import { afterEach, describe, expect, it, vi } from 'vitest';
import { inspectAnalysisCoverage } from '../analysisCoverage';
import { completeAnalysis, runPreservedReanalysis } from '../reanalysisPreservation';
import { analyzeText } from '../analyzeText';
import { callGemini } from '../gemini';

vi.mock('../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock('../gemini', () => ({ callGemini: vi.fn(), parseGeminiJSON: JSON.parse, buildTokenizationPrompt: line => line }));
afterEach(() => vi.unstubAllGlobals());

function analysis(lines, suffix = 'old') {
  const sequence = [], dictionary = {};
  lines.forEach((text, line) => {
    if (text.trim()) {
      const id = `id_${line}_0_${suffix}`;
      sequence.push(id); dictionary[id] = { text, meaning: `meaning-${suffix}`, furigana: 'jiù', pos: '명사' };
    }
    if (line < lines.length - 1) {
      const id = `br_${line}_${suffix}`;
      sequence.push(id); dictionary[id] = { text: '\n', pos: '개행' };
    }
  });
  return { status: 'completed', sequence, dictionary, failed_indices: [], metadata: { language: 'Chinese' } };
}
function material(lines) { return { id: 'resume-fixture', raw_text: lines.join('\n'), processed_json: analysis(lines) }; }
function client(source) {
  const query = { select: () => query, eq: () => query, order: () => query, range: vi.fn(async () => ({ data: [] })) };
  return { from: vi.fn(() => query), rpc: vi.fn(async (_, args) => ({ data: { material: { ...source, raw_text: args.p_raw, processed_json: args.p_json } } })), query };
}
const signal = () => new AbortController().signal;

describe('source-based analysis coverage', () => {
  it('unites absent, failed, incomplete and explicitly failed lines, ignoring blank lines', () => {
    const source = material(['甲。', '乙。', '丙。', '丁。', '', '戊。']);
    const json = source.processed_json;
    json.sequence = json.sequence.filter(id => id !== 'id_1_0_old');
    json.dictionary.id_2_0_old.failed = true;
    json.dictionary.id_3_0_old.text = '丁';
    json.failed_indices = [5, 2, 5];
    expect(inspectAnalysisCoverage(source.raw_text, json).missingIndices).toEqual([1, 2, 3, 5]);
  });
  it.each(['failed placeholder', 'break only', 'missing dictionary', 'wrong text'])('does not count %s as a completed line', kind => {
    const source = material(['甲。']);
    const json = source.processed_json;
    if (kind === 'failed placeholder') { json.sequence = ['failed_0_old']; json.dictionary.failed_0_old = { text: '甲。' }; }
    if (kind === 'break only') { json.sequence = ['br_0_old']; json.dictionary.br_0_old = { text: '\n', pos: '개행' }; }
    if (kind === 'missing dictionary') delete json.dictionary.id_0_0_old;
    if (kind === 'wrong text') json.dictionary.id_0_0_old.text = '乙。';
    expect(inspectAnalysisCoverage(source.raw_text, json).missingIndices).toEqual([0]);
    expect(completeAnalysis(json, source.raw_text)).toBe(false);
  });
  it.each(['duplicate', 'out of range', 'unknown id', 'out of order', 'invalid failure index'])('rejects %s instead of guessing source coordinates', kind => {
    const source = material(['甲。', '乙。']);
    const json = source.processed_json;
    if (kind === 'duplicate') json.sequence.push(json.sequence[0]);
    if (kind === 'out of range') json.sequence.push('br_99_extra');
    if (kind === 'unknown id') json.sequence.push('unmapped');
    if (kind === 'out of order') json.sequence.reverse();
    if (kind === 'invalid failure index') json.failed_indices = ['0'];
    expect(inspectAnalysisCoverage(source.raw_text, json).validStructure).toBe(false);
    expect(completeAnalysis(json, source.raw_text)).toBe(false);
  });
  it('normalizes whitespace and NFC but retains punctuation differences', () => {
    const json = analysis(['Café !']);
    expect(completeAnalysis(json, 'Cafe\u0301  !')).toBe(true);
    expect(completeAnalysis(json, 'Café ?')).toBe(false);
  });
});

describe('resume commits only a complete, preserved candidate', () => {
  it.each(['Chinese', 'Japanese', 'English'])('%s passes the union to the paragraph analyzer and keeps successful token data byte for byte', async language => {
    const source = material(['甲。', '乙。', '丙。', '', '丁。']);
    source.processed_json.status = 'analyzing';
    source.processed_json.metadata.language = language;
    source.processed_json.sequence = source.processed_json.sequence.filter(id => id !== 'id_1_0_old');
    source.processed_json.dictionary.id_2_0_old.failed = true;
    source.processed_json.failed_indices = [2];
    source.processed_json.metadata.viewerCorrections = { id_0_0_old: ['meaning', 'furigana'] };
    const snapshot = structuredClone(source), c = client(source), progress = vi.fn();
    const fetcher = vi.fn(async (_, request) => ({ ok: true, json: async () => ({ results: JSON.parse(request.body).lines.map(text => ({ sequence: ['a'], dictionary: { a: { text, meaning: 'new', furigana: 'xīn', pos: '명사' } } })) }) }));
    vi.stubGlobal('fetch', fetcher);
    const analyzer = vi.fn(analyzeText);
    const saved = await runPreservedReanalysis(c, source, signal(), analyzer, { resume: true, onRecoveryProgress: progress });
    expect(analyzer.mock.calls[0][2].existingJson.failed_indices).toEqual([1, 2]);
    expect(fetcher).toHaveBeenCalledOnce(); // 정상 줄만 있는 마지막 문단은 요청하지 않는다.
    expect(JSON.parse(fetcher.mock.calls[0][1].body).lines).toEqual(['甲。', '乙。', '丙。']);
    for (const id of ['id_0_0_old', 'br_0_old', 'id_4_0_old']) expect(saved.processed_json.dictionary[id]).toEqual(snapshot.processed_json.dictionary[id]);
    expect(saved.processed_json.metadata.viewerCorrections.id_0_0_old).toEqual(['meaning', 'furigana']);
    expect(completeAnalysis(saved.processed_json, source.raw_text)).toBe(true);
    expect(c.rpc).toHaveBeenCalledOnce();
    expect(c.rpc.mock.calls[0][1].p_expected_json).toEqual(snapshot.processed_json);
    expect(progress).toHaveBeenLastCalledWith({ completed: 2, total: 2 });
    expect(source).toEqual(snapshot);
  });
  it('preserves French successful lines through the existing per-line analyzer', async () => {
    const source = material(['Bonjour.', 'Bonsoir.']);
    source.processed_json.metadata.language = 'French';
    source.processed_json.sequence = source.processed_json.sequence.filter(id => id !== 'id_1_0_old');
    callGemini.mockResolvedValue(JSON.stringify({ sequence: ['a'], dictionary: { a: { text: 'Bonsoir.', pos: '감탄사' } } }));
    const saved = await runPreservedReanalysis(client(source), source, signal(), analyzeText, { resume: true });
    expect(callGemini).toHaveBeenCalledOnce();
    expect(saved.processed_json.dictionary.id_0_0_old).toEqual(source.processed_json.dictionary.id_0_0_old);
    expect(completeAnalysis(saved.processed_json, source.raw_text)).toBe(true);
  });
  it('does not replace healthy neighbors with failed responses from their shared paragraph', async () => {
    const source = material(['甲。', '乙。']); source.processed_json.dictionary.id_1_0_old.failed = true;
    const result = analysis(['甲。', '乙。'], 'new'); result.status = 'partial'; result.failed_indices = [0]; result.dictionary.id_0_0_new.failed = true;
    const saved = await runPreservedReanalysis(client(source), source, signal(), async () => result, { resume: true });
    expect(completeAnalysis(saved.processed_json, source.raw_text)).toBe(true);
    expect(saved.processed_json.dictionary.id_0_0_old).toEqual(source.processed_json.dictionary.id_0_0_old);
  });
  it('skips AI when only an old analyzing status remains', async () => {
    const source = material(['甲。']); source.processed_json.status = 'analyzing';
    const c = client(source), analyzer = vi.fn();
    const saved = await runPreservedReanalysis(c, source, signal(), analyzer, { resume: true });
    expect(analyzer).not.toHaveBeenCalled();
    expect(c.rpc).toHaveBeenCalledOnce();
    expect(saved.processed_json.status).toBe('completed');
    expect(saved.processed_json.sequence).toEqual(source.processed_json.sequence);
  });
  it('repairs an empty snapshot without losing blank source lines', async () => {
    const source = material(['', '甲。', '', '乙。']); source.processed_json = { status: 'analyzing', metadata: { language: 'Chinese' } };
    const c = client(source);
    const saved = await runPreservedReanalysis(c, source, signal(), async () => analysis(source.raw_text.split('\n'), 'new'), { resume: true });
    expect(completeAnalysis(saved.processed_json, source.raw_text)).toBe(true);
    expect(saved.processed_json.sequence).toEqual(['br_0_new', 'id_1_0_new', 'br_1_new', 'br_2_new', 'id_3_0_new']);
  });
  it('retains the old material on incomplete recovery, abort, correction failure or concurrent edit', async () => {
    for (const failure of ['incomplete', 'abort', 'corrections', 'conflict']) {
      const source = material(['甲。', '乙。']); source.processed_json.dictionary.id_1_0_old.failed = true;
      const before = structuredClone(source), c = client(source), controller = new AbortController();
      if (failure === 'corrections') c.query.range.mockResolvedValue({ error: new Error('history unavailable') });
      if (failure === 'conflict') c.rpc.mockResolvedValue({ error: new Error('concurrent edit') });
      await expect(runPreservedReanalysis(c, source, controller.signal, async () => {
        if (failure === 'abort') controller.abort();
        return analysis(['甲。', failure === 'incomplete' ? '乙' : '乙。'], 'new');
      }, { resume: true })).rejects.toThrow();
      expect(c.rpc).toHaveBeenCalledTimes(failure === 'conflict' ? 1 : 0);
      expect(source).toEqual(before);
    }
  });
  it('does not salvage duplicated IDs by silently moving saved sources', async () => {
    const source = material(['甲。']); source.processed_json.sequence.push('id_0_0_old');
    const c = client(source), analyze = vi.fn();
    await expect(runPreservedReanalysis(c, source, signal(), analyze, { resume: true })).rejects.toThrow('줄 위치');
    expect(analyze).not.toHaveBeenCalled(); expect(c.rpc).not.toHaveBeenCalled();
  });
  it('keeps full reset explicit and reanalyzes all lines', async () => {
    const source = material(['甲。']);
    const analyze = vi.fn(async () => analysis(['甲。'], 'new'));
    const saved = await runPreservedReanalysis(client(source), source, signal(), analyze, { fullReset: true });
    expect(analyze.mock.calls[0][2].existingJson).toBeNull();
    expect(saved.processed_json.dictionary.id_0_0_old.meaning).toBe('meaning-new');
  });
  it('preserves manual corrections on a complete line explicitly flagged for retry', async () => {
    const source = material(['甲。']); source.processed_json.failed_indices = [0];
    source.processed_json.metadata.viewerCorrections = { id_0_0_old: ['meaning'] };
    const saved = await runPreservedReanalysis(client(source), source, signal(), async () => analysis(['甲。'], 'new'), { resume: true });
    expect(saved.processed_json.dictionary.id_0_0_old.meaning).toBe('meaning-old');
  });
  it('does not apply a corrected token at a guessed offset after an earlier dictionary hole', async () => {
    const source = material(['甲乙。']);
    source.processed_json.sequence = ['id_0_0_old', 'id_0_1_old'];
    source.processed_json.dictionary = { id_0_1_old: { text: '乙。', meaning: 'corrected' } };
    source.processed_json.metadata.viewerCorrections = { id_0_1_old: ['meaning'] };
    const saved = await runPreservedReanalysis(client(source), source, signal(), async () => analysis(['甲乙。'], 'new'), { resume: true });
    expect(saved.processed_json.sequence).toEqual(['id_0_0_new']);
    expect(saved.processed_json.dictionary.id_0_0_new.meaning).toBe('meaning-new');
  });
  it('preserves source-edit remaps and fills a new line without reusing a wrong occurrence', async () => {
    const source = material(['甲。']);
    const base = { ...analysis(['', '甲。']), status: 'partial', failed_indices: [0] };
    const saved = await runPreservedReanalysis(client(source), source, signal(), async () => analysis(['乙。', '甲。'], 'new'), {
      rawTextOverride: '乙。\n甲。', baseJsonOverride: base, selectedLineIndices: new Set([0]),
    });
    expect(saved.processed_json.dictionary.id_1_0_old.text).toBe('甲。');
    expect(saved.processed_json.dictionary.id_0_0_new.text).toBe('乙。');
  });
});
