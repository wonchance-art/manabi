import { describe, expect, it } from 'vitest';
import { absoluteSourceSpan, exactSourceQuote, viewerSourceIdentity,
  withLocalizedExplanation, readLocalizedExplanation } from '../viewerLocalizedContext';

const span = (start, end, extra = {}) => ({ start, end, unit: 'utf16', ...extra });
const explanation = (explanationLocale, meaning) => ({ explanationLocale, meaning,
  sourceRevision: 'source-r1', explanationVersion: 'reviewed-v1' });

describe('exact raw source contract', () => {
  it('preserves punctuation, multiple spaces, tabs and decomposed source characters', () => {
    const text = 'Hello,  world!\tCafe\u0301.';
    expect(exactSourceQuote(text, span(0, text.length))).toBe(text);
    expect(exactSourceQuote(text, span(15, text.length), 'Café.')).toBeNull();
  });
  it('maps line-local Korean offsets to the raw document without changing line endings', () => {
    const raw = '첫 줄\r\n학교에  갔어요.\n끝';
    expect(absoluteSourceSpan(raw, span(5, 8, { lineIndex: 1 }))).toEqual(span(10, 13));
    expect(exactSourceQuote(raw, span(5, 8, { lineIndex: 1 }), '갔어요')).toBe('갔어요');
    expect(exactSourceQuote('a\rb\r\nc', span(0, 1, { lineIndex: 2 }))).toBe('c');
    expect(absoluteSourceSpan(raw, span(0, 11, { lineIndex: 1 }))).toBeNull();
  });
  it('keeps repeated occurrences distinct by source offsets and revision', () => {
    const scope = { materialId: '211', targetLanguage: 'Korean', sourceRevision: 'r1', rawText: '학교 학교', sourceSpan: span(3, 5) };
    const identity = viewerSourceIdentity(scope);
    expect(identity).toBe(viewerSourceIdentity({ ...scope, targetLanguage: 'ko', uiLocale: 'zh-TW', explanationLocale: 'zh-CN' }));
    expect(identity).not.toBe(viewerSourceIdentity({ ...scope, sourceSpan: span(0, 2) }));
    expect(identity).not.toBe(viewerSourceIdentity({ ...scope, sourceRevision: 'r2' }));
    expect(exactSourceQuote(scope.rawText, scope.sourceSpan, '학교')).toBe('학교');
    expect(exactSourceQuote('학 교 학교', scope.sourceSpan, '학교')).toBeNull();
  });
  it('rejects invalid units, ranges, missing lines and split surrogate pairs', () => {
    for (const value of [span(-1, 1), span(0, 0), span(1.5, 2), span(0, 4), span(0, 1, { unit: 'codepoint' }), span(0, 1, { lineIndex: 1 }), span(0, 1, { lineIndex: -1 })]) {
      expect(absoluteSourceSpan('abc', value)).toBeNull();
    }
    expect(exactSourceQuote('😀학교', span(1, 3))).toBeNull();
    expect(exactSourceQuote('😀학교', span(0, 1))).toBeNull();
    expect(exactSourceQuote('😀학교', span(0, 4))).toBe('😀학교');
    expect(viewerSourceIdentity({ targetLanguage: 'unsupported', sourceRevision: 'r1', materialId: '1', rawText: 'a', sourceSpan: span(0, 1) })).toBeNull();
  });
});

describe('optional locale explanations preserve learning records', () => {
  const saved = Object.freeze({ id: 'card-id', user_id: 'owner-id', language: 'Chinese', word_text: '学校',
    meaning: 'my edited meaning', furigana: 'xuéxiào', source_sentence: '学校。', source_material_id: 211,
    interval: 23, ease_factor: 5, repetitions: 9, next_review_at: '2026-11-01', last_reviewed_at: '2026-09-01' });
  it('retains legacy Korean meaning and never labels it as Chinese', () => {
    expect(readLocalizedExplanation(saved)).toEqual({ locale: 'ko', meaning: saved.meaning, legacy: true });
    expect(readLocalizedExplanation(saved, { explanationLocale: 'zh-CN' })).toBeNull();
    expect(readLocalizedExplanation(saved, { explanationLocale: 'zh-Hant' })).toBeNull();
  });
  it('adds independent locale data without changing identity, owner, overrides, sources or schedules', () => {
    const simplified = withLocalizedExplanation(saved, explanation('zh-CN', '学校'));
    const traditional = withLocalizedExplanation(simplified, explanation('zh-TW', '學校'));
    const { localizedExplanations, ...original } = traditional;
    expect(original).toEqual(saved);
    expect(simplified.localizedExplanations.byLocale['zh-TW']).toBeUndefined();
    expect(localizedExplanations.byLocale['zh-CN'].meaning).toBe('学校');
    expect(readLocalizedExplanation(traditional, { explanationLocale: 'zh-TW', sourceRevision: 'source-r1' })).toMatchObject({ meaning: '學校', locale: 'zh-TW', legacy: false });
    expect(readLocalizedExplanation(traditional, { sourceRevision: 'source-r1' }).meaning).toBe(saved.meaning);
  });
  it('rejects stale source/prompt versions and keeps a changed revision from relabeling old locales', () => {
    const old = withLocalizedExplanation(saved, explanation('zh-CN', '学校'));
    expect(readLocalizedExplanation(old, { explanationLocale: 'zh-CN' })).toBeNull();
    expect(readLocalizedExplanation(old, { explanationLocale: 'zh-CN', sourceRevision: 'source-r2' })).toBeNull();
    expect(readLocalizedExplanation(old, { explanationLocale: 'zh-CN', sourceRevision: 'source-r1', explanationVersion: 'v2' })).toBeNull();
    const next = withLocalizedExplanation(old, { ...explanation('zh-TW', '學校'), sourceRevision: 'source-r2' });
    expect(readLocalizedExplanation(next, { explanationLocale: 'zh-CN', sourceRevision: 'source-r2' })).toBeNull();
    expect(next.meaning).toBe(saved.meaning);
  });
  it('ignores unknown reader versions and refuses to overwrite them or coerce invalid locales', () => {
    const future = { ...saved, localizedExplanations: { version: 2, secretFutureField: 'preserve' } };
    expect(readLocalizedExplanation(future, { sourceRevision: 'r1' })).toBeNull();
    expect(() => withLocalizedExplanation(future, explanation('ko', '뜻'))).toThrow(TypeError);
    for (const locale of ['zh', 'zh-Hans', 'zh-Hant', 'zh-Hans-TW', 'en', null]) {
      expect(() => withLocalizedExplanation(saved, explanation(locale, 'meaning'))).toThrow(TypeError);
    }
    expect(() => withLocalizedExplanation(saved, { ...explanation('ko', '뜻'), sourceRevision: '' })).toThrow(TypeError);
    expect(() => withLocalizedExplanation(saved, { ...explanation('ko', '뜻'), meaning: {} })).toThrow(TypeError);
  });
});
