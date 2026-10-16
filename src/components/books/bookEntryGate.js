// 본문 위치로 바로 열기(BOOK-HASH-ENTRY-001 · BOOK-ENTRY-SKELETON-001): /books/japanese-n5#u01-start는 서버가 hash를 모른다.
// 서버 HTML은 늘 표지(BookHome 또는 교재 대기 골격 — books/loading.jsx)를 그려 보낸다. 그대로면 붙기 전까지 표지가 비친다.
// ① 하드 로드: 표지보다 먼저 실행되는 한 줄(HASH_GATE)이 hash가 본문 위치이거나 이 기록에 읽던 자리가 있으면 head에 style을 넣어
//    표지를 끄고 함께 보내 둔 본문 골격(.book-entry-skeleton, 평소에는 꺼짐 — reading-shell.css)을 켠다.
// ② 붙은 뒤: BookReader가 그리기 전(layout effect)에 첫 쪽을 정하고 그 그림에서 style을 뗀다.
// 서버 · 하이드레이션 첫 그림은 늘 같은 마크업(표지 + 그 한 줄 + 꺼진 본문 골격)이라 불일치가 없다.
export const HASH_GATE_ID = 'book-hash-gate';
export const HASH_GATE_CSS = ':root .book-reader>.manabi-book-home,:root .manabi-book-home[aria-busy]{display:none}:root .book-entry-skeleton{display:block}';

/** 주소 hash → 쪽 id(web- · pdf- · audio- 접두는 같은 쪽). 비었거나 깨졌으면 'cover'. */
export const pageFromHash = (hash) => {
  let id;
  try { id = decodeURIComponent(String(hash || '').slice(1)) || 'cover'; } catch { id = 'cover'; }
  return id.replace(/^(?:web|pdf|audio)-/, '');
};
export const coverPage = (id) => !id || id === 'cover' || id.startsWith('toc');

/** 지금 주소가 본문으로 열리는가 — 본문 hash, 또는 이 기록에 남긴 읽던 자리(계정 대조는 BookReader sync가 한다). */
export function readerEntry() {
  if (typeof window === 'undefined') return false;
  return !coverPage(pageFromHash(window.location.hash)) || window.history.state?.manabiBookPosition?.href === window.location.href;
}

// 같은 판정의 하드 로드판 — 교재 대기 골격과 BookReader가 둘 다 보낼 수 있어 이미 있으면 다시 넣지 않는다.
export const HASH_GATE = `(function(){try{if(document.getElementById('${HASH_GATE_ID}'))return;var h='';try{h=decodeURIComponent(location.hash.slice(1))}catch(e){}h=h.replace(/^(?:web|pdf|audio)-/,'');var s=history.state&&history.state.manabiBookPosition;if((h&&h!=='cover'&&h.indexOf('toc')!==0)||(s&&s.href===location.href)){var g=document.createElement('style');g.id='${HASH_GATE_ID}';g.textContent='${HASH_GATE_CSS}';document.head.appendChild(g)}}catch(e){}})()`;

export function hashGate(on) {
  const current = document.getElementById(HASH_GATE_ID);
  if (!on) { current?.remove(); return; }
  if (current) return;
  const style = document.createElement('style');
  style.id = HASH_GATE_ID; style.textContent = HASH_GATE_CSS;
  document.head.appendChild(style);
}
