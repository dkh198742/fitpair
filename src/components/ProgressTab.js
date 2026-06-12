import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import Chart from 'chart.js/auto';

export default function ProgressTab() {
  const { profile } = useAuth();
  const [weightLog, setWeightLog] = useState([]);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [mealCount, setMealCount] = useState(0);
  const [weight, setWeight] = useState('');
  const [wdate, setWdate] = useState(new Date().toISOString().slice(0, 10));
  const chartRef = useRef(null);
  const chartInst = useRef(null);

  useEffect(() => {
    if (profile) {
      fetchWeightLog();
      fetchStats();
    }
  }, [profile]);

  useEffect(() => {
    if (!chartRef.current) return;
    const logs = [...weightLog].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
    if (logs.length < 1) return;
    chartInst.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: logs.map(l => l.date.slice(5)),
        datasets: [{
          label: 'Weight (lbs)',
          data: logs.map(l => l.weight),
          borderColor: '#1D9E75',
          backgroundColor: 'rgba(29,158,117,.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#1D9E75',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { font: { size: 11 } } },
          x: { ticks: { font: { size: 11 }, maxRotation: 45 } },
        },
      },
    });
    return () => { if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; } };
  }, [weightLog]);

  async function fetchWeightLog() {
    const { data } = await supabase
      .from('weight_log')
      .select('*')
      .eq('user_id', profile.id)
      .order('date', { ascending: true });
    setWeightLog(data || []);
  }

  async function fetchStats() {
    const [{ count: wc }, { count: mc }] = await Promise.all([
      supabase.from('workout_log').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
      supabase.from('macro_log').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
    ]);
    setWorkoutCount(wc || 0);
    setMealCount(mc || 0);
  }

  async function addWeight() {
    if (!weight) return;
    const entry = { user_id: profile.id, date: wdate, weight: parseFloat(weight) };
    const { data } = await supabase.from('weight_log').insert(entry).select().single();
    if (data) setWeightLog(l => [...l, data].sort((a, b) => a.date.localeCompare(b.date)));
    setWeight('');
  }

  const first = weightLog[0]?.weight;
  const last = weightLog[weightLog.length - 1]?.weight;
  const diff = first && last ? +(last - first).toFixed(1) : null;

  return (
    <div>
      <div className="card">
        <div className="macro-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <div className="macro-cell">
            <div className="macro-val" style={{ color: '#1D9E75' }}>{workoutCount}</div>
            <div className="macro-lbl">workouts logged</div>
          </div>
          <div className="macro-cell">
            <div className="macro-val" style={{ color: '#185FA5' }}>{mealCount}</div>
            <div className="macro-lbl">meals logged</div>
          </div>
          <div className="macro-cell">
            <div className="macro-val" style={{ color: diff === null ? 'inherit' : diff <= 0 ? '#1D9E75' : '#A32D2D' }}>
              {diff === null ? '—' : (diff > 0 ? '+' : '') + diff + ' lb'}
            </div>
            <div className="macro-lbl">weight change</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-hdr">
          <span className="card-title" style={{ margin: 0 }}>Weight log</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="number" placeholder="lbs" value={weight} onChange={e => setWeight(e.target.value)} style={{ width: '70px' }} />
            <input type="date" value={wdate} onChange={e => setWdate(e.target.value)} style={{ width: '130px' }} />
            <button className="btn btn-primary btn-sm" onClick={addWeight}>Log</button>
          </div>
        </div>
        {weightLog.length > 0 ? (
          <div style={{ position: 'relative', height: '220px', marginTop: '12px' }}>
            <canvas ref={chartRef} role="img" aria-label="Weight over time line chart" />
          </div>
        ) : (
          <div className="empty">Log your first weight to see your progress chart</div>
        )}
      </div>

      {weightLog.length > 0 && (
        <div className="card">
          <div className="card-title">Recent entries</div>
          {[...weightLog].reverse().slice(0, 10).map(e => (
            <div key={e.id} className="log-item">
              <div className="log-name">{e.date}</div>
              <div style={{ fontWeight: '500' }}>{e.weight} lbs</div>
              <button className="btn btn-sm btn-danger" onClick={async () => {
                await supabase.from('weight_log').delete().eq('id', e.id);
                setWeightLog(l => l.filter(x => x.id !== e.id));
              }}>
                <i className="ti ti-trash" style={{ fontSize: '13px' }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
