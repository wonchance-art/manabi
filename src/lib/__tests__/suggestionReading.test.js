import { describe, it, expect, vi } from 'vitest';
import { canReadSuggestion, createSuggestionSave, suggestionHref, suggestionSource, suggestionSections } from '../suggestionReading';
import { publicSuggestionTargets, readSuggestion } from '../server/suggestionReading';
import { saveComposerOnce } from '../materialComposer';
import { isFocusedReadingRoute, navigationOwner } from '../webNavigation';

const s = { id: '11111111-1111-4111-8111-111111111111', date: '2026-09-11',
  title: 'Une promenade', transcript: 'Bonjour.\n\nUn autre paragraphe.', language: 'French',
  source: 'wikinews_fr', video_id: 'wikinews_fr_Une%20promenade', channel_name: 'Wikinews français', level: 'B1' };

describe('finished recommendation reading', () => {
  it('opens a stable reading address and keeps the referring screen', () => {
    expect(suggestionHref(s, 'home')).toBe(`/suggestions/${s.id}?from=home`);
    expect(suggestionHref(s)).toBe(`/suggestions/${s.id}?from=materials`);
    expect(suggestionHref({ ...s, material_id: 51 })).toBe('/viewer/51');
    expect(isFocusedReadingRoute(`/suggestions/${s.id}`)).toBe(true);
    expect(navigationOwner(`/suggestions/${s.id}`)).toBe('/discover');
    expect(canReadSuggestion(s)).toBe(true);
    expect(canReadSuggestion({ ...s, transcript: ' \n ' })).toBe(false);
    expect(canReadSuggestion({ ...s, title: ' ' })).toBe(false);
    expect(canReadSuggestion({ ...s, source: 'youtube_ondemand', material_id: 1 })).toBe(false);
  });
  it('formats supplied digest headlines without translating, rewriting or dropping the article text', () => {
    expect(suggestionSections(s)).toEqual([{ heading: '', text: 'Bonjour.' }, { heading: '', text: 'Un autre paragraphe.' }]);
    const digest = { ...s, source: 'nhk_science', transcript: '今日のニュース（NHK）\n\n【1】科学の話\nもとの文章。\n続き。' };
    expect(suggestionSections(digest)).toEqual([{ heading: '今日のニュース（NHK）', text: '' }, { heading: '科学の話', text: 'もとの文章。\n続き。' }]);
  });
  it('keeps exact Wikimedia source identity, refusing malformed or executable source URLs', () => {
    expect(suggestionSource(s).url).toBe('https://fr.wikinews.org/wiki/Une%20promenade');
    expect(suggestionSource({ ...s, source: 'qiita', video_id: 'qiita_abc123', channel_name: 'Qiita · @author' }).url).toBe('https://qiita.com/author/items/abc123');
    expect(suggestionSource({ ...s, source: 'devto', video_id: 'devto_123' })).toMatchObject({ url: 'https://dev.to/', label: '출처 사이트' });
    expect(suggestionSource({ ...s, video_id: 'wikinews_fr_%zz' }).url).toBeNull();
    expect(suggestionSource({ source: 'rss', transcript: 'Text\nhttps://secret@example.com/' }).url).toBeNull();
    expect(suggestionSource({ source: 'youtube_ondemand', video_id: 'javascript:bad' }).url).toBeNull();
  });
  it('keeps an existing publicly readable analyzed target, never a private or unfinished target', async () => {
    const eq = vi.fn(() => Promise.resolve({ data: [{ id: 3, status: 'completed' }, { id: 4, status: 'pending' }] }));
    const client = { from: vi.fn(() => ({ select: () => ({ in: () => ({ eq }) }) })) };
    const out = await publicSuggestionTargets(client, [1, 3, 4].map(material_id => ({ ...s, material_id })));
    expect(eq).toHaveBeenCalledWith('visibility', 'public');
    expect(out.map(r => r.material_id)).toEqual([null, 3, null]);
    expect(out.every(r => r.transcript === s.transcript)).toBe(true);
  });
  it('removes on-demand transcripts and pointers even if a legacy row incorrectly has them', async () => {
    const client = { from: vi.fn() };
    const out = await publicSuggestionTargets(client, [{ ...s, source: 'youtube_ondemand', material_id: 9 }]);
    expect(client.from).not.toHaveBeenCalled();
    expect(out[0]).toMatchObject({ transcript: null, material_id: null });
  });
  it('old-day links read by ID and invalid IDs do not query the database', async () => {
    const eq = vi.fn(() => ({ maybeSingle: async () => ({ data: s }) }));
    const client = { from: vi.fn(() => ({ select: () => ({ eq }) })) };
    expect(await readSuggestion(client, s.id)).toMatchObject({ date: '2026-09-11', transcript: s.transcript });
    expect(eq.mock.calls).toEqual([['id', s.id]]);
    expect(await readSuggestion(client, '../../today')).toBeNull();
    expect(client.from).toHaveBeenCalledTimes(1);
  });
  it('distinguishes missing data from a failed query and preserves text when target validation fails', async () => {
    const from = data => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => data }) }) }) });
    expect(await readSuggestion(from({ data: null }), s.id)).toBeNull();
    await expect(readSuggestion(from({ error: new Error('offline') }), s.id)).rejects.toThrow('offline');
    const client = { from: () => ({ select: () => ({ in: () => ({ eq: async () => ({ error: new Error('offline') }) }) }) }) };
    expect((await publicSuggestionTargets(client, [{ ...s, material_id: 3 }]))[0]).toMatchObject({ material_id: null, transcript: s.transcript });
  });
});

describe('explicit personal keeping reuses the original-material contract', () => {
  it('preserves original wording, language, source and privacy with no analysis or publication write', async () => {
    const save = await createSuggestionSave('owner', s);
    expect(save.attempt.row).toMatchObject({ visibility: 'private', owner_id: 'owner', raw_text: s.transcript,
      processed_json: { status: 'saved', metadata: { language: 'French', level: 'B1', recommendation: { id: s.id, date: s.date }, composer: { version: 1, links: [suggestionSource(s).url] } } } });
    await expect(createSuggestionSave(null, s)).rejects.toThrow();
    await expect(createSuggestionSave('owner', { ...s, source: 'youtube_ondemand' })).rejects.toThrow();
  });
  it('reconciles identical editions across days but gives changed wording a new copy', async () => {
    const first = await createSuggestionSave('owner', s);
    const tomorrow = await createSuggestionSave('owner', { ...s, id: 'another-day', date: '2026-09-12' });
    expect(tomorrow.draft.id).toBe(first.draft.id);
    expect((await createSuggestionSave('owner', { ...s, transcript: s.transcript + ' Updated.' })).draft.id).not.toBe(first.draft.id);
    const insert = vi.fn();
    const client = { from: () => ({ select() { return this; }, eq() { return this; }, limit: async () => ({ data: [{ id: 77 }] }), insert }) };
    expect((await saveComposerOnce(client, tomorrow)).id).toBe(77);
    expect(insert).not.toHaveBeenCalled();
  });
  it('retains CC attribution for the existing vocabulary viewer', async () => {
    const save = await createSuggestionSave('owner', { ...s, source: 'youtube_cc', video_id: 'dQw4w9WgXcQ' });
    expect(save.attempt.row.processed_json.metadata.source).toMatchObject({ kind: 'youtube', license: 'cc-by', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', channel: s.channel_name });
  });
});
