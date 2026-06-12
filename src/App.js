import React, { useState, useEffect } from 'react';
import { useAuth } from './lib/AuthContext';
import AuthPage from './components/AuthPage';
import MacrosTab from './components/MacrosTab';
import WorkoutsTab from './components/WorkoutsTab';
import ProgressTab from './components/ProgressTab';
import TogetherTab from './components/TogetherTab';
import AITab from './components/AITab';
import './App.css';

const TABS = [
  { id: 'macros', icon: 'ti-salad', label: 'Macros' },
  { id: 'workouts', icon: 'ti-barbell', label: 'Workouts' },
  { id: 'progress', icon: 'ti-trending-up', label: 'Progress' },
  { id: 'together', icon: 'ti-users', label: 'Together' },
  { id: 'ai', icon: 'ti-robot', label: 'AI Coach' },
];

export default function App() {
  const { session, profile, loading, signOut } = useAuth();
  const [tab, setTab] = useState('macros');
  const [showMenu, setShowMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('fitpair_dark');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('fitpair_dark', darkMode);
  }, [darkMode]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: '600', marginBottom: '8px' }}>
            <span style={{ color: '#1D9E75' }}>Fit</span>Pair
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (!session) return <AuthPage />;

  return (
    <div className="app">
      <div className="header">
        <div className="logo"><span>Fit</span>Pair</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn btn-sm"
            onClick={() => setDarkMode(d => !d)}
            title="Toggle dark mode"
            style={{ padding: '6px 8px' }}
          >
            <i className={`ti ${darkMode ? 'ti-sun' : 'ti-moon'}`} style={{ fontSize: '15px' }} />
          </button>
          <div style={{ position: 'relative' }}>
            <button className="btn btn-sm" onClick={() => setShowMenu(!showMenu)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="avatar av-a" style={{ width: '24px', height: '24px', fontSize: '11px', display: 'inline-flex' }}>
                {(profile?.display_name || '?')[0].toUpperCase()}
              </div>
              {profile?.display_name || 'Me'}
              <i className="ti ti-chevron-down" style={{ fontSize: '12px' }} />
            </button>
            {showMenu && (
              <div style={{ position: 'absolute', right: 0, top: '36px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '6px', minWidth: '160px', zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,.12)' }}>
                <div style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Code: <b style={{ fontFamily: 'monospace', letterSpacing: '2px' }}>{profile?.partner_code}</b>
                </div>
                <hr style={{ border: 'none', borderTop: '0.5px solid var(--border)', margin: '4px 0' }} />
                <button onClick={() => { signOut(); setShowMenu(false); }} className="btn btn-sm" style={{ width: '100%', textAlign: 'left', color: '#A32D2D' }}>
                  <i className="ti ti-logout" style={{ fontSize: '13px', marginRight: '6px' }} />Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="nav">
        {TABS.map(t => (
          <button key={t.id} className={`nav-btn${tab === t.id ? ' active' : ''}`} onClick={() => { setTab(t.id); setShowMenu(false); }}>
            <i className={`ti ${t.icon}`} style={{ fontSize: '15px' }} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'macros' && <MacrosTab />}
      {tab === 'workouts' && <WorkoutsTab />}
      {tab === 'progress' && <ProgressTab />}
      {tab === 'together' && <TogetherTab />}
      {tab === 'ai' && <AITab />}
    </div>
  );
}
