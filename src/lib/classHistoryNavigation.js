import { safeReaderReturn } from './libraryReturn';
import { TEAM_KEY_RE } from './classBoard';

export function classHistoryState(params) {
  return { search: (params.get('q') || '').slice(0, 200), extras: params.get('extras') === 'true',
    shown: Math.min(2000, Math.max(20, Number(params.get('shown')) || 20)),
    scrollY: Math.min(10000000, Math.max(0, Number(params.get('restoreY')) || 0)) };
}

export function classHistoryReturn(pathname, { search = '', extras = false, shown = 20, day, scrollY = 0 } = {}) {
  const params = new URLSearchParams({ view: 'history' });
  if (search) params.set('q', search.slice(0, 200));
  if (extras) params.set('extras', 'true');
  if (day) params.set('day', day);
  if (shown > 20) params.set('shown', String(Math.min(2000, Math.ceil(shown))));
  if (Number.isFinite(scrollY)) params.set('restoreY', String(Math.min(10000000, Math.max(0, Math.round(scrollY)))));
  return safeReaderReturn(`${pathname}?${params}`);
}

export function classSourceRequest(params) {
  const team = params.get('sourceClass'), note = params.get('sourceNote'), entry = params.get('sourceEntry');
  if (!TEAM_KEY_RE.test(team || '') || !/^[1-9][0-9]{0,15}$/.test(note || '')
    || !/^[a-zA-Z0-9_-]{1,100}:[0-9]{1,8}$/.test(entry || '')) return null;
  return { team, note, entry };
}

export function classEntryHref(href, team, entry) {
  const url = new URL(href, 'https://manabi.invalid');
  if (entry.returnTo) url.searchParams.set('returnTo', safeReaderReturn(entry.returnTo));
  if (entry.sourceNote && entry.sourceEntry) {
    url.searchParams.set('sourceClass', team);
    url.searchParams.set('sourceNote', String(entry.sourceNote));
    url.searchParams.set('sourceEntry', entry.sourceEntry);
  } else if (entry.sourceToken) {
    // Existing callers/links remain valid; new history entries use record IDs.
    url.searchParams.set('sourceToken', entry.sourceToken);
    url.searchParams.set('sourceQuote', entry.sourceQuote || '');
  }
  return url.pathname + url.search + url.hash;
}

// The local guest reader remains network-free. This is a short-lived navigation
// hint from a history response already authorized by the class unlock, not a
// learning record. It never grants access to a missing local material.
export function cacheClassSource(storage, team, entry, now = Date.now()) {
  if (!entry.sourceNote || !entry.sourceEntry || !entry.source) return;
  try { storage.setItem(`class-source:${team}:${entry.sourceNote}:${entry.sourceEntry}`, JSON.stringify({ source: entry.source, expires: now + 30 * 60 * 1000 })); } catch {}
}
export function cachedClassSource(storage, request, now = Date.now()) {
  try {
    const value = JSON.parse(storage.getItem(`class-source:${request.team}:${request.note}:${request.entry}`));
    return value?.expires > now ? value.source : null;
  } catch { return null; }
}
