// A return address is navigation state, never a learning record or arbitrary redirect.
export function safeLibraryReturn(value) {
  if (typeof value !== 'string' || !/^\/materials(?:\?|$)/.test(value) || value.length > 2000) return '/materials';
  try {
    const url = new URL(value, 'https://manabi.invalid');
    if (url.origin !== 'https://manabi.invalid' || url.pathname !== '/materials') return '/materials';
    const allowed = new Set(['view', 'tab', 'q', 'lang', 'level', 'sort', 'unread', 'pinned', 'shown', 'restoreY']);
    for (const key of [...url.searchParams.keys()]) if (!allowed.has(key)) url.searchParams.delete(key);
    return url.pathname + url.search;
  } catch { return '/materials'; }
}

export function libraryReaderHref(href, returnTo, scrollY = null) {
  if (!/^\/(?:viewer|pdf)\/[^/?#]+(?:[?#]|$)/.test(href)) return href;
  const url = new URL(href, 'https://manabi.invalid');
  const back = new URL(safeLibraryReturn(returnTo), 'https://manabi.invalid');
  if (Number.isFinite(scrollY)) back.searchParams.set('restoreY', String(Math.max(0, Math.round(scrollY))));
  url.searchParams.set('returnTo', back.pathname + back.search);
  return url.pathname + url.search + url.hash;
}

export function librarySearchHref(user) {
  return `/materials?${user ? 'view=owned' : 'tab=public'}#library-search`;
}
