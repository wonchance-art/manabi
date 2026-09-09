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
