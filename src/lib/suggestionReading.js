import { isOnDemandSuggestion } from './suggestionSources';
import { createComposerSave, newComposerDraft } from './materialComposer';
import { licenseForSource } from './videoAttribution';

export const SUGGESTION_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export const SUGGESTION_FIELDS = 'id, date, language, source, video_id, title, channel_name, thumbnail_url, level, transcript, material_id';

// 오늘의 추천(/api/suggestions/today) — 홈과 자료실이 같은 캐시 한 칸을 읽는다. 키·조회를 화면마다
// 따로 두면 같은 응답을 두 번 받는다(브라우저 조회 감사). 실패는 던져서 빈 목록을 캐시하지 않는다.
export const TODAY_SUGGESTIONS_KEY = ['today-suggestions'];
export async function fetchTodaySuggestions() {
  const response = await fetch('/api/suggestions/today');
  if (!response.ok) throw new Error('추천을 불러오지 못했어요.');
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

export function canReadSuggestion(s) {
  return !!s?.title?.trim() && !isOnDemandSuggestion(s) &&
    (!!s.transcript?.trim() || !!s.material_id);
}

// 추천 본문의 돌아갈 곳(?from=) — 들어온 화면으로. 목록 밖 값은 서재로.
export const SUGGESTION_BACK = Object.freeze({
  home: { href: '/home', label: '← 오늘로' },
  discover: { href: '/discover', label: '← 발견으로' },
  materials: { href: '/materials', label: '← 내 서재로' },
});
export const suggestionBackKey = (from) => (Object.hasOwn(SUGGESTION_BACK, from) ? from : 'materials');

export function suggestionHref(s, from = 'materials') {
  if (/^[1-9]\d*$/.test(String(s.material_id || ''))) return `/viewer/${s.material_id}`;
  return `/suggestions/${encodeURIComponent(s.id)}?from=${suggestionBackKey(from)}`;
}

export function suggestionSource(s) {
  const id = s.video_id || '';
  if (/^youtube_(?:ondemand|cc|pd)$/.test(s.source) && /^[\w-]{11}$/.test(id)) {
    return { url: `https://www.youtube.com/watch?v=${id}`, label: '원본 영상 보기', kind: 'video' };
  }
  if (/^nhk(?:_|$)/.test(s.source)) return { url: 'https://www3.nhk.or.jp/news/', label: '출처 사이트', kind: 'digest' };
  const wiki = id.match(/^wikinews_(en|fr|zh)_(.+)$/);
  if (wiki) {
    try {
      return { url: `https://${wiki[1]}.wikinews.org/wiki/${encodeURIComponent(decodeURIComponent(wiki[2]))}`, label: '원문 보기', kind: 'excerpt' };
    } catch { /* A malformed legacy id must not produce a broken source link. */ }
  }
  if (/^qiita_[a-f0-9]+$/.test(id)) {
    const author = s.channel_name?.match(/· @([\w-]+)$/)?.[1];
    return { url: author ? `https://qiita.com/${author}/items/${id.slice(6)}` : 'https://qiita.com/', label: author ? '원문 보기' : '출처 사이트', kind: 'excerpt' };
  }
  // Old DEV rows don't retain the article slug. Don't invent an article address.
  if (/^devto_\d+$/.test(id)) return { url: 'https://dev.to/', label: '출처 사이트', kind: 'excerpt' };
  // RSS collectors retain an exact source URL as their final credit line.
  const tail = s.transcript?.trim().split('\n').at(-1)?.trim();
  if (/^https:\/\/[^\s]+$/.test(tail || '')) {
    try { const url = new URL(tail); if (!url.username && !url.password) return { url: url.href, label: '원문 보기', kind: 'excerpt' }; } catch { /* plain text remains readable */ }
  }
  return { url: null, label: '', kind: 'excerpt' };
}

// A publication, not an editor: keep source wording intact and only give existing
// paragraph/headline boundaries semantic structure. Never render source HTML.
export function suggestionSections(s) {
  const body = typeof s.transcript === 'string' ? s.transcript.trim() : '';
  return body.split(/\n\s*\n/).filter(Boolean).map((text, index) => {
    if (suggestionSource(s).kind === 'digest') {
      const match = text.match(/^【\d+】([^\n]+)\n([\s\S]*)$/);
      if (match) return { heading: match[1], text: match[2] };
      if (index === 0 && text.startsWith('今日のニュース')) return { heading: text, text: '' };
    }
    return { heading: '', text };
  });
}

export async function createSuggestionSave(ownerId, suggestion) {
  if (!ownerId || !canReadSuggestion(suggestion) || !suggestion.transcript?.trim()) throw new Error('SUGGESTION_UNAVAILABLE');
  // The existing private-composer unique index serializes tabs, lost replies and
  // repeat daily recommendations of the same edition. Reading itself never writes.
  const input = JSON.stringify(['suggestion-copy-v1', suggestion.source, suggestion.video_id,
    suggestion.language, suggestion.title, suggestion.transcript]);
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  const source = suggestionSource(suggestion);
  const save = createComposerSave(ownerId, { ...newComposerDraft(id), title: suggestion.title,
    body: suggestion.transcript, language: suggestion.language, links: source.url ? [source.url] : [] });
  const meta = save.attempt.row.processed_json.metadata;
  meta.level = suggestion.level || null;
  meta.recommendation = { id: suggestion.id, date: suggestion.date, source: suggestion.source,
    channel: suggestion.channel_name, url: source.url, format: source.kind };
  if (source.kind === 'video') meta.source = { kind: 'youtube', url: source.url,
    videoId: suggestion.video_id, channel: suggestion.channel_name, license: licenseForSource(suggestion.source), via: 'suggestion' };
  return save;
}
