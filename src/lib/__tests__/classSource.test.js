import { describe, it, expect } from 'vitest';
import { makeClassAnchor, classAnchorAt, resolveClassSource, validClassAnchor, classSentenceEnd, sourceFromClassNote } from '../classSource';
import { studySelection, studySelectionKey, findStudyEntry } from '../classStudy';
import { makeTextbookAnchor } from '../textbookAnnotations';
import { classEntryHref, classHistoryReturn, classHistoryState, classSourceRequest, cacheClassSource, cachedClassSource } from '../classHistoryNavigation';
const json = parts => ({ sequence: parts.map((_, i) => `t${i}`), dictionary: Object.fromEntries(parts.map((text, i) => [`t${i}`, { text, pos: text === '\n' ? '개행' : '명사' }])) });
const material = parts => ({ id: 12, processed_json: json(parts) });

describe('classroom source locations', () => {
  it('captures the second occurrence without finding the first matching word', () => {
    const m = material(['我去', '学校', '。明天去', '学校', '。']);
    const selected = studySelection(m, { id: 't3', text: '学校', meaning: '학교' });
    expect(selected.source.anchor.start).toBe(8);
    expect(resolveClassSource(m.processed_json, selected.source).first).toBe('t3');
  });
  it('ranges keep actual boundaries without borrowing one word’s meaning', () => {
    const m = material(['📚', '我们', '明天', '见', '。']);
    const selected = studySelection(m, null, '我们明天', { first: 't1', last: 't2' });
    expect(selected.meaning).toBe('');
    expect(selected.source.anchor).toMatchObject({ start: 2, end: 6, exact: '我们明天' });
    expect(selected.source.tokenId).toBeUndefined();
    expect(resolveClassSource(m.processed_json, selected.source)).toMatchObject({ first: 't1', last: 't2' });
  });
  it('resolves retokenized text and ignores dictionary IDs/digests for duplicate identity', () => {
    const m = material(['欢迎', '图书馆', '。']), selected = studySelection(m, { id: 't1', text: '图书馆' });
    const changed = json(['欢', '迎图', '书', '馆。']);
    expect(resolveClassSource(changed, selected.source)).toMatchObject({ first: 't1', last: 't3', start: 2, end: 5 });
    const saved = { ...selected.source, tokenId: 'old', streamDigest: 'a'.repeat(32) };
    expect(studySelectionKey({ ...selected, source: saved })).toBe(studySelectionKey(selected));
    const note = { processed_json: { metadata: { classEntries: [{ id: 'e', text: selected.text }], classSources: { e: saved } } } };
    expect(findStudyEntry(note, selected)?.id).toBe('e');
  });
  it('does not jump to ambiguous or edited text, including reused legacy IDs', () => {
    const j = json(['学校', '和', '学校']);
    expect(resolveClassSource(j, { quote: '学校', tokenId: 't0' })).toBeNull();
    const source = { quote: '学校', anchor: { type: 'TextQuoteSelector', exact: '学校', prefix: '', suffix: '', start: 0, end: 2 } };
    expect(resolveClassSource(j, source)).toBeNull();
    const anchor = makeClassAnchor(j, 't2', 't2', '学校');
    expect(resolveClassSource(json(['学校', '或', '学校']), { quote: '学校', anchor })).toBeNull();
  });
  it('keeps unique legacy links usable after token IDs change', () => {
    expect(resolveClassSource(json(['图', '书馆']), { quote: '图书馆', tokenId: 'old' })).toMatchObject({ first: 't0', last: 't1' });
  });
  it('keeps an exact sub-token quote when analysis merges the surrounding text', () => {
    const j = json(['欢迎图书馆。']);
    const anchor = classAnchorAt('欢迎图书馆。', 2, 5, '图书馆');
    expect(resolveClassSource(j, { quote: '图书馆', anchor })).toMatchObject({ first: 't0', last: 't0', start: 2, end: 5 });
    expect(classAnchorAt('欢迎图书馆。', 0, 5, '图书馆')).toBeNull();
  });
  it('does not restore an entry whose original note line was replaced', () => {
    expect(sourceFromClassNote({ raw_text: '새 내용', processed_json: { metadata: { classEntries: [{ id: 'e', idx: 0, text: '词' }], classSources: { e: { materialId: '12', quote: '词' } } } } }, 'e')).toBeNull();
  });
  it('preserves multiline selections, trims only edges, and finds sentence end', () => {
    const j = json([' ', '我们', '。', '\n', '明天', '见', ' ']);
    expect(classSentenceEnd(j, 't1')).toBe('t2');
    expect(makeClassAnchor(j, 't0', 't6', '我们。\n明天见')).toMatchObject({ start: 1, end: 8 });
    expect(makeClassAnchor(j, 't1', 't2', 'wrong')).toBeNull();
    const selection={text:'我们。\n明天见',source:{materialId:'12',quote:'我们。\n明天见',anchor:makeClassAnchor(j,'t0','t6','我们。\n明天见')}};
    const note={processed_json:{metadata:{classEntries:[{id:'op:0',text:'我们。'},{id:'op:1',text:'明天见'}],classSources:{'op:0':selection.source,'op:1':selection.source}}}};
    expect(findStudyEntry(note,selection)?.id).toBe('op:0');
  });
  it('retains 5000-unit classroom and 1000-unit annotation limits separately', () => {
    const j = json(['中'.repeat(5000)]);
    expect(validClassAnchor(makeClassAnchor(j, 't0', 't0', j.dictionary.t0.text))).toBe(true);
    expect(makeTextbookAnchor(j, 't0')).toBeNull();
    expect(makeClassAnchor(json(['中'.repeat(5001)]), 't0', 't0', '中'.repeat(5001))).toBeNull();
  });
  it('never splits emoji at either context boundary', () => {
    const j = json(['📚' + '中'.repeat(47), '词', '中'.repeat(47) + '📚']);
    const a = makeClassAnchor(j, 't1', 't1', '词');
    expect(a.start).toBe(49); expect(a.prefix).toBe('中'.repeat(47)); expect(a.suffix).toBe('中'.repeat(47));
    expect(resolveClassSource(j, { quote: '词', anchor: a }).first).toBe('t1');
  });
  it('rejects malformed anchors instead of degrading them into legacy navigation', () => {
    const good = makeClassAnchor(json(['词']), 't0', 't0', '词');
    for (const bad of [{ ...good, end: 4 }, { ...good, extra: true }, { ...good, prefix: 'x'.repeat(49) }]) {
      expect(validClassAnchor(bad)).toBe(false);
      expect(sourceFromClassNote({ processed_json: { metadata: { classEntries: [{ id: 'e', text: '词' }], classSources: { e: { materialId: '12', quote: '词', anchor: bad } } } } }, 'e')).toBeNull();
    }
  });
});

describe('class history navigation', () => {
  it('puts record IDs, not textbook text, in new URLs and preserves return state', () => {
    const returnTo = classHistoryReturn('/class/team-a', { search: '학교', extras: true, day: '2026-09-10', scrollY: 513.4, shown: 60 });
    const href = classEntryHref('/viewer/12', 'team-a', { sourceNote: 34, sourceEntry: 'uuid:0', sourceQuote: '私たち', returnTo });
    const url = new URL(href, 'https://example.test');
    expect(classSourceRequest(url.searchParams)).toEqual({ team: 'team-a', note: '34', entry: 'uuid:0' });
    expect(href).not.toContain('sourceQuote');
    expect(classHistoryState(new URL(url.searchParams.get('returnTo'), url).searchParams)).toEqual({ search: '학교', extras: true, shown: 60, scrollY: 513 });
  });
  it('rejects arbitrary redirects/identifiers and caps navigation state', () => {
    expect(classHistoryReturn('https://evil.test')).toBe('/materials');
    expect(classSourceRequest(new URLSearchParams({ sourceClass: '../other', sourceNote: '12', sourceEntry: 'a:0' }))).toBeNull();
    expect(classHistoryState(new URLSearchParams({ shown: '999999', restoreY: '-2' }))).toMatchObject({ shown: 2000, scrollY: 0 });
  });
  it('keeps guest navigation hints short-lived and scoped to a team and record', () => {
    const map = new Map(), storage = { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) };
    cacheClassSource(storage, 'a', { sourceNote: 12, sourceEntry: 'entry:0', source: { quote: '词' } }, 100);
    expect(cachedClassSource(storage, { team: 'a', note: 12, entry: 'entry:0' }, 110)).toEqual({ quote: '词' });
    expect(cachedClassSource(storage, { team: 'b', note: 12, entry: 'entry:0' }, 110)).toBeNull();
    expect(cachedClassSource(storage, { team: 'a', note: 12, entry: 'entry:0' }, 1800100)).toBeNull();
  });
});
