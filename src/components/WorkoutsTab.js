import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const NINJA_KEY = process.env.REACT_APP_NINJA_API_KEY;
const WORKOUT_TYPES = ['Strength', 'Cardio', 'HIIT', 'Yoga', 'Walk/Run', 'Cycling', 'Other'];
const MUSCLES = ['any', 'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals', 'lower_back', 'traps', 'lats', 'forearms'];
const EQUIPMENT = ['any', 'barbell', 'dumbbell', 'bodyweight', 'machine', 'cable', 'kettlebell', 'resistance_band', 'medicine_ball'];
const DIFFICULTY = ['any', 'beginner', 'intermediate', 'expert'];

export default function WorkoutsTab() {
  const { profile } = useAuth();
  const [log, setLog] = useState([]);
  const [type, setType] = useState('Strength');
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ name: '', duration: '', notes: '', date: today });
  const [loading, setLoading] = useState(true);

  // Exercise search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [muscle, setMuscle] = useState('any');
  const [equipment, setEquipment] = useState('any');
  const [difficulty, setDifficulty] = useState('any');
  const [exercises, setExercises] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const searchTimeout = useRef(null);

  useEffect(() => {
    if (profile) fetchLog();
  }, [profile]);

  async function fetchLog() {
    setLoading(true);
    const { data } = await supabase.from('workout_log').select('*').eq('user_id', profile.id).order('date', { ascending: false }).limit(20);
    setLog(data || []);
    setLoading(false);
  }

  async function searchExercises() {
    setSearching(true);
    setSelectedExercise(null);
    try {
      let url = 'https://api.api-ninjas.com/v1/exercises?limit=15';
      if (searchQuery.trim()) url += `&name=${encodeURIComponent(searchQuery.trim())}`;
      if (muscle !== 'any') url += `&muscle=${muscle}`;
      if (equipment !== 'any') url += `&equipment=${equipment}`;
      if (difficulty !== 'any') url += `&difficulty=${difficulty}`;
      // API requires at least one filter — default to chest if nothing selected
      if (!searchQuery.trim() && muscle === 'any' && equipment === 'any' && difficulty === 'any') {
        url += '&muscle=chest';
      }

      const res = await fetch(url, { headers: { 'X-Api-Key': NINJA_KEY } });
      const data = await res.json();
      setExercises(Array.isArray(data) ? data : []);
    } catch { setExercises([]); }
    setSearching(false);
  }

  function handleSearchInput(e) {
    setSearchQuery(e.target.value);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(searchExercises, 600);
  }

  function selectExercise(ex) {
    setForm(f => ({ ...f, name: ex.name }));
    // Map exercise type to workout type
    const typeMap = { 'cardio': 'Cardio', 'olympic_weightlifting': 'Strength', 'powerlifting': 'Strength', 'strength': 'Strength', 'stretching': 'Yoga', 'plyometrics': 'HIIT' };
    if (typeMap[ex.type]) setType(typeMap[ex.type]);
    setSelectedExercise(ex);
    setShowSearch(false);
  }

  async function addWorkout() {
    if (!form.name) return;
    const entry = { user_id: profile.id, name: form.name, type, duration: form.duration ? parseInt(form.duration) : null, notes: form.notes || null, date: form.date || today };
    const { data } = await supabase.from('workout_log').insert(entry).select().single();
    if (data) setLog(l => [data, ...l]);
    setForm({ name: '', duration: '', notes: '', date: today });
    setSelectedExercise(null);
  }

  async function removeWorkout(id) {
    await supabase.from('workout_log').delete().eq('id', id);
    setLog(l => l.filter(w => w.id !== id));
  }

  const muscleLabel = (m) => m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div>
      <div className="card">
        <div className="section-hdr">
          <span className="card-title" style={{ margin: 0 }}>Log a workout</span>
          <button className="btn btn-sm" onClick={() => { setShowSearch(!showSearch); if (!showSearch && !exercises.length) searchExercises(); }}>
            <i className="ti ti-search" style={{ fontSize: '13px', marginRight: '4px' }} />
            {showSearch ? 'Hide search' : 'Find exercises'}
          </button>
        </div>

        {/* Exercise search */}
        {showSearch && (
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px', marginBottom: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label>Muscle group</label>
                <select value={muscle} onChange={e => { setMuscle(e.target.value); setTimeout(searchExercises, 100); }}>
                  {MUSCLES.map(m => <option key={m} value={m}>{m === 'any' ? 'Any muscle' : muscleLabel(m)}</option>)}
                </select>
              </div>
              <div>
                <label>Equipment</label>
                <select value={equipment} onChange={e => { setEquipment(e.target.value); setTimeout(searchExercises, 100); }}>
                  {EQUIPMENT.map(e => <option key={e} value={e}>{e === 'any' ? 'Any equipment' : muscleLabel(e)}</option>)}
                </select>
              </div>
              <div>
                <label>Difficulty</label>
                <select value={difficulty} onChange={e => { setDifficulty(e.target.value); setTimeout(searchExercises, 100); }}>
                  {DIFFICULTY.map(d => <option key={d} value={d}>{d === 'any' ? 'Any level' : muscleLabel(d)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <input placeholder="Search by name… e.g. 'squat', 'bench press', 'curl'" value={searchQuery} onChange={handleSearchInput} />
              {searching && <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}><i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite', display: 'inline-block', color: 'var(--text-secondary)' }} /></div>}
            </div>
            <button className="btn btn-primary btn-sm" onClick={searchExercises} style={{ marginBottom: '10px' }}>
              <i className="ti ti-search" style={{ fontSize: '12px', marginRight: '4px' }} />Search
            </button>

            {exercises.length > 0 && (
              <div style={{ maxHeight: '320px', overflowY: 'auto', border: '0.5px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                {exercises.map((ex, i) => (
                  <div key={i} onClick={() => selectExercise(ex)}
                    style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: i < exercises.length - 1 ? '0.5px solid var(--border)' : 'none', background: 'var(--bg-primary)', transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-primary)'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500', flex: 1, textTransform: 'capitalize' }}>{ex.name}</span>
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: '#E1F5EE', color: '#0F6E56', flexShrink: 0, textTransform: 'capitalize' }}>{ex.difficulty}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      {ex.muscle && <span>💪 {muscleLabel(ex.muscle)}</span>}
                      {ex.equipment && <span>🏋️ {muscleLabel(ex.equipment)}</span>}
                      {ex.type && <span>📋 {muscleLabel(ex.type)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!searching && exercises.length === 0 && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', padding: '12px' }}>
                No exercises found — try different filters
              </div>
            )}
          </div>
        )}

        {/* Show selected exercise instructions */}
        {selectedExercise && (
          <div style={{ background: '#E1F5EE', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#085041', marginBottom: '4px', textTransform: 'capitalize' }}>
              📋 {selectedExercise.name}
            </div>
            {selectedExercise.instructions && (
              <div style={{ fontSize: '12px', color: '#0F6E56', lineHeight: '1.6' }}>
                {selectedExercise.instructions.slice(0, 300)}{selectedExercise.instructions.length > 300 ? '…' : ''}
              </div>
            )}
            <button className="btn btn-sm" style={{ marginTop: '8px', fontSize: '11px' }} onClick={() => setSelectedExercise(null)}>Dismiss</button>
          </div>
        )}

        <div className="workout-type">
          {WORKOUT_TYPES.map(t => (
            <button key={t} className={`type-chip${type === t ? ' active' : ''}`} onClick={() => setType(t)}>{t}</button>
          ))}
        </div>
        <div className="form-row2">
          <div><label>Workout name</label><input placeholder="e.g. Barbell Back Squat" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label>Duration (min)</label><input type="number" placeholder="45" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} /></div>
          <div><label>Date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <button className="btn btn-primary" style={{ marginTop: '18px' }} onClick={addWorkout}>
            <i className="ti ti-plus" style={{ fontSize: '16px' }} />
          </button>
        </div>
        <div>
          <label>Notes (sets, reps, distance, etc.)</label>
          <input placeholder="e.g. 3x10 at 135lb, 20 min run" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ marginTop: '3px' }} />
        </div>
      </div>

      {!loading && log.length > 0 && (
        <div className="card">
          <div className="card-title">Recent workouts</div>
          {log.map(w => (
            <div key={w.id} className="log-item">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>{w.name}</span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: '#E1F5EE', color: '#0F6E56' }}>{w.type}</span>
                </div>
                {w.notes && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{w.notes}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{w.date}</div>
                {w.duration && <div style={{ fontSize: '12px', fontWeight: '500' }}>{w.duration} min</div>}
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => removeWorkout(w.id)}>
                <i className="ti ti-trash" style={{ fontSize: '13px' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && log.length === 0 && <div className="empty">No workouts logged yet. Search for an exercise or add one above!</div>}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
