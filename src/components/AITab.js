import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const API_URL = 'https://api.anthropic.com/v1/messages';

const QUICK_PROMPTS = [
  "What should I eat to hit my protein goal?",
  "Suggest a 30-min workout for today",
  "How is my progress looking?",
  "Tips to stay motivated as a couple",
];

export default function AITab() {
  const { profile, partner } = useAuth();
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (profile) fetchHistory();
  }, [profile]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  async function fetchHistory() {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('ai_chat')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: true })
      .limit(60);
    if (data && data.length > 0) {
      setChat(data);
    } else {
      const welcome = { role: 'assistant', content: `Hi${profile.display_name ? ' ' + profile.display_name : ''}! I'm your FitPair AI coach. I can help with meal suggestions, workout tips, and analyzing your progress. What would you like to work on today?` };
      setChat([welcome]);
      await supabase.from('ai_chat').insert({ user_id: profile.id, ...welcome });
    }
    setLoadingHistory(false);
  }

  function buildSystemPrompt() {
    const g = profile.macro_goals || {};
    return `You are a helpful, encouraging fitness and nutrition coach for a couple on a weight loss journey. Keep responses concise and practical (under 200 words unless asked for more). Be warm and supportive.

User's name: ${profile.display_name || 'the user'}
Partner's name: ${partner?.display_name || 'their partner'}
Daily macro goals: ${g.calories || 1800} cal, ${g.protein || 140}g protein, ${g.carbs || 180}g carbs, ${g.fat || 60}g fat.
Goal: weight loss.

Offer specific, actionable advice. Celebrate wins. Keep things encouraging for both partners.`;
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    const newChat = [...chat, userMsg];
    setChat(newChat);
    setInput('');
    setLoading(true);

    await supabase.from('ai_chat').insert({ user_id: profile.id, ...userMsg });

    const messages = newChat.map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: buildSystemPrompt(),
          messages,
        }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || 'Sorry, I had trouble responding. Please try again.';
      const assistantMsg = { role: 'assistant', content: reply };
      setChat(c => [...c, assistantMsg]);
      await supabase.from('ai_chat').insert({ user_id: profile.id, ...assistantMsg });
    } catch {
      const errMsg = { role: 'assistant', content: 'Connection error. Please try again.' };
      setChat(c => [...c, errMsg]);
    }
    setLoading(false);
  }

  if (loadingHistory) return <div className="empty">Loading chat history…</div>;

  return (
    <div>
      <div className="card" style={{ minHeight: '300px', maxHeight: '500px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {chat.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'assistant' ? (
              <div className="ai-bubble" style={{ maxWidth: '90%' }}>{m.content}</div>
            ) : (
              <div style={{ background: 'var(--color-background-secondary,#f0ede8)', borderRadius: '12px', borderBottomRightRadius: '2px', padding: '10px 14px', maxWidth: '80%', fontSize: '14px', lineHeight: '1.5' }}>{m.content}</div>
            )}
          </div>
        ))}
        {loading && <div className="ai-bubble loading-dots" style={{ maxWidth: '90%' }}>Thinking</div>}
        <div ref={chatEndRef} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0' }}>
        {QUICK_PROMPTS.map(p => (
          <button key={p} className="btn btn-sm" style={{ fontSize: '12px' }} onClick={() => setInput(p)}>{p}</button>
        ))}
      </div>

      <div className="ai-input-row">
        <input
          placeholder="Ask your AI coach anything…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
        />
        <button className="btn btn-primary" onClick={sendMessage} disabled={loading}>
          <i className="ti ti-send" style={{ fontSize: '16px' }} />
        </button>
      </div>
    </div>
  );
}
