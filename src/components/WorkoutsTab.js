import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const WORKOUT_TYPES = ['Strength', 'Cardio', 'HIIT', 'Yoga', 'Walk/Run', 'Cycling', 'Other'];

export default function WorkoutsTab() {
  const { profile } = useAuth();
  const [log, setLog] = useState([]);
  const [type, setType] = useState('Strength');
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ name: '', duration: '', notes: '', date: today });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchLog();
  }, [profile]);

  async function fetchLog() {
    setLoading(true);
    const { data } = await supabase
      .from('workout_log')
      .select('*')
      .eq('user_id', profile.id)
      .order('date', { ascending: false })
      .limit(20);
    setLog(data || []);
    setLoading(false);
  }

  async function addWorkout() {
    if (!form.name) return;
    const entry = {
      user_id: profile.id,
      name: form.name,
      type,
      duration: form.duration ? parseInt(form.duration) : null,
      notes: form.notes || null,
      date: form.date || today,
    };
    const { data } = await supabase.from('workout_log').insert(entry).select().single();
    if (data) setLog(l => [data, ...l]);
    setForm({ name: '', duration: '', notes: '', date: today });
  }

  async function removeWorkout(id) {
    await supabase.from('workout_log').delete().eq('id', id);
    setLog(l => l.filter(w => w.id !== id));
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">Log a workout</div>
        <div className="workout-type">
          {WORKOUT_TYPES.map(t => (
            <button key={t} className={`type-chip${type === t ? ' active' : ''}`} onClick={() => setType(t)}>{t}</button>
          ))}
        </div>
        <div className="form-row2">
          <div><label>Workout name</label><input placeholder="e.g. Upper body push" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label>Duration (min)</label><input type="number" placeholder="45" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} /></div>
          <div><label>Date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <button className="btn btn-primary" style={{ marginTop: '18px' }} onClick={addWorkout}>
            <i className="ti ti-plus" style={{ fontSize: '16px' }} />
          </button>
        </div>
        <div>
          <label>Notes (sets, reps, distance, etc.)</label>
          <input placeholder="e.g. 3x10 squats at 135lb, 20 min run" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ marginTop: '3px' }} />
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
                {w.notes && <div style={{ fontSize: '12px', color: 'var(--color-text-secondary,#888)', marginTop: '2px' }}>{w.notes}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary,#888)' }}>{w.date}</div>
                {w.duration && <div style={{ fontSize: '12px', fontWeight: '500' }}>{w.duration} min</div>}
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => removeWorkout(w.id)}>
                <i className="ti ti-trash" style={{ fontSize: '13px' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && log.length === 0 && (
        <div className="empty">No workouts logged yet. Add your first one above!</div>
      )}
    </div>
  );
}
