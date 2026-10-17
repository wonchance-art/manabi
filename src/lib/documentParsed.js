/**
 * 스트리밍 HTML이 다 도착하고 Suspense 경계에 다 붙은 뒤에 fn을 부른다(HYDRATION-AUTH-001 · HYDRATION-UPDATE-001).
 * 페이지 본문은 app/(app)/loading.jsx Suspense 경계 뒤에서 늦게 흘러오는데(<template id="B:n"> → <div hidden id="S:n"> + $RC),
 * 그 전에 로그인 복원이 AuthProvider 값을 바꾸면(경계 안 RefPatternCheck · BookReader 등이 useAuth를 읽는다) React는 아직 서버 HTML을
 * 기다리는 경계를 하이드레이션하지 못해 클라이언트에서 새로 그린다 — 숨은 서버 조각과 새 조각이 잠시 함께 있어 같은 섹션이 두 번
 * 잡혔다(smoke 「N4 자동사」 .fr-check 2개 · 교재 .book-reader 2개, CI 간헐).
 *
 * 문서 파싱이 끝나도(DOMContentLoaded) 다 붙은 것은 아니다: React 19.2는 도착한 조각을 경계에 붙이는 일($RC)을 묶어서 늦게 한다 —
 * 경계 표시를 「$~」(붙일 차례 기다림)로 바꾸고 마지막 붙이기 뒤 300ms까지 미룬다($RV). React는 「$~」 · 「$?」 경계를 아직
 * 기다리는 중으로 보고, 그 사이 위에서 값이 바뀌면 전환(startTransition) 갱신이어도 서버 HTML을 버리고 새로 그린다
 * (react-dom-client updateSuspenseComponent: isSuspenseInstancePending → retrySuspenseComponentWithoutHydrating).
 * 그래서 파싱이 끝난 뒤 문서에 기다리는 경계가 남았으면 다 붙을 때까지(표시가 「$」로 바뀔 때) 기다린다 — 3초를 넘기면 그만 기다린다.
 * 기다리는 경계가 없으면 바로(같은 틱) 부른다.
 */
const WAITING = new Set(['$?', '$~']);
const SETTLE_LIMIT_MS = 3000;

/** 아직 서버 조각을 기다리거나(「$?」) 붙일 차례를 기다리는(「$~」) Suspense 경계가 문서에 남았나. */
export function hasWaitingBoundary(doc) {
  if (typeof doc?.createTreeWalker !== 'function') return false;
  const walker = doc.createTreeWalker(doc.body || doc, 128 /* NodeFilter.SHOW_COMMENT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if (WAITING.has(node.data)) return true;
  return false;
}

export function whenDocumentParsed(fn, doc = typeof document === 'undefined' ? null : document) {
  if (!doc) { fn(); return () => {}; }
  let active = true, observer = null, timer = 0;
  const stop = () => { active = false; observer?.disconnect(); clearTimeout(timer); doc.removeEventListener?.('DOMContentLoaded', settle); };
  const finish = () => { if (!active) return; stop(); fn(); };
  function settle() {
    if (!active) return;
    if (!hasWaitingBoundary(doc)) { finish(); return; }
    if (observer || typeof MutationObserver !== 'function') { if (!observer) finish(); return; }
    // 붙이기($RV)는 경계 표시(주석)를 「$」로 바꾸고 조각을 옮긴다 — 그때마다 다시 본다.
    observer = new MutationObserver(settle);
    observer.observe(doc, { subtree: true, childList: true, characterData: true });
    timer = setTimeout(finish, SETTLE_LIMIT_MS);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', settle, { once: true });
  else settle();
  return stop;
}
