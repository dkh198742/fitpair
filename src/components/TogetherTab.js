import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export default function TogetherTab() {
  const { profile, partner, linkPartner } = useAuth();
  const [linkCode, setLinkCode] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [myStats, setMyStats] = useState(null);
  const [partnerStats, setPartnerStats] = useState(null);

  useEffect(() => {
    if (profile) fetchMyStats();
    if (partner) fetchPartnerStats();
  }, [profile, partner]);

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);

  async function fetchStats(userId, goals) {
    const [macros, workoutsWeek, lastWeight] = await Promise.all([
      supabase.from('macro_log').select('calories,protein').eq('user_id', userId).eq('date', today),
      supabase.from('workout_log').select('date').eq('user_id', userId).gte('date', weekAgo),
      supabase.from('weight_log').select('weight,date').eq('user_id', userId).order('date', { ascending: false }).limit(1),
    ]);

    const totals = (macros.data || []).reduce((a, e) => ({ cal: a.cal + e.calories, pro: a.pro + e.protein }), { cal: 0, pro: 0 });
    const uniqueWorkoutDays = new Set((workoutsWeek.data || []).map(w => w.date)).size;

    return {
      cal: totals.cal,
      pro: totals.pro,
      goalCal: goals?.calories || 1800,
      goalPro: goals?.protein || 140,
      workouts: uniqueWorkoutDays,
      weight: lastWeight.data?.[0]?.weight || null,
    };
  }

  async function fetchMyStats() {
    const stats = await fetchStats(profile.id, profile.macro_goals);
    setMyStats(stats);
  }

  async function fetchPartnerStats() {
    const stats = await fetchStats(partner.id, partner.macro_goals);
    setPartnerStats(stats);
  }

  async function handleLink() {
    setLinkError(''); setLinkLoading(true);
    const result = await linkPartner(linkCode);
    if (result.error) setLinkError(result.error);
    setLinkLoading(false);
  }

  const av = (name, cls) => (
    <div className={`avatar ${cls}`}>{(name || '?')[0].toUpperCase()}</div>
  );

  if (!partner) {
    return (
      <div>
        <div className="card">
          <div className="card-title">Link with your partner</div>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary,#888)', marginBottom: '16px', lineHeight: '1.6' }}>
            Both of you need to create accounts, then share your partner code with each other. One person enters the other's code below to link your accounts.
          </p>

          <div style={{ background: 'var(--color-background-secondary,#f5f5f3)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary,#888)', marginBottom: '6px' }}>Your partner code — share this!</div>
            <div style={{ fontSize: '28px', fontWeight: '600', letterSpacing: '4px', color: '#1D9E75', fontFamily: 'monospace' }}>
              {profile?.partner_code || '------'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              placeholder="Enter your partner's code"
              value={linkCode}
              onChange={e => setLinkCode(e.target.value.toUpperCase())}
              style={{ flex: 1, fontFamily: 'monospace', letterSpacing: '2px', fontSize: '16px' }}
              maxLength={6}
            />
            <button className="btn btn-primary" onClick={handleLink} disabled={linkLoading || linkCode.length !== 6}>
              {linkLoading ? 'Linking…' : 'Link'}
            </button>
          </div>
          {linkError && <div style={{ marginTop: '8px', fontSize: '13px', color: '#A32D2D' }}>{linkError}</div>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">Today's progress</div>
        {[
          { label: 'Calories', myVal: myStats?.cal, myGoal: myStats?.goalCal, theirVal: partnerStats?.cal, theirGoal: partnerStats?.goalCal, colorA: '#1D9E75', colorB: '#378ADD' },
          { label: 'Protein', myVal: myStats?.pro, myGoal: myStats?.goalPro, theirVal: partnerStats?.pro, theirGoal: partnerStats?.goalPro, colorA: '#1D9E75', colorB: '#378ADD' },
        ].map(row => (
          <div key={row.label} style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary,#888)', marginBottom: '4px' }}>{row.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
              {av(profile.display_name, 'av-a')}
              <div style={{ flex: 1, background: 'var(--color-background-secondary,#f0ede8)', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: row.colorA, width: `${Math.min(100, Math.round((row.myVal || 0) / (row.myGoal || 1) * 100))}%`, borderRadius: '4px', transition: 'width .5s' }} />
              </div>
              <span style={{ fontSize: '11px', color: '#0F6E56', minWidth: '70px' }}>{row.myVal || 0} / {row.myGoal}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {av(partner.display_name, 'av-b')}
              <div style={{ flex: 1, background: 'var(--color-background-secondary,#f0ede8)', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: row.colorB, width: `${Math.min(100, Math.round((row.theirVal || 0) / (row.theirGoal || 1) * 100))}%`, borderRadius: '4px', transition: 'width .5s' }} />
              </div>
              <span style={{ fontSize: '11px', color: '#185FA5', minWidth: '70px' }}>{row.theirVal || 0} / {row.theirGoal}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="shared-row">
        {[
          { p: profile, stats: myStats, cls: 'av-a' },
          { p: partner, stats: partnerStats, cls: 'av-b' },
        ].map(({ p, stats, cls }) => (
          <div key={p.id} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              {av(p.display_name, cls)}
              <span style={{ fontWeight: '500' }}>{p.display_name}</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary,#888)', marginBottom: '6px' }}>
              <i className="ti ti-barbell" style={{ fontSize: '14px', marginRight: '4px', verticalAlign: '-2px' }} />
              {stats?.workouts ?? '—'} workouts this week
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary,#888)' }}>
              <i className="ti ti-scale" style={{ fontSize: '14px', marginRight: '4px', verticalAlign: '-2px' }} />
              {stats?.weight ? `${stats.weight} lbs` : 'No weight logged'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
