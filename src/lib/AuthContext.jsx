'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getSupabase, supabase } from '../lib/supabase';
import { hasSupabaseSessionCookie } from './authCookie';
import { whenDocumentParsed } from './documentParsed';
import { authCallbackUrl } from './authRedirect';
import { isRepeatedSignup } from './authErrors';
import { migrateGuestDrillQueue } from './drillSrs';
import { useToast } from './ToastContext';
import { watchAccountMutations } from './accountQueryCache';
import { REF_READ_KEYS, claimGuestRefProgress } from './refReadStore';
import { clearAllStudySources } from './studySourceHandoff';
import { syncScHintCookie } from './scFontHint';
import { pullProgress } from './refProgress';
import { createProfileReadOnlyRefresh, recordExplicitProfileLogin } from './learningActivity';
import { accountCacheReset, accountLeft, clearAccountQueries, noteAccount } from './accountQueryCache';

const AuthContext = createContext(null);

// 레퍼런스 진도 동기화용 읽음 키 (언어명 → localStorage 키)
// (언어 → 키 바탕 REF_READ_KEYS는 lib/refReadStore — 계정 키 · 손님 몫 합치기와 한곳)

// 세션 쿠키가 있는데 SDK 조각을 못 받았을 때 다시 복원하는 간격(그 밖에는 online 이벤트에서).
const AUTH_RESTORE_RETRY_MS = [2000, 8000, 30000];

const STREAK_MILESTONES = { 7: '🔥 7일 연속 학습 달성!', 30: '🏆 30일 연속 학습 달성!', 100: '🌟 100일 연속 학습 달성!' };

// queryClient: providers.jsx가 넘긴다 — 계정이 바뀌면 계정에 딸린 캐시를 비운다(AUTH-CACHE-CLEAR-001 · lib/accountQueryCache).
// onAccountLeft: providers.jsx가 router.refresh를 넘긴다 — 같은 순간(A → 손님 · A → B)에 서버 렌더 데이터도 버린다(AUTH-ROUTER-REFRESH-001).
//   서버 컴포넌트가 쿠키 세션으로 그린 A의 데이터(서재 HydrationBoundary · /study · /writing · /review/grammar · 관리 화면 · 뷰어 제목)는
//   react-query가 아니라 RSC 페이로드 · 라우터 캐시에 있다 — 지금 화면과 뒤로 가기 캐시에 남아 B에게 보였다. 로그아웃 버튼마다 따로
//   부르던 router.refresh(Layout · MyPage — 계정 삭제 · 다른 탭 전환은 빠져 있었다)를 이 한 관문으로 모았다.
export function AuthProvider({ children, queryClient, onAccountLeft }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // 프로필 읽기가 끝난(성공 · 실패 모두) 계정 — profile이 null인 것이 「아직 받는 중」인지 「없음」인지 가른다(profileLoading).
  const [profileSettledFor, setProfileSettledFor] = useState(null);
  const toast = useToast();
  const explicitSignOutRef = useRef(false);
  const hadSessionRef = useRef(false);
  // 쿠키가 없어 SDK를 건너뛴 상태 — 이 경우 로그인 성공 시 그 자리에서 listener를 붙여야 한다.
  const guestConfirmedRef = useRef(false);
  const subscriptionRef = useRef(null);
  const unloadingRef = useRef(false);

  const actorRef = useRef(null);
  const lastSignedInRef = useRef(null); // 이 탭에서 마지막으로 들어와 있던 계정(손님 → B 때 앞선 A의 늦은 쓰기를 비우는 판정)
  // 계정이 떠난 뒤 그리기가 끝나면(아래 effect) 한 번 서버 렌더를 버린다. 콜백은 최신 것을 쓴다(렌더마다 새 함수여도 effect를 다시 걸지 않게).
  const accountLeftPendingRef = useRef(false);
  const onAccountLeftRef = useRef(onAccountLeft);
  onAccountLeftRef.current = onAccountLeft;
  const authGenerationRef = useRef(0);
  const explicitLoginRequestRef = useRef(0);
  const mountedRef = useRef(true);
  const loginActorRef = useRef(null);
  const observedProfileRef = useRef(null);
  const profileReaderRef = useRef(null);

  function adoptUser(nextUser) {
    const nextActor = nextUser?.id ?? null;
    noteAccount(nextActor);
    if (actorRef.current !== nextActor) {
      // A → 손님 · A → B(· 손님 → B인데 앞서 A): 새 user로 그리기(setUser) 전에 A의 캐시를 비운다 — 같은 키(['material', id] 등)를
      // B가 받아 그리지 않게. 기기 캐시(IndexedDB)도 새 계정이 열 수 없는 기록을 지운다(대기 연산은 보존 — offlineCache).
      // 서버 렌더 버리기(router.refresh)는 계정이 떠날 때만(A → 손님 · A → B) — 손님 → B는 로그인 화면이 이미 새로 그린다.
      const left = accountLeft(actorRef.current, nextActor);
      if (accountCacheReset(lastSignedInRef.current, actorRef.current, nextActor)) {
        clearAccountQueries(queryClient);
        import('./offlineCache').then((cache) => cache.purgeOfflineForAccount(nextActor)).catch(() => {});
        clearAllStudySources(); // 넘겨줄 글(/study?source=mine)은 넘긴 계정의 것 — 떠나면 지운다
        // 간체 글꼴 힌트도 이 판정에서 지운다(SC-LINK-001 리뷰 N2) — 다음 계정은 배움 화면에서 자기 학습 언어로 다시 쓴다.
        // 처음 계정을 맞을 때(손님 → 계정, 앞선 계정 없음)는 지우지 않는다.
        syncScHintCookie(false);
      }
      if (left) accountLeftPendingRef.current = true;
      // 손님 몫 레퍼런스 진도는 이 기기의 첫 로그인 계정에만 한 번 합친다 — 화면이 합친 값을 바로 읽게 그리기 전에.
      if (nextActor) claimGuestRefProgress(nextActor);
      if (nextActor) lastSignedInRef.current = nextActor;
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
        setProfileSettledFor(actorId);
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
  // 밖에서 부르는 refreshProfileReadOnly · fetchProfile은 「쓰기 뒤 재읽기」다 — 늘 새로 읽는다(공유하지 않음).
  async function refreshProfileReadOnly(userId) { return readProfile(userId); }
  // 세션 경로(getSession · 인증 알림)만 같은 계정의 진행 중 읽기를 공유한다(PROFILE-READ-SHARE-001) — 페이지 로드마다
  // 두 경로가 몇 ms 차이로 같은 읽기를 보냈다. 쓰기 경계 뒤에 시작된 읽기만 합류한다(learningActivity 참고).
  function readSessionProfile(userId) { return readProfile(userId, { share: true }); }
  async function readProfile(userId, options) {
    try { return await profileReaderRef.current.refresh(userId, options); }
    catch (err) {
      if (mountedRef.current && actorRef.current === userId) {
        setProfileSettledFor(userId); // 실패도 끝 — 받는 중으로 영원히 두지 않는다
        if (!unloadingRef.current) console.error('프로필 로드/갱신 실패:', err.message);
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
      if (current()) setProfileSettledFor(userId); // 로그인 기록이 실패해도 받는 중으로 남기지 않는다
      if (current() && !unloadingRef.current) console.error('프로필 로드/갱신 실패:', err.message);
    }
  }

  // 서버 렌더 버리기 — 새 계정(또는 손님)으로 그린 뒤에 한 번. effect라 로그아웃 버튼의 이동(router.push('/auth'))이 먼저 나가고
  // 새로고침이 뒤따른다(예전 Layout의 「이동 뒤 차례로」 순서 — 이동이 새로고침을 버리지 않게). 손님 → 계정 · 같은 계정은 부르지 않는다.
  useEffect(() => {
    if (!accountLeftPendingRef.current) return;
    accountLeftPendingRef.current = false;
    onAccountLeftRef.current?.();
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      explicitLoginRequestRef.current += 1;
      profileReaderRef.current?.invalidate();
      subscriptionRef.current?.unsubscribe();
    };
  }, []);

  // 계정을 가로지른 mutation의 늦은 쓰기를 지운다(MUTATION-ACCOUNT-GEN-001 — lib/accountQueryCache.watchAccountMutations).
  useEffect(() => (queryClient ? watchAccountMutations(queryClient) : undefined), [queryClient]);

  // bfcache 복원(문서 뒤로 가기) — 얼어 있던 동안 계정이 바뀌었을 수 있다(GUEST-STATIC-001 1단계, 2026-10-23 KST).
  // Chrome은 no-store 문서만 「쿠키가 바뀌면 퇴출」한다 — 정적 문서(/profile · /japanese/vocab/*)는 A가 본 그대로 살아난다.
  // 다른 탭의 로그인 · 로그아웃은 SDK 탭 사이 알림(BroadcastChannel)이 얼어 있는 페이지를 퇴출시키지만, 알림 없이 쿠키만 바뀌면
  // (서버가 세션 쿠키를 지움 · 만료 등) A 화면이 손님에게 그대로 복원됐다(account-boundary e2e ⑨ 실측). 여기서는 판정만 다시 한다 —
  // 정리는 늘 adoptUser(accountCacheReset · 서버 렌더 버리기)라는 한 관문이다. 같은 계정이면 아무것도 하지 않는다.
  function recheckAccountOnRestore() {
    if (typeof document === 'undefined' || !hasSupabaseSessionCookie(document.cookie)) {
      if (actorRef.current === null) return;
      hadSessionRef.current = false;
      adoptUser(null);
      setLoading(false);
      return;
    }
    const generation = authGenerationRef.current;
    getSupabase()
      .then(async (client) => {
        const { data: { session } } = await client.auth.getSession();
        const next = session?.user ?? null;
        if (!mountedRef.current || authGenerationRef.current !== generation || (next?.id ?? null) === actorRef.current) return;
        if (next) await ensureAuthListener(); // 손님으로 얼었던 화면(SDK 없이 확정) — 이제 알림도 받는다
        if (!mountedRef.current || authGenerationRef.current !== generation) return;
        adoptUser(next);
        setLoading(false);
        if (next) { hadSessionRef.current = true; readSessionProfile(next.id); } else { hadSessionRef.current = false; setProfile(null); }
      })
      .catch(() => {});
  }

  // 이동 시작을 표시 — bfcache 복원(persisted)까지 고려해 pageshow에서 되돌린다. 복원이면 계정을 다시 확인한다(위).
  useEffect(() => {
    const onHide = () => { unloadingRef.current = true; };
    const onShow = (event) => { unloadingRef.current = false; if (event?.persisted) recheckAccountOnRestore(); };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', onShow);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('pageshow', onShow);
    };
    // 마운트 1회 등록. recheckAccountOnRestore는 매 렌더 새 함수지만 ref · setState만 쓴다(attachAuthListener와 같은 이유).
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      guestConfirmedRef.current = true;
      noteAccount(null); // 쿠키가 없으면 손님이 확정이다 — 기기 캐시 읽기(whenAccountKnown)가 기다리지 않게
      // 손님 확정 — 세션 쿠키가 없다(만료 · 다른 탭 로그아웃 뒤). 학습자 힌트를 남기지 않는다(SC-LINK-001 리뷰 N2).
      syncScHintCookie(false);
      // 게스트 확정도 Provider 값을 바꾼다 — 스트리밍 본문이 다 온 뒤에(whenDocumentParsed).
      const stopWaiting = whenDocumentParsed(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; stopWaiting(); };
    }

    let stopWaiting = () => {};
    // SDK 조각을 못 받으면(오프라인 · 배포 교체 직후 등) 쿠키가 있는데도 user가 비어 로그아웃처럼 보인다.
    // 로그아웃으로 굳히지 않고 연결이 돌아올 때 · 잠시 뒤 다시 복원한다 — 같은 계정이 돌아오면 /study처럼
    // 세션 계정을 고정한 화면이 멈춰 둔 기록을 이어 보낸다(getSupabase는 실패하면 다음 호출에서 다시 받는다).
    // 복원 재시도가 남아 있는 동안은 loading=true(「확인 중」)다 — 소비자(서재 serverUserId · /study authLost · 배움 손님 분기 ·
    // 목표 칸)는 loading만 보면 되고, 따로 「복원 중」 값을 읽지 않는다.
    let restored = false;
    let retryTimer;
    let retries = 0;
    const restore = () => {
      if (cancelled || restored) return;
      clearTimeout(retryTimer);
      getSupabase()
        // SDK는 지금 받고, 세션 복원(값 변경)은 스트리밍 본문이 다 온 뒤에 한다(whenDocumentParsed — HYDRATION-AUTH-001).
        .then((client) => new Promise((resolve) => { stopWaiting(); stopWaiting = whenDocumentParsed(() => resolve(client)); }))
        .then((client) => {
          if (cancelled || restored) return;
          restored = true;
          window.removeEventListener('online', restore);

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
              readSessionProfile(session.user.id); // 세션 경로 — 알림 경로와 진행 중 읽기 공유
            }
            setLoading(false);
          });
        })
        .catch(() => {
          if (cancelled) return;
          // 다시 해 볼 차례가 남았으면 loading을 그대로 둔다 — 쿠키가 있는데 아직 확인 못 했을 뿐이라, 그동안 user=null을
          // 「로그아웃」으로 읽으면 서재는 서버가 확인한 계정 대신 손님 화면, /study는 「로그인이 필요해요」, 배움은 손님 분기로
          // 뒤집혔다가 돌아온다(병합 전 교차 리뷰 S1). 차례를 다 쓰면(2 · 8 · 30초) 그때 확정(loading=false · user=null)이다.
          // 그 뒤에도 online이 오면 다시 복원한다(복원되면 user가 들어온다).
          if (!restored && retries < AUTH_RESTORE_RETRY_MS.length) { retryTimer = setTimeout(restore, AUTH_RESTORE_RETRY_MS[retries++]); return; }
          setLoading(false);
          noteAccount(null); // 복원을 포기한 확정(손님) — 기다리던 기기 캐시 읽기를 풀어 준다
        });
    };
    window.addEventListener('online', restore);
    restore();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      window.removeEventListener('online', restore);
      stopWaiting();
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
        readSessionProfile(session.user.id); // 세션 경로 — getSession 경로와 진행 중 읽기 공유
      } else {
        setProfile(null);
        // 세션이 있다가 사라진 경우 — 명시적 로그아웃이 아니면 만료로 간주
        if (event === 'SIGNED_OUT' && hadSessionRef.current && !explicitSignOutRef.current) {
          toast('세션이 만료됐어요. 다시 로그인해 주세요.', 'warning', 5000);
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
    // 이미 가입된 이메일(Google 가입 포함)은 성공처럼 돌아오고 메일도 가지 않는다 — 화면이 알아보도록 오류로 바꾼다.
    if (isRepeatedSignup(data)) throw new Error('User already registered');
    await acceptExplicitLogin(data, request, generation);
    return data;
  }

  // 가입 인증 메일 다시 보내기 — 없는 주소·이미 인증된 주소도 Supabase는 같은 성공으로 답한다.
  async function resendConfirmation(email) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: authCallbackUrl(window.location.origin) },
    });
    if (error) throw error;
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
    // 로그인했는데 프로필을 아직 받지 못했다 — profile null을 「목표 없음」 같은 빈 상태로 읽지 않게(LOADING-SKELETON-001).
    profileLoading: !!user && profileSettledFor !== user.id,
    isAdmin,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    resendConfirmation,
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
