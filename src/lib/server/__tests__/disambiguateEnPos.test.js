import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  collectEnLemmaLookupForms,
  collectEnPosMarks,
  disambiguateEnPos,
  enPosMarkKey,
  hasEnPosMarker,
  needsEnPosBackfill,
  resolveEnTokenContext,
} from '../disambiguateEnPos.js';
import { tokenizeEnLine } from '../tokenizeEn.js';

const row = (pos, meanings, source = 'gemini') => ({ pos, meanings, source, reading: null });

describe('영어 marker·mark 수집', () => {
  it('en_pos_v는 meanings 위치와 무관하게 판정한다', () => {
    const meanings = [
      { meaning: '교정 뜻', pos: '명사' },
      { meaning: '기존 뜻', pos: '동사', en_pos_v: 1 },
    ];
    expect(hasEnPosMarker(meanings)).toBe(true);
    expect(needsEnPosBackfill(row('동사·명사', meanings))).toBe(false);
  });

  it('marker 없는 gemini 행만 백필하고 user_verified는 보호한다', () => {
    const legacy = row('명사', [{ meaning: '기록', pos: '명사' }]);
    expect(needsEnPosBackfill(legacy)).toBe(true);
    expect(needsEnPosBackfill({ ...legacy, source: 'user_verified' })).toBe(false);
    expect(needsEnPosBackfill(row('명사', []))).toBe(false);
  });

  it('같은 줄의 같은 표기도 occurrence key로 각각 수집한다', () => {
    const tokenized = [{ tokens: tokenizeEnLine('I record a record') }];
    const cache = new Map([
      ['i', row('대명사', [{ meaning: '나', pos: '대명사', en_pos_v: 1 }])],
      ['a', row('관사', [{ meaning: '하나의', pos: '관사', en_pos_v: 1 }])],
      ['record', row('동사·명사', [
        { meaning: '기록하다', pos: '동사', en_pos_v: 1 },
        { meaning: '기록', pos: '명사' },
      ])],
    ]);
    const marks = collectEnPosMarks(tokenized, cache);
    expect(marks.filter((mark) => mark.word === 'record').map((mark) => mark.key)).toEqual(['0:1', '0:3']);
  });

  it('lemma 후보 사전 키를 중복 제거하고 cap 안에서 수집한다', () => {
    const tokenized = [{ tokens: tokenizeEnLine('saw leaves ran') }];
    expect(collectEnLemmaLookupForms(tokenized, 2)).toEqual(['saw', 'leave']);
  });
});

describe('disambiguateEnPos — 검증·fallback', () => {
  beforeEach(() => vi.stubEnv('GEMINI_API_KEY', 'test-key'));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const token = tokenizeEnLine('saw')[0];
  const mark = collectEnPosMarks([{ tokens: [token] }], new Map())[0];

  it('유효한 occurrence 판정만 Map에 넣고 HTTP 횟수를 분리한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify([
        { all: ['동사', '명사'], pos: '명사', base_form: 'saw' },
      ]) }] } }] }),
    })));
    const { picks, httpCalls } = await disambiguateEnPos(['I used a saw.'], [mark]);
    expect(httpCalls).toBe(1);
    expect(picks.get(mark.key)).toEqual({ all: ['동사', '명사'], pos: '명사', base_form: 'saw' });
  });

  it('같은 표기 반복도 occurrence별 서로 다른 품사를 보존한다', async () => {
    const tokens = tokenizeEnLine('I record a record');
    const cache = new Map([
      ['i', row('대명사', [{ meaning: '나', pos: '대명사', en_pos_v: 1 }])],
      ['a', row('관사', [{ meaning: '하나의', pos: '관사', en_pos_v: 1 }])],
      ['record', row('동사·명사', [
        { meaning: '기록하다', pos: '동사', en_pos_v: 1 },
        { meaning: '기록', pos: '명사' },
      ])],
    ]);
    const marks = collectEnPosMarks([{ tokens }], cache);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify([
        { all: ['동사', '명사'], pos: '동사', base_form: 'record' },
        { all: ['동사', '명사'], pos: '명사', base_form: 'record' },
      ]) }] } }] }),
    })));
    const { picks, httpCalls } = await disambiguateEnPos(['I record a record'], marks);
    expect({ marks: marks.length, httpCalls }).toEqual({ marks: 2, httpCalls: 1 });
    expect(picks.get('0:1').pos).toBe('동사');
    expect(picks.get('0:3').pos).toBe('명사');
  });

  it('pos 후보와 맞지 않는 lemma는 모델 위반으로 폐기한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify([
        { all: ['명사'], pos: '명사', base_form: 'see' },
      ]) }] } }] }),
    })));
    const { picks } = await disambiguateEnPos(['I used a saw.'], [mark]);
    expect(picks.size).toBe(0);
  });

  it('허용 목록 밖 품사가 all에 섞여도 행 전체를 폐기한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify([
        { all: ['명사', '엉뚱품사'], pos: '명사', base_form: 'saw' },
      ]) }] } }] }),
    })));
    const { picks } = await disambiguateEnPos(['I used a saw.'], [mark]);
    expect(picks.size).toBe(0);
  });

  it('키 없음·판별 실패는 호출 없이 빈 결과로 수렴한다', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const { picks, httpCalls } = await disambiguateEnPos(['I used a saw.'], [mark]);
    expect(picks.size).toBe(0);
    expect(httpCalls).toBe(0);
  });
});

describe('resolveEnTokenContext — lemma 행·뜻 선택', () => {
  const token = tokenizeEnLine('saw')[0];
  const pick = { all: ['동사', '명사'], pos: '명사', base_form: 'saw' };
  const see = row('동사', [{ meaning: '보다', pos: '동사', en_pos_v: 1 }]);
  const saw = row('명사', [{ meaning: '톱', pos: '명사', en_pos_v: 1 }]);

  it('선택 lemma 행이 조회됐으면 그 행의 품사·뜻·base_form을 쓴다', () => {
    expect(resolveEnTokenContext({ token, pick, cache: new Map([['see', see], ['saw', saw]]) })).toEqual({
      baseForm: 'saw',
      entry: saw,
      pos: '명사',
      posAll: '동사·명사',
      meaning: '톱',
      fallback: false,
    });
  });

  it('선택 lemma 행이 미조회면 현행 기본 행·첫 뜻 표시를 그대로 유지한다', () => {
    expect(resolveEnTokenContext({ token, pick, cache: new Map([['see', see]]) })).toEqual({
      baseForm: 'see',
      entry: see,
      pos: '동사',
      posAll: null,
      meaning: '보다',
      fallback: true,
    });
  });

  it('판별 결과가 없어도 현행 표시를 그대로 유지한다', () => {
    expect(resolveEnTokenContext({ token, pick: undefined, cache: new Map([['see', see]]) }).meaning).toBe('보다');
  });
});

describe('영어 라우트 배선 계약', () => {
  it('occurrence 판별·stats.enPos·graceful resolver가 실제 라우트에 연결된다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/app/api/analyze/route.js'), 'utf8');
    expect(src).toContain('collectEnPosMarks(tokenizedLines, cache)');
    expect(src).toContain('resolveEnTokenContext({ token: t');
    expect(src).toContain('enPos: {');
    expect(src).toContain('backfillRows: enBackfillRows');
    expect(src).toContain('fallbacks: enFallbacks');
    expect(enPosMarkKey(2, 4)).toBe('2:4');
  });
});
