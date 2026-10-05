import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const hooks = vi.hoisted(() => ({ slots: [], cursor: 0, effects: [] }));
const network = vi.hoisted(() => ({ calls: [] }));
const changed = (a, b) => !a || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
vi.mock('react', () => ({
  useState(initial) {
    const i = hooks.cursor++;
    hooks.slots[i] ??= { value: initial };
    return [hooks.slots[i].value, value => { hooks.slots[i].value = value; }];
  },
  useRef(initial) { const i = hooks.cursor++; return hooks.slots[i] ??= { current: initial }; },
  useEffect(effect, deps) {
    const i = hooks.cursor++;
    if (changed(hooks.slots[i]?.deps, deps)) hooks.effects.push({ i, effect, deps });
  },
}));
vi.mock('../gemini', () => ({ callGemini: vi.fn((prompt, signal) => new Promise(resolve => {
  network.calls.push({ prompt, signal, resolve });
})) }));

import { useViewerExplanation } from '../useViewerExplanation';
import { viewerCacheKey } from '../viewerReliability';

let props, cache;
const TestExplanation = () => useViewerExplanation(props);
const render = () => {
  hooks.cursor = 0;
  const result = TestExplanation();
  for (const { i, effect, deps } of hooks.effects.splice(0)) {
    hooks.slots[i]?.cleanup?.();
    hooks.slots[i] = { deps, cleanup: effect() };
  }
  return result;
};
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

beforeEach(() => {
  Object.assign(hooks, { slots: [], cursor: 0, effects: [] });
  network.calls = [];
  cache = new Map();
  vi.stubGlobal('localStorage', { getItem: key => cache.get(key) ?? null,
    setItem: (key, value) => cache.set(key, value) });
  vi.stubGlobal('crypto', { subtle: { digest: async (_, bytes) => createHash('sha256').update(bytes).digest() } });
  props = { enabled: true, scope: ['qa-actor', 'qa-source'], locale: 'zh-TW', sourceLocale: 'ko',
    sentence: '계약을 아직 읽지 않았어요.',
    token: Object.freeze({ id: 'id_0_2', text: '읽지', base_form: '읽다', meaning: '읽지',
      morphology: Object.freeze([{ form: '-지', function: '부정 연결 어미' }]) }) };
});
afterEach(() => {
  for (const slot of hooks.slots) slot?.cleanup?.();
  vi.unstubAllGlobals();
});

describe('localized Korean explanations preserve source and requested terminology', () => {
  it.each([
    ['ko', 'natural Korean grammatical terms', '보조 동사'],
    ['zh-CN', 'natural Simplified Chinese grammatical terms', '助动词'],
    ['zh-TW', 'natural Taiwan Traditional Chinese grammatical terms', '助動詞'],
  ])('sends locale proofreading through the actual word overlay in %s', async (locale, rule, term) => {
    props.locale = locale;
    props.sourceLocale = locale === 'ko' ? 'zh-CN' : 'ko';
    render(); await flush();
    expect(network.calls).toHaveLength(1);
    const { prompt, resolve } = network.calls[0];
    expect(prompt).toContain(rule);
    expect(prompt).toContain(term);
    expect(prompt).toContain('Do not copy English grammatical labels');
    if (locale === 'ko') expect(prompt).not.toContain('Proofread explanations for complete, natural Chinese terms');
    expect(JSON.parse(prompt.split('INPUT_JSON=').at(-1))).toEqual({
      surface: '읽지', lemma: '읽다', sentence: props.sentence,
    });
    const reply = { meaning: 'QA contextual meaning', morphology: ['QA localized morphology'] };
    resolve(JSON.stringify(reply)); await flush();
    expect(render()).toMatchObject({ ...reply, loading: false, error: false });
    expect(props.token.meaning).toBe('읽지');
    expect(props.token.morphology).toEqual([{ form: '-지', function: '부정 연결 어미' }]);
  });

  it('regenerates the old mixed-language display cache without changing or deleting stored source meanings', async () => {
    const oldKey = await viewerCacheKey('viewer_word_locale', [props.scope, props.locale, '1'],
      [props.token.text, props.token.base_form, props.sentence]);
    const old = JSON.stringify({ meaning: '還沒有讀', morphology: ['Auxiliary Verb 않다', 'negate 動詞'] });
    cache.set(oldKey, old);
    render(); await flush();
    expect(network.calls).toHaveLength(1);
    network.calls[0].resolve(JSON.stringify({ meaning: '還沒有讀', morphology: ['않다：表示否定的助動詞。'] }));
    await flush();
    expect(render()).toMatchObject({ meaning: '還沒有讀', morphology: ['않다：表示否定的助動詞。'], loading: false });
    expect(cache.get(oldKey)).toBe(old);
    expect(cache.size).toBe(2);
    expect(props.token.meaning).toBe('읽지');
    Object.assign(hooks, { slots: [], cursor: 0, effects: [] });
    network.calls = [];
    render(); await flush();
    expect(network.calls).toHaveLength(0);
    expect(render()).toMatchObject({ morphology: ['않다：表示否定的助動詞。'], loading: false });
  });
});
