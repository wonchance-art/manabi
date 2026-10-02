import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ llm: vi.fn(), getUser: vi.fn(), rateLimit: vi.fn(), fetch: vi.fn() }));
vi.mock('../llm.js', () => ({ callLLM: mocks.llm }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock('../rateLimit.js', () => ({ rateLimit: mocks.rateLimit, getClientKey: (_request, id) => `u:${id}` }));
vi.mock('../../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test' } } }) } } }));
vi.mock('../../gemini', () => ({ callGemini: vi.fn(), parseGeminiJSON: vi.fn(), buildTokenizationPrompt: vi.fn() }));

import {
  analyzeKoreanLines, buildKoreanAnalysisPrompt, parseKoreanAnalysis, validateKoreanRequest,
  koreanAnalysisMetadata, koreanSourceUnits, KOREAN_ANALYSIS_VERSION,
} from '../koreanAnalysis.js';
import { POS_CANON_ALL } from '../posCanon.js';
import { POST } from '../../../app/api/analyze/korean/route.js';
import { analyzeText } from '../../analyzeText.js';

const token = (surface, start, pos = '동사', lemma = '가다', meaning = '去') => ({
  surface, start, end: start + surface.length, pos, lemma, meaning,
});
const serialize = (...tokens) => JSON.stringify({ lines: tokens.map((line) => ({ tokens: line })) });
const lineText = (result) => result.sequence.map((id) => result.dictionary[id].text).join('');
const request = (body, auth = true) => new Request('https://test/api/analyze/korean', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer test' } : {}) },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'reader' } }, error: null });
  mocks.rateLimit.mockReturnValue({ ok: true });
});
afterEach(() => vi.unstubAllGlobals());

describe('Korean structured adapter', () => {
  it.each(['ko', 'zh-CN', 'zh-TW'])('keeps %s explanations explicit and original Hangul separate', async (explanationLocale) => {
    const expectedMeaning = { ko: '갔다의 공손한 표현', 'zh-CN': '去过；礼貌语尾', 'zh-TW': '去過；禮貌語尾' }[explanationLocale];
    mocks.llm.mockResolvedValue({ text: serialize([{ ...token('갔어요', 0, '동사', '가다', expectedMeaning),
      morphology: [{ form: '가', function: 'verb stem' }, { form: '았', function: 'past' }, { form: '어요', function: 'polite' }] }]) });
    const result = await analyzeKoreanLines({ lines: ['갔어요'], language: 'Korean', explanationLocale });
    expect(result.metadata).toMatchObject({ explanationLocale, analysisVersion: KOREAN_ANALYSIS_VERSION, analysisQuality: 'unreviewed' });
    const word = result.results[0].dictionary[result.results[0].sequence[0]];
    expect(word).toMatchObject({ text: '갔어요', surface: '갔어요', base_form: '가다', lemma: '가다', meaning: expectedMeaning,
      sourceSpan: { start: 0, end: 3, unit: 'utf16', lineIndex: 0 } });
    expect(word.morphology.map((m) => m.form).join('')).not.toBe(word.surface);
    expect(word.morphology.every((m) => m.sourceSpan === undefined)).toBe(true);
    expect(word.furigana).toBeUndefined();
    expect(mocks.llm).toHaveBeenCalledWith('light', expect.any(String), expect.objectContaining({
      groq: false, maxOutputTokens: 8192, timeoutMs: 25_000, retry: { max: 0 }, responseMimeType: 'application/json',
    }));
  });

  it('requires exact raw UTF16 coverage for spaces, punctuation, repetition, NFD Hangul, emoji and CR', () => {
    const nfd = '한'.normalize('NFD');
    const surfaces = ['  ', '갔어요', ',', '\t', '갔어요', ' ', nfd, '🙂', '\r'];
    let offset = 0;
    const tokens = surfaces.map((surface) => {
      const symbol = /^[\s\p{P}\p{S}]+$/u.test(surface);
      const output = token(surface, offset, symbol ? '기호' : '동사', symbol ? '' : '가다', symbol ? '' : '去');
      offset += surface.length;
      return output;
    });
    const line = surfaces.join('');
    const [result] = parseKoreanAnalysis(serialize(tokens), [line], 'zh-TW');
    expect(result.failed).toBeUndefined();
    expect(lineText(result)).toBe(line);
    expect(result.sequence.map((id) => result.dictionary[id].sourceSpan)).toEqual(tokens.map((t) => ({
      start: t.start, end: t.end, unit: 'utf16', lineIndex: 0,
    })));
    expect(result.sequence.every((id) => POS_CANON_ALL.has(result.dictionary[id].pos))).toBe(true);
  });

  it.each([
    [token('갔어요', 1)], [token('가요', 0)], [{ ...token('갔어요', 0), end: 2 }],
    [{ ...token('갔어요', 0), pos: '종결어미' }], [token('갔', 0), token('어요', 0)], [],
  ])('rejects wrong coverage or undocumented POS while preserving the original: %j', (...bad) => {
    const [result] = parseKoreanAnalysis(serialize(bad.flat()), ['갔어요']);
    expect(result.failed).toBe(true);
    expect(lineText(result)).toBe('갔어요');
  });

  it('rejects surrogate and NFD grapheme splits', () => {
    for (const line of ['🙂', '한'.normalize('NFD')]) {
      const tokens = [token(line.slice(0, 1), 0), token(line.slice(1), 1)];
      const [result] = parseKoreanAnalysis(serialize(tokens), [line]);
      expect(result.failed).toBe(true);
      expect(lineText(result)).toBe(line);
    }
  });

  it('rejects invented morpheme selection spans and grouping across eojeol whitespace', () => {
    for (const [line, tokens] of [
      ['갔어요', [token('갔', 0), token('어요', 1)]],
      ['학교에', [token('학교', 0, '명사', '학교'), token('에', 2, '조사', '에')]],
      ['학교에 갔어요', [token('학교에 갔어요', 0)]],
    ]) {
      const [result] = parseKoreanAnalysis(serialize(tokens), [line]);
      expect(result.failed).toBe(true);
      expect(lineText(result)).toBe(line);
    }
  });

  it('provides immutable exact source units so the model never guesses offsets or splits attached particles', () => {
    const source = ['  학교에 갔어요!', '', `${'한'.normalize('NFD')}👩‍💻\t학교에`];
    const units = koreanSourceUnits(source);
    expect(units[0]).toEqual([
      { start: 0, end: 2, surface: '  ', kind: 'whitespace' },
      { start: 2, end: 5, surface: '학교에', kind: 'lexical' },
      { start: 5, end: 6, surface: ' ', kind: 'whitespace' },
      { start: 6, end: 9, surface: '갔어요', kind: 'lexical' },
      { start: 9, end: 10, surface: '!', kind: 'punctuation' },
    ]);
    expect(units[1]).toEqual([]);
    units.forEach((line, index) => {
      expect(line.map(unit => unit.surface).join('')).toBe(source[index]);
      for (const unit of line) expect(source[index].slice(unit.start, unit.end)).toBe(unit.surface);
    });
    const prompt = buildKoreanAnalysisPrompt(source, 'zh-CN');
    expect(prompt).toContain(`SOURCE_UNITS_JSON=${JSON.stringify(units)}`);
    expect(prompt).toContain('EXACTLY one token per template unit');
    expect(prompt).toContain('학교에 is ONE selection token');
  });

  it('rejects the actual synthetic live model defect without relaxing eojeol/whitespace/spans', () => {
    const tokens = [
      token('  ', 0, '기호', '', ''), token('학교', 2, '명사', '학교', '学校'),
      token('에', 4, '조사', '에', '在……（表示方向或地点）'),
      { ...token('갔어요', 5, '동사', '가다', '去，走了'), end: 10 }, token('!', 10, '기호', '', ''),
    ];
    const [result] = parseKoreanAnalysis(serialize(tokens), ['  학교에 갔어요!'], 'zh-CN');
    expect(result.failed).toBe(true);
    expect(result.errorCode).toBe('invalid_analysis');
    expect(lineText(result)).toBe('  학교에 갔어요!');
  });

  it('keeps optional pronunciation typed as Hangul rather than furigana', () => {
    const [result] = parseKoreanAnalysis(serialize([{ ...token('같이', 0, '부사', '같이'), reading: '가치' }]), ['같이']);
    expect(Object.values(result.dictionary)[0].readings).toEqual([{ system: 'hangul', text: '가치' }]);
    expect(parseKoreanAnalysis(serialize([{ ...token('같이', 0), reading: 'かち' }]), ['같이'])[0].failed).toBe(true);
  });

  it('preserves a whole emoji ZWJ sequence as a symbol group', () => {
    const line = '가요👩‍💻';
    const [result] = parseKoreanAnalysis(serialize([token('가요', 0), token('👩‍💻', 2, '기호', '', '')]), [line]);
    expect(result.failed).toBeUndefined();
    expect(lineText(result)).toBe(line);
    expect(Object.values(result.dictionary)[1].sourceSpan.end).toBe(line.length);
  });

  it('fails only an invalid line and preserves line order', () => {
    const results = parseKoreanAnalysis(serialize([token('갔어요', 0)], [token('invented', 0)], []), ['갔어요', '  원문', '']);
    expect(results.map(lineText)).toEqual(['갔어요', '  원문', '']);
    expect(results.map((line) => Boolean(line.failed))).toEqual([false, true, false]);
  });

  it('bad JSON or unavailable model returns exact original failed lines without model detail leakage', async () => {
    for (const output of ['{bad', JSON.stringify({ lines: [] })]) {
      mocks.llm.mockResolvedValue({ text: output });
      const result = await analyzeKoreanLines({ language: 'Korean', lines: ['  갔어요', '둘째🙂'], explanationLocale: 'zh-CN' });
      expect(result.results.map(lineText)).toEqual(['  갔어요', '둘째🙂']);
      expect(result.results.every((line) => line.failed)).toBe(true);
    }
    mocks.llm.mockRejectedValue(new Error('private provider detail'));
    const result = await analyzeKoreanLines({ language: 'Korean', lines: ['원문'] });
    expect(result.results[0].errorCode).toBe('analysis_unavailable');
    expect(JSON.stringify(result)).not.toContain('private provider');
  });

  it('whitespace-only input is exact and costs no LLM call', async () => {
    const result = await analyzeKoreanLines({ language: 'Korean', lines: ['', ' \t\r'] });
    expect(result.results.map(lineText)).toEqual(['', ' \t\r']);
    expect(mocks.llm).not.toHaveBeenCalled();
    expect(result.metadata.explanationLocale).toBe('ko');
  });

  it('rejects unknown locales, non-Korean input and oversized source without truncating or calling LLM', async () => {
    for (const body of [
      { language: 'Korean', lines: ['원문'], explanationLocale: 'zh-Hant' },
      { language: 'Korean', lines: ['원문'], explanationLocale: null },
      { language: 'Japanese', lines: ['원문'] }, { language: 'Korean', lines: [123] },
      { language: 'Korean', lines: ['가'.repeat(201)] },
      { language: 'Korean', lines: Array(11).fill('가'.repeat(200)) },
      { language: 'Korean', lines: ['a\nb'] },
    ]) await expect(analyzeKoreanLines(body)).rejects.toThrow();
    expect(mocks.llm).not.toHaveBeenCalled();
    expect(validateKoreanRequest({ language: 'Korean', lines: [' 원문 '] }).lines).toEqual([' 원문 ']);
    expect(buildKoreanAnalysisPrompt(['원문'], 'zh-TW')).toContain('Taiwan Traditional Chinese');
    expect(buildKoreanAnalysisPrompt(['원문'], 'zh-CN')).toContain('Simplified Chinese');
  });

  it('propagates cancellation instead of reporting failed analysis', async () => {
    const controller = new AbortController();
    controller.abort();
    mocks.llm.mockRejectedValue(new Error('cancelled'));
    await expect(analyzeKoreanLines({ language: 'Korean', lines: ['원문'] }, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('Korean route protections', () => {
  it('requires verified Bearer auth and shares existing analyze rate policy', async () => {
    expect((await POST(request({ language: 'Korean', lines: ['원문'] }, false))).status).toBe(401);
    expect(mocks.getUser).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid' } });
    expect((await POST(request({ language: 'Korean', lines: ['원문'] }))).status).toBe(401);
    mocks.rateLimit.mockReturnValueOnce({ ok: false, resetIn: 2300 });
    const response = await POST(request({ language: 'Korean', lines: ['원문'] }));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('3');
    expect(mocks.rateLimit).toHaveBeenCalledWith('u:reader', { limit: 20, windowMs: 60_000 });
    expect(mocks.llm).not.toHaveBeenCalled();
  });

  it('returns controlled errors for malformed JSON, unsupported locale, and oversized source', async () => {
    expect((await POST(request('{bad'))).status).toBe(400);
    expect((await POST(request({ language: 'Korean', lines: ['원문'], explanationLocale: 'en' }))).status).toBe(400);
    expect((await POST(request({ language: 'Korean', lines: ['가'.repeat(201)] }))).status).toBe(413);
    expect(mocks.llm).not.toHaveBeenCalled();
  });

  it('returns locale metadata, no-store and honest failed originals', async () => {
    mocks.llm.mockResolvedValue({ text: 'invalid' });
    const response = await POST(request({ language: 'Korean', lines: ['  원문🙂'], explanationLocale: 'zh-TW' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const data = await response.json();
    expect(data.metadata.explanationLocale).toBe('zh-TW');
    expect(data.results[0].failed).toBe(true);
    expect(lineText(data.results[0])).toBe('  원문🙂');
  });
});

describe('Korean client dispatch', () => {
  const successfulFetch = (url, options) => {
    expect(url).toBe('/api/analyze/korean');
    const body = JSON.parse(options.body);
    const metadata = koreanAnalysisMetadata(body.explanationLocale);
    return Promise.resolve({ ok: true, json: async () => ({ metadata, results: body.lines.map((line) => {
      const tokens = [...line.matchAll(/\s+|[\p{P}\p{S}]+|[^\s\p{P}\p{S}]+/gu)].map((match) => {
        const symbol = /^[\s\p{P}\p{S}]+$/u.test(match[0]);
        return token(match[0], match.index, symbol ? '기호' : '동사', symbol ? '' : '가다', symbol ? '' : '去');
      });
      return parseKoreanAnalysis(serialize(tokens), [line], body.explanationLocale)[0];
    }) }) });
  };

  it('preserves whole document whitespace/newlines and absolute UTF16 spans with batched callbacks', async () => {
    mocks.fetch.mockImplementation(successfulFetch);
    vi.stubGlobal('fetch', mocks.fetch);
    const raw = '  갔어요\t\n\n둘째🙂\n';
    const onBatch = vi.fn();
    const result = await analyzeText(raw, null, { metadata: { language: 'Korean', explanationLocale: 'zh-TW' }, onBatch });
    expect(lineText(result)).toBe(raw);
    expect(result.metadata).toMatchObject({ language: 'Korean', explanationLocale: 'zh-TW', analysisVersion: KOREAN_ANALYSIS_VERSION });
    const tokens = Object.values(result.dictionary).filter((t) => t.sourceSpan && t.pos !== '개행');
    expect([...new Set(tokens.map((t) => t.sourceSpan.lineIndex))]).toEqual([0, 2]);
    for (const t of Object.values(result.dictionary)) {
      expect(t.sourceSpan).toBeDefined();
      expect(raw.slice(t.sourceSpan.start, t.sourceSpan.end)).toBe(t.text);
    }
    expect(onBatch).toHaveBeenLastCalledWith(expect.objectContaining({ processed: 4, total: 4 }));
  });

  it('keeps failed source and retries without duplicate newlines while respecting locale changes', async () => {
    mocks.fetch.mockImplementationOnce(() => Promise.reject(new Error('offline'))).mockImplementation(successfulFetch);
    vi.stubGlobal('fetch', mocks.fetch);
    const metadata = { language: 'Korean', explanationLocale: 'zh-CN' };
    const raw = '갔어요\n\n둘째🙂\n';
    const failed = await analyzeText(raw, null, { metadata });
    expect(failed.failed_indices).toEqual([0]);
    expect(lineText(failed)).toBe(raw);
    mocks.fetch.mockClear();
    const retried = await analyzeText(raw, null, { metadata, existingJson: failed });
    expect(lineText(retried)).toBe(raw);
    expect(retried.failed_indices).toEqual([]);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    mocks.fetch.mockClear();
    const switched = await analyzeText(raw, null, { metadata: { ...metadata, explanationLocale: 'zh-TW' }, existingJson: failed });
    expect(lineText(switched)).toBe(raw);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(switched.metadata.explanationLocale).toBe('zh-TW');
  });

  it('bounds requests and aborts before fetching', async () => {
    mocks.fetch.mockImplementation(successfulFetch);
    vi.stubGlobal('fetch', mocks.fetch);
    const raw = Array(20).fill('갔어요').join('\n');
    expect(lineText(await analyzeText(raw, null, { metadata: { language: 'Korean' } }))).toBe(raw);
    expect(mocks.fetch.mock.calls.map(([, opts]) => JSON.parse(opts.body).lines.length)).toEqual([8, 8, 4]);
    mocks.fetch.mockClear();
    const controller = new AbortController();
    controller.abort();
    await expect(analyzeText(raw, controller.signal, { metadata: { language: 'Korean' } })).rejects.toMatchObject({ name: 'AbortError' });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('analyzes pending imported metadata while preserving material provenance and raw CRLF', async () => {
    mocks.fetch.mockImplementation(successfulFetch);
    vi.stubGlobal('fetch', mocks.fetch);
    const raw = '\n  학교에 갔어요!\r\n\n도와줘서 고마워요.  \n';
    const metadata = { language: 'Korean', explanationLocale: 'zh-CN', importAttempt: 'import-1',
      composer: { version: 1, role: 'study', parentId: 'source-1', sourceRevision: 'revision-1' } };
    const pending = { sequence: [], dictionary: {}, last_idx: -1, status: 'pending', metadata };
    const result = await analyzeText(raw, null, { metadata, existingJson: pending });
    expect(result.status).toBe('completed');
    expect(lineText(result)).toBe(raw);
    expect(result.metadata).toMatchObject({ ...metadata, analysisEngine: 'llm', analysisQuality: 'unreviewed',
      analysisVersion: KOREAN_ANALYSIS_VERSION });
    for (const t of Object.values(result.dictionary)) expect(raw.slice(t.sourceSpan.start, t.sourceSpan.end)).toBe(t.text);
  });

  it('refuses stale source reuse and rebases retained line spans after an earlier line changes length', async () => {
    mocks.fetch.mockImplementation(successfulFetch);
    vi.stubGlobal('fetch', mocks.fetch);
    const metadata = { language: 'Korean', explanationLocale: 'zh-TW' };
    const initial = await analyzeText('가요\n\n학교에 갔어요', null, { metadata });
    initial.failed_indices = [0];
    const changed = '도와줘서 고마워요\n\n학교에 갔어요';
    mocks.fetch.mockClear();
    const result = await analyzeText(changed, null, { metadata, existingJson: initial });
    expect(lineText(result)).toBe(changed);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    for (const t of Object.values(result.dictionary)) expect(changed.slice(t.sourceSpan.start, t.sourceSpan.end)).toBe(t.text);
    // A caller marks only line 0 failed, but line 2's source itself has changed too.
    mocks.fetch.mockClear();
    const changedAgain = '가요\n\n집에 갔어요';
    expect(lineText(await analyzeText(changedAgain, null, { metadata, existingJson: initial }))).toBe(changedAgain);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
});
