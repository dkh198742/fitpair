import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthPage() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setMessage(''); setLoading(true);

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { display_name: name } }
      });
      if (error) setError(error.message);
      else setMessage('Account created! Check your email to confirm, then sign in.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background-tertiary, #f5f5f3)' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
            <span style={{ color: '#1D9E75' }}>Fit</span>Pair
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary, #888)', marginTop: '6px' }}>
            Your couples fitness tracker
          </p>
        </div>

        <div style={{ background: 'var(--color-background-primary, #fff)', borderRadius: '16px', border: '0.5px solid rgba(0,0,0,.1)', padding: '28px' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--color-background-secondary, #f0ede8)', borderRadius: '10px', padding: '3px', marginBottom: '24px' }}>
            {['signin', 'signup'].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: '7px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                background: mode === m ? 'white' : 'transparent',
                fontWeight: mode === m ? '500' : '400',
                color: mode === m ? 'var(--color-text-primary)' : 'var(--color-text-secondary, #888)',
                fontSize: '13px',
                boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,.1)' : 'none'
              }}>
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Your name</label>
                <input style={inputStyle} type="text" placeholder="e.g. Alex" value={name} onChange={e => setName(e.target.value)} required />
              </div>
            )}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Password</label>
              <input style={inputStyle} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>

            {error && <div style={{ background: '#FCEBEB', color: '#A32D2D', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' }}>{error}</div>}
            {message && <div style={{ background: '#E1F5EE', color: '#0F6E56', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' }}>{message}</div>}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '10px', background: '#1D9E75', color: 'white', border: 'none',
              borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
              opacity: loading ? 0.7 : 1
            }}>
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-secondary, #888)', marginTop: '16px' }}>
          Both partners create separate accounts, then link up inside the app.
        </p>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '12px', color: 'var(--color-text-secondary, #666)', marginBottom: '4px', fontWeight: '500' };
const inputStyle = { width: '100%', padding: '9px 12px', border: '0.5px solid rgba(0,0,0,.15)', borderRadius: '8px', fontSize: '14px', background: 'var(--color-background-primary, #fff)', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box' };
