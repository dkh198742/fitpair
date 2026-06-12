import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else { setProfile(null); setPartner(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
    if (data?.partner_id) {
      const { data: partnerData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.partner_id)
        .single();
      setPartner(partnerData);
    }
    setLoading(false);
  }

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id);
  }

  async function linkPartner(code) {
    // Find partner by their code
    const { data: partnerProfile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('partner_code', code.toUpperCase())
      .neq('id', session.user.id)
      .single();

    if (error || !partnerProfile) return { error: 'Partner code not found. Ask your partner to share their code.' };

    if (partnerProfile.partner_id) return { error: 'That account is already linked to someone.' };

    // Link both ways
    await supabase.from('profiles').update({ partner_id: partnerProfile.id }).eq('id', session.user.id);
    await supabase.from('profiles').update({ partner_id: session.user.id }).eq('id', partnerProfile.id);

    await loadProfile(session.user.id);
    return { success: true };
  }

  async function updateGoals(goals) {
    await supabase.from('profiles').update({ macro_goals: goals }).eq('id', session.user.id);
    await refreshProfile();
  }

  async function updateName(name) {
    await supabase.from('profiles').update({ display_name: name }).eq('id', session.user.id);
    await refreshProfile();
  }

  const value = {
    session,
    profile,
    partner,
    loading,
    refreshProfile,
    linkPartner,
    updateGoals,
    updateName,
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
