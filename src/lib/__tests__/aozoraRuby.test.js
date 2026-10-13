import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } } }));

import {
  applyAozoraRubyLocks,
  applyMaterialRubyLocks,
  clearRubyLockOnCorrection,
  countAppliedRubyLocks,
  indexAozoraTokenSpans,
} from '../aozoraRuby.js';
import { analyzeText } from '../analyzeText';
import { preserveReanalysisTokens, runPreservedReanalysis } from '../reanalysisPreservation';
import { applyTokenCorrections } from '../tokenEditOptions';
import { createAozoraMaterialDraft } from '../aozoraMaterial.js';
import { parseAozoraText } from '../aozoraParser.js';
import { aozoraFixture, sampleEntry } from './helpers/aozoraFixtures.js';

const analysis = () => ({
  rawText: '私は先生です。\n明日も読む。',
  sequence: ['t0', 't1', 't2', 't3', 'nl', 't4', 't5', 't6', 't7'],
  dictionary: {
    t0: { text: '私', furigana: 'わたし' },
    t1: { text: 'は' },
    t2: { text: '先生', furigana: 'せんせい' },
    t3: { text: 'です。' },
    nl: { text: '\n', pos: '개행' },
    t4: { text: '明日', furigana: 'あす' },
    t5: { text: 'も' },
    t6: { text: '読む' },
    t7: { text: '。' },
  },
});

describe('indexAozoraTokenSpans', () => {
  it('반복·개행 토큰을 원문 순서대로 문자 범위에 잇는다', () => {
    const input = analysis();
    expect(indexAozoraTokenSpans(input.rawText, input.sequence, input.dictionary).map(({ tokenId, start, end }) => [tokenId, start, end]))
      .toEqual([['t0', 0, 1], ['t1', 1, 2], ['t2', 2, 4], ['t3', 4, 7], ['nl', 7, 8], ['t4', 8, 10], ['t5', 10, 11], ['t6', 11, 13], ['t7', 13, 14]]);
  });

  it('원문에 잇지 못하면 fail-closed', () => {
    const input = analysis();
    expect(() => indexAozoraTokenSpans(input.rawText, ['missing'], input.dictionary)).toThrow('Missing token');
    expect(() => indexAozoraTokenSpans(input.rawText, ['t0'], { t0: { text: '僕' } })).toThrow('cannot be mapped');
    expect(() => indexAozoraTokenSpans(input.rawText, ['t0', 't0'], input.dictionary)).toThrow('must be unique');
  });
});

describe('applyAozoraRubyLocks — 정확 일치만 적용, 나머지는 진단', () => {
  it('정확한 원문 범위의 토큰만 저자 독음으로 덮는다', () => {
    const input = analysis();
    const result = applyAozoraRubyLocks({ ...input, rubyLocks: [{ start: 8, end: 10, base: '明日', reading: 'あした' }] });
    expect(result.dictionary.t4).toMatchObject({ text: '明日', furigana: 'あした', reading_source: 'aozora', reading_locked: true });
    expect(result.dictionary.t2).toEqual(input.dictionary.t2);
    expect(result.diagnostics).toEqual({ lockCount: 1, appliedCount: 1, unmatchedLocks: [] });
  });

  it('루비 하나가 토큰 여럿에 걸치면 독음을 쪼개 추정하지 않는다', () => {
    const input = analysis();
    const result = applyAozoraRubyLocks({
      ...input,
      rubyLocks: [{ start: 11, end: 13, base: '読む', reading: 'よむ' }],
      dictionary: { ...input.dictionary, t6: { text: '読' }, t7: { text: 'む。' } },
    });
    expect(result.diagnostics.appliedCount).toBe(0);
    expect(result.diagnostics.unmatchedLocks).toEqual([{ start: 11, end: 13, base: '読む', reading: 'よむ' }]);
    expect(result.dictionary.t6.reading_locked).toBeUndefined();
  });

  it('실패 토큰(줄 통째) 위의 루비는 적용하지 않는다', () => {
    const result = applyAozoraRubyLocks({
      rawText: '明日', sequence: ['f'], dictionary: { f: { text: '明日', failed: true, pos: '미분석' } },
      rubyLocks: [{ start: 0, end: 2, base: '明日', reading: 'あした' }],
    });
    expect(result.diagnostics.appliedCount).toBe(0);
    expect(result.dictionary.f.furigana).toBeUndefined();
  });

  it('결정적·불변이고 분석 입력을 바꾸지 않는다', () => {
    const input = analysis();
    const args = { ...input, rubyLocks: [{ start: 2, end: 4, base: '先生', reading: 'せんせい' }] };
    const first = applyAozoraRubyLocks(args);
    expect(JSON.stringify(first)).toBe(JSON.stringify(applyAozoraRubyLocks(args)));
    expect(input.dictionary.t2.reading_source).toBeUndefined();
    expect(Object.isFrozen(first.dictionary.t2)).toBe(true);
  });

  it.each([
    [[{ start: 8, end: 10, base: '今日', reading: 'きょう' }], 'does not match'],
    [[{ start: 8, end: 99, base: '明日', reading: 'あした' }], 'exceeds'],
    [[{ start: 8, end: 10, base: '明日', reading: '' }], 'reading'],
    [[{ start: 8, end: 10, base: '明日', reading: 'あした' }, { start: 9, end: 10, base: '日', reading: 'ひ' }], 'overlap'],
  ])('잘못된 잠금은 fail-closed (%#)', (rubyLocks, message) => {
    expect(() => applyAozoraRubyLocks({ ...analysis(), rubyLocks })).toThrow(message);
  });
});

describe('applyMaterialRubyLocks — analyzeText 말미 훅의 판정', () => {
  const json = (rubyLocks) => {
    const input = analysis();
    return { sequence: input.sequence, dictionary: input.dictionary, metadata: { language: 'Japanese', literature: { provider: 'aozora', rubyLocks } } };
  };

  it('잠금이 없으면 입력 그대로(일반 자료 무변경)', () => {
    const plain = { sequence: [], dictionary: {}, metadata: { language: 'Japanese' } };
    expect(applyMaterialRubyLocks('x', plain)).toEqual({ json: plain, diagnostics: null });
    expect(applyMaterialRubyLocks('x', { ...plain, metadata: { literature: { rubyLocks: [] } } }).diagnostics).toBe(null);
  });

  it('적용 결과는 평범한(동결 안 된) 객체 — 뒤 단계(교정 보존·저장)가 고칠 수 있다', () => {
    const { json: out, diagnostics } = applyMaterialRubyLocks(analysis().rawText, json([{ start: 8, end: 10, base: '明日', reading: 'あした' }]));
    expect(diagnostics).toEqual({ lockCount: 1, appliedCount: 1, unmatchedCount: 0 });
    expect(Object.isFrozen(out.dictionary.t4)).toBe(false);
    expect(countAppliedRubyLocks(out)).toBe(1);
  });

  it('원문이 바뀌어 잠금 하나라도 어긋나면 하나도 적용하지 않는다(낡은 오프셋 fail-closed)', () => {
    const stale = json([
      { start: 2, end: 4, base: '先生', reading: 'せんせい' },
      { start: 9, end: 11, base: '明日', reading: 'あした' },
    ]);
    const { json: out, diagnostics } = applyMaterialRubyLocks(analysis().rawText, stale);
    expect(out).toBe(stale);
    expect(diagnostics).toMatchObject({ lockCount: 2, appliedCount: 0, skipped: 'ruby lock base does not match raw text' });
  });
});

describe('우선순위 — 사용자 교정 > 저자 루비 > 분석기', () => {
  const locked = { text: '明日', furigana: 'あした', meaning: '내일', reading_source: 'aozora', reading_locked: true };

  it('독음 교정은 잠금 표식을 지우고, 뜻만 고치면 잠금이 남는다', () => {
    expect(applyTokenCorrections(locked, { furigana: 'みょうにち' })).toEqual({ text: '明日', furigana: 'みょうにち', meaning: '내일' });
    expect(applyTokenCorrections(locked, { meaning: '다음 날' })).toMatchObject({ furigana: 'あした', reading_source: 'aozora', reading_locked: true });
    expect(clearRubyLockOnCorrection({ text: '先生', furigana: 'せんせい' }, { furigana: 'x' })).toEqual({ text: '先生', furigana: 'せんせい' });
  });

  it('재분석 보존: 새 분석이 잠금을 다시 얹어도 같은 자리의 독음 교정이 이긴다', () => {
    const material = {
      raw_text: '明日も。',
      processed_json: {
        status: 'completed', metadata: { language: 'Japanese' }, sequence: ['id_0_0_old', 'id_0_1_old'],
        dictionary: { id_0_0_old: { text: '明日', furigana: 'みょうにち' }, id_0_1_old: { text: 'も。' } },
      },
    };
    const reanalyzed = {
      status: 'completed', failed_indices: [], metadata: { language: 'Japanese' }, sequence: ['id_0_0_new', 'id_0_1_new'],
      dictionary: { id_0_0_new: { ...locked }, id_0_1_new: { text: 'も。' } },
    };
    const out = preserveReanalysisTokens(material, material.raw_text, reanalyzed,
      [{ token_id: 'id_0_0_old', after_value: { furigana: 'みょうにち' } }]);
    expect(out.dictionary.id_0_0_old).toEqual({ text: '明日', furigana: 'みょうにち', meaning: '내일' });
    expect(out.metadata.viewerCorrections).toEqual({ id_0_0_old: ['furigana'] });
  });
});

/* ── analyzeText 말미 훅 — 실제 analyzeHybrid 경로(가짜 /api/analyze) ── */

const T0 = Date.UTC(2026, 9, 12, 5, 0, 0);
/** 문자종 연속 단위로 자르는 결정적 가짜 서버. 한자 토큰에는 분석기 독음(틀린 값 포함)을 준다. */
const ANALYZER_READING = { 今日: 'こんにち', 船頭: 'せんどう', 川面: 'かわづら', 欄干: 'らんかん', 舟着場: 'ふなつきじょう', 明日: 'あす' };
function fakeAnalyzeServer(calls) {
  return vi.fn(async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    return {
      ok: true, status: 200,
      json: async () => ({ results: body.lines.map((line) => {
        const words = line.match(/[\p{Script=Han}々]+|\p{Script=Hiragana}+|[\p{Script=Katakana}ー]+|\S/gu) || [];
        return {
          sequence: words.map((_, k) => `s${k}`),
          dictionary: Object.fromEntries(words.map((text, k) => [`s${k}`, { text, meaning: `뜻:${text}`,
            ...(/\p{Script=Han}/u.test(text) ? { furigana: ANALYZER_READING[text] ?? 'よみ' } : {}) }])),
        };
      }) }),
    };
  });
}

describe('analyzeText 말미 훅 — 정본 책 장을 분석하면 저자 루비가 사전 독음을 덮는다', () => {
  let calls;
  beforeEach(() => {
    vi.useFakeTimers({ now: T0, toFake: ['Date'] });
    calls = [];
    vi.stubGlobal('fetch', fakeAnalyzeServer(calls));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const chapter = () => createAozoraMaterialDraft(sampleEntry(), parseAozoraText(aozoraFixture('format-sample-headings.txt'))).chapters[0];
  const readingOf = (json, text) => json.sequence.map((id) => json.dictionary[id]).find((token) => token.text === text);

  it('첫 분석: 정확히 맞는 토큰 5개가 저자 독음, 잠금 없는 한자는 분석기 독음 그대로', async () => {
    const { rawText, metadata } = chapter();
    const json = await analyzeText(rawText, new AbortController().signal, { metadata: structuredClone(metadata) });
    expect(json.status).toBe('completed');
    expect(countAppliedRubyLocks(json)).toBe(5);
    expect(readingOf(json, '今日')).toMatchObject({ furigana: 'きょう', reading_source: 'aozora', reading_locked: true });
    expect(readingOf(json, '川面')).toMatchObject({ furigana: 'かわも', reading_source: 'aozora' });
    expect(readingOf(json, '舟着場')).toMatchObject({ furigana: 'ふなつきば' });
    expect(readingOf(json, '朝')).toMatchObject({ furigana: 'よみ' });
    expect(readingOf(json, '朝').reading_source).toBeUndefined();
    // 분석 요청에는 원문 평문만 간다 — 루비 기호·독음이 요청에 실리지 않는다.
    expect(calls.flatMap((body) => body.lines).join('')).not.toMatch(/[《》｜]|かわも/u);
  });

  it('일반 자료(잠금 없음)는 훅이 아무것도 바꾸지 않는다', async () => {
    const json = await analyzeText('明日も。', new AbortController().signal, { metadata: { language: 'Japanese' } });
    expect(readingOf(json, '明日')).toEqual({ text: '明日', meaning: '뜻:明日', furigana: 'あす' });
  });

  it('재분석(runPreservedReanalysis): 잠금이 다시 적용되고, 사용자가 고친 독음은 그대로 이긴다', async () => {
    const { rawText, metadata } = chapter();
    const first = await analyzeText(rawText, new AbortController().signal, { metadata: structuredClone(metadata) });
    const kyouId = first.sequence.find((id) => first.dictionary[id].text === '今日');
    // 사용자가 뷰어에서 今日의 독음을 고쳤다(correctTokenMutation과 같은 적용 함수 + 교정 이력 1행).
    const corrected = { ...first, dictionary: { ...first.dictionary, [kyouId]: applyTokenCorrections(first.dictionary[kyouId], { furigana: 'こんにち' }) } };
    const material = { id: 7, owner_id: 'admin', raw_text: rawText, processed_json: corrected };
    const rows = [{ token_id: kyouId, after_value: { furigana: 'こんにち' } }];
    const chain = { select: () => chain, eq: () => chain, order: () => chain, range: async () => ({ data: rows, error: null }) };
    const client = {
      from: () => chain,
      rpc: vi.fn(async (name, args) => ({ data: { material: { ...material, processed_json: args.p_json } }, error: null })),
    };
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');

    const saved = await runPreservedReanalysis(client, material, new AbortController().signal, analyzeText, { fullReset: true });
    const json = saved.processed_json;
    expect(client.rpc).toHaveBeenCalledOnce();
    expect(json.dictionary[kyouId]).toMatchObject({ text: '今日', furigana: 'こんにち' });
    expect(json.dictionary[kyouId].reading_source).toBeUndefined();
    expect(readingOf(json, '船頭')).toMatchObject({ furigana: 'せんどう', reading_source: 'aozora' });
    expect(readingOf(json, '川面')).toMatchObject({ furigana: 'かわも', reading_source: 'aozora' });
    expect(countAppliedRubyLocks(json)).toBe(4);
    expect(json.metadata.literature.rubyLocks).toEqual(metadata.literature.rubyLocks);
  });
});
