import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collectZhPosMarks,
  disambiguateZhPos,
  resolveZhTokenPos,
  zhPosMarkKey,
} from '../disambiguateZhPos.js';

// 계약: 중국어 겸류사(工作·计划·希望 등)는 jieba가 문맥 불문 한 태그만 달고 캐시 pos가 그걸
// 박제한다. 명/동/형 계열 한자어를 모아 flash-lite 1회로 "후보 전체 + 이 문장에서의 품사"를
// 받고, 실패하면 기존 pos로 그대로 동작해야 한다(그레이스풀 디그레이드).

const tok = (text, pos, extra = {}) => ({ text, base_form: text, furigana: '', pos, ...extra });

describe('collectZhPosMarks — 판별 대상 수집', () => {
  it('명사/동사/형용사 계열 한자어만 마크한다(대명사·기호·비한자 제외)', () => {
    const lines = [{
      tokens: [
        tok('我', '대명사'),
        tok('计划', '명사'),                      // jieba 단일 태그 — 명사라도 문맥 판별 대상
        tok('工作', '명사성 동사', { pos_all: '동사·명사' }), // 겸류 라벨
        tok('。', '기호'),
        tok('OK', null),                          // 한자 없음 — 제외
      ],
    }];
    const marks = collectZhPosMarks(lines, new Map());
    expect(marks.map((m) => m.word)).toEqual(['计划', '工作']);
    expect(marks[0]).toMatchObject({ lineIdx: 0, key: zhPosMarkKey(0, '计划') });
  });

  it('품사 미상(jieba 미지 태그 + 캐시 없음) 한자어도 마크한다', () => {
    const lines = [{ tokens: [tok('内卷', null)] }];
    expect(collectZhPosMarks(lines, new Map()).map((m) => m.word)).toEqual(['内卷']);
  });

  it('캐시 pos가 다중(·)이면 jieba 태그와 무관하게 마크한다', () => {
    const cache = new Map([['学习', { pos: '동사·명사' }]]);
    const lines = [{ tokens: [tok('学习', '지명')] }]; // 억지 케이스 — 캐시 후보가 우선 신호
    expect(collectZhPosMarks(lines, cache).map((m) => m.word)).toEqual(['学习']);
  });

  it('같은 줄의 중복 단어는 한 번만, 다른 줄이면 각각 마크한다', () => {
    const lines = [
      { tokens: [tok('工作', '명사'), tok('工作', '명사')] },
      { tokens: [tok('工作', '명사')] },
    ];
    const marks = collectZhPosMarks(lines, new Map());
    expect(marks.map((m) => m.key)).toEqual([zhPosMarkKey(0, '工作'), zhPosMarkKey(1, '工作')]);
  });

  it('상한(120)을 넘는 마크는 잘라낸다', () => {
    const lines = Array.from({ length: 130 }, (_, i) => ({ tokens: [tok(`词${String.fromCharCode(0x4e00 + i)}`, '명사')] }));
    expect(collectZhPosMarks(lines, new Map()).length).toBe(120);
  });
});

describe('disambiguateZhPos — Gemini 문맥 판별', () => {
  beforeEach(() => vi.stubEnv('GEMINI_API_KEY', 'test-key'));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const marks = [
    { lineIdx: 0, word: '计划', key: zhPosMarkKey(0, '计划') },
    { lineIdx: 1, word: '工作', key: zhPosMarkKey(1, '工作') },
  ];
  const lines = ['我计划去北京。', '我的工作很忙。'];

  const geminiText = (arr) => ({
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(arr) }] } }] }),
  });

  it('정상 응답을 mark key로 매핑한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => geminiText([
      { all: ['동사', '명사'], pos: '동사' },
      { all: ['동사', '명사'], pos: '명사' },
    ])));
    const picks = await disambiguateZhPos(lines, marks);
    expect(picks.get(zhPosMarkKey(0, '计划'))).toEqual({ pos: '동사', all: ['동사', '명사'] });
    expect(picks.get(zhPosMarkKey(1, '工作'))).toEqual({ pos: '명사', all: ['동사', '명사'] });
  });

  it('프롬프트에 문장과 단어 목록이 실린다', async () => {
    let sentPrompt = '';
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      sentPrompt = JSON.parse(opts.body).contents[0].parts[0].text;
      return geminiText([{ all: ['동사'], pos: '동사' }, { all: ['명사'], pos: '명사' }]);
    }));
    await disambiguateZhPos(lines, marks);
    expect(sentPrompt).toContain('我计划去北京。');
    expect(sentPrompt).toContain('"工作" (문장 2)');
  });

  it('pos가 all에 없는 항목은 버린다(모델 위반 — 해당 단어만 폴백)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => geminiText([
      { all: ['명사'], pos: '동사' },          // 위반 — 버림
      { all: ['동사', '명사'], pos: '동사' },   // 정상
    ])));
    const picks = await disambiguateZhPos(lines, marks);
    expect(picks.has(zhPosMarkKey(0, '计划'))).toBe(false);
    expect(picks.get(zhPosMarkKey(1, '工作'))?.pos).toBe('동사');
  });

  it('길이 불일치 응답은 전량 버린다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => geminiText([{ all: ['동사'], pos: '동사' }])));
    expect((await disambiguateZhPos(lines, marks)).size).toBe(0);
  });

  it('HTTP 실패·예외에도 빈 결과로 수렴한다(throw 금지)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    expect((await disambiguateZhPos(lines, marks)).size).toBe(0);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    expect((await disambiguateZhPos(lines, marks)).size).toBe(0);
  });

  it('API 키가 없으면 호출 없이 빈 결과', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect((await disambiguateZhPos(lines, marks)).size).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('deadline이 지났으면 호출 자체를 생략한다', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const picks = await disambiguateZhPos(lines, marks, { deadlineMs: Date.now() - 1 });
    expect(picks.size).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('마크가 없으면 호출 없이 빈 결과', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect((await disambiguateZhPos(lines, [])).size).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('resolveZhTokenPos — 최종 pos/pos_all 병합', () => {
  it('문맥 pick이 있으면 pick.pos + 후보 전체', () => {
    expect(resolveZhTokenPos({
      pick: { pos: '동사', all: ['동사', '명사'] },
      cachedPos: '명사', tokenPos: '명사', tokenPosAll: undefined,
    })).toEqual({ pos: '동사', posAll: '동사·명사' });
  });

  it('pick 없음 + 캐시 다중 pos → 첫 후보 + pos_all(판별 실패 디그레이드)', () => {
    expect(resolveZhTokenPos({
      pick: undefined, cachedPos: '동사·명사', tokenPos: '명사성 동사', tokenPosAll: undefined,
    })).toEqual({ pos: '동사', posAll: '동사·명사' });
  });

  it('pick 없음 + jieba 겸류 확장 → 첫 후보 + pos_all', () => {
    expect(resolveZhTokenPos({
      pick: undefined, cachedPos: undefined, tokenPos: '명사성 동사', tokenPosAll: '동사·명사',
    })).toEqual({ pos: '동사', posAll: '동사·명사' });
  });

  it('후보가 전혀 없으면 기존 동작(캐시 pos > jieba pos, pos_all 없음)', () => {
    expect(resolveZhTokenPos({
      pick: undefined, cachedPos: '대명사', tokenPos: '대명사', tokenPosAll: undefined,
    })).toEqual({ pos: '대명사', posAll: null });
    expect(resolveZhTokenPos({
      pick: undefined, cachedPos: undefined, tokenPos: '기호', tokenPosAll: undefined,
    })).toEqual({ pos: '기호', posAll: null });
  });

  it('pick 후보가 1개면 pos만 쓰고 pos_all은 달지 않는다', () => {
    expect(resolveZhTokenPos({
      pick: { pos: '명사', all: ['명사'] },
      cachedPos: '명사', tokenPos: '명사', tokenPosAll: undefined,
    })).toEqual({ pos: '명사', posAll: null });
  });
});
