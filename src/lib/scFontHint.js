// 간체 글꼴 「학습 언어 힌트」 쿠키(SC-LINK-001 2단계 C, 2026-10-17 KST).
// 배움(/home) · 발견(/discover)은 중국어 글자가 대부분 로그인 뒤 데이터로 온다 — 잎(ZhSlot)이 그때 스타일시트를 걸면
// 그 잎은 스타일시트가 올 때까지 자리만 지킨다. 중국어 학습자는 거의 매번 그 기다림을 겪으므로, 학습 언어에 중국어가
// 있으면 이 기기에 표식 쿠키를 남기고 두 세그먼트의 서버 렌더가 스타일시트를 미리(첫 그림 전에) 건다.
// 값은 '1' 하나(학습 언어 목록 자체는 쿠키에 싣지 않는다). 힌트일 뿐이다 — 틀려도 잎이 스스로 건다(없으면 기다림, 남으면 CSS 한 벌).
export const SC_HINT_COOKIE = 'manabi_sc';
const MAX_AGE = 60 * 60 * 24 * 180;

/** 학습 언어 목록(learnLanguages 결과 — 'Chinese' 등)에 중국어가 있는가. */
export const wantsScFont = (langs) => Array.isArray(langs) && langs.includes('Chinese');

/** 서버: next/headers cookies() 결과에서 힌트를 읽는다. */
export function scHintFromJar(jar) {
  try { return jar?.get?.(SC_HINT_COOKIE)?.value === '1'; } catch { return false; }
}

/** 클라이언트: 지금 쿠키 문자열과 원하는 상태가 다를 때만 쓴다(같으면 아무것도 안 함). */
export function syncScHintCookie(on, doc = typeof document === 'undefined' ? null : document) {
  if (!doc) return false;
  let has = false;
  try { has = doc.cookie.split(';').some(part => part.trim() === `${SC_HINT_COOKIE}=1`); } catch { return false; }
  if (has === Boolean(on)) return false;
  try {
    doc.cookie = on
      ? `${SC_HINT_COOKIE}=1; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`
      : `${SC_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch { return false; }
  return true;
}
