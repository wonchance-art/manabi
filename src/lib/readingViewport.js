// A display change preserves visible text, not a percentage of a changing page.
// Long unsegmented tokens need a text offset; their box may begin above the viewport.
function visibleTextRange(element, top, bottom) {
  const doc=element.ownerDocument;
  if(!doc?.createTreeWalker)return null;
  const walker=doc.createTreeWalker(element,4,{acceptNode:node=>node.parentElement?.closest('rt,.rt-an,.rt-hun')?2:1});
  for(let node=walker.nextNode();node;node=walker.nextNode()) {
    if(!node.textContent.length)continue;
    const range=doc.createRange();let lo=0,hi=node.textContent.length-1,found=null;
    while(lo<=hi) {
      const mid=(lo+hi)>>1;range.setStart(node,mid);range.setEnd(node,mid+1);
      const rect=range.getBoundingClientRect();
      if(rect.bottom>top){found=mid;hi=mid-1;}else lo=mid+1;
    }
    if(found!==null){range.setStart(node,found);range.setEnd(node,found+1);const rect=range.getBoundingClientRect();if(rect.top<bottom&&rect.width>0)return {range,top:rect.top};}
  }
  return null;
}
export function captureReadingAnchor(root, top = 72, bottom = Infinity) {
  if (!root) return null;
  for (const element of root.querySelectorAll('[data-source-token]')) {
    const rect = element.getBoundingClientRect();
    if (rect.bottom > top && rect.top < bottom && rect.width > 0) {
      const inner=rect.top<top?visibleTextRange(element,top,bottom):null;
      return inner?{element,...inner}:{element,top:rect.top};
    }
  }
  return null;
}
export function restoreReadingAnchor(anchor, scrollBy) {
  if (!anchor?.element?.isConnected) return;
  const rect=anchor.range?.startContainer?.isConnected?anchor.range.getBoundingClientRect():anchor.element.getBoundingClientRect();
  const delta = rect.top - anchor.top;
  if (Number.isFinite(delta) && Math.abs(delta) > 1) scrollBy({ top: delta, behavior: 'instant' });
}

// Reveal only the obscured edge; an expanded sheet may leave no usable line.
export function selectedTokenScrollDelta(rect, bounds) {
  const spare = bounds.bottom - bounds.top - (rect.bottom - rect.top);
  if (spare < 0) return 0;
  // A zoomed phone can fit the word but not two full margins. Reduce the
  // margins before giving up on showing the selected text.
  const padding = Math.min(8, spare / 2);
  const top = bounds.top + padding, bottom = bounds.bottom - padding;
  if (rect.top < top) return rect.top - top;
  if (rect.bottom > bottom) return rect.bottom - bottom;
  return 0;
}

// 쪽 넘김 보기(READER-PAGED-001 목업 C) — 본문은 다시 흐르지 않으므로, 바닥 시트가 고른 단어를 덮으면 시트를 낮춘다.
// 덮지 않으면 null(원래 높이). 낮춘 높이는 단어 아래 남은 자리, 단 카드의 핵심(머리줄·표제어·뜻·등급 4버튼 — AE-R2
// 「스크롤 없이 보인다」 계약)이 들어가는 min보다 작게는 줄이지 않는다 — 부르는 쪽이 실제 카드에서 잰 값을 주고, 못 재면
// 390px 실측(359px)에 여유를 둔 368px. 아주 아래 줄은 그래도 덮일 수 있다(그때도 카드가 먼저다).
export function compactSheetHeight({ tokenBottom, sheetTop, sheetBottom, min = 368, margin = 12 }) {
  if (![tokenBottom, sheetTop, sheetBottom].every(Number.isFinite) || tokenBottom <= sheetTop - 8) return null;
  return Math.max(min, Math.floor(sheetBottom - tokenBottom - margin));
}

// 쪽 넘김 보기 A안(VIEWER-AUDIT 2, 오너 「권장대로」 2026-10-17 KST): 바닥 시트가 화면 아래 절반의 단어를 덮었다(낮춰도 카드 핵심
// 높이 아래로는 못 줄여서). 고른 단어가 아래 절반이면 시트를 머리줄 아래(topLimit)에 세운다 — 쪽 · 쪽 경계는 그대로다.
// 위에 세울 때도 단어 위 남은 자리가 모자라면 낮추되 카드 핵심(min — 부르는 쪽이 잰 값) 아래로는 줄이지 않고, 원래 높이보다
// 키우지도 않는다(height null = 원래 높이 — 긴 문장 카드는 핵심이 원래 높이를 넘는다, viewer-word-card 「zh 390 long sentence」).
// 화면 가운데 띠(390×844에서 약 y 441–529)의 단어는 어느 쪽에 세워도 핵심 높이 때문에 덮일 수 있다 — 덮는 양이 적은 쪽(중점 기준)을 고른다.
export function pagedSheetDock({ tokenTop, tokenBottom, viewportHeight, topLimit, naturalHeight, min = 368, margin = 12 }) {
  if (![tokenTop, tokenBottom, viewportHeight, topLimit, naturalHeight].every(Number.isFinite)) return { dock: 'bottom' };
  if ((tokenTop + tokenBottom) / 2 <= viewportHeight / 2) return { dock: 'bottom' };
  const height = Math.max(min, Math.floor(tokenTop - margin - topLimit));
  return { dock: 'top', top: Math.ceil(topLimit), height: height >= naturalHeight ? null : height };
}
