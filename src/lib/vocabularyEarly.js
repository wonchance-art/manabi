/**
 * 단어장 학습 읽기 일찍 시작(VOCAB-EARLY-001) — 문서를 처음 열 때 머리 스크립트가 /api/learning/vocabulary를 바로 보내고,
 * 화면이 붙은 뒤 fetchVocabularyLearningRows가 그 응답을 한 번 넘겨받는다.
 * 전에는 붙기(하이드레이션) · 로그인 확인이 끝난 뒤에야 보내 단어 레벨 · 뷰어 · 단어장 · 홈이 첫 그림 뒤 약 0.7~1초를 그냥 기다렸다
 * (390 · CPU×4 · 4G · 합성 무거운 계정 실측 2026-10-28 KST — 단어 레벨 시작 1,054 ms, 뷰어 1,586 ms).
 * 요청 · 응답 · 검증은 그대로다(같은 주소 · 같은 자격 증명, 넘겨받은 본문도 계정 · 모양 검사를 똑같이 거친다). 성공 응답만 넘겨받고,
 * 실패 · 오래됨(15초) · 다른 주소면 지금처럼 새로 보낸다. 로그인 쿠키가 없거나 그 화면이 쓰지 않는 읽기는 보내지 않는다.
 * <link rel=preload>는 쓰지 않는다 — 읽기가 cache:'no-store'라 브라우저마다(iOS Safari) 넘겨받기가 갈린다.
 */
export const VOCAB_EARLY_KEY = '__manabiVocabEarly';
export const VOCAB_EARLY_MAX_AGE_MS = 15000;
const FULL = '/api/learning/vocabulary?view=learning';
const SUMMARY = `${FULL}&fields=summary`;

/** 첫 화면이 바로 이 읽기를 하는 경로(실측 — 그 밖의 경로는 보내지 않는다). */
export function earlyVocabularyUrl(pathname) {
  if (/^\/(?:japanese|chinese)\/vocab\/[^/]+\/?$/.test(pathname) || /^\/(?:english|french)\/words\/[^/]+\/?$/.test(pathname)
    || /^\/viewer\/[^/]+\/?$/.test(pathname) || /^\/vocab\/?$/.test(pathname)) return FULL;
  if (/^\/home\/?$/.test(pathname)) return SUMMARY;
  return null;
}

/** Supabase 로그인 쿠키(sb-<ref>-auth-token, 나뉘면 .0)가 있을 때만 — 손님은 보내지 않는다. 유효성은 서버가 본다. */
export const hasAuthCookie = (cookie) => /(?:^|;\s*)sb-[^=;]*-auth-token(?:\.0)?=/.test(cookie || '');

/** 머리 스크립트(뿌리 레이아웃 인라인) — 위 두 판정과 같은 규칙을 ES5로 손으로 옮긴 것(계약 테스트가 둘을 경로마다 맞춰 본다). */
export const VOCAB_EARLY_SCRIPT = "try{var vp=location.pathname,vu=null;"
  + "if(/^\\/(?:japanese|chinese)\\/vocab\\/[^/]+\\/?$/.test(vp)||/^\\/(?:english|french)\\/words\\/[^/]+\\/?$/.test(vp)"
  + "||/^\\/viewer\\/[^/]+\\/?$/.test(vp)||/^\\/vocab\\/?$/.test(vp))vu='" + FULL + "';"
  + "else if(/^\\/home\\/?$/.test(vp))vu='" + SUMMARY + "';"
  + "if(vu&&/(?:^|;\\s*)sb-[^=;]*-auth-token(?:\\.0)?=/.test(document.cookie)&&window.fetch)"
  + "window." + VOCAB_EARLY_KEY + "={url:vu,at:Date.now(),res:fetch(vu,{method:'GET',credentials:'same-origin',cache:'no-store'})};"
  + "}catch(e){}";

/** 같은 주소 · 15초 안의 일찍 보낸 읽기를 한 번만 넘긴다(없으면 null). 넘긴 뒤에는 지운다 — 두 번째 읽기는 새로 보낸다. */
export function takeEarlyVocabulary(url, { now = Date.now(), target = globalThis } = {}) {
  const early = target?.[VOCAB_EARLY_KEY];
  if (!early) return null;
  try { delete target[VOCAB_EARLY_KEY]; } catch { target[VOCAB_EARLY_KEY] = undefined; }
  if (early.url !== url || !(now - early.at >= 0 && now - early.at <= VOCAB_EARLY_MAX_AGE_MS) || typeof early.res?.then !== 'function') return null;
  return early.res.then((response) => (response?.ok ? response : null), () => null);
}
