// A return address is navigation state, never a learning record or arbitrary redirect.
export function safeLibraryReturn(value) {
  if (typeof value !== 'string' || !/^\/materials(?:\?|$)/.test(value) || value.length > 2000) return '/materials';
  try {
    const url = new URL(value, 'https://manabi.invalid');
    if (url.origin !== 'https://manabi.invalid' || url.pathname !== '/materials') return '/materials';
    const allowed = new Set(['view', 'tab', 'q', 'lang', 'level', 'sort', 'unread', 'pinned', 'shown', 'restoreY', 'collection', 'kind', 'state', 'tools']);
    for (const key of [...url.searchParams.keys()]) if (!allowed.has(key)) url.searchParams.delete(key);
    return url.pathname + url.search;
  } catch { return '/materials'; }
}

// Classroom notes return to their input session. Keep the library-only helper strict.
export function safeReaderReturn(value) {
  if(typeof value==='string'&&value.length<=2000&&/^\/class\/[a-z0-9][a-z0-9-]{0,15}(?:\?|$)/.test(value)){
    const url=new URL(value,'https://manabi.invalid');
    if(!url.hash){const clean=new URLSearchParams();const day=url.searchParams.get('day');
      if(/^\d{4}-\d{2}-\d{2}$/.test(day||'')&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day)clean.set('day',day);
      if(['notes','book'].includes(url.searchParams.get('tab')))clean.set('tab',url.searchParams.get('tab'));
      return url.pathname+(clean.size?'?'+clean:'');}
  }
  if (typeof value === 'string' && value.length <= 2000 && /^\/class\/[a-z0-9][a-z0-9-]{0,15}\/live(?:\?|$)/.test(value)) {
    const url = new URL(value, 'https://manabi.invalid');
    if (!url.hash && /^\/class\/[a-z0-9][a-z0-9-]{0,15}\/live$/.test(url.pathname)) {
      const day = url.searchParams.get('day');
      const validDay = /^\d{4}-\d{2}-\d{2}$/.test(day || '') && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0,10) === day;
      return url.pathname + (validDay ? `?day=${day}` : '');
    }
  }
  return safeLibraryReturn(value);
}

export function libraryReaderHref(href, returnTo, scrollY = null) {
  if (!/^\/(?:viewer|pdf|books)\/[^/?#]+(?:[?#]|$)/.test(href)) return href;
  const url = new URL(href, 'https://manabi.invalid');
  if(url.pathname.startsWith('/books/')&&!/^[a-f0-9]{24}$/.test(url.searchParams.get('edition')||''))return href;
  const back = new URL(safeLibraryReturn(returnTo), 'https://manabi.invalid');
  if (Number.isFinite(scrollY)) back.searchParams.set('restoreY', String(Math.max(0, Math.round(scrollY))));
  url.searchParams.set('returnTo', back.pathname + back.search);
  return url.pathname + url.search + url.hash;
}

export function librarySearchHref(user) {
  return `/materials?${user ? 'view=owned' : 'tab=public'}#library-search`;
}

// The old public address remains a compatibility return route into Discover.
export function libraryBrowseReturn(pathname,search){
 if(pathname==='/discover'){const params=new URLSearchParams(search);params.delete('view');params.set('tab','public');return safeLibraryReturn(`/materials?${params}`);}
 return safeLibraryReturn(pathname+search);
}
