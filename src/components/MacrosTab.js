import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const USDA_KEY = process.env.REACT_APP_USDA_API_KEY;

export default function MacrosTab() {
  const { profile, updateGoals } = useAuth();
  const [log, setLog] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [water, setWater] = useState({ glasses: 0, goal: 8, id: null });
  const [form, setForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  const [showGoals, setShowGoals] = useState(false);
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [goals, setGoals] = useState(profile?.macro_goals || { calories: 1800, protein: 140, carbs: 180, fat: 60 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchSource, setSearchSource] = useState('all');
  const searchTimeout = useRef(null);

  // TDEE calculator state
  const [calc, setCalc] = useState({ weight: '', height: '', age: '', sex: 'male', activity: '1.375', goal: 'lose' });

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (profile) {
      setGoals(profile.macro_goals);
      fetchLog();
      fetchTemplates();
      fetchWater();
    }
  }, [profile]);

  async function fetchLog() {
    setLoading(true);
    const { data } = await supabase.from('macro_log').select('*').eq('user_id', profile.id).eq('date', today).order('created_at', { ascending: true });
    setLog(data || []);
    setLoading(false);
  }

  async function fetchTemplates() {
    const { data } = await supabase.from('meal_templates').select('*').eq('user_id', profile.id).order('name');
    setTemplates(data || []);
  }

  async function fetchWater() {
    const { data } = await supabase.from('water_log').select('*').eq('user_id', profile.id).eq('date', today).single();
    if (data) setWater({ glasses: data.glasses, goal: data.goal, id: data.id });
  }

  async function updateWater(newGlasses) {
    const clamped = Math.max(0, newGlasses);
    if (water.id) {
      await supabase.from('water_log').update({ glasses: clamped }).eq('id', water.id);
    } else {
      const { data } = await supabase.from('water_log').insert({ user_id: profile.id, date: today, glasses: clamped, goal: water.goal }).select().single();
      if (data) setWater(w => ({ ...w, id: data.id }));
    }
    setWater(w => ({ ...w, glasses: clamped }));
  }

  async function saveTemplate() {
    if (!form.name || !form.calories) return;
    const t = { user_id: profile.id, name: form.name, calories: parseInt(form.calories) || 0, protein: parseInt(form.protein) || 0, carbs: parseInt(form.carbs) || 0, fat: parseInt(form.fat) || 0 };
    const { data } = await supabase.from('meal_templates').insert(t).select().single();
    if (data) setTemplates(ts => [...ts, data].sort((a, b) => a.name.localeCompare(b.name)));
    alert(`"${form.name}" saved as a meal template!`);
  }

  async function deleteTemplate(id) {
    await supabase.from('meal_templates').delete().eq('id', id);
    setTemplates(ts => ts.filter(t => t.id !== id));
  }

  function applyTemplate(t) {
    setForm({ name: t.name, calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat });
    setShowTemplates(false);
  }

  function calculateTDEE() {
    const w = parseFloat(calc.weight);
    const h = parseFloat(calc.height);
    const a = parseFloat(calc.age);
    if (!w || !h || !a) return;
    // Mifflin-St Jeor BMR
    const bmr = calc.sex === 'male'
      ? 10 * w + 6.25 * h - 5 * a + 5
      : 10 * w + 6.25 * h - 5 * a - 161;
    const tdee = Math.round(bmr * parseFloat(calc.activity));
    let targetCal = tdee;
    if (calc.goal === 'lose') targetCal = Math.round(tdee * 0.8);
    if (calc.goal === 'gain') targetCal = Math.round(tdee * 1.1);
    // Macro split: 30% protein, 40% carbs, 30% fat
    const protein = Math.round((targetCal * 0.30) / 4);
    const carbs = Math.round((targetCal * 0.40) / 4);
    const fat = Math.round((targetCal * 0.30) / 9);
    setGoals({ calories: targetCal, protein, carbs, fat });
    setShowCalcModal(false);
    setShowGoals(true);
  }

  async function searchOpenFoodFacts(query) {
    try {
      const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=6&fields=product_name,brands,nutriments,serving_size,serving_quantity`);
      const data = await res.json();
      return (data.products || []).filter(p => p.product_name && p.nutriments).map(p => {
        const n = p.nutriments;
        const serving = p.serving_quantity || 100;
        const factor = serving / 100;
        return { name: p.product_name + (p.brands ? ` (${p.brands.split(',')[0].trim()})` : ''), serving: p.serving_size || `${serving}g`, calories: Math.round((n['energy-kcal_serving'] || n['energy-kcal_100g'] * factor) || 0), protein: Math.round((n['proteins_serving'] || n['proteins_100g'] * factor) || 0), carbs: Math.round((n['carbohydrates_serving'] || n['carbohydrates_100g'] * factor) || 0), fat: Math.round((n['fat_serving'] || n['fat_100g'] * factor) || 0), source: 'Open Food Facts' };
      }).filter(p => p.calories > 0);
    } catch { return []; }
  }

  async function searchUSDA(query) {
    if (!USDA_KEY) return [];
    try {
      const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&dataType=Branded,SR%20Legacy&pageSize=6&api_key=${USDA_KEY}`);
      const data = await res.json();
      return (data.foods || []).map(food => {
        const get = (name) => { const n = food.foodNutrients?.find(n => n.nutrientName === name); return n ? Math.round(n.value || 0) : 0; };
        return { name: food.description + (food.brandOwner ? ` (${food.brandOwner})` : ''), serving: food.servingSize ? `${food.servingSize}${food.servingSizeUnit || 'g'}` : '100g', calories: get('Energy'), protein: get('Protein'), carbs: get('Carbohydrate, by difference'), fat: get('Total lipid (fat)'), source: 'USDA' };
      }).filter(p => p.calories > 0);
    } catch { return []; }
  }

  async function searchFood(query) {
    if (!query || query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      let results = [];
      if (searchSource === 'all') {
        const [off, usda] = await Promise.all([searchOpenFoodFacts(query), searchUSDA(query)]);
        const maxLen = Math.max(off.length, usda.length);
        for (let i = 0; i < maxLen; i++) { if (usda[i]) results.push(usda[i]); if (off[i]) results.push(off[i]); }
        results = results.slice(0, 12);
      } else if (searchSource === 'usda') {
        results = await searchUSDA(query);
      } else {
        results = await searchOpenFoodFacts(query);
      }
      setSearchResults(results);
    } catch { setSearchResults([]); }
    setSearching(false);
  }

  function handleSearchInput(e) {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchFood(q), 500);
  }

  function selectFood(food) {
    setForm({ name: food.name, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat });
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  }

  async function addEntry() {
    if (!form.name || !form.calories) return;
    const entry = { user_id: profile.id, date: today, name: form.name, calories: parseInt(form.calories) || 0, protein: parseInt(form.protein) || 0, carbs: parseInt(form.carbs) || 0, fat: parseInt(form.fat) || 0 };
    const { data } = await supabase.from('macro_log').insert(entry).select().single();
    if (data) setLog(l => [...l, data]);
    setForm({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  }

  async function removeEntry(id) {
    await supabase.from('macro_log').delete().eq('id', id);
    setLog(l => l.filter(e => e.id !== id));
  }

  async function saveGoals() {
    await updateGoals(goals);
    setShowGoals(false);
  }

  const totals = log.reduce((a, e) => ({ calories: a.calories + (e.calories || 0), protein: a.protein + (e.protein || 0), carbs: a.carbs + (e.carbs || 0), fat: a.fat + (e.fat || 0) }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const g = goals;
  const pct = (v, max) => Math.min(100, Math.round((v / (max || 1)) * 100));
  const sourceColors = { 'USDA': '#185FA5', 'Open Food Facts': '#3B6D11' };
  const waterPct = Math.min(100, Math.round((water.glasses / water.goal) * 100));

  return (
    <div>
      {/* Macro summary */}
      <div className="card">
        <div className="section-hdr">
          <span className="card-title" style={{ margin: 0 }}>Today's macros</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn btn-sm" onClick={() => setShowCalcModal(true)}>
              <i className="ti ti-calculator" style={{ fontSize: '13px', marginRight: '4px' }} />Calculate
            </button>
            <button className="btn btn-sm" onClick={() => setShowGoals(!showGoals)}>
              <i className="ti ti-settings" style={{ fontSize: '13px', marginRight: '4px' }} />Goals
            </button>
          </div>
        </div>

        {showCalcModal && (
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px' }}>
              <i className="ti ti-calculator" style={{ marginRight: '6px', color: '#1D9E75' }} />
              Calorie & macro calculator
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div><label>Weight (kg)</label><input type="number" placeholder="75" value={calc.weight} onChange={e => setCalc({ ...calc, weight: e.target.value })} /></div>
              <div><label>Height (cm)</label><input type="number" placeholder="170" value={calc.height} onChange={e => setCalc({ ...calc, height: e.target.value })} /></div>
              <div><label>Age</label><input type="number" placeholder="30" value={calc.age} onChange={e => setCalc({ ...calc, age: e.target.value })} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div>
                <label>Sex</label>
                <select value={calc.sex} onChange={e => setCalc({ ...calc, sex: e.target.value })}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label>Activity level</label>
                <select value={calc.activity} onChange={e => setCalc({ ...calc, activity: e.target.value })}>
                  <option value="1.2">Sedentary</option>
                  <option value="1.375">Lightly active</option>
                  <option value="1.55">Moderately active</option>
                  <option value="1.725">Very active</option>
                  <option value="1.9">Extra active</option>
                </select>
              </div>
              <div>
                <label>Goal</label>
                <select value={calc.goal} onChange={e => setCalc({ ...calc, goal: e.target.value })}>
                  <option value="lose">Lose weight</option>
                  <option value="maintain">Maintain</option>
                  <option value="gain">Gain muscle</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-primary btn-sm" onClick={calculateTDEE}>Calculate & apply goals</button>
              <button className="btn btn-sm" onClick={() => setShowCalcModal(false)}>Cancel</button>
            </div>
          </div>
        )}

        {showGoals && (
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
            <div className="form-row">
              {['calories', 'protein', 'carbs', 'fat'].map(k => (
                <div key={k}>
                  <label>{k.charAt(0).toUpperCase() + k.slice(1)}{k !== 'calories' ? ' (g)' : ''}</label>
                  <input type="number" value={goals[k]} onChange={e => setGoals({ ...goals, [k]: +e.target.value })} />
                </div>
              ))}
              <div />
              <button className="btn btn-primary btn-sm" style={{ marginTop: '18px' }} onClick={saveGoals}>Save</button>
            </div>
          </div>
        )}

        <div className="macro-grid">
          {[
            { key: 'calories', label: 'Calories', color: '#1D9E75', cls: 'macro-cal' },
            { key: 'protein', label: 'Protein (g)', color: '#3B6D11', cls: 'macro-pro' },
            { key: 'carbs', label: 'Carbs (g)', color: '#BA7517', cls: 'macro-carb' },
            { key: 'fat', label: 'Fat (g)', color: '#185FA5', cls: 'macro-fat' },
          ].map(m => (
            <div key={m.key} className="macro-cell">
              <div className={`macro-val ${m.cls}`}>{totals[m.key]}</div>
              <div className="macro-lbl">/ {g[m.key]} {m.label}</div>
              <div className="bar-wrap"><div className="bar" style={{ width: `${pct(totals[m.key], g[m.key])}%`, background: m.color }} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* Water tracker */}
      <div className="card">
        <div className="section-hdr">
          <span className="card-title" style={{ margin: 0 }}>
            <i className="ti ti-droplet" style={{ marginRight: '5px', color: '#378ADD' }} />Water intake
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{water.glasses} / {water.goal} glasses</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {Array.from({ length: water.goal }).map((_, i) => (
            <button key={i} onClick={() => updateWater(i < water.glasses ? i : i + 1)}
              style={{ width: '36px', height: '36px', borderRadius: '8px', border: '0.5px solid var(--border)', background: i < water.glasses ? '#378ADD' : 'var(--bg-secondary)', cursor: 'pointer', fontSize: '16px', transition: 'all .15s' }}>
              {i < water.glasses ? '💧' : '○'}
            </button>
          ))}
        </div>
        <div className="bar-wrap">
          <div className="bar" style={{ width: `${waterPct}%`, background: '#378ADD' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Daily goal:</span>
          <button className="btn btn-sm" onClick={() => setWater(w => ({ ...w, goal: Math.max(1, w.goal - 1) }))}>−</button>
          <span style={{ fontSize: '13px', fontWeight: '500' }}>{water.goal} glasses</span>
          <button className="btn btn-sm" onClick={() => setWater(w => ({ ...w, goal: w.goal + 1 }))}>+</button>
        </div>
      </div>

      {/* Food log */}
      <div className="card">
        <div className="section-hdr">
          <span className="card-title" style={{ margin: 0 }}>Log food</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn btn-sm" onClick={() => { setShowTemplates(!showTemplates); setShowSearch(false); }}>
              <i className="ti ti-bookmark" style={{ fontSize: '13px', marginRight: '4px' }} />My meals
            </button>
            <button className="btn btn-sm" onClick={() => { setShowSearch(!showSearch); setShowTemplates(false); setSearchQuery(''); setSearchResults([]); }}>
              <i className="ti ti-search" style={{ fontSize: '13px', marginRight: '4px' }} />Search
            </button>
          </div>
        </div>

        {/* Meal templates */}
        {showTemplates && (
          <div style={{ marginBottom: '14px' }}>
            {templates.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '12px', textAlign: 'center' }}>
                No saved meals yet. Fill in the form below and click "Save as template" to save a meal!
              </div>
            ) : (
              <div style={{ border: '0.5px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                {templates.map((t, i) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderBottom: i < templates.length - 1 ? '0.5px solid var(--border)' : 'none', background: 'var(--bg-primary)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>{t.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.calories} cal · {t.protein}g pro · {t.carbs}g carbs · {t.fat}g fat</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => applyTemplate(t)}>Add</button>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteTemplate(t.id)}><i className="ti ti-trash" style={{ fontSize: '13px' }} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Food search */}
        {showSearch && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              {[['all', 'All sources'], ['usda', 'USDA (restaurants)'], ['off', 'Open Food Facts']].map(([val, label]) => (
                <button key={val} className={`type-chip${searchSource === val ? ' active' : ''}`}
                  onClick={() => { setSearchSource(val); if (searchQuery.length > 1) searchFood(searchQuery); }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative' }}>
              <input placeholder="Search foods… e.g. 'Big Mac', 'Greek yogurt'" value={searchQuery} onChange={handleSearchInput} autoFocus />
              {searching && <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-secondary)' }}><i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} /></div>}
            </div>
            {searchResults.length > 0 && (
              <div style={{ marginTop: '8px', border: '0.5px solid var(--border)', borderRadius: '10px', overflow: 'hidden', maxHeight: '300px', overflowY: 'auto' }}>
                {searchResults.map((food, i) => (
                  <div key={i} onClick={() => selectFood(food)}
                    style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: i < searchResults.length - 1 ? '0.5px solid var(--border)' : 'none', background: 'var(--bg-primary)', transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-primary)'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500', flex: 1 }}>{food.name}</span>
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: sourceColors[food.source] + '20', color: sourceColors[food.source], flexShrink: 0 }}>{food.source}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span>per {food.serving}</span>
                      <span style={{ color: '#1D9E75' }}><b>{food.calories}</b> cal</span>
                      <span><b>{food.protein}</b>g pro</span>
                      <span><b>{food.carbs}</b>g carbs</span>
                      <span><b>{food.fat}</b>g fat</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {searchQuery.length > 1 && !searching && searchResults.length === 0 && (
              <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', padding: '12px' }}>No results — try different terms or enter manually</div>
            )}
          </div>
        )}

        <div className="form-row">
          <div><label>Food / meal</label><input placeholder="e.g. Chicken & rice" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && addEntry()} /></div>
          <div><label>Calories</label><input type="number" placeholder="0" value={form.calories} onChange={e => setForm({ ...form, calories: e.target.value })} /></div>
          <div><label>Protein</label><input type="number" placeholder="0" value={form.protein} onChange={e => setForm({ ...form, protein: e.target.value })} /></div>
          <div><label>Carbs</label><input type="number" placeholder="0" value={form.carbs} onChange={e => setForm({ ...form, carbs: e.target.value })} /></div>
          <div><label>Fat</label><input type="number" placeholder="0" value={form.fat} onChange={e => setForm({ ...form, fat: e.target.value })} /></div>
          <button className="btn btn-primary" style={{ marginTop: '18px' }} onClick={addEntry}><i className="ti ti-plus" style={{ fontSize: '16px' }} /></button>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <button className="btn btn-sm" onClick={saveTemplate} disabled={!form.name || !form.calories}>
            <i className="ti ti-bookmark" style={{ fontSize: '12px', marginRight: '4px' }} />Save as template
          </button>
        </div>
      </div>

      {!loading && log.length > 0 && (
        <div className="card">
          <div className="card-title">Today's food log</div>
          {log.map(e => (
            <div key={e.id} className="log-item">
              <div className="log-name">{e.name}</div>
              <div className="log-macros">
                <div className="log-macro"><b>{e.calories}</b> cal</div>
                <div className="log-macro"><b>{e.protein}</b>g pro</div>
                <div className="log-macro"><b>{e.carbs}</b>g carb</div>
                <div className="log-macro"><b>{e.fat}</b>g fat</div>
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => removeEntry(e.id)}><i className="ti ti-trash" style={{ fontSize: '13px' }} /></button>
            </div>
          ))}
        </div>
      )}

      {!loading && log.length === 0 && <div className="empty">No meals logged today — search or add one manually above!</div>}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
