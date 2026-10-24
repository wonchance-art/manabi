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
// floor(뷰어 점검 A1, 오너 승인 2026-10-23 KST): 핵심이 다 안 들어가도 머리줄 · 등급 줄 · 표제어 한 줄(floor)까지는 낮추고 카드 안에서
// 스크롤한다 — 예전엔 핵심(min) 아래로 못 줄여 아래쪽 단어를 덮었다. floor를 안 주면 min 그대로(예전 동작).
// 낮춘 시트(뷰어 점검 A1, 오너 승인 2026-10-23 KST)의 카드 본문을 뜻 줄 끝이 보일 만큼만 내린다 — 표제어가 맨 위를 넘지는
// 않는다(그래도 모자라면 표제어부터 보이고 뜻은 아래로 스크롤). 문장 줄 · 칩이 먼저 위로 밀린다. 내린 값은 data-head-scroll에
// 적어 사람의 스크롤과 가른다 — AE-R3 첫 화면 단계(ViewerGlyphColumn)는 이 자동 스크롤을 0으로 보고, 단계가 올라 내용이 줄면 다시 맞춘다.
export function anchorCardHead(body) {
  const head = body?.querySelector('.reader-card-headword'), meaning = body?.querySelector('.word-detail-card__meaning');
  if (!head || !meaning || !body.clientHeight) return;
  const origin = body.getBoundingClientRect().top - body.scrollTop;
  const headAt = head.getBoundingClientRect().top - origin - 4;
  const need = Math.ceil(meaning.getBoundingClientRect().bottom - origin - body.clientHeight - 0.5);
  body.scrollTop = need > 0 ? Math.max(0, Math.min(Math.floor(headAt), need)) : 0;
  if (body.scrollTop > 0) body.dataset.headScroll = String(body.scrollTop);
  else delete body.dataset.headScroll;
}
/** 지금 카드 본문 스크롤이 anchorCardHead가 내린 그대로인가(사람이 움직이지 않았다). */
export function headScrolled(body) {
  return !!body?.dataset?.headScroll && Math.abs(body.scrollTop - Number(body.dataset.headScroll)) < 1;
}

export function compactSheetHeight({ tokenBottom, sheetTop, sheetBottom, min = 368, floor = min, margin = 12 }) {
  if (![tokenBottom, sheetTop, sheetBottom].every(Number.isFinite) || tokenBottom <= sheetTop - 8) return null;
  const room = Math.floor(sheetBottom - tokenBottom - margin);
  return room >= Math.min(floor, min) ? Math.max(Math.min(floor, min), room) : Math.max(min, room);
}

// 쪽 넘김 보기 A안(VIEWER-AUDIT 2, 오너 「권장대로」 2026-10-17 KST): 바닥 시트가 화면 아래 절반의 단어를 덮었다(낮춰도 카드 핵심
// 높이 아래로는 못 줄여서). 고른 단어가 아래 절반이면 시트를 머리줄 아래(topLimit)에 세운다 — 쪽 · 쪽 경계는 그대로다.
// 위에 세울 때도 단어 위 남은 자리가 모자라면 낮추되 카드 핵심(min — 부르는 쪽이 잰 값) 아래로는 줄이지 않고, 원래 높이보다
// 키우지도 않는다(height null = 원래 높이 — 긴 문장 카드는 핵심이 원래 높이를 넘는다, viewer-word-card 「zh 390 long sentence」).
// 위에 세운 시트가 단어를 덮으면(단어 위 자리 < 시트가 줄 수 있는 가장 낮은 높이 = min(카드 핵심, 원래 높이)) 바닥(지금 그대로)에
// 둔다(2026-10-17 KST 오너 「권장대로」: 머리줄이 큰 배치 — 390 듣기 중 머리줄 바닥 386 · 단어 540 — 에서 위 시트 394–834가 단어를
// 30/30 덮었다). 시트는 원래 높이보다 커지지 않으므로 핵심이 원래 높이를 넘는 카드(게스트 카드 실측 핵심 1113 · 원래 440)는 원래 높이로
// 잰다 — 단어 689 · 위 끝 242면 242–682로 덮지 않으니 위에 선다. 바닥 시트도 단어를 덮을 수 있다(낮추기가 핵심 아래로는 못 줄인다) — 기록만.
// 좌표는 모두 배치 뷰포트 기준 — 보이는 영역은 visualViewport의 offsetTop부터 height만큼이다(키보드가 열리면 줄고 내려간다).
// 반대쪽 붙이기(뷰어 점검 A1): floor · sheetBottom(바닥 시트 아래 끝)을 주면 ① 바닥 시트가 단어를 덮을 때 위 자리가 되면 위에 세우고
// ② 어느 쪽도 핵심이 안 들어가면 floor까지 낮춘 쪽(더 넓은 쪽)에 둔다(카드 안 스크롤). 둘 다 floor도 안 되면 지금처럼 바닥(덮을 수 있다).
// 두 값을 안 주면 예전 판정 그대로다.
export function pagedSheetDock({ tokenTop, tokenBottom, viewportTop = 0, viewportHeight, topLimit, naturalHeight, min = 368, floor = min, sheetBottom, margin = 12 }) {
  if (![tokenTop, tokenBottom, viewportTop, viewportHeight, topLimit, naturalHeight].every(Number.isFinite)) return { dock: 'bottom' };
  const need = Math.min(min, naturalHeight); // 위에 세운 시트의 가장 낮은 높이
  const lowest = Math.min(floor, need); // 카드 안에서 스크롤하면 줄일 수 있는 가장 낮은 높이
  const roomAbove = tokenTop - Math.ceil(topLimit);
  const roomBelow = Number.isFinite(sheetBottom) ? Math.floor(sheetBottom - tokenBottom - margin) : NaN;
  const top = height => ({ dock: 'top', top: Math.ceil(topLimit), height: height >= naturalHeight ? null : height });
  if ((tokenTop + tokenBottom) / 2 <= viewportTop + viewportHeight / 2) {
    // 위 절반: 바닥이 기본. 바닥이 핵심 높이로 단어를 덮고 위에 핵심이 들어가면 위로, 위도 아래도 핵심이 안 되면 floor가 되는 쪽으로.
    if (!Number.isFinite(roomBelow) || roomBelow >= need) return { dock: 'bottom' };
    if (roomAbove >= need) return top(Math.max(need, Math.floor(tokenTop - margin - topLimit)));
    if (roomBelow >= lowest) return { dock: 'bottom' };
    if (roomAbove >= lowest) return top(Math.max(lowest, Math.floor(tokenTop - margin - topLimit)));
    return { dock: 'bottom' };
  }
  if (roomAbove >= need) return top(Math.max(need, Math.floor(tokenTop - margin - topLimit)));
  // 아래 절반인데 위에 핵심이 안 들어간다 — 바닥 자리가 floor도 안 되고 위가 floor는 되면 위에 낮춰 세운다.
  if (lowest < need && roomAbove >= lowest && !(roomBelow >= lowest)) return top(Math.max(lowest, Math.floor(tokenTop - margin - topLimit)));
  return { dock: 'bottom' }; // 그 높이로도 단어를 덮는다(바닥 낮추기가 floor까지 줄인다)
}
