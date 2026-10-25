// 탭이 닫히는 순간(pagehide)의 PostgREST 쓰기 정본 — 문법 보류함(grammarSrs) · 아는 단어 쓰기(knownWords)가 같이 쓴다.
// 한 곳에 두는 이유: 요청 조립(URL · apikey · 인증 헤더 · keepalive)과 토큰 판정이 둘로 갈리면 한쪽만 고쳐진다
// (리뷰 2026-10-17 KST — 두 에이전트가 같은 전송기를 따로 만들었다). keepaliveSeam.test.js가 두 번째 구현을 막는다.
//
// 왜 supabase-js가 아닌가: supabase-js는 요청마다 keepalive를 줄 수 없고 인증 헤더를 비동기로 붙여, 닫히는 탭에서는
// 요청이 나가기 전에 끊긴다. 그래서 같은 PostgREST 요청을 fetch(keepalive)로 그 자리에서 보낸다 — 토큰은 미리 받아 둔다.
//
// best-effort다(이 주석이 정본 — 다른 곳에 다시 적지 않는다): 다른 출처로 가는 요청에 Authorization · JSON 헤더가 붙어
// 사전 요청(preflight)이 필요한 keepalive라, 일부 브라우저는 이 요청을 거절할 수 있다. 그러면 null — 호출부는 실패로 다룬다
// (문법 보류분은 bfcache 복귀 시 다음 retry가, 아는 단어는 원래 요청이 그대로 진행 중이다).
import { supabase } from './supabase';

/**
 * PostgREST 요청 하나를 keepalive로 보낸다.
 * @param {{ path: string, method: string, query?: Record<string,string>, body?: unknown, prefer?: string, accessToken: string,
 *   url?: string, apiKey?: string, fetchImpl?: Function }} request  path = 표 이름(예: 'grammar_review')
 * @returns {Promise<Response | null>} 응답(ok 판정은 호출부) · 입력이 모자라거나 네트워크 실패면 null
 */
export function postgrestKeepalive({
  path, method, query = {}, body, prefer, accessToken,
  url = process.env.NEXT_PUBLIC_SUPABASE_URL, apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  fetchImpl = typeof fetch === 'function' ? fetch : null,
} = {}) {
  if (!path || !method || !accessToken || !url || !apiKey || !fetchImpl) return Promise.resolve(null);
  const headers = { apikey: apiKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const search = new URLSearchParams(query).toString();
  const init = { method, keepalive: true, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  try {
    return Promise.resolve(fetchImpl(`${url}/rest/v1/${path}${search ? `?${search}` : ''}`, init)).then(res => res || null, () => null);
  } catch {
    return Promise.resolve(null);
  }
}

/**
 * 닫힘 전송에 쓸 만한 토큰인가 — JWT exp가 아직 margin보다 넉넉히 남았는가(독립 리뷰 2026-10-25 KST). 미리 받아 둔 토큰이 그새 만료됐으면
 * keepalive는 401로 조용히 사라진다 — 그때는 호출부가 보통 전송(supabase-js가 토큰을 새로 고친다)으로 돌린다. 읽을 수 없는 토큰도 false.
 */
export function keepaliveTokenUsable(token, { now = Date.now(), marginMs = 60000 } = {}) {
  try {
    const payload = JSON.parse(atob(String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Number.isFinite(payload?.exp) && payload.exp * 1000 - now > marginMs;
  } catch { return false; }
}

/** 지금 로그인한 세션이 그 계정일 때만 토큰을 준다 — 다른 계정의 토큰으로 이 계정의 쓰기를 보내지 않는다. */
export async function sessionTokenFor(accountId) {
  if (!accountId) return null;
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  return session?.access_token && session.user?.id === accountId ? session.access_token : null;
}
