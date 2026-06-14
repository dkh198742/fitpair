import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import Chart from 'chart.js/auto';

export default function WeeklyTab() {
  const { profile, partner } = useAuth();
  const [weekData, setWeekData] = useState([]);
  const [partnerWeekData, setPartnerWeekData] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const calChartRef = useRef(null);
  const proChartRef = useRef(null);
  const calChartInst = useRef(null);
  const proChartInst = useRef(null);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    if (profile) { fetchWeekData(); fetchWorkouts(); }
  }, [profile]);

  async function fetchWeekData() {
    setLoading(true);
    const { data } = await supabase.from('macro_log').select('date,calories,protein,carbs,fat').eq('user_id', profile.id).gte('date', days[0]).lte('date', days[6]);
    const grouped = days.map(d => {
      const entries = (data || []).filter(e => e.date === d);
      return { date: d, calories: entries.reduce((s, e) => s + e.calories, 0), protein: entries.reduce((s, e) => s + e.protein, 0), carbs: entries.reduce((s, e) => s + e.carbs, 0), fat: entries.reduce((s, e) => s + e.fat, 0) };
    });
    setWeekData(grouped);

    if (partner) {
      const { data: pd } = await supabase.from('macro_log').select('date,calories,protein').eq('user_id', partner.id).gte('date', days[0]).lte('date', days[6]);
      const pgrouped = days.map(d => {
        const entries = (pd || []).filter(e => e.date === d);
        return { date: d, calories: entries.reduce((s, e) => s + e.calories, 0), protein: entries.reduce((s, e) => s + e.protein, 0) };
      });
      setPartnerWeekData(pgrouped);
    }
    setLoading(false);
  }

  async function fetchWorkouts() {
    const { data } = await supabase.from('workout_log').select('date,name,type,duration').eq('user_id', profile.id).gte('date', days[0]).lte('date', days[6]);
    setWorkouts(data || []);
  }

  useEffect(() => {
    if (!weekData.length || !calChartRef.current) return;
    const labels = days.map(d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }));
    const goalCal = profile?.macro_goals?.calories || 1800;

    if (calChartInst.current) calChartInst.current.destroy();
    calChartInst.current = new Chart(calChartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: profile?.display_name || 'You', data: weekData.map(d => d.calories), backgroundColor: 'rgba(29,158,117,.7)', borderRadius: 6 },
          ...(partnerWeekData.length ? [{ label: partner?.display_name || 'Partner', data: partnerWeekData.map(d => d.calories), backgroundColor: 'rgba(55,138,221,.7)', borderRadius: 6 }] : []),
          { label: 'Goal', data: days.map(() => goalCal), type: 'line', borderColor: '#BA7517', borderDash: [4, 4], pointRadius: 0, borderWidth: 1.5, fill: false },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, scales: { y: { ticks: { font: { size: 11 } } }, x: { ticks: { font: { size: 10 } } } } },
    });

    if (proChartInst.current) proChartInst.current.destroy();
    proChartInst.current = new Chart(proChartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: profile?.display_name || 'You', data: weekData.map(d => d.protein), backgroundColor: 'rgba(59,109,17,.7)', borderRadius: 6 },
          ...(partnerWeekData.length ? [{ label: partner?.display_name || 'Partner', data: partnerWeekData.map(d => d.protein), backgroundColor: 'rgba(55,138,221,.5)', borderRadius: 6 }] : []),
          { label: 'Goal', data: days.map(() => profile?.macro_goals?.protein || 140), type: 'line', borderColor: '#BA7517', borderDash: [4, 4], pointRadius: 0, borderWidth: 1.5, fill: false },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, scales: { y: { ticks: { font: { size: 11 } } }, x: { ticks: { font: { size: 10 } } } } },
    });

    return () => { if (calChartInst.current) calChartInst.current.destroy(); if (proChartInst.current) proChartInst.current.destroy(); };
  }, [weekData, partnerWeekData]);

  if (loading) return <div className="empty">Loading weekly data…</div>;

  const avg = (key) => weekData.length ? Math.round(weekData.filter(d => d[key] > 0).reduce((s, d) => s + d[key], 0) / (weekData.filter(d => d[key] > 0).length || 1)) : 0;
  const daysLogged = weekData.filter(d => d.calories > 0).length;
  const goalDays = weekData.filter(d => d.calories > 0 && d.calories <= (profile?.macro_goals?.calories || 1800)).length;
  const workoutDays = new Set(workouts.map(w => w.date)).size;

  return (
    <div>
      <div className="card">
        <div className="card-title">This week at a glance</div>
        <div className="macro-grid">
          <div className="macro-cell"><div className="macro-val" style={{ color: '#1D9E75' }}>{avg('calories')}</div><div className="macro-lbl">avg calories/day</div></div>
          <div className="macro-cell"><div className="macro-val" style={{ color: '#3B6D11' }}>{avg('protein')}g</div><div className="macro-lbl">avg protein/day</div></div>
          <div className="macro-cell"><div className="macro-val" style={{ color: '#185FA5' }}>{workoutDays}</div><div className="macro-lbl">workout days</div></div>
          <div className="macro-cell"><div className="macro-val" style={{ color: '#BA7517' }}>{goalDays}/{daysLogged}</div><div className="macro-lbl">days under goal</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Calories this week</div>
        <div style={{ position: 'relative', height: '200px' }}>
          <canvas ref={calChartRef} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Protein this week</div>
        <div style={{ position: 'relative', height: '200px' }}>
          <canvas ref={proChartRef} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Workouts this week</div>
        {workouts.length === 0 ? (
          <div className="empty" style={{ padding: '16px' }}>No workouts logged this week</div>
        ) : (
          days.map(d => {
            const dayWorkouts = workouts.filter(w => w.date === d);
            if (!dayWorkouts.length) return null;
            return (
              <div key={d} style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '4px' }}>
                  {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </div>
                {dayWorkouts.map(w => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
                    <span style={{ flex: 1, fontSize: '14px' }}>{w.name}</span>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: '#E1F5EE', color: '#0F6E56' }}>{w.type}</span>
                    {w.duration && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{w.duration} min</span>}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
