'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // 프로필 조회 및 스트릭 갱신
  async function fetchProfile(userId, metadata = {}) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code === 'PGRST116') { // Not found
        // Create new profile
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert([{
            id: userId,
            display_name: metadata.display_name || '새로운 학습자',
            streak_count: 1,
            last_login_at: new Date().toISOString()
          }])
          .select()
          .single();
        
        if (createError) throw createError;
        setProfile(newProfile);
        return;
      } else if (error) {
        throw error;
      }
      
      // Streak Calculation
      const today = new Date().toISOString().split('T')[0];
      const lastLogin = data.last_login_at ? data.last_login_at.split('T')[0] : null;

      if (lastLogin !== today) {
        let newStreak = 1;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (lastLogin === yesterdayStr) {
          newStreak = (data.streak_count || 0) + 1;
        }

        // Update profile in DB
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update({
            streak_count: newStreak,
            last_login_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select()
          .single();

        if (updateError) throw updateError;
        setProfile(updatedProfile);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error("프로필 로드/갱신 실패:", err.message);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.user_metadata);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id, session.user.user_metadata);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // 이메일 회원가입
  async function signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } }
    });
    if (error) throw error;
    return data;
  }

  // 이메일 로그인
  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  }

  // 구글 소셜 로그인
  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) throw error;
    return data;
  }

  // 비밀번호 재설정 메일 발송
  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth?mode=reset',
    });
    if (error) throw error;
  }

  // 로그아웃
  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  const isAdmin = profile?.role === 'admin';

  const value = {
    user,
    profile,
    loading,
    isAdmin,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    fetchProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
