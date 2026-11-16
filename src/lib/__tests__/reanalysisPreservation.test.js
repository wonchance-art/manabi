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

// 뷰어 v2 AD-R4 §7 · §9.1 「교정 우선」: 서버가 「뜻 확인 필요」 표식(meaningCheck)을 내도, 사용자가 뜻을 교정한 토큰은
// 교정값이 이기고 표식이 지워진다. 교정하지 않은 토큰과 뜻 아닌 칸(발음)만 교정한 토큰은 표식을 그대로 둔다.
describe('AD-R4: a corrected meaning clears the meaningCheck marker on reanalysis', () => {
  const flagged = () => {
    const result = generated();
    result.dictionary.id_0_0_new.meaningCheck = 'doubt';
    result.dictionary.id_0_1_new.meaningCheck = 'ctx';
    return result;
  };
  it('drops meaningCheck where the meaning was corrected, keeps the corrected value', () => {
    const result = preserveReanalysisTokens(old, old.raw_text, flagged(), [{ token_id: 'id_0_0_old', after_value: { meaning: '담다' } }]);
    expect(result.dictionary.id_0_0_old.meaning).toBe('담다');
    expect(result.dictionary.id_0_0_old).not.toHaveProperty('meaningCheck');
    expect(result.dictionary.id_0_1_old.meaningCheck).toBe('ctx');
  });
  it('a reading-only correction does not clear the marker', () => {
    const result = preserveReanalysisTokens(old, old.raw_text, flagged(), [{ token_id: 'id_0_0_old', after_value: { furigana: 'chéng' } }]);
    expect(result.dictionary.id_0_0_old.furigana).toBe('chéng');
    expect(result.dictionary.id_0_0_old.meaningCheck).toBe('doubt');
  });
});

// FLOW-ADD-A1(2026-11-16 KST) — 처음 분석(분석 결과가 없는 자료)은 지킬 기존 분석이 없다. 한 줄 실패 · 중단 · 연결 끊김으로
// 이미 분석한 줄을 버리지 않고 partial(failed_indices = 남은 줄)로 저장한다 — 옛 가져오기와 같은 꼴, 뷰어 「이어서 분석」이 잇는다.
// 이 묶음은 옛 동작(전부 버리고 「기존 원문과 분석은 그대로 있어요」)으로 되돌리면 실패한다.
describe('first analysis keeps the lines it already analyzed', () => {
  const fresh = (language = 'Japanese') => ({ id: 9, owner_id: 'owner', raw_text: '雨。\n晴れ。',
    processed_json: { status: 'saved', sequence: [], dictionary: {}, last_idx: -1, metadata: { language } } });
  const line0 = () => ({ sequence: ['id_0_0_t', 'br_0_t'], dictionary: { id_0_0_t: { text: '雨。', meaning: '비' }, br_0_t: { text: '\n', pos: '개행' } }, last_idx: 0, failed_indices: [] });
  const freshClient = (material) => {
    const q = { select: () => q, eq: () => q, order: () => q, range: async () => ({ data: [], error: null }) };
    return { from: vi.fn(() => q), rpc: vi.fn(async (name, p) => ({ data: { material: { ...material, raw_text: p.p_raw, processed_json: p.p_json } } })) };
  };

  it('one failed line → saves the analyzed line as partial with the rest in failed_indices', async () => {
    const m = fresh(), c = freshClient(m);
    const analyze = async () => ({ ...line0(), status: 'partial',
      sequence: [...line0().sequence, 'failed_1_t'], dictionary: { ...line0().dictionary, failed_1_t: { text: '晴れ。', failed: true, pos: '미분석' } }, failed_indices: [1] });
    const saved = await runPreservedReanalysis(c, m, new AbortController().signal, analyze);
    expect(c.rpc).toHaveBeenCalledOnce();
    expect(saved.processed_json.status).toBe('partial');
    expect(saved.processed_json.failed_indices).toEqual([1]);
    expect(saved.processed_json.sequence).toContain('id_0_0_t');
  });

  it('stopped mid-way (leaving the viewer · 「중단」) → saves the batches done so far', async () => {
    const m = fresh(), c = freshClient(m), controller = new AbortController();
    const analyze = async (text, signal, { onBatch }) => {
      onBatch({ currentJson: line0() });
      controller.abort();
      onBatch({ currentJson: line0() });
      throw new Error('unreachable');
    };
    const saved = await runPreservedReanalysis(c, m, controller.signal, analyze);
    expect(c.rpc).toHaveBeenCalledOnce();
    expect(saved.processed_json.status).toBe('partial');
    expect(saved.processed_json.failed_indices).toEqual([1]);
  });

  it('nothing analyzed → no write, and the message does not claim an earlier analysis exists', async () => {
    const m = fresh(), c = freshClient(m);
    const analyze = async () => ({ status: 'failed', sequence: ['failed_0_t'], dictionary: { failed_0_t: { text: '雨。', failed: true } }, failed_indices: [0, 1], last_idx: 1 });
    await expect(runPreservedReanalysis(c, m, new AbortController().signal, analyze)).rejects.toThrow('원문은 그대로 있어요');
    await expect(runPreservedReanalysis(c, m, new AbortController().signal, analyze)).rejects.not.toThrow('기존 원문과 분석');
    expect(c.rpc).not.toHaveBeenCalled();
  });

  it('stopped before any batch → no write', async () => {
    const m = fresh(), c = freshClient(m), controller = new AbortController();
    controller.abort();
    await expect(runPreservedReanalysis(c, m, controller.signal, async () => line0())).rejects.toThrow();
    expect(c.rpc).not.toHaveBeenCalled();
  });

  it('Korean first analysis and already-analyzed materials keep 「all or nothing」', async () => {
    const ko = fresh('Korean'), c = freshClient(ko);
    const partial = async () => ({ ...line0(), status: 'partial', failed_indices: [1] });
    await expect(runPreservedReanalysis(c, ko, new AbortController().signal, partial)).rejects.toThrow();
    expect(c.rpc).not.toHaveBeenCalled();
  });
});
