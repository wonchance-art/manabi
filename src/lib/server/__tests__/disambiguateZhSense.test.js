import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ZH_SENSE_REVIEW, buildZhPosWriteback, disambiguateZhPos, pickZhMeaning, resolveZhTokenPos, zhPosMarkKey,
} from '../disambiguateZhPos.js';
import {
  attachZhSenseCandidates, buildZhPosPrompt, createZhSenseStats, matchZhSenseCandidate,
  resolveZhTokenSense, validateZhSensePick, zhSenseFragments,
} from '../zhSenseReview.js';
import { isCanonPos } from '../posCanon.js';

// AD-R4 PR② — 중국어 「이 문장 뜻」 검수의 서버 계약(설계서 docs/manabi-viewer-v2-ad-r4.md §4·§7·§9.1).
// 출시 상태는 꺼짐(ZH_SENSE_REVIEW = false)이다. 켜짐 경로는 함수 단위로 여기서, 라우트 단위로
// zhSenseReviewRouteOn.test.js에서 고정한다. 기존 disambiguateZhPos.test.js는 무수정으로 통과해야 한다.

const isCanon = (p) => isCanonPos('Chinese', p);
const DA = [
  { meaning: '때리다, 치다', pos: '동사' },
  { meaning: '(전화를) 걸다', pos: '동사' },
  { meaning: '(운동을) 하다', pos: '동사' },
];
const daMark = { lineIdx: 0, word: '打', key: zhPosMarkKey(0, '打'), candidates: DA };

const geminiText = (arr) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: typeof arr === 'string' ? arr : JSON.stringify(arr) }] } }] }),
});

describe('상수', () => {
  it('ZH_SENSE_REVIEW는 꺼진 채 출시된다(켜기는 측정 결과를 붙인 별도 PR — 설계서 §10 ②′)', () => {
    expect(ZH_SENSE_REVIEW).toBe(false);
  });
});

describe('뜻 정규화 — 괄호 보충 제거 + 조각 비교', () => {
  it('조각으로 나누고, ctx가 후보의 조각이면 그 후보 번호', () => {
    expect(zhSenseFragments('(전화를) 걸다')).toEqual(['걸다']);
    expect(zhSenseFragments('때리다, 치다')).toEqual(['때리다', '치다']);
    expect(matchZhSenseCandidate(DA, '걸다')).toBe(2);
    expect(matchZhSenseCandidate(DA, '치다')).toBe(1);
    expect(matchZhSenseCandidate(DA, '전화하다')).toBe(0);
  });
});

describe('응답 검증 validateZhSensePick — 설계서 §4.3 표', () => {
  it('pos ∉ all이면 그 단어를 통째로 버린다(뜻도)', () => {
    expect(validateZhSensePick({ all: ['동사'], pos: '명사', sense: 2 }, daMark, isCanon)).toEqual({ discarded: 'pos' });
  });
  it('정수 sense 1..n은 후보 문구를 문자열 그대로 쓴다. 후보 품사 ≠ 판정 품사면 doubt', () => {
    expect(validateZhSensePick({ all: ['동사'], pos: '동사', sense: 2 }, daMark, isCanon).sense)
      .toEqual({ meaning: '(전화를) 걸다', via: 'sense' });
    const zai = [{ meaning: '~에서', pos: '전치사' }, { meaning: '있다', pos: '동사' }];
    expect(validateZhSensePick({ all: ['동사', '전치사'], pos: '동사', sense: 1 }, { word: '在', candidates: zai }, isCanon).sense)
      .toEqual({ meaning: '~에서', via: 'sense', meaningCheck: 'doubt' });
  });
  it('범위 밖·비정수·문자열(후보 문구를 다시 쓴 답) sense는 버린다', () => {
    for (const sense of [4, -1, 1.5, '2', '(전화를) 걸다', null, true]) {
      const v = validateZhSensePick({ all: ['동사'], pos: '동사', sense }, daMark, isCanon);
      expect(v.sense, JSON.stringify(sense)).toBeUndefined();
      expect(v.senseDiscarded, JSON.stringify(sense)).toBeTruthy();
      expect(v.pos).toBe('동사');
    }
  });
  it('sense 0 + 한글 ctx 1~10자는 문맥 뜻(ctx 표식), 후보와 정규화가 같으면 그 후보', () => {
    expect(validateZhSensePick({ all: ['동사'], pos: '동사', sense: 0, ctx: '질투하다' }, daMark, isCanon).sense)
      .toEqual({ meaning: '질투하다', via: 'ctx', meaningCheck: 'ctx' });
    expect(validateZhSensePick({ all: ['동사'], pos: '동사', sense: 0, ctx: '걸다' }, daMark, isCanon).sense)
      .toEqual({ meaning: '(전화를) 걸다', via: 'sense' });
    expect(validateZhSensePick({ all: ['동사'], pos: '동사', sense: 0, ctx: '열글자정확히맞음요' }, daMark, isCanon).sense?.via).toBe('ctx');
  });
  it('sense 0인데 ctx가 없거나 10자 초과·한글 없음·한자 섞임이면 버리고 doubt', () => {
    for (const ctx of [undefined, '', '아주아주아주아주긴뜻이다', 'hack', '해킹黑', 7]) {
      const v = validateZhSensePick({ all: ['동사'], pos: '동사', sense: 0, ctx }, daMark, isCanon);
      expect(v.sense, String(ctx)).toBeUndefined();
      expect(v.meaningCheck, String(ctx)).toBe('doubt');
    }
  });
  it('후보 없는 단어의 sense는 무시하고, join은 묶음 판정 마크의 불리언만 받는다', () => {
    expect(validateZhSensePick({ all: ['명사'], pos: '명사', sense: 1, join: true }, { word: '电话' }, isCanon)).toEqual({ pos: '명사', all: ['명사'] });
    expect(validateZhSensePick({ all: ['양사'], pos: '양사', join: false }, { word: '个', pair: ['个', '人'] }, isCanon)).toMatchObject({ join: false });
    expect(validateZhSensePick({ all: ['양사'], pos: '양사', join: 'yes' }, { word: '个', pair: ['个', '人'] }, isCanon).join).toBeUndefined();
  });
  it('all은 품사 정본으로 거른다(현행과 같은 X 게이트)', () => {
    expect(validateZhSensePick({ all: ['동사·喝咖啡'], pos: '동사·喝咖啡' }, { word: '喝' }, isCanon)).toEqual({ discarded: 'pos' });
  });
});

describe('후보 붙이기 attachZhSenseCandidates — 설계서 §4.1', () => {
  const tok = (text, extra = {}) => ({ text, base_form: text, ...extra });
  const two = [{ meaning: '가', pos: '동사' }, { meaning: '나', pos: '명사' }];
  const lines = [{ tokens: [tok('打'), tok('计划'), tok('篮球'), tok('电话'), tok('妈妈'), tok('歉', { sep_link: '道歉' }), tok('个人', { boundary: 'user' }), tok('工作')] }];
  const cache = new Map([
    ['打', { meanings: [...DA, { meaning: '넷째', pos: '동사' }], source: 'gemini' }],
    ['计划', { meanings: two, source: 'user_verified' }],
    ['篮球', { meanings: two, source: 'gemini' }],
    ['电话', { meanings: [two[0]], source: 'gemini' }],
    ['歉', { meanings: two, source: 'gemini' }],
    ['个人', { meanings: two, source: 'gemini' }],
    ['工作', { meanings: [{ meaning: '일하다', pos: '동사', ja: null, priority: 1 }, { meaning: '일', priority: 2 }], source: 'jmdict' }],
  ]);
  const marks = ['打', '计划', '篮球', '电话', '妈妈', '歉', '个人', '工作'].map((word) => ({ lineIdx: 0, word, key: zhPosMarkKey(0, word) }));

  it('뜻 2개 이상 · user_verified 아님 · 미싱/재조회 아님 · 이합사 조각/경계 표식 아님일 때만, 최대 3개', () => {
    const out = attachZhSenseCandidates(marks, { tokenizedLines: lines, cache, refreshForms: new Set(['篮球', '妈妈']) });
    const offered = Object.fromEntries(out.filter((m) => m.candidates).map((m) => [m.word, m.candidates]));
    expect(Object.keys(offered)).toEqual(['打', '工作']);
    expect(offered['打']).toEqual(DA);                 // 넷째 뜻은 잘린다
    expect(offered['工作']).toEqual([{ meaning: '일하다', pos: '동사' }, { meaning: '일' }]); // 프롬프트에 필요한 필드만
  });

  it('입력 마크는 바꾸지 않고, 키·순서·길이를 그대로 둔다(판별 응답 길이 계약)', () => {
    const before = JSON.stringify(marks);
    const out = attachZhSenseCandidates(marks, { tokenizedLines: lines, cache });
    expect(JSON.stringify(marks)).toBe(before);
    expect(out.map((m) => m.key)).toEqual(marks.map((m) => m.key));
  });

  it('minMeanings 1이면 뜻 1개 행에도 붙인다(측정 Q3 전용 옵션)', () => {
    const out = attachZhSenseCandidates(marks, { tokenizedLines: lines, cache, minMeanings: 1 });
    expect(out.find((m) => m.word === '电话').candidates).toEqual([two[0]]);
  });

  it('마크가 없으면 빈 배열(호출이 새로 생기지 않는다)', () => {
    expect(attachZhSenseCandidates([], { tokenizedLines: lines, cache })).toEqual([]);
  });
});

describe('프롬프트 — 후보 있는 단어만 「뜻 후보」 줄', () => {
  const lines = ['我给妈妈打了一个电话。', '他吃醋了。'];
  const marks = [daMark, { lineIdx: 0, word: '电话', key: zhPosMarkKey(0, '电话') }, { lineIdx: 1, word: '吃醋', key: zhPosMarkKey(1, '吃醋') }];

  it('후보 있는 단어에만 붙고 규칙·예시가 더해진다. 후보가 없으면 sense 문구가 하나도 없다', () => {
    const prompt = buildZhPosPrompt(lines, marks);
    expect(prompt).toContain('1. "打" (문장 1) 뜻 후보: ①때리다, 치다(동사) ②(전화를) 걸다(동사) ③(운동을) 하다(동사)\n');
    expect(prompt).toContain('2. "电话" (문장 1)\n');
    expect(prompt).toContain('3. "吃醋" (문장 2)\n');
    expect(prompt).toContain('- ctx: sense가 0일 때만. 이 문장에서의 한국어 뜻, 10자 이내');
    expect(prompt).toContain('- 후보 문구를 고쳐 쓰지 말고 번호로만 답할 것');
    const plain = buildZhPosPrompt(lines, marks.map(({ candidates, ...m }) => m));
    expect(plain).not.toMatch(/sense|ctx|뜻 후보|join/);
  });

  it('후보 뜻에 품사 태그가 없으면 괄호 없이 싣는다(레거시 행)', () => {
    const prompt = buildZhPosPrompt(lines, [{ ...daMark, candidates: [{ meaning: '때리다' }, { meaning: '걸다', pos: '동사' }] }]);
    expect(prompt).toContain('"打" (문장 1) 뜻 후보: ①때리다 ②걸다(동사)\n');
  });
});

describe('disambiguateZhPos — 켜짐 마크의 응답 처리·호출 수·실패', () => {
  beforeEach(() => vi.stubEnv('GEMINI_API_KEY', 'test-key'));
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const lines = ['我给妈妈打了一个电话。', '他吃醋了。'];
  const cu = [{ meaning: '식초를 먹다', pos: '동사' }, { meaning: '시샘하다', pos: '동사' }];
  const marks = [
    daMark,
    { lineIdx: 0, word: '电话', key: zhPosMarkKey(0, '电话') },
    { lineIdx: 1, word: '吃醋', key: zhPosMarkKey(1, '吃醋'), candidates: cu },
  ];

  it('검증된 뜻을 pick에 싣고, 후보 없는 마크의 pick은 현행 모양 그대로다. 호출은 1회', async () => {
    const fetchMock = vi.fn(async () => geminiText([
      { all: ['동사'], pos: '동사', sense: 2 },
      { all: ['명사'], pos: '명사', sense: 1 },
      { all: ['동사'], pos: '동사', sense: 0, ctx: '질투하다' },
    ]));
    vi.stubGlobal('fetch', fetchMock);
    const stats = createZhSenseStats(marks);
    const picks = await disambiguateZhPos(lines, marks, { senseStats: stats });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(picks.get(zhPosMarkKey(0, '打'))).toEqual({ pos: '동사', all: ['동사'], sense: { meaning: '(전화를) 걸다', via: 'sense' } });
    expect(picks.get(zhPosMarkKey(0, '电话'))).toEqual({ pos: '명사', all: ['명사'] });
    expect(picks.get(zhPosMarkKey(1, '吃醋'))).toEqual({ pos: '동사', all: ['동사'], sense: { meaning: '질투하다', via: 'ctx', meaningCheck: 'ctx' } });
    expect(stats).toEqual({ offered: 2, picked: 1, ctx: 1, doubt: 0, discarded: 0, joinAsked: 0, joinApplied: 0, joinSuggested: 0 });
  });

  it('pos 위반·sense 위반은 그 단어만 버리고 discarded로 센다. sense 0 + 나쁜 ctx는 doubt 표식만 남긴다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => geminiText([
      { all: ['동사'], pos: '명사', sense: 2 },
      { all: ['명사'], pos: '명사' },
      { all: ['동사'], pos: '동사', sense: 0, ctx: '아주아주아주아주긴뜻이다' },
    ])));
    const stats = createZhSenseStats(marks);
    const picks = await disambiguateZhPos(lines, marks, { senseStats: stats });
    expect(picks.has(zhPosMarkKey(0, '打'))).toBe(false);
    expect(picks.get(zhPosMarkKey(1, '吃醋'))).toEqual({ pos: '동사', all: ['동사'], meaningCheck: 'doubt' });
    expect(stats).toMatchObject({ offered: 2, picked: 0, ctx: 0, doubt: 1, discarded: 2 });
  });

  it('묶음 판정만을 위해 더한 마크(pairOnly)는 join만 남기고 품사 결과는 pick이 없는 것과 같게 처리된다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => geminiText([
      { all: ['동사'], pos: '동사', sense: 2 },
      { all: ['양사'], pos: '양사', join: true },
    ])));
    const pairMark = { lineIdx: 0, word: '个', key: zhPosMarkKey(0, '个'), pair: ['个', '电'], pairOnly: true };
    const picks = await disambiguateZhPos(lines, [daMark, pairMark]);
    const pick = picks.get(pairMark.key);
    expect(pick).toEqual({ pos: null, all: [], join: true });
    const token = { cachedPos: '양사', tokenPos: '양사', tokenPosAll: null };
    expect(resolveZhTokenPos({ pick, ...token })).toEqual(resolveZhTokenPos({ pick: undefined, ...token }));
    expect(buildZhPosWriteback([pairMark], picks, new Map([['个', { pos: '양사', source: 'gemini' }]]))).toEqual([]);
  });

  it('마크가 없으면 호출 0', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await disambiguateZhPos(lines, [])).size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['HTTP 실패', () => ({ ok: false, status: 500, json: async () => ({}), text: async () => 'boom' })],
    ['길이 불일치', () => geminiText([{ all: ['동사'], pos: '동사', sense: 2 }])],
    ['파싱 실패', () => geminiText('not json at all')],
  ])('%s면 결과가 후보 없는 마크로 돈 결과와 같다(빈 결과 → 현행 뜻)', async (_name, respond) => {
    vi.stubGlobal('fetch', vi.fn(async () => respond()));
    const on = await disambiguateZhPos(lines, marks, { senseStats: createZhSenseStats(marks) });
    const off = await disambiguateZhPos(lines, marks.map(({ candidates, ...m }) => m));
    expect([...on]).toEqual([...off]);
    expect(on.size).toBe(0);
    const t = { text: '打', base_form: '打' };
    expect(resolveZhTokenSense(on.get(daMark.key), t)).toBeNull();
    expect(pickZhMeaning(DA, '동사')).toBe('때리다, 치다');
  });
});

describe('토큰 뜻 결정 resolveZhTokenSense', () => {
  const t = { text: '打', base_form: '打' };
  it('검증된 sense가 있으면 그 뜻과 표식, doubt만 있으면 표식만, 없으면 null', () => {
    expect(resolveZhTokenSense({ pos: '동사', all: ['동사'], sense: { meaning: '걸다', via: 'sense' } }, t)).toEqual({ meaning: '걸다', via: 'sense' });
    expect(resolveZhTokenSense({ pos: '동사', all: ['동사'], sense: { meaning: '질투', via: 'ctx', meaningCheck: 'ctx' } }, t)).toEqual({ meaning: '질투', via: 'ctx', meaningCheck: 'ctx' });
    expect(resolveZhTokenSense({ pos: '동사', all: ['동사'], meaningCheck: 'doubt' }, t)).toEqual({ meaningCheck: 'doubt' });
    expect(resolveZhTokenSense({ pos: '동사', all: ['동사'] }, t)).toBeNull();
    expect(resolveZhTokenSense(undefined, t)).toBeNull();
  });
  it('사전 키가 표면형과 다른 토큰(이합사 조각)에는 적용하지 않는다 — 후보와 사전 행이 어긋난다', () => {
    const pick = { pos: '동사', all: ['동사'], sense: { meaning: '걸다', via: 'sense' } };
    expect(resolveZhTokenSense(pick, { text: '歉', base_form: '歉', sep_link: '道歉' })).toBeNull();
  });
});
