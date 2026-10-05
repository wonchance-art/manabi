import { describe, expect, it, vi } from 'vitest';
import { analyzeKoreanLines, KOREAN_ANALYSIS_SCHEMA, koreanSourceUnits, parseKoreanAnalysis } from '../koreanAnalysis.js';

const textOf = result => result.sequence.map(id => result.dictionary[id].surface).join('');
const lexical = result => result.sequence.map(id => result.dictionary[id]).filter(token => token.pos !== '기호');
const response = (source, entries) => JSON.stringify({ lines: [{ tokens: koreanSourceUnits([source])[0].map(unit => {
  const analysis = entries[unit.surface];
  return { start: unit.start, end: unit.end, surface: unit.surface,
    ...(unit.kind === 'lexical' ? analysis : { lemma: '', pos: '기호', meaning: '' }) };
}) }] });

describe('Korean explanation field guidance retains the v1 wire and source contract', () => {
  it('adds model guidance without introducing output fields or changing one-request execution', async () => {
    const source = '늦게';
    const llm = vi.fn().mockResolvedValue({ text: response(source, { 늦게: {
      lemma: '늦다', pos: '형용사', meaning: '迟地', morphology: [
        { form: '늦-', function: '形容词词干' }, { form: '-게', function: '使形容词用于修饰谓语的副词性形式' },
      ],
    } }) });
    const output = await analyzeKoreanLines({ language: 'Korean', explanationLocale: 'zh-CN', lines: [source] }, { llm });
    expect(llm).toHaveBeenCalledTimes(1);
    const [tier, , options] = llm.mock.calls[0];
    expect(tier).toBe('light');
    expect(options).toMatchObject({ groq: false, retry: { max: 0 }, timeoutMs: 25_000, responseSchema: KOREAN_ANALYSIS_SCHEMA });
    const schema = options.responseSchema.properties.lines.items.properties.tokens.items;
    expect(schema.required).toEqual(['start', 'end', 'surface', 'lemma', 'pos', 'meaning']);
    expect(Object.keys(schema.properties).sort()).toEqual(['end', 'lemma', 'meaning', 'morphology', 'pos', 'reading', 'start', 'surface']);
    expect(schema.properties.morphology.items.required).toEqual(['form', 'function']);
    expect(Object.keys(schema.properties.morphology.items.properties).sort()).toEqual(['form', 'function']);
    expect(output.metadata).toMatchObject({ analysisVersion: 'ko-llm-v1', analysisQuality: 'unreviewed' });
    const [word] = lexical(output.results[0]);
    expect(word).toMatchObject({ lemma: '늦다', pos: '형용사', surface: '늦게', base_form: '늦다' });
    expect(word).not.toHaveProperty('description');
    expect(word.morphology[1].function).toBe('使形容词用于修饰谓语的副词性形式');
    expect(textOf(output.results[0])).toBe(source);
  });

  it.each(['zh-CN', 'zh-TW'])('preserves clause-scope explanations in %s without inferring semantic approval', locale => {
    const source = '계약을 아직 읽지 않았어요.';
    const cn = locale === 'zh-CN';
    const [result] = parseKoreanAnalysis(response(source, {
      계약을: { lemma: '계약', pos: '명사', meaning: cn ? '合同' : '契約', morphology: [
        { form: '계약', function: cn ? '名词，指合同' : '名詞，指契約' },
        { form: '을', function: cn ? '标示阅读对象的宾格助词' : '標示閱讀對象的受格助詞' },
      ] },
      아직: { lemma: '아직', pos: '부사', meaning: cn ? '还（与否定呼应）' : '還（與否定呼應）' },
      읽지: { lemma: '읽다', pos: '동사', meaning: cn ? '还没读（与后面的않았어요构成否定）' : '還沒讀（與後面的않았어요構成否定）', morphology: [
        { form: '-지', function: cn ? '连接后面的않다，构成长否定形式' : '連接後面的않다，構成長否定形式' },
      ] },
      않았어요: { lemma: '않다', pos: '조동사', meaning: cn ? '没有（否定阅读已经发生）' : '沒有（否定閱讀已經發生）' },
    }), [source], locale);
    expect(result.failed).toBeUndefined();
    expect(textOf(result)).toBe(source);
    expect(lexical(result)[0].meaning).toBe(cn ? '合同' : '契約');
    expect(lexical(result)[2].lemma).toBe('읽다');
    expect(lexical(result)[2].morphology[0].form).toBe('-지');
    expect(result.metadata.analysisQuality).toBe('unreviewed');
  });

  it.each([
    ['걸다', '挂', [{ form: '걸-', function: '规则动词词干' }, { form: '-어요', function: '礼貌终结词尾' }]],
    ['걷다', '走', [{ form: '걷-', function: 'ㄷ不规则：元音前ㄷ变成ㄹ，得到걸-' }, { form: '-어요', function: '礼貌终结词尾' }]],
  ])('does not decide the ambiguous surface 걸어요 from spelling alone: %s', (lemma, meaning, morphology) => {
    const [result] = parseKoreanAnalysis(response('걸어요', { 걸어요: { lemma, pos: '동사', meaning, morphology } }), ['걸어요'], 'zh-CN');
    expect(result.failed).toBeUndefined();
    expect(lexical(result)[0]).toMatchObject({ lemma, meaning, morphology });
    expect(result.metadata.analysisQuality).toBe('unreviewed');
  });

  it('leaves unsupported semantic claims unreviewed instead of silently replacing Chinese text', () => {
    const source = '아직';
    const [result] = parseKoreanAnalysis(response(source, { 아직: { lemma: '아직', pos: '부사', meaning: '還沒；主語、干涉、契約' } }), [source], 'zh-TW');
    expect(result.failed).toBeUndefined();
    expect(lexical(result)[0].meaning).toBe('還沒；主語、干涉、契約');
    expect(result.metadata.analysisQuality).toBe('unreviewed');
  });

  it('preserves the complete source instead of guessing a corrected POS for a contradictory model output', () => {
    const source = '늦게.';
    const [result] = parseKoreanAnalysis(response(source, { 늦게: { lemma: '늦다', pos: '부사', meaning: '晚地',
      morphology: [{ form: '늦-', function: '形容詞語幹' }, { form: '-게', function: '副詞化語尾' }],
    } }), [source], 'zh-TW');
    expect(result).toMatchObject({ failed: true, errorCode: 'inconsistent_morphology' });
    expect(textOf(result)).toBe(source);
    expect(result.dictionary[result.sequence[0]]).toMatchObject({ pos: null, failed: true,
      sourceSpan: { start: 0, end: source.length, unit: 'utf16', lineIndex: 0 } });
    expect(result.metadata).toMatchObject({ analysisVersion: 'ko-llm-v1', analysisQuality: 'unreviewed' });
  });
});
