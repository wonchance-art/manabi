import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preserveReanalysisTokens, runPreservedReanalysis } from '../reanalysisPreservation';
import { exactSourceQuote } from '../viewerLocalizedContext';

const services = vi.hoisted(() => ({ db: {}, analyze: null, mutations: [], queryClient: { setQueryData: () => {} } }));
vi.mock('../supabase', () => ({ supabase: services.db }));
vi.mock('../analyzeText', () => ({ analyzeText: (...args) => services.analyze(...args) }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => services.queryClient,
  useMutation: configuration => { services.mutations.push(configuration); return { isPending: false, mutate: vi.fn() }; },
}));
vi.mock('react', () => ({
  useState: value => [value, vi.fn()], useRef: value => ({ current: value }), useEffect: () => {},
  useMemo: fn => fn(),
}));
import { useReanalyze } from '../useReanalyze';

const metadata = locale => ({ language: 'Korean', targetLanguage: 'ko', explanationLocale: locale,
  analysisVersion: 'ko-llm-v1', analysisEngine: 'llm', analysisQuality: 'unreviewed' });
function analysis(text, locale = 'zh-CN', staleOffsets = false) {
  const sequence = [], dictionary = {};
  let offset = 0;
  text.split('\n').forEach((line, lineIndex, lines) => {
    const parts = line.match(/\s+|[^\s]+/gu) || [];
    let lineStart = 0;
    parts.forEach((part, index) => {
      const id = `id_${lineIndex}_${index}_generated`;
      sequence.push(id);
      dictionary[id] = { text: part, surface: part, meaning: /^\s+$/u.test(part) ? '' : `${locale} meaning`,
        pos: /^\s+$/u.test(part) ? '기호' : '명사', language: 'Korean', explanationLocale: locale,
        morphology: [{ form: part, function: `${locale} morphology` }], sourceSpan: {
          start: staleOffsets ? 0 : offset + lineStart, end: staleOffsets ? part.length : offset + lineStart + part.length,
          unit: 'utf16', lineIndex, lineStart, lineEnd: lineStart + part.length,
        } };
      lineStart += part.length;
    });
    if (lineIndex < lines.length - 1) {
      const id = `br_${lineIndex}_generated`;
      sequence.push(id); dictionary[id] = { text: '\n', pos: '개행' };
    }
    offset += line.length + 1;
  });
  return { sequence, dictionary, status: 'completed', failed_indices: [], metadata: metadata(locale) };
}
function material(text = '학교에  갔어요.', locale = 'ko') {
  const json = analysis(text, locale);
  json.metadata = { ...json.metadata, book: { bookId: 'stable-book', editionId: 'old-edition' },
    sourceRevision: 'original-source-revision', importAttempt: 'original-import', viewerRevision: 'old-revision', updated_at: 'old-time' };
  return { id: 211, owner_id: 'owner', raw_text: text, processed_json: json };
}
function client(row, corrections = []) {
  const query = { select: () => query, eq: () => query, order: () => query,
    range: async () => ({ data: corrections, error: null }) };
  return { from: vi.fn(() => query), rpc: vi.fn(async (_, args) => ({
    data: { material: { ...row, raw_text: args.p_raw, processed_json: args.p_json } }, error: null,
  })) };
}
beforeEach(() => { services.mutations = []; services.analyze = vi.fn(); });
afterEach(() => vi.restoreAllMocks());

describe('Korean reanalysis metadata and exact source preservation', () => {
  it('retains fresh analysis provenance, protected source/book metadata, and the new commit revision', async () => {
    const row = material(), snapshot = structuredClone(row), db = client(row);
    const generated = analysis(row.raw_text, 'zh-TW');
    generated.metadata = { ...generated.metadata, book: { bookId: 'wrong' }, importAttempt: 'wrong',
      sourceRevision: 'wrong', viewerRevision: 'wrong', updated_at: 'wrong' };
    const analyze = vi.fn(async () => generated);
    const saved = await runPreservedReanalysis(db, row, new AbortController().signal, analyze, { explanationLocale: 'zh-TW' });
    expect(analyze.mock.calls[0][2].metadata.explanationLocale).toBe('zh-TW');
    expect(saved.processed_json.metadata).toMatchObject({ ...metadata('zh-TW'),
      book: snapshot.processed_json.metadata.book, importAttempt: 'original-import', sourceRevision: 'original-source-revision' });
    expect(saved.processed_json.metadata.viewerRevision).toBe(db.rpc.mock.calls[0][1].p_attempt);
    expect(saved.processed_json.metadata.viewerRevision).not.toBe('old-revision');
    expect(saved.processed_json.metadata.updated_at).not.toBe('old-time');
    expect(db.rpc.mock.calls[0][1].p_expected_json).toEqual(snapshot.processed_json);
    expect(row).toEqual(snapshot);
  });
  it('preserves a user-edited Korean meaning as Korean under fresh Chinese document metadata', async () => {
    const row = material(), tokenId = row.processed_json.sequence[0];
    row.processed_json.dictionary[tokenId].meaning = '내가 수정한 학교 뜻';
    row.processed_json.metadata.viewerCorrections = { [tokenId]: ['meaning'] };
    const db = client(row), snapshot = structuredClone(row);
    const saved = await runPreservedReanalysis(db, row, new AbortController().signal,
      async () => analysis(row.raw_text, 'zh-CN'), { explanationLocale: 'zh-CN' });
    expect(saved.processed_json.metadata.explanationLocale).toBe('zh-CN');
    const preserved = saved.processed_json.dictionary[tokenId];
    expect(preserved).toMatchObject({ meaning: '내가 수정한 학교 뜻', explanationLocale: 'ko', meaningLocale: 'ko' });
    expect(preserved.morphology).toEqual(snapshot.processed_json.dictionary[tokenId].morphology);
    expect(saved.processed_json.metadata.viewerCorrections[tokenId]).toEqual(['meaning']);
    expect(row).toEqual(snapshot);
  });
  it('log-based legacy corrections default only to Korean and omit conflicting generated morphology', () => {
    const row = material(), tokenId = row.processed_json.sequence[0];
    delete row.processed_json.metadata.explanationLocale;
    delete row.processed_json.dictionary[tokenId].explanationLocale;
    delete row.processed_json.dictionary[tokenId].morphology;
    row.processed_json.dictionary[tokenId].meaning = '사용자 뜻';
    const saved = preserveReanalysisTokens(row, row.raw_text, analysis(row.raw_text, 'zh-TW'), [{
      token_id: tokenId, after_value: { meaning: '사용자 뜻' },
    }]);
    expect(saved.dictionary[tokenId]).toMatchObject({ meaning: '사용자 뜻', meaningLocale: 'ko', explanationLocale: 'ko' });
    expect(saved.dictionary[tokenId].morphology).toBeUndefined();
  });
  it('rebases stale spans after final merges and remaps including CRLF, whitespace and NFD text', async () => {
    const raw = '학교  학교\r\n갔어요.\n끝';
    const row = material(raw), db = client(row);
    const saved = await runPreservedReanalysis(db, row, new AbortController().signal,
      async () => analysis(raw, 'zh-CN', true), { explanationLocale: 'zh-CN', selectedLineIndices: new Set([1]) });
    expect(saved.processed_json.sequence.map(id => saved.processed_json.dictionary[id].text).join('')).toBe(raw);
    for (const id of saved.processed_json.sequence) {
      const token = saved.processed_json.dictionary[id];
      expect(raw.slice(token.sourceSpan.start, token.sourceSpan.end)).toBe(token.text);
      expect(exactSourceQuote(raw, token.sourceSpan, token.text)).toBe(token.text);
    }
    const moved = '\n' + raw;
    const movedDb = client(row);
    const movedSaved = await runPreservedReanalysis(movedDb, row, new AbortController().signal,
      async () => analysis(moved, 'zh-TW', true), { rawTextOverride: moved, explanationLocale: 'zh-TW' });
    expect(movedSaved.processed_json.sequence[1]).toContain('id_1_');
    for (const id of movedSaved.processed_json.sequence) {
      const token = movedSaved.processed_json.dictionary[id];
      expect(exactSourceQuote(moved, token.sourceSpan, token.text)).toBe(token.text);
    }
  });
  it('declines whitespace reconstruction mismatches before the material RPC', async () => {
    const row = material('학교  학교'), db = client(row);
    const corrupted = analysis(row.raw_text, 'zh-CN');
    const space = corrupted.sequence.find(id => corrupted.dictionary[id].text === '  ');
    corrupted.dictionary[space].text = ' ';
    await expect(runPreservedReanalysis(db, row, new AbortController().signal, async () => corrupted)).rejects.toThrow('원문');
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('declines split surrogate boundaries even when token concatenation reproduces raw text', async () => {
    const row = material('😀학교'), db = client(row), split = analysis(row.raw_text);
    split.sequence = ['id_0_0_split', 'id_0_1_split'];
    split.dictionary = { id_0_0_split: { text: '\uD83D', pos: '기호' }, id_0_1_split: { text: '\uDE00학교', pos: '명사' } };
    await expect(runPreservedReanalysis(db, row, new AbortController().signal, async () => split)).rejects.toThrow('문자 범위');
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('a no-analysis remap retains the stored explanation locale even if UI locale changed', async () => {
    const row = material(), db = client(row), analyze = vi.fn();
    const saved = await runPreservedReanalysis(db, row, new AbortController().signal, analyze,
      { selectedLineIndices: new Set(), explanationLocale: 'zh-TW' });
    expect(analyze).not.toHaveBeenCalled();
    expect(saved.processed_json.metadata.explanationLocale).toBe('ko');
  });
  it('rejects an explicit unsupported Korean explanation locale before generating or saving', async () => {
    const row = material(), db = client(row), analyze = vi.fn();
    await expect(runPreservedReanalysis(db, row, new AbortController().signal, analyze,
      { explanationLocale: 'zh-Hant' })).rejects.toThrow('설명 언어');
    expect(analyze).not.toHaveBeenCalled(); expect(db.rpc).not.toHaveBeenCalled();
  });
  it('validates explicitly absolute+line-local spans without weakening legacy span validation', () => {
    const raw = '첫 줄\r\n학교';
    expect(exactSourceQuote(raw, { start: 5, end: 7, unit: 'utf16', lineIndex: 1, lineStart: 0, lineEnd: 2 }, '학교')).toBe('학교');
    expect(exactSourceQuote(raw, { start: 0, end: 2, unit: 'utf16', lineIndex: 1, lineStart: 0, lineEnd: 2 })).toBeNull();
    expect(exactSourceQuote(raw, { start: 5, end: 7, unit: 'utf16', lineIndex: 1, lineStart: 0 })).toBeNull();
    expect(exactSourceQuote(raw, { start: 0, end: 2, unit: 'utf16', lineIndex: 1 })).toBe('학교');
  });
});

describe('useReanalyze optional locale forwarding is user-action-only', () => {
  it('rendering/changing explanation locale alone does not analyze or write', () => {
    const row = material(), db = client(row); Object.assign(services.db, db);
    useReanalyze({ materialId: row.id, material: row, explanationLocale: 'zh-CN' });
    useReanalyze({ materialId: row.id, material: row, explanationLocale: 'zh-TW' });
    expect(services.analyze).not.toHaveBeenCalled(); expect(db.rpc).not.toHaveBeenCalled();
    expect(services.mutations).toHaveLength(2);
  });
  it('passes selected explanation locale only to explicit Korean reanalysis', async () => {
    const row = material(), db = client(row); Object.assign(services.db, db);
    services.analyze.mockImplementation(async text => analysis(text, 'zh-TW'));
    useReanalyze({ materialId: row.id, material: row, explanationLocale: 'zh-TW' });
    await services.mutations[0].mutationFn({ fullReset: true });
    expect(services.analyze.mock.calls[0][2].metadata.explanationLocale).toBe('zh-TW');
    expect(db.rpc).toHaveBeenCalledOnce();
    const chinese = material('学校'); chinese.processed_json.metadata.language = 'Chinese';
    delete chinese.processed_json.metadata.explanationLocale;
    const legacyDb = client(chinese); Object.assign(services.db, legacyDb);
    services.analyze.mockImplementation(async text => { const result = analysis(text); delete result.metadata; return result; });
    useReanalyze({ materialId: chinese.id, material: chinese, explanationLocale: 'zh-TW' });
    await services.mutations[1].mutationFn({ fullReset: true });
    expect(services.analyze.mock.calls[1][2].metadata.explanationLocale).toBeUndefined();
  });
});
