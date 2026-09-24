import { describe, expect, it, vi } from 'vitest';
import { runPreservedReanalysis } from '../reanalysisPreservation';

function generated(lines = [['学习']]) {
  const dictionary = {}, sequence = [];
  lines.forEach((words, line) => words.forEach((text, index) => {
    const id = `id_${line}_${index}_new`;
    sequence.push(id); dictionary[id] = { text, pos: '동사', meaning: '분석된 뜻', furigana: 'AI reading' };
  }));
  return { status: 'completed', sequence, dictionary, failed_indices: [] };
}
function material() {
  return { id: 30, raw_text: '学习', processed_json: {
    status: 'partial', sequence: ['failed_0_0'], dictionary: { failed_0_0: { text: '学习', pos: '미분석', failed: true } }, failed_indices: [0],
    metadata: { language: 'Chinese', classEntries: [{ id: 'entry', idx: 0, text: '学习' }],
      classMeanings: { entry: { text: '学习', meaning: '배우다, 공부하다' } }, classReadings: { entry: 'xué xí' } },
  } };
}
async function run(source, result = generated(), corrections = [], options = {}) {
  const q = { select: () => q, eq: () => q, order: () => q, range: async () => ({ data: corrections }) };
  const rpc = vi.fn(async (_, p) => ({ data: { material: { ...source, processed_json: p.p_json } } }));
  const saved = await runPreservedReanalysis({ from: () => q, rpc }, source, new AbortController().signal, async () => result, { fullReset: true, ...options });
  expect(rpc).toHaveBeenCalledOnce();
  expect(rpc.mock.calls[0][1].p_expected_json).toEqual(source.processed_json);
  return saved.processed_json;
}

describe('class entry meaning and reading survive background analysis', () => {
  it('keeps confirmed manual word values through initial analysis and another reanalysis without labeling them personal edits', async () => {
    const source = material(), before = structuredClone(source);
    const first = await run(source);
    expect(first.dictionary.id_0_0_new).toMatchObject({ meaning: '배우다, 공부하다', furigana: 'xué xí' });
    expect(first.metadata.viewerCorrections).toEqual({});
    expect(source).toEqual(before);
    const second = await run({ ...source, processed_json: first });
    expect(second.dictionary).toEqual(first.dictionary);
  });

  it.each(['log', 'marker'])('preserves a student’s edited meaning and intentionally blank reading via %s', async mode => {
    const source = material(), meta = source.processed_json.metadata;
    source.processed_json = { ...generated(), metadata: meta };
    source.processed_json.dictionary.id_0_0_new = { text: '学习', pos: '동사', meaning: '내가 확정한 뜻', furigana: '' };
    const row = { token_id: 'id_0_0_new', after_value: { meaning: '내가 확정한 뜻', furigana: '' } };
    if (mode === 'marker') meta.viewerCorrections = { id_0_0_new: ['meaning', 'furigana'] };
    const json = await run(source, generated(), mode === 'log' ? [row] : []);
    expect(json.dictionary.id_0_0_new).toMatchObject({ meaning: '내가 확정한 뜻', furigana: '' });
    expect(json.metadata.viewerCorrections.id_0_0_new).toEqual(['meaning', 'furigana']);
  });

  it('does not distribute a sentence meaning or reading over its separate tokens', async () => {
    const source = material(); source.raw_text = '学习中文';
    const meta = source.processed_json.metadata;
    meta.classEntries[0].text = '学习中文'; meta.classMeanings.entry.text = '学习中文';
    meta.classMeanings.entry.meaning = '중국어를 공부하다';
    const result = generated([['学习', '中文']]), json = await run(source, result);
    expect(json.dictionary).toEqual(result.dictionary);
  });

  it('keeps different confirmed senses on their exact repeated-word occurrences', async () => {
    const source = material(); source.raw_text = '学习\n学习';
    const meta = source.processed_json.metadata;
    meta.classEntries.push({ id: 'second', idx: 1, text: '学习' });
    meta.classMeanings.second = { text: '学习', meaning: '본받다' };
    const json = await run(source, generated([['学习'], ['学习']]));
    expect(json.dictionary.id_0_0_new.meaning).toBe('배우다, 공부하다');
    expect(json.dictionary.id_1_0_new.meaning).toBe('본받다');
  });

  it.each(['changed text', 'ambiguous anchor', 'source edit'])('leaves analysis alone when the anchor is unsafe: %s', async scenario => {
    const source = material(), result = generated(), options = {};
    if (scenario === 'changed text') source.processed_json.metadata.classEntries[0].text = '学校';
    if (scenario === 'ambiguous anchor') source.processed_json.metadata.classEntries.push({ id: 'other', idx: 0, text: '学习' });
    if (scenario === 'source edit') { source.raw_text = '学习\n学习'; options.rawTextOverride = '学习'; }
    const json = await run(source, result, [], options);
    expect(json.dictionary).toEqual(result.dictionary);
  });

  it('preserves an explicitly cleared class meaning and limits pronunciation to CJK languages', async () => {
    const source = material(), meta = source.processed_json.metadata;
    meta.classMeanings.entry.meaning = ''; meta.language = 'English';
    const json = await run(source);
    expect(json.dictionary.id_0_0_new).toMatchObject({ meaning: '', furigana: 'AI reading' });
  });

  it('does not affect an ordinary personal material without class entry anchors', async () => {
    const source = material(); delete source.processed_json.metadata.classEntries;
    const result = generated(), json = await run(source, result);
    expect(json.dictionary).toEqual(result.dictionary);
  });
});
