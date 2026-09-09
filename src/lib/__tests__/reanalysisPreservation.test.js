import { describe, expect, it, vi } from 'vitest';
import { completeAnalysis, preserveReanalysisTokens, runPreservedReanalysis } from '../reanalysisPreservation';
const old = { id: 4, owner_id: 'owner', raw_text: '盛粥。', processed_json: { status: 'completed', metadata: { language: 'Chinese' }, sequence: ['id_0_0_old', 'id_0_1_old'], dictionary: { id_0_0_old: { text: '盛', meaning: '담다', furigana: 'chéng' }, id_0_1_old: { text: '粥。', meaning: '죽' } } } };
const generated = () => ({ status: 'completed', failed_indices: [], sequence: ['id_0_0_new', 'id_0_1_new'], dictionary: { id_0_0_new: { text: '盛', meaning: '성대하다', furigana: 'shèng' }, id_0_1_new: { text: '粥。', meaning: '죽' } } });
function client() {
  const q = { select: () => q, eq: () => q, order: () => q, range: async () => ({ data: [], error: null }) };
  return { from: vi.fn(() => q), rpc: vi.fn(async (name, p) => ({ data: { material: { ...old, raw_text: p.p_raw, processed_json: p.p_json } } })) };
}
describe('reanalysis preserves the active source until complete', () => {
  it('does not write batches, failures or aborts to the current material', async () => {
    for (const failure of ['throw', 'partial', 'abort']) {
      const c = client(), controller = new AbortController(), snapshot = structuredClone(old);
      const analyze = async (text, signal, { onBatch }) => {
        onBatch({ currentJson: { sequence: [], dictionary: {}, last_idx: 0 } });
        if (failure === 'abort') controller.abort();
        if (failure === 'throw') throw new Error('offline');
        return { ...generated(), status: 'partial', failed_indices: [0] };
      };
      await expect(runPreservedReanalysis(c, old, controller.signal, analyze)).rejects.toThrow();
      expect(c.rpc).not.toHaveBeenCalled();
      expect(old).toEqual(snapshot);
    }
  });
  it('commits source and analysis together with the exact initial snapshot', async () => {
    const c = client(), snapshot = structuredClone(old);
    const saved = await runPreservedReanalysis(c, old, new AbortController().signal, async () => generated());
    expect(c.rpc).toHaveBeenCalledOnce();
    expect(c.rpc.mock.calls[0][1].p_expected_json).toEqual(snapshot.processed_json);
    expect(c.rpc.mock.calls[0][1].p_expected_raw).toBe(snapshot.raw_text);
    expect(saved.processed_json.sequence).toEqual(old.processed_json.sequence);
    expect(old).toEqual(snapshot);
  });
  it('preserves corrected fields at the same occurrence and never misassigns changed segmentation', () => {
    const result = preserveReanalysisTokens(old, old.raw_text, generated(), [{ token_id: 'id_0_0_old', after_value: { furigana: 'chéng', meaning: '담다' } }]);
    expect(result.dictionary.id_0_0_old.furigana).toBe('chéng');
    expect(result.dictionary.id_0_0_old.meaning).toBe('담다');
    const changed = generated(); changed.dictionary.id_0_0_new.text = '盛粥'; changed.dictionary.id_0_1_new.text = '。';
    expect(preserveReanalysisTokens(old, old.raw_text, changed).sequence).toEqual(changed.sequence);
  });
  it('retains correction markers after moving a line and reanalyzing again', () => {
    const moved = generated();
    moved.sequence = moved.sequence.map(id => id.replace('id_0_', 'id_1_'));
    moved.dictionary = Object.fromEntries(Object.entries(moved.dictionary).map(([id, token]) => [id.replace('id_0_', 'id_1_'), token]));
    const text = '\n' + old.raw_text;
    const first = preserveReanalysisTokens(old, text, moved, [{ token_id: 'id_0_0_old', after_value: { meaning: '담다', furigana: 'chéng' } }]);
    const second = preserveReanalysisTokens({ ...old, raw_text: text, processed_json: first }, text, moved, []);
    expect(second.dictionary.id_1_0_old).toMatchObject({ meaning: '담다', furigana: 'chéng' });
  });
  it('rejects missing source lines and broken dictionaries despite a completed status', () => {
    expect(completeAnalysis(generated(), '盛粥。\n他走。')).toBe(false);
    const missing = generated(); delete missing.dictionary.id_0_1_new;
    expect(completeAnalysis(missing, old.raw_text)).toBe(false);
    const truncated = generated(); truncated.dictionary.id_0_1_new.text = '。';
    expect(completeAnalysis(truncated, old.raw_text)).toBe(false);
  });
  it('does not re-call AI for a valid remap with no changed lines, and marks the commit boundary', async () => {
    const c = client(), analyze = vi.fn(), onCommitting = vi.fn();
    await runPreservedReanalysis(c, old, new AbortController().signal, analyze, {
      rawTextOverride: old.raw_text, baseJsonOverride: old.processed_json, selectedLineIndices: new Set(), onCommitting,
    });
    expect(analyze).not.toHaveBeenCalled();
    expect(onCommitting).toHaveBeenCalledOnce();
    expect(c.rpc).toHaveBeenCalledOnce();
  });
  it('reads all correction pages and fails closed if correction history is unavailable', async () => {
    const c = client();
    const range = vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 500 }, () => ({ token_id: 'old', after_value: {} })) }).mockResolvedValueOnce({ data: [] });
    const q = { select: () => q, eq: () => q, order: () => q, range }; c.from.mockReturnValue(q);
    await runPreservedReanalysis(c, old, new AbortController().signal, async () => generated());
    expect(range.mock.calls).toEqual([[0, 499], [500, 999]]);
    range.mockResolvedValue({ error: new Error('history unavailable') }); c.rpc.mockClear();
    await expect(runPreservedReanalysis(c, old, new AbortController().signal, async () => generated())).rejects.toThrow('history unavailable');
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it('does not report a missing RPC or a concurrent update as successful', async () => {
    const c = client(); c.rpc.mockResolvedValue({ error: { code: 'PGRST202' } });
    await expect(runPreservedReanalysis(c, old, new AbortController().signal, async () => generated())).rejects.toThrow('기존 원문');
    c.rpc.mockResolvedValue({ error: new Error('다른 창에서 수정') });
    await expect(runPreservedReanalysis(c, old, new AbortController().signal, async () => generated())).rejects.toThrow('다른 창');
  });
});
