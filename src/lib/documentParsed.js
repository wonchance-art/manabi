/**
 * 스트리밍 HTML이 다 도착한 뒤에 fn을 부른다(HYDRATION-AUTH-001). 페이지 본문은 app/(app)/loading.jsx Suspense 경계 뒤에서
 * 늦게 흘러오는데(<template id="B:n"> → <div hidden id="S:n"> + $RC), 그 전에 로그인 복원이 AuthProvider 값을 바꾸면(경계 안 RefPatternCheck 등이 useAuth를 읽는다)
 * React는 아직 서버 HTML을 기다리는 경계를 하이드레이션하지 못해 클라이언트에서 새로 그린다 — 숨은 서버 조각과 새 조각이
 * 잠시 함께 있어 같은 섹션이 두 번 잡혔다(smoke 「N4 자동사」 .fr-check 2개: 클라이언트 id _r_6_ · 서버 id _R_…, CI 간헐).
 * 문서 파싱이 끝나면(DOMContentLoaded) 스트림의 모든 경계가 서버 HTML로 채워진 뒤다. 이미 끝났으면 바로(같은 틱) 부른다.
 */
export function whenDocumentParsed(fn, doc = typeof document === 'undefined' ? null : document) {
  if (!doc || doc.readyState !== 'loading') { fn(); return () => {}; }
  let active = true;
  const run = () => { if (active) fn(); };
  doc.addEventListener('DOMContentLoaded', run, { once: true });
  return () => { active = false; doc.removeEventListener('DOMContentLoaded', run); };
}
