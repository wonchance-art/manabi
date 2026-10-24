// A return address is navigation state, never a learning record or arbitrary redirect.
export function safeLibraryReturn(value) {
  if (typeof value !== 'string' || !/^\/materials(?:\?|$)/.test(value) || value.length > 2000) return '/materials';
  try {
    const url = new URL(value, 'https://manabi.invalid');
    if (url.origin !== 'https://manabi.invalid' || url.pathname !== '/materials') return '/materials';
    const allowed = new Set(['view', 'tab', 'q', 'lang', 'level', 'sort', 'unread', 'pinned', 'shown', 'restoreY', 'collection', 'kind', 'state', 'tools', 'scope', 'outline']);
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
      if(url.searchParams.get('view')==='history')clean.set('view','history');
      if(['notes','book'].includes(url.searchParams.get('tab')))clean.set('tab',url.searchParams.get('tab'));
      if(clean.get('view')==='history'){
        const q=url.searchParams.get('q');if(q&&q.length<=200)clean.set('q',q);
        if(url.searchParams.get('extras')==='true')clean.set('extras','true');
        for(const [key,max] of [['restoreY',10000000],['shown',2000]]){const raw=url.searchParams.get(key);if(raw&&/^\d{1,8}$/.test(raw)&&Number(raw)<=max)clean.set(key,raw);}
      }
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
  // 산책 「고전 명작」(DISCOVER-CLASSICS-001) — 구간(책 · 그림, DISCOVER-ART-001)과 거르기(언어 · 갈래 · 작가)만 옮긴다. 값은 화면이 다시 검사한다(classicsFilters).
  if (typeof value === 'string' && value.length <= 2000 && /^\/discover\/classics(?:\?|$)/.test(value)) {
    const url = new URL(value, 'https://manabi.invalid');
    if (!url.hash && url.pathname === '/discover/classics') {
      const clean = new URLSearchParams();
      for (const key of CLASSICS_RETURN_KEYS) { const v = url.searchParams.get(key); if (v && v.length <= 80) clean.set(key, v); }
      return url.pathname + (clean.size ? `?${clean}` : '');
    }
  }
  return safeLibraryReturn(value);
}
const CLASSICS_RETURN_KEYS = Object.freeze(['shelf', 'lang', 'group', 'cat', 'author']);

// 「함께 읽는 글」 목록 키 — /discover?view=reading이 읽는 것만, 이 순서로 옮긴다. 개인 서재 키(tab · tools · scope ·
// collection · outline · kind · state)는 옮기지 않는다.
const PUBLIC_READING_KEYS = Object.freeze(['q', 'lang', 'level', 'sort', 'unread', 'pinned', 'shown', 'restoreY']);

/**
 * 뷰어 「←」가 실제로 갈 주소(READER-RETURN-001). 저장된 returnTo가 공개 목록(/materials?tab=public…)이면
 * 옛 주소 리다이렉트(/materials → /discover)를 거치지 않고 곧장 /discover?view=reading으로 — 거치면 화면이 세 번 바뀌고
 * 위치(restoreY)를 잃었다. 그 밖(서재 · 수업 · 거절된 입력)은 safeReaderReturn 결과 그대로다.
 */
export function readerReturnHref(value) {
  const back = safeReaderReturn(value);
  const url = new URL(back, 'https://manabi.invalid');
  if (url.pathname !== '/materials' || url.searchParams.get('tab') !== 'public') return back;
  const out = new URLSearchParams([['view', 'reading']]);
  for (const key of PUBLIC_READING_KEYS) { const v = url.searchParams.get(key); if (v !== null) out.set(key, v); }
  return `/discover?${out}`;
}

export function readerReturnLabel(value) {
  const url = new URL(safeReaderReturn(value), 'https://manabi.invalid');
  if (url.pathname.startsWith('/class/')) {
    if (url.pathname.endsWith('/live')) return '← 수업 진행';
    return url.searchParams.get('view') === 'history' ? '← 수업 기록' : '← 수업으로';
  }
  if (url.pathname === '/discover/classics') return '← 고전 명작';
  return url.searchParams.get('tab') === 'public' ? '← 함께 읽는 글' : '← 내 서재';
}

// 손님은 서재가 없다 — 맥락 없이 연 뷰어의 「←」는 산책(/discover)으로(뷰어 기능 감사 2026-10-17 KST). 뷰어의 아이콘 버튼이라
// 그림은 같고 접근 이름 · 툴팁 · 이동처만 바뀐다. 쓸 수 있는 returnTo가 있으면(그대로 받은 /materials 포함) 그쪽이 우선이다.
// 맥락 없음 = returnTo가 없거나 거절돼 기본 /materials로 떨어진 경우(LibraryReturnLink onlyWithContext와 같은 판정).
export const GUEST_READER_RETURN = Object.freeze({ href: '/discover', label: '← 산책' });
export function readerReturnTarget(value, { guest = false } = {}) {
  const back = safeReaderReturn(value);
  const noContext = !value || (back === '/materials' && value !== '/materials');
  if (guest && noContext) return { ...GUEST_READER_RETURN, guestDefault: true };
  return { href: readerReturnHref(value), label: readerReturnLabel(value), guestDefault: false };
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
