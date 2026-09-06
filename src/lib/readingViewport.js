// A display change preserves a visible token, not a percentage of a changing page.
export function captureReadingAnchor(root, top = 72, bottom = Infinity) {
  if (!root) return null;
  for (const element of root.querySelectorAll('[data-source-token]')) {
    const rect = element.getBoundingClientRect();
    if (rect.bottom > top && rect.top < bottom && rect.width > 0) return { element, top: rect.top };
  }
  return null;
}

export function restoreReadingAnchor(anchor, scrollBy) {
  if (!anchor?.element?.isConnected) return;
  const delta = anchor.element.getBoundingClientRect().top - anchor.top;
  if (Number.isFinite(delta) && Math.abs(delta) > 1) scrollBy({ top: delta, behavior: 'instant' });
}
