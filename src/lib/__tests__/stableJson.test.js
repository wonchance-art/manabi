/* eslint-disable react-hooks/rules-of-hooks -- 훅을 아래 작은 런타임에서 평범한 함수로 직접 부르는 시험이다. */
// 해설 훅의 요청 범위 직렬화(VIEWER-TAP-INP-001). 뷰어의 scope에는 자료 원문 · 분석 전체(processed_json)가 들어 있어,
// 낱말을 누를 때마다 뷰어가 다시 그려지며 훅 셋(문형 · 쉬운 말 · 낱말 설명)이 그 전체를 JSON으로 만들었다(390 · CPU×4 ·
// 48줄 자료에서 탭마다 약 9ms, 자료 길이에 비례). 같은 scope면 한 번만 직렬화하고, 열쇠 문자열은 예전과 글자 하나까지 같다.
import fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const host = vi.hoisted(() => ({ slots: [], cursor: 0, effects: [] }));
const changed = (a, b) => !a || a.length !== b.length || a.some((value, i) => !Object.is(value, b[i]));
vi.mock('react', () => ({
  useState(initial) {
    const i = host.cursor++;
    host.slots[i] ??= { value: typeof initial === 'function' ? initial() : initial };
    return [host.slots[i].value, value => { host.slots[i].value = typeof value === 'function' ? value(host.slots[i].value) : value; }];
  },
  useRef(initial) { const i = host.cursor++; return host.slots[i] ??= { current: initial }; },
  useCallback(callback, deps) { const i = host.cursor++; if (changed(host.slots[i]?.deps, deps)) host.slots[i] = { deps, callback }; return host.slots[i].callback; },
  useEffect(effect, deps) { const i = host.cursor++; if (changed(host.slots[i]?.deps, deps)) host.effects.push({ i, effect, deps }); },
}));
vi.mock('../gemini', () => ({ GEMINI_TIER: 'standard', callGemini: vi.fn(() => new Promise(() => {})) }));
vi.mock('../../content/refGrammarManifest', () => ({ REF_GRAMMAR_MANIFEST: { languages: {} } }));

const { stableJson } = await import('../stableJson');
const { useGrammarDetail } = await import('../useGrammarDetail');
const { useEasierText } = await import('../useEasierText');
const { useViewerExplanation, viewerExplanationKey } = await import('../useViewerExplanation');

// 직렬화 횟수를 세는 큰 scope 대역 — processed_json 자리에 둔다.
function countedScope() {
  const counter = { n: 0 };
  const processed = { toJSON() { counter.n += 1; return { sequence: ['id_0_0'], dictionary: { id_0_0: { text: '駅' } } }; } };
  return { counter, scope: ['user-1', '94171', 'Japanese', '駅まで歩いて行きます。', processed] };
}
const oneRender = (useHook, props) => {
  host.cursor = 0;
  const api = useHook(props);
  for (const { i, effect, deps } of host.effects.splice(0)) { host.slots[i]?.cleanup?.(); host.slots[i] = { deps, cleanup: effect() }; }
  return api;
};
beforeEach(() => { Object.assign(host, { slots: [], cursor: 0, effects: [] }); });

describe('stableJson — JSON.stringify와 같은 결과, 같은 입력이면 다시 만들지 않는다', () => {
  it('결과 문자열이 JSON.stringify(parts)와 같다', () => {
    for (const parts of [[], ['ko', undefined, null, 0, NaN], [['a', { b: [1, '駅'] }], 'grammar-prompt-v2'], ['😀\n"q"', { x: undefined }]]) {
      expect(stableJson({ current: null }, parts)).toBe(JSON.stringify(parts));
    }
  });
  it('각 칸이 같은 값이면 지난 문자열을 돌려주고, 한 칸이라도 바뀌면 새로 만든다', () => {
    const { counter, scope } = countedScope(), cache = { current: null };
    const first = stableJson(cache, ['Japanese', 'ko', scope]);
    expect(stableJson(cache, ['Japanese', 'ko', scope])).toBe(first);
    expect(counter.n).toBe(1);
    expect(stableJson(cache, ['Japanese', 'zh-TW', scope])).toBe(JSON.stringify(['Japanese', 'zh-TW', scope]));
    expect(counter.n).toBe(3); // 새로 만들기 1 + 비교용 JSON.stringify 1
    expect(stableJson(cache, ['Japanese', 'zh-TW', [...scope]])).toBe(JSON.stringify(['Japanese', 'zh-TW', scope])); // 새 배열 = 새로 만든다
  });
});

describe('낱말 설명 열쇠 — 예전 JSON.stringify([scope, id, text, base_form, sentence, locale, sourceLocale])와 같은 문자열', () => {
  it.each([
    [['user-1', '94171', 'Korean', '학교에 갔어요.', { sequence: ['id_0_0'] }], { id: 'id_0_0', text: '갔어요', base_form: '가다' }, '학교에 갔어요.', 'zh-TW', 'ko'],
    [undefined, undefined, undefined, 'ko', 'ko'],
    [null, { id: 'id_1_2', text: '"따옴표"\n' }, null, 'zh-CN', undefined],
    ['', { text: '駅' }, '', 'ko', 'ko'],
  ])('scope %#', (scope, token, sentence, locale, sourceLocale) => {
    const old = JSON.stringify([scope, token?.id, token?.text, token?.base_form, sentence, locale, sourceLocale]);
    const parts = JSON.stringify([token?.id, token?.text, token?.base_form, sentence, locale, sourceLocale]);
    expect(viewerExplanationKey(stableJson({ current: null }, [scope]), parts)).toBe(old);
    expect(JSON.parse(viewerExplanationKey(JSON.stringify([scope]), parts))).toEqual(JSON.parse(old));
  });
});

describe('해설 훅 셋 — 낱말을 바꿔 눌러 다시 그려도 큰 scope는 한 번만 직렬화한다', () => {
  it.each([['문형', useGrammarDetail], ['쉬운 말', useEasierText]])('%s(useGrammarDetail · useEasierText)', (_, useHook) => {
    const { counter, scope } = countedScope();
    for (let i = 0; i < 4; i++) oneRender(useHook, { materialLang: 'Japanese', toast: () => {}, explanationLocale: 'ko', scope });
    expect(counter.n).toBe(1);
    oneRender(useHook, { materialLang: 'Japanese', toast: () => {}, explanationLocale: 'ko', scope: [...scope] });
    expect(counter.n).toBe(2); // 자료가 바뀌면(새 scope) 다시 만든다
  });
  it('낱말 설명(useViewerExplanation) — 낱말이 바뀌어도 scope는 다시 만들지 않는다', () => {
    const { counter, scope } = countedScope();
    for (const [id, text] of [['id_0_0', '私'], ['id_0_2', '毎朝'], ['id_0_5', '歩いて']]) {
      oneRender(useViewerExplanation, { token: { id, text, base_form: text }, sentence: '私は毎朝駅まで歩いて行きます。', locale: 'ko', sourceLocale: 'ko', scope, enabled: false });
    }
    expect(counter.n).toBe(1);
  });
  it('훅 안에 scope 전체를 렌더마다 직렬화하는 식이 되살아나지 않는다', () => {
    for (const file of ['useGrammarDetail', 'useEasierText', 'useViewerExplanation']) {
      const src = fs.readFileSync(`src/lib/${file}.js`, 'utf8').replace(/\/\/.*$/gm, ''); // 주석 제외
      expect(src).not.toMatch(/JSON\.stringify\(\[(materialLang, locale, )?scope\b/);
      expect(src).toContain('stableJson(useRef(null), [');
    }
  });
});
