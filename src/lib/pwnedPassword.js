/**
 * 유출된 비밀번호 확인 (PWNED-PASSWORD-001 — 오너 승인 2026-10-26 KST 「권장대로 진행」).
 * Supabase 기본 「유출 비밀번호 차단」은 Pro 요금제 기능이라(조직은 Free) 앱에서 같은 확인을 한다.
 * 쓰는 곳: 회원가입 · 재설정 링크의 새 비밀번호 · 내 정보 「비밀번호 바꾸기/만들기」 — Supabase를 부르기 전에.
 * 로그인(signIn)은 확인하지 않는다.
 *
 * k-익명성(Have I Been Pwned 「Pwned Passwords」 range API):
 *   SHA-1(비밀번호) 40자 중 **앞 5자만** 우리 라우트(/api/auth/password-check)로 보낸다. 라우트가 HIBP에서
 *   그 5자로 시작하는 접미사 목록(Add-Padding: true)을 받아 그대로 돌려주고, 나머지 35자 비교는 이 브라우저 안에서만 한다.
 *   비밀번호 · 전체 해시 · 35자 접미사는 어디로도 보내지 않고 기록하지 않는다.
 *
 * 열린 실패(fail-open): crypto.subtle이 없거나, 라우트 · HIBP가 실패하거나 2.5초 안에 답하지 않으면 null(모름)을 돌려준다.
 * 화면은 true일 때만 막는다 — 확인 서비스 장애가 가입 · 비밀번호 변경을 막지 않게.
 */
export const PASSWORD_CHECK_ENDPOINT = '/api/auth/password-check';
export const PASSWORD_CHECK_TIMEOUT_MS = 2500;

/** SHA-1 대문자 hex 40자. Web Crypto가 없으면 null. */
export async function sha1Hex(text) {
  const subtle = globalThis.crypto?.subtle;
  if (typeof subtle?.digest !== 'function') return null;
  const digest = await subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * range 본문(줄마다 「35자 접미사:횟수」, CRLF)에 이 접미사가 있는지.
 * Add-Padding이 섞는 가짜 줄은 횟수가 0이라, 맞아도 유출로 치지 않는다.
 */
export function rangeHasSuffix(body, suffix) {
  const want = String(suffix || '').toUpperCase();
  if (want.length !== 35) return false;
  for (const line of String(body || '').split(/\r?\n/)) {
    const [hashPart, countPart] = line.trim().split(':');
    if (hashPart?.toUpperCase() === want && Number(countPart) > 0) return true;
  }
  return false;
}

/**
 * @returns {Promise<true|false|null>} true = 유출 목록에 있음(막는다) · false = 없음 · null = 확인하지 못함(막지 않는다)
 */
export async function isPasswordPwned(password, {
  fetchImpl = globalThis.fetch,
  timeoutMs = PASSWORD_CHECK_TIMEOUT_MS,
  endpoint = PASSWORD_CHECK_ENDPOINT,
} = {}) {
  if (typeof password !== 'string' || !password || typeof fetchImpl !== 'function') return null;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer;
  try {
    const hash = await sha1Hex(password);
    if (!hash || hash.length !== 40) return null;
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const timeout = new Promise(resolve => {
      timer = setTimeout(() => { controller?.abort(); resolve(null); }, timeoutMs);
    });
    const lookup = (async () => {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prefix }),
        cache: 'no-store',
        credentials: 'omit',
        signal: controller?.signal,
      });
      if (!res?.ok) return null;
      return rangeHasSuffix(await res.text(), suffix);
    })();
    return await Promise.race([lookup, timeout]);
  } catch {
    // 원인(네트워크 · 중단 · 해시)은 남기지 않는다 — 비밀번호와 엮일 수 있는 것은 기록하지 않는다.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
