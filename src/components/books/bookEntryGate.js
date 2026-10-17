// 본문 위치로 바로 열기(BOOK-HASH-ENTRY-001 · BOOK-ENTRY-SKELETON-001): /books/japanese-n5#u01-start는 서버가 hash를 모른다.
// 서버 HTML은 늘 표지(BookHome 또는 교재 대기 골격 — books/loading.jsx)를 그려 보낸다. 그대로면 붙기 전까지 표지가 비친다.
// ① 하드 로드: 표지보다 먼저 실행되는 한 줄(HASH_GATE)이 hash가 본문 위치이거나 이 기록에 읽던 자리가 있으면 head에 style을 넣어
//    표지를 끄고 함께 보내 둔 본문 골격(.book-entry-skeleton, 평소에는 꺼짐 — reading-shell.css)을 켠다.
// ② 붙은 뒤: BookReader가 그리기 전(layout effect)에 첫 쪽을 정하고 그 그림에서 style을 뗀다.
// 서버 · 하이드레이션 첫 그림은 늘 같은 마크업(표지 + 그 한 줄 + 꺼진 본문 골격)이라 불일치가 없다.
export const HASH_GATE_ID = 'book-hash-gate';
export const HASH_GATE_CSS = ':root .book-reader>.manabi-book-home,:root .manabi-book-home[aria-busy]{display:none}:root .book-entry-skeleton{display:block}';
// 과가 아닌 쪽(책 사용법 guide- · 찾기 reference- · 문화 읽기 culture- …)은 과 머리에 부제 · 목표 · 과 번호가 없다 — 본문 골격의 그 칸을 뺀다.
export const HASH_GATE_PLAIN_CSS = ':root .book-entry-skeleton .book-entry-lesson{display:none}';

/** 주소 hash → 쪽 id(web- · pdf- · audio- 접두는 같은 쪽). 비었거나 깨졌으면 'cover'. */
export const pageFromHash = (hash) => {
  let id;
  try { id = decodeURIComponent(String(hash || '').slice(1)) || 'cover'; } catch { id = 'cover'; }
  return id.replace(/^(?:web|pdf|audio)-/, '');
};
export const coverPage = (id) => !id || id === 'cover' || id.startsWith('toc');
/** 과 본문 쪽인가(u01-… ~ u42-…). 아니면 과 머리가 단순하다. 읽던 자리(hash 없음)는 과로 둔다. */
export const lessonPage = (id) => coverPage(id) || /^u\d{2}/.test(id);

/** 지금 주소가 본문으로 열리는가 — 본문 hash, 또는 이 기록에 남긴 읽던 자리(계정 대조는 BookReader sync가 한다). */
/** 지금 주소의 본문이 과 본문인가 — 링크 이동 때 본문 골격의 머리 모양. */
export function lessonEntry() {
  return typeof window === 'undefined' || lessonPage(pageFromHash(window.location.hash));
}
export function readerEntry() {
  if (typeof window === 'undefined') return false;
  return !coverPage(pageFromHash(window.location.hash)) || window.history.state?.manabiBookPosition?.href === window.location.href;
}

// 같은 판정의 하드 로드판 — 교재 대기 골격과 BookReader가 둘 다 보낼 수 있어 이미 있으면 다시 넣지 않는다.
export const HASH_GATE = `(function(){try{if(document.getElementById('${HASH_GATE_ID}'))return;var h='';try{h=decodeURIComponent(location.hash.slice(1))}catch(e){}h=h.replace(/^(?:web|pdf|audio)-/,'');var s=history.state&&history.state.manabiBookPosition;if((h&&h!=='cover'&&h.indexOf('toc')!==0)||(s&&s.href===location.href)){var g=document.createElement('style');g.id='${HASH_GATE_ID}';g.textContent='${HASH_GATE_CSS}'+(h&&h!=='cover'&&h.indexOf('toc')!==0&&!/^u\\d{2}/.test(h)?'${HASH_GATE_PLAIN_CSS}':'');document.head.appendChild(g)}}catch(e){}})()`;

/**
 * 같은 문서 hash 이동(주소창 · 고유 링크 · 브라우저 이동)을 Next 라우터에 알린다(BOOK-HASH-RACE-001).
 * 그런 이동은 Next의 pushState 패치를 거치지 않아 라우터 주소(canonicalUrl)가 옛 hash에 머문다. 그 전에 걸린 라우터 갱신
 * (읽던 자리 replaceState → ACTION_RESTORE — transition이라 늦게 반영)이 들어오면 HistoryUpdater가 주소를 옛 hash로 되돌리고,
 * 뒤이은 hashchange가 그 주소를 읽어 앞 과로 되돌아갔다(4배 감속에서 다른 과 hash 이동 160회 중 8회, 2026-10-17 KST 실측).
 * 패치된 replaceState로 새 주소를 넘겨 라우터의 마지막 갱신이 늘 이 주소가 되게 한다 — Next 표지(__NA · tree)가 있으면 패치가
 * 그냥 지나가므로 빼고 넘긴다(패치가 지금 기록의 표지를 다시 붙인다). 다른 주소의 읽던 자리는 이 기록에 남기지 않는다.
 */
export function announceFragmentUrl(href) {
  const own = { ...(window.history.state || {}) };
  delete own.__NA; delete own.__PRIVATE_NEXTJS_INTERNALS_TREE;
  if (own.manabiBookPosition && own.manabiBookPosition.href !== href) delete own.manabiBookPosition;
  window.history.replaceState(own, '', href);
  // 고유 hash 이동의 새 기록은 state가 null이라 패치가 붙일 표지가 없다 — `{}`로 남은 기록으로 뒤로 가면 Next가 새로 고친다
  // (onPopState의 !__NA). 표지를 직접 찍는다(표지가 있으면 패치를 지나가 RESTORE가 더 생기지 않고, tree가 없으면 traverse가 지금 tree를 쓴다).
  if (!window.history.state?.__NA) window.history.replaceState({ ...(window.history.state || {}), __NA: true }, '', href);
}

export function hashGate(on) {
  const current = document.getElementById(HASH_GATE_ID);
  if (!on) { current?.remove(); return; }
  if (current) return;
  const style = document.createElement('style');
  style.id = HASH_GATE_ID; style.textContent = HASH_GATE_CSS;
  document.head.appendChild(style);
}
