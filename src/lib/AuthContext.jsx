'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getSupabase, supabase } from '../lib/supabase';
import { hasSupabaseSessionCookie } from './authCookie';
import { authCallbackUrl } from './authRedirect';
import { migrateGuestDrillQueue } from './drillSrs';
import { useToast } from './ToastContext';
import { pullProgress } from './refProgress';
import { createProfileReadOnlyRefresh, recordExplicitProfileLogin } from './learningActivity';

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
  const unloadingRef = useRef(false);

  const actorRef = useRef(null);
  const authGenerationRef = useRef(0);
  const explicitLoginRequestRef = useRef(0);
  const mountedRef = useRef(true);
  const loginActorRef = useRef(null);
  const observedProfileRef = useRef(null);
  const profileReaderRef = useRef(null);

  function adoptUser(nextUser) {
    if (actorRef.current !== (nextUser?.id ?? null)) {
      authGenerationRef.current += 1;
      actorRef.current = nextUser?.id ?? null;
      loginActorRef.current = null;
      observedProfileRef.current = null;
      profileReaderRef.current?.invalidate();
      setProfile(null);
    }
    setUser(nextUser ?? null);
  }

  if (!profileReaderRef.current) {
    profileReaderRef.current = createProfileReadOnlyRefresh({
      getActor: () => mountedRef.current ? actorRef.current : null,
      read: actorId => supabase.from('profiles').select('*').eq('id', actorId).single(),
      onProfile: (nextProfile, actorId) => {
        const previous = observedProfileRef.current;
        observedProfileRef.current = nextProfile;
        setProfile(nextProfile);
        // 첫 조회는 보상 이벤트가 아니다. 확정된 같은 계정의 증가만 기존 토스트로 알린다.
        const count = nextProfile?.streak_count;
        const message = previous && count > previous.streak_count && STREAK_MILESTONES[count];
        if (!message || typeof sessionStorage === 'undefined') return;
        const key = `milestone_shown_${actorId}_${nextProfile.last_streak_date}_${count}`;
        try {
          if (sessionStorage.getItem(key)) return;
          sessionStorage.setItem(key, '1');
        } catch { return; }
        setTimeout(() => {
          if (mountedRef.current && actorRef.current === actorId) toast(message, 'celebrate', 6000);
        }, 1500);
      },
    });
  }

  // refresh와 로그인은 별개다. 누락된 프로필도 읽기 중에는 생성하지 않는다.
  async function refreshProfileReadOnly(userId) {
    try { return await profileReaderRef.current.refresh(userId); }
    catch (err) {
      if (!unloadingRef.current && mountedRef.current && actorRef.current === userId) {
        console.error('프로필 로드/갱신 실패:', err.message);
      }
      return null;
    }
  }
  const fetchProfile = refreshProfileReadOnly;

  // 실제 로그인만 접속 시각을 기록한다. streak/freeze는 학습 활동 트랜잭션만 변경한다.
  async function initializeLoginProfile(nextUser) {
    const userId = nextUser?.id, generation = authGenerationRef.current;
    if (!userId || actorRef.current !== userId || loginActorRef.current === userId) return;
    loginActorRef.current = userId;
    const current = () => mountedRef.current && actorRef.current === userId && authGenerationRef.current === generation;
    try {
      if (await recordExplicitProfileLogin({ client: supabase, user: nextUser, isCurrent: current })) {
        await refreshProfileReadOnly(userId);
      }
    } catch (err) {
      if (current() && !unloadingRef.current) console.error('프로필 로드/갱신 실패:', err.message);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      explicitLoginRequestRef.current += 1;
      profileReaderRef.current?.invalidate();
      subscriptionRef.current?.unsubscribe();
    };
  }, []);

  // 이동 시작을 표시 — bfcache 복원(persisted)까지 고려해 pageshow에서 되돌린다.
  useEffect(() => {
    const onHide = () => { unloadingRef.current = true; };
    const onShow = () => { unloadingRef.current = false; };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', onShow);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('pageshow', onShow);
    };
  }, []);

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
        const sessionGeneration = authGenerationRef.current;
        const sessionRequest = client.auth.getSession();
        subscription = attachAuthListener(client, () => cancelled);

        return sessionRequest.then(({ data: { session } }) => {
          if (cancelled || authGenerationRef.current !== sessionGeneration) return;
          adoptUser(session?.user ?? null);
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
    // 마운트 1회 세션 복원. attachAuthListener·fetchProfile은 매 렌더 새 함수라 의존성에 넣으면
    // 렌더마다 세션 조회와 auth 구독을 다시 붙인다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auth listener 등록 — 마운트 시(쿠키 있음)와 게스트 상태에서의 로그인 성공 직후 양쪽에서 쓴다.
  function attachAuthListener(client, isCancelled = () => false) {
    subscriptionRef.current?.unsubscribe();
    const authState = client.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current || isCancelled()) return;
      if (event === 'SIGNED_OUT') explicitLoginRequestRef.current += 1;
      adoptUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        hadSessionRef.current = true;
        // SDK는 cookie 복원/탭 복귀에도 SIGNED_IN을 보낸다. 이벤트는 로그인 쓰기의 증거가 아니다.
        refreshProfileReadOnly(session.user.id);
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
    if (!mountedRef.current) return;
    attachAuthListener(client);
  }

  async function acceptExplicitLogin(data, request, generation) {
    const nextUser = data.session?.user;
    // SDK의 본인 SIGNED_IN은 응답보다 먼저 온다. 본인 actor는 허용하고 후착 타인 결과만 버린다.
    const current = () => mountedRef.current && explicitLoginRequestRef.current === request
      && (authGenerationRef.current === generation || actorRef.current === nextUser?.id);
    if (!current()) return;
    await ensureAuthListener();
    if (nextUser && current()) {
      adoptUser(nextUser);
      await initializeLoginProfile(nextUser);
    }
  }

  // 로그인 시 앱 어디서든 레퍼런스 진도 동기화 — [강의]/[홈] 외 페이지에서도 기기 간 병합되도록.
  // user.id 변경(로그인/앱 진입) 시 1회만 도므로 force로 throttle 무시 — 다른 기기가 방금 올린 진도를 확실히 끌어온다.
  useEffect(() => {
    if (!user?.id) return;
    pullProgress(user.id, REF_READ_KEYS, { force: true }).catch(() => {});
    // 게스트로 쌓은 드릴 복습 큐를 서버로 옮긴다 — 로그인했다고 기록이 사라지면 안 된다.
    // 서버에 이미 있는 카드는 건드리지 않고(다른 기기가 더 진행했을 수 있다), 없는 것만 넣는다.
    migrateGuestDrillQueue(user.id).catch(() => {});
  }, [user?.id]);

  // 이메일 회원가입
  async function signUp(email, password, displayName) {
    const request = ++explicitLoginRequestRef.current, generation = authGenerationRef.current;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: authCallbackUrl(window.location.origin),
      },
    });
    if (error) throw error;
    await acceptExplicitLogin(data, request, generation);
    return data;
  }

  // 이메일 로그인
  async function signIn(email, password) {
    const request = ++explicitLoginRequestRef.current, generation = authGenerationRef.current;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    await acceptExplicitLogin(data, request, generation);
    return data;
  }

  // 구글 소셜 로그인
  async function signInWithGoogle(next = '/home') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authCallbackUrl(window.location.origin, next) }
    });
    if (error) throw error;
    return data;
  }

  // 비밀번호 재설정 메일 발송
  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authCallbackUrl(window.location.origin, '/auth?mode=reset'),
    });
    if (error) throw error;
  }

  // 로그아웃
  async function signOut() {
    explicitLoginRequestRef.current += 1;
    explicitSignOutRef.current = true;
    await supabase.auth.signOut();
    adoptUser(null);
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
    fetchProfile,
    refreshProfileReadOnly
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
