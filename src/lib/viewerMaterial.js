// 뷰어 자료 조회 정본 + 조기 조회 등록부 — ViewerPage에서 뺐다(VIEWER-ENTRY R1, 2026-10-17 KST).
// 서재 카드를 누르는 순간 조회를 띄우려면 서재가 이 함수를 불러야 하는데, ViewerPage를 import하면 서재 번들에 뷰어 JS가 통째로
// 끌려온다. 그래서 조회 · 등록부만 이 작은 모듈에 둔다(의존: supabase · 기기 캐시 · 팀 사본 · 책 메타뿐 — viewerEntryWarm.test가
// import 그래프로 지킨다). ViewerPage와 서재가 같은 fetchMaterial · 같은 등록부를 쓴다 — 결과 · 오류 · 오프라인 폴백이 그대로다.
import { supabase } from './supabase';
import { knownAccount, whenAccountKnown } from './accountQueryCache';
import { cacheMaterial, getCachedMaterial } from './offlineCache';
import { isLocalId, parseLocalId } from './classBoard';
import { getSharedCopy } from './sharedStore';
import { getBook } from './bookMeta';

/**
 * 자료 조회 — 온라인이면 네트워크가 정본(계약 6)이고, 성공분은 오프라인용으로
 * 남긴다(사용자 조작 0 — 뷰어에 들어온 것 자체가 '이 자료를 읽는다'는 신호).
 * 네트워크가 죽었을 때만 캐시로 폴백한다: 지하철·비행기에서 읽던 자료가 이어진다(v2-N R1).
 * NOT_FOUND(자료가 실제로 없음)는 폴백하지 않는다 — 삭제된 자료가 캐시로 되살아나면
 * 그것이야말로 스테일이다.
 */
export async function fetchMaterial(id) {
  // 팀 사본(v2-AB R2) — `local:<id>`는 **네트워크 0**: 기기 사본(sharedStore)만 연다. 없으면 LOCAL_MISSING
  // (캐시 폴백·서버 조회 없음 — 받기는 팀 페이지만 한다). 사본이 없어도 팀 페이지로 돌아갈 길은 ?team=가 준다.
  if (isLocalId(id)) {
    // 팀 사본도 계정별(OFFLINE-ACCOUNT-SCOPE-001) — 화면 계정, 아직 모르면(첫 복원 전 직접 진입) 정해질 때까지 기다린다.
    const shown = knownAccount();
    const account = shown !== undefined ? shown : await whenAccountKnown(); // 세션 조회(토큰 갱신)도 하지 않는다 — 네트워크 0
    const copy = await getSharedCopy(parseLocalId(id), { account });
    if (!copy?.material) {
      const err = new Error('LOCAL_MISSING');
      err.code = 'LOCAL_MISSING';
      throw err;
    }
    return { ...copy.material, __local: true, __team: copy.team };
  }
  // 기기 캐시는 계정별이다(OFFLINE-ACCOUNT-SCOPE-001) — 이 조회를 보내는 계정을 요청과 함께 잡는다(나란히 — 기다림을 늘리지 않음).
  // 늦게 읽으면 로그아웃 · 계정 전환 뒤의 계정으로 적혀 남의 자료가 그 계정 몫이 된다.
  const accountRequest = supabase.auth.getSession().then(({ data: auth }) => auth?.session?.user?.id ?? null, () => null);
  try {
    const { data, error } = await supabase
      .from('reading_materials')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const err = new Error('NOT_FOUND');
      err.code = 'NOT_FOUND';
      throw err;
    }
    // fire-and-forget이되 완전 격리 — 캐시 실패가 아래 catch로 새면 네트워크
    // 성공분이 캐시 폴백으로 빠진다(계약 4·6 동시 위반).
    Promise.resolve().then(async () => cacheMaterial(data, { owner: await accountRequest })).catch(() => {});
    return data;
  } catch (err) {
    if (err?.code === 'NOT_FOUND') throw err;
    // 읽는 계정은 화면이 보고 있는 계정(AuthContext)이 정본 — 토큰이 만료된 채 오프라인이면 getSession은 손님을 돌려준다.
    // 아직 정하지 않았으면(첫 복원 전 직접 진입) 요청과 함께 잡은 세션 계정.
    const shown = knownAccount();
    const cached = await getCachedMaterial(id, { account: shown !== undefined ? shown : await accountRequest });
    if (!cached) throw err;   // 캐시가 없으면 기존 에러 화면 그대로(계약 5)
    // 비로그인에게 책 장 본문은 없다(BOOK-GUEST-GATE-1) — 로그인했을 때 받아 둔 사본도 로그아웃 뒤에는 열지 않는다.
    if (getBook(cached.processed_json?.metadata) && !(await supabase.auth.getSession()).data?.session) throw err;
    return { ...cached, __offline: true };
  }
}

// 조기 조회(VIEWER-FIRST-TOKEN-001 · VIEWER-ENTRY R1) — 두 곳에서 띄운다.
//   ① 직접 진입: ViewerPage 모듈이 평가될 때(하이드레이션 전) 주소의 자료. 계정은 아직 모른다(owner undefined).
//   ② 서재 카드: 누르는 순간(뷰어 서버 응답 · JS 청크 15개를 기다리는 동안) 그 자료. 누른 계정을 같이 적는다.
// 뷰어 useQuery가 같은 id로 한 번만 받아 쓴다. 다른 id · 늦음(EARLY_MATERIAL_MAX_AGE_MS) · 계정이 다름(전환 · 로그아웃)이면 넘기지 않고
// 새로 받는다 — 오래된 응답이나 다른 사람의 응답을 화면에 내지 않는다. 팀 사본(local:)은 네트워크가 없어 띄우지 않는다.
export const EARLY_MATERIAL_MAX_AGE_MS = 10000;
let earlyMaterial = null;

export function viewerMaterialId(pathname) {
  const match = /^\/viewer\/([^/?#]+)\/?$/.exec(String(pathname || '').split(/[?#]/)[0]);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

/** owner: 누른 계정 id(로그인) · null(손님) · undefined(모름 — 직접 진입). 같은 id · 같은 계정으로 이미 띄웠으면 그것을 그대로 둔다. */
export function startEarlyMaterial(pathname, now = Date.now(), { owner, fetch = fetchMaterial } = {}) {
  const id = viewerMaterialId(pathname);
  if (!id || isLocalId(id)) return null;
  const live = earlyMaterial;
  if (live && live.id === id && now - live.at <= EARLY_MATERIAL_MAX_AGE_MS && (owner === undefined || live.owner === owner)) return live;
  const promise = fetch(id);
  promise.catch(() => {}); // 쓰는 쪽(useQuery)이 오류를 받는다 — 여기서는 처리되지 않은 거부로 남기지 않는다
  earlyMaterial = { id, promise, at: now, owner };
  return earlyMaterial;
}

/** 같은 id로 띄워 둔 조회를 한 번만 넘긴다(다시 받기 · 재시도는 새로 조회). 없거나 · 늦었거나 · 다른 계정이 띄웠으면 null. */
export function takeEarlyMaterial(id, now = Date.now(), { owner } = {}) {
  const early = earlyMaterial;
  if (!early || early.id !== String(id)) return null;
  earlyMaterial = null;
  if (now - early.at > EARLY_MATERIAL_MAX_AGE_MS) return null;
  // 서재에서 띄운 것은 누른 계정의 것이다 — 지금 계정(전환 · 로그아웃 뒤 손님)과 다르면 버린다. 직접 진입(모름)은 같은 첫 화면이라 그대로.
  if (early.owner !== undefined && owner !== undefined && early.owner !== owner) return null;
  return early.promise;
}

/** 뷰어 useQuery의 queryFn — 띄워 둔 조회가 있으면 그것, 없으면 새로. 띄운 조회가 실패하면(없음 NOT_FOUND 말고) 한 번 새로 받는다. */
export function loadMaterial(id, { owner, now = Date.now(), fetch = fetchMaterial } = {}) {
  const early = takeEarlyMaterial(id, now, { owner });
  if (!early) return fetch(id);
  return early.catch((err) => {
    if (err?.code === 'NOT_FOUND' || err?.code === 'LOCAL_MISSING') throw err;
    return fetch(id);
  });
}
