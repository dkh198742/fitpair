import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export default function MacrosTab() {
  const { profile, updateGoals } = useAuth();
  const [log, setLog] = useState([]);
  const [form, setForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  const [showGoals, setShowGoals] = useState(false);
  const [goals, setGoals] = useState(profile?.macro_goals || { calories: 1800, protein: 140, carbs: 180, fat: 60 });
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (profile) {
      setGoals(profile.macro_goals);
      fetchLog();
    }
  }, [profile]);

  async function fetchLog() {
    setLoading(true);
    const { data } = await supabase
      .from('macro_log')
      .select('*')
      .eq('user_id', profile.id)
      .eq('date', today)
      .order('created_at', { ascending: true });
    setLog(data || []);
    setLoading(false);
  }

  async function addEntry() {
    if (!form.name || !form.calories) return;
    const entry = {
      user_id: profile.id,
      date: today,
      name: form.name,
      calories: parseInt(form.calories) || 0,
      protein: parseInt(form.protein) || 0,
      carbs: parseInt(form.carbs) || 0,
      fat: parseInt(form.fat) || 0,
    };
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

  const totals = log.reduce((a, e) => ({
    calories: a.calories + (e.calories || 0),
    protein: a.protein + (e.protein || 0),
    carbs: a.carbs + (e.carbs || 0),
    fat: a.fat + (e.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const g = goals;
  const pct = (v, max) => Math.min(100, Math.round((v / (max || 1)) * 100));

  return (
    <div>
      <div className="card">
        <div className="section-hdr">
          <span className="card-title" style={{ margin: 0 }}>Today's macros</span>
          <button className="btn btn-sm" onClick={() => setShowGoals(!showGoals)}>
            <i className="ti ti-settings" style={{ fontSize: '13px', marginRight: '4px' }} />Goals
          </button>
        </div>

        {showGoals && (
          <div style={{ background: 'var(--color-background-secondary,#f5f5f3)', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
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
              <div className="bar-wrap">
                <div className="bar" style={{ width: `${pct(totals[m.key], g[m.key])}%`, background: m.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Log food</div>
        <div className="form-row">
          <div><label>Food / meal</label><input placeholder="e.g. Chicken & rice" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && addEntry()} /></div>
          <div><label>Calories</label><input type="number" placeholder="0" value={form.calories} onChange={e => setForm({ ...form, calories: e.target.value })} /></div>
          <div><label>Protein</label><input type="number" placeholder="0" value={form.protein} onChange={e => setForm({ ...form, protein: e.target.value })} /></div>
          <div><label>Carbs</label><input type="number" placeholder="0" value={form.carbs} onChange={e => setForm({ ...form, carbs: e.target.value })} /></div>
          <div><label>Fat</label><input type="number" placeholder="0" value={form.fat} onChange={e => setForm({ ...form, fat: e.target.value })} /></div>
          <button className="btn btn-primary" style={{ marginTop: '18px' }} onClick={addEntry}>
            <i className="ti ti-plus" style={{ fontSize: '16px' }} />
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
              <button className="btn btn-sm btn-danger" onClick={() => removeEntry(e.id)}>
                <i className="ti ti-trash" style={{ fontSize: '13px' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && log.length === 0 && (
        <div className="empty">No meals logged today — add your first one above!</div>
      )}
    </div>
  );
}
