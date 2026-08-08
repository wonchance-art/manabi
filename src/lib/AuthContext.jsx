'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getSupabase, supabase } from '../lib/supabase';
import { hasSupabaseSessionCookie } from './authCookie';
import { useToast } from './ToastContext';
import { pullProgress } from './refProgress';

const AuthContext = createContext(null);

// 레퍼런스 진도 동기화용 읽음 키 (언어명 → localStorage 키)
const REF_READ_KEYS = {
  Japanese: 'ja_read_chapters',
  English: 'en_read_chapters',
  French: 'fr_read_chapters',
  Chinese: 'zh_read_chapters',
};

const STREAK_MILESTONES = { 7: '🔥 7일 연속 학습 달성!', 30: '🏆 30일 연속 학습 달성!', 100: '🌟 100일 연속 학습 달성!' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const explicitSignOutRef = useRef(false);
  const hadSessionRef = useRef(false);
  // 쿠키가 없어 SDK를 건너뛴 상태 — 이 경우 로그인 성공 시 그 자리에서 listener를 붙여야 한다.
  const guestConfirmedRef = useRef(false);
  const subscriptionRef = useRef(null);

  // 프로필 조회 및 스트릭 갱신
  async function fetchProfile(userId, metadata = {}) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code === 'PGRST116') { // Not found
        // 트리거가 이미 생성했을 수 있으므로 upsert(중복 무시) 후 재조회
        await supabase
          .from('profiles')
          .upsert([{
            id: userId,
            display_name: metadata.display_name || metadata.full_name || metadata.name || '새로운 학습자',
            streak_count: 1,
            last_login_at: new Date().toISOString()
          }], { onConflict: 'id', ignoreDuplicates: true });

        const { data: profile } = await supabase
          .from('profiles').select('*').eq('id', userId).single();
        setProfile(profile);
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

        // 스트릭 마일스톤 토스트 (세션당 1회)
        const milestoneMsg = STREAK_MILESTONES[newStreak];
        if (milestoneMsg) {
          const key = `milestone_shown_${newStreak}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            setTimeout(() => toast(milestoneMsg, 'celebrate', 6000), 1500);
          }
        }
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error("프로필 로드/갱신 실패:", err.message);
    }
  }

  // 세션 쿠키가 하나도 없으면 로그인 상태일 수 없다 — SDK(약 200 kB)를 받지 않고 게스트로 확정한다.
  // @supabase/ssr은 큰 세션을 `sb-<ref>-auth-token.0`처럼 조각내므로 접두사로 판정한다.
  // OAuth 콜백은 서버 라우트(app/auth/callback)가 쿠키를 심고 리다이렉트하므로,
  // 브라우저가 URL에서 세션을 주워야 하는 경로는 없다 — 쿠키 유무만으로 안전하게 갈린다.
  useEffect(() => {
    let cancelled = false;
    let subscription;

    const hasSessionCookie =
      typeof document !== 'undefined' && hasSupabaseSessionCookie(document.cookie);
    if (!hasSessionCookie) {
      setLoading(false);
      guestConfirmedRef.current = true;
      return () => { cancelled = true; };
    }

    getSupabase()
      .then((client) => {
        if (cancelled) return;

        // 기존 순서 유지: 세션 조회를 먼저 시작한 뒤 auth listener를 즉시 등록한다.
        // listener는 동기 반환 API라 lazy facade 대신 실제 client가 필요하다.
        const sessionRequest = client.auth.getSession();
        subscription = attachAuthListener(client, () => cancelled);

        return sessionRequest.then(({ data: { session } }) => {
          if (cancelled) return;
          setUser(session?.user ?? null);
          if (session?.user) {
            hadSessionRef.current = true;
            fetchProfile(session.user.id, session.user.user_metadata);
          }
          setLoading(false);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  // auth listener 등록 — 마운트 시(쿠키 있음)와 게스트 상태에서의 로그인 성공 직후 양쪽에서 쓴다.
  function attachAuthListener(client, isCancelled = () => false) {
    subscriptionRef.current?.unsubscribe();
    const authState = client.auth.onAuthStateChange(async (event, session) => {
      if (isCancelled()) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        hadSessionRef.current = true;
        fetchProfile(session.user.id, session.user.user_metadata);
      } else {
        setProfile(null);
        // 세션이 있다가 사라진 경우 — 명시적 로그아웃이 아니면 만료로 간주
        if (event === 'SIGNED_OUT' && hadSessionRef.current && !explicitSignOutRef.current) {
          toast('세션이 만료됐어요. 다시 로그인해주세요.', 'warning', 5000);
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
            const from = window.location.pathname + window.location.search;
            window.location.href = `/auth?from=${encodeURIComponent(from)}`;
          }
        }
        hadSessionRef.current = false;
        explicitSignOutRef.current = false;
      }
    });
    subscriptionRef.current = authState.data.subscription;
    return subscriptionRef.current;
  }

  // 쿠키가 없어 마운트 때 SDK를 건너뛴 경우, 로그인 성공 시점에 listener를 붙여
  // 새로고침 없이도 로그인 상태가 반영되게 한다(로그인 성공 시엔 이미 SDK가 로드된 뒤다).
  async function ensureAuthListener() {
    if (!guestConfirmedRef.current) return;
    guestConfirmedRef.current = false;
    const client = await getSupabase();
    attachAuthListener(client);
  }

  // 로그인 시 앱 어디서든 레퍼런스 진도 동기화 — [강의]/[홈] 외 페이지에서도 기기 간 병합되도록.
  // user.id 변경(로그인/앱 진입) 시 1회만 도므로 force로 throttle 무시 — 다른 기기가 방금 올린 진도를 확실히 끌어온다.
  useEffect(() => {
    if (user?.id) pullProgress(user.id, REF_READ_KEYS, { force: true }).catch(() => {});
  }, [user?.id]);

  // 이메일 회원가입
  async function signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    await ensureAuthListener();
    return data;
  }

  // 이메일 로그인
  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    await ensureAuthListener();
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
    explicitSignOutRef.current = true;
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
