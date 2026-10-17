// 계정 경계의 react-query 캐시 비우기(AUTH-CACHE-CLEAR-001, 2026-10-17 KST).
// 캐시 키 다수는 계정을 모른다(['material', id] · ['materials'] · ['pdf-info', id] · ['group-members', id] …) — RLS가 계정마다 다른 답을
// 주는데 키가 같다. 전역 staleTime이 2분이라, 같은 탭에서 A 로그아웃 → B 로그인(router.push, 새로 읽기 없음) 뒤 B가 같은 주소를 열면
// A의 비공개 자료가 서버를 거치지 않고 캐시로 그려졌다. 계정이 「있다가 바뀌는」 순간(A → 손님 · A → B) 한 곳(AuthContext adoptUser)에서
// 비운다. 손님 → A(첫 복원 · 로그인)는 비우지 않는다 — 서버가 미리 받아 넣은 서재(HydrationBoundary)가 그 계정의 것이고, 손님 캐시는 공개분이다.
// 기본은 전부 지운다(새 키가 생겨도 새지 않게). 남기는 것은 계정과 무관함을 확인한 정적 · 공개 자료만이다.

/** 계정과 무관한 캐시 뿌리 — 지우지 않는다. 넣기 전에 queryFn이 세션 · RLS · 계정 id에 기대지 않는지 확인한다(accountQueryCache.test). */
export const ACCOUNT_FREE_QUERY_ROOTS = Object.freeze([
  'goal-catalog', // /api/goal-catalog — force-static 공개 응답(교재 과정 목록)
  'zh-hsk-levels', // 번들 JSON(HSK 2026 급수표)
  'guest-book-chapter', // public_book_catalog RPC — 손님에게도 같은 공개 제목 · 책 정보(본문 없음)
]);

export function isAccountFreeQuery(queryKey) {
  return Array.isArray(queryKey) && ACCOUNT_FREE_QUERY_ROOTS.includes(queryKey[0]);
}

/** 계정이 있다가 바뀌면(A → 손님 · A → B) 비운다. 손님 → 계정 · 같은 계정(토큰 갱신)은 그대로. */
export function accountLeft(previousActor, nextActor) {
  return previousActor != null && previousActor !== (nextActor ?? null);
}

/**
 * 손님 → B인데 이 탭에 앞서 다른 계정(A)이 있었으면 한 번 더 비운다(⑤ 늦은 쓰기, OFFLINE-ACCOUNT-SCOPE-001).
 * A의 로그아웃 때 비운 뒤에도, 그때 진행 중이던 A의 mutation onSuccess(setQueryData)나 늦게 끝난 조회가 A의 자료를 다시
 * 넣을 수 있다 — B가 들어오는 순간 그것까지 지운다. 같은 A가 다시 들어오면(A → 손님 → A) A 자신의 것이라 그대로.
 */
export function accountSwitchedIn(lastSignedIn, previousActor, nextActor) {
  return previousActor == null && nextActor != null && lastSignedIn != null && lastSignedIn !== nextActor;
}

/** adoptUser의 한 판정 — 이 둘 중 하나면 계정에 딸린 캐시(react-query · 기기 캐시)를 비운다. */
export function accountCacheReset(lastSignedIn, previousActor, nextActor) {
  return accountLeft(previousActor, nextActor) || accountSwitchedIn(lastSignedIn, previousActor, nextActor);
}

// 앱이 지금 누구로 보고 있나(AuthContext가 adoptUser마다 적는다) — 기기 캐시 읽기가 쓴다. 아직 한 번도 정하지 않았으면 undefined
// (첫 복원 전 · 하이드레이션 전 직접 진입). 토큰이 만료된 채 오프라인이면 getSession은 손님을 돌려주지만, 화면이 A로 보고 있는
// 동안은 A가 받아 둔 자료를 열어야 한다(지하철 — 계정이 바뀐 것이 아니다).
let shownAccount;
const accountWaiters = [];
export function noteAccount(id) {
  shownAccount = id ?? null;
  for (const resolve of accountWaiters.splice(0)) resolve(shownAccount);
}
export function knownAccount() { return shownAccount; }
/** 화면 계정이 정해지면(첫 adoptUser · 손님 확정 · 복원 포기) 그 값 — 네트워크 없이 기다린다(local: 팀 사본은 네트워크 0). */
export function whenAccountKnown() {
  return shownAccount !== undefined ? Promise.resolve(shownAccount) : new Promise((resolve) => accountWaiters.push(resolve));
}

/**
 * 계정을 가로지른 mutation의 늦은 쓰기(MUTATION-ACCOUNT-GEN-001, 2026-10-17 KST) — react-query 내부를 바꾸지 않는다.
 * A로 시작한 mutation이 로그아웃 · 다른 계정 로그인 뒤에 끝나면, 그 onSuccess · onError(되돌리기) · onSettled · mutate(…, { onSuccess })가
 * setQueryData로 A의 자료를 다시 넣는다 — 키가 계정을 모르면(['material', id] 등) B가 그것을 그린다. 어느 키를 썼는지는 알 수 없으므로
 * (쓰기는 콜백 안의 setQueryData), 끝난 순간 계정이 시작 때와 다르면 콜백이 모두 돈 다음(다음 차례) 계정에 딸린 캐시를 한 번 더 비운다.
 * 시작 계정은 mutation 캐시 이벤트(pending)에서 적는다 — 전역 콜백이나 mutation 옵션을 건드리지 않는다. 손님으로 시작한 것은 공개 자료라
 * 비우지 않는다(로그인 직후 서버가 넣은 서재를 지우지 않게). 같은 계정이 다시 들어온 뒤 끝난 것(A → 손님 → A)은 A 자신의 것이라 그대로.
 * 드물게 B의 화면 캐시가 한 번 더 비워져 다시 받는다(비용은 그 한 번).
 * @returns {() => void} 구독 해제
 */
export function watchAccountMutations(queryClient, { currentAccount = knownAccount, schedule = (fn) => setTimeout(fn, 0) } = {}) {
  const cache = queryClient?.getMutationCache?.();
  if (!cache?.subscribe) return () => {};
  const startedAs = new WeakMap();
  return cache.subscribe((event) => {
    if (event?.type !== 'updated' || !event.mutation) return;
    const kind = event.action?.type;
    if (kind === 'pending') {
      if (!startedAs.has(event.mutation)) startedAs.set(event.mutation, currentAccount());
      return;
    }
    if (kind !== 'success' && kind !== 'error') return;
    const was = startedAs.get(event.mutation);
    startedAs.delete(event.mutation);
    if (typeof was !== 'string' || !was || currentAccount() === was) return;
    // 이 이벤트 뒤에 mutate(…, { onSuccess })가 돈다 — 다음 차례에 비워 그 쓰기까지 지운다(그사이 A가 돌아왔으면 그대로).
    schedule(() => { if (currentAccount() !== was) clearAccountQueries(queryClient); });
  });
}

/** 계정에 딸린 캐시를 모두 지운다. 화면에 붙은 쿼리는 다음 그리기(setUser)에서 새 계정으로 다시 받는다. */
export function clearAccountQueries(queryClient) {
  if (!queryClient?.removeQueries) return;
  queryClient.removeQueries({ predicate: (query) => !isAccountFreeQuery(query.queryKey) });
}
