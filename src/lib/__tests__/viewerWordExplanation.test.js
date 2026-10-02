import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// No browser renderer is installed. This host preserves React's hook slots,
// dependency comparison and cleanup order while allowing deterministic async races.
const host = vi.hoisted(() => ({ slots: [], cursor: 0, effects: [], reset() { this.slots = []; this.cursor = 0; this.effects = []; } }));
const mocks = vi.hoisted(() => ({ callGemini: vi.fn(), cacheKey: vi.fn() }));
vi.mock('react', () => ({
  useState(initial) {
    const index = host.cursor++;
    if (!host.slots[index]) host.slots[index] = { value: typeof initial === 'function' ? initial() : initial };
    return [host.slots[index].value, value => { host.slots[index].value = typeof value === 'function' ? value(host.slots[index].value) : value; }];
  },
  useRef(initial) {
    const index = host.cursor++;
    if (!host.slots[index]) host.slots[index] = { current: initial };
    return host.slots[index];
  },
  useEffect(effect, deps) {
    const index = host.cursor++, previous = host.slots[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) host.effects.push({ index, effect, deps });
  },
}));
vi.mock('../gemini', () => ({ callGemini: mocks.callGemini }));
vi.mock('../viewerReliability', () => ({ viewerCacheKey: mocks.cacheKey }));
import { useViewerExplanation } from '../useViewerExplanation';

const sourceToken = Object.freeze({ id: 'id_1_0_locale', text: '갔어요', base_form: '가다', meaning: '去了', explanationLocale: 'zh-CN', sourceSpan: Object.freeze({ start: 4, end: 7, unit: 'utf16' }), morphology: Object.freeze([Object.freeze({ form: '어요', function: '礼貌语尾' })]) });
const base = { token: sourceToken, sentence: '학교에 갔어요.', locale: 'zh-TW', sourceLocale: 'zh-CN', scope: ['account', 'material', 'revision'], enabled: true };
const result = (meaning, fn) => JSON.stringify({ meaning, morphology: [fn] });
const settle = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function ExplanationHarness(props = base) {
  host.cursor = 0;
  const value = useViewerExplanation(props);
  for (const { index, effect, deps } of host.effects.splice(0)) {
    host.slots[index]?.cleanup?.();
    host.slots[index] = { deps, cleanup: effect() };
  }
  return value;
}

beforeEach(() => {
  host.reset(); mocks.callGemini.mockReset(); mocks.cacheKey.mockReset();
  mocks.cacheKey.mockImplementation(async (...args) => JSON.stringify(args));
  const storage = new Map();
  vi.stubGlobal('localStorage', { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) });
});
afterEach(() => { for (const slot of host.slots) slot?.cleanup?.(); vi.unstubAllGlobals(); });

describe('word explanation is a locale-scoped display overlay', () => {
  it('never presents source-locale meaning or morphology while the new locale is pending', async () => {
    const pending = deferred(); mocks.callGemini.mockReturnValue(pending.promise);
    const first = ExplanationHarness();
    expect(first).toMatchObject({ meaning: '', morphology: [], loading: true, error: false });
    await settle();
    expect(ExplanationHarness()).toMatchObject({ meaning: '', morphology: [], loading: true });
    pending.resolve(result('去了學校', '禮貌語尾')); await settle();
    expect(ExplanationHarness()).toMatchObject({ meaning: '去了學校', morphology: ['禮貌語尾'], loading: false });
    expect(sourceToken.meaning).toBe('去了'); expect(sourceToken.sourceSpan).toEqual({ start: 4, end: 7, unit: 'utf16' });
  });

  it('rejects a delayed locale A response after locale B has completed, even if the provider ignores abort', async () => {
    const a = deferred(), b = deferred();
    mocks.callGemini.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    ExplanationHarness(); await settle();
    const oldSignal = mocks.callGemini.mock.calls[0][1];
    const next = { ...base, locale: 'ko' };
    expect(ExplanationHarness(next)).toMatchObject({ meaning: '', morphology: [], loading: true });
    expect(oldSignal.aborted).toBe(true);
    await settle(); b.resolve(result('학교에 갔다', '공손한 종결 표현')); await settle();
    expect(ExplanationHarness(next).meaning).toBe('학교에 갔다');
    a.resolve(result('늦게 도착한 대만 설명', '늦은 설명')); await settle();
    expect(ExplanationHarness(next)).toMatchObject({ meaning: '학교에 갔다', morphology: ['공손한 종결 표현'], error: false });
  });

  it('retains the same request and displayed help when only UI locale changes', async () => {
    const pending = deferred(); mocks.callGemini.mockReturnValue(pending.promise);
    ExplanationHarness({ ...base, uiLocale: 'ko' }); await settle();
    const signal = mocks.callGemini.mock.calls[0][1];
    ExplanationHarness({ ...base, uiLocale: 'zh-CN' }); await settle();
    expect(mocks.callGemini).toHaveBeenCalledTimes(1); expect(signal.aborted).toBe(false);
    pending.resolve(result('去了學校', '禮貌語尾')); await settle();
    expect(ExplanationHarness({ ...base, uiLocale: 'zh-TW' }).meaning).toBe('去了學校');
    expect(mocks.callGemini).toHaveBeenCalledTimes(1);
  });

  it('keeps failures retryable without falling back to a wrong-locale stored meaning', async () => {
    mocks.callGemini.mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce(result('去了學校', '禮貌語尾'));
    ExplanationHarness(); await settle();
    const failed = ExplanationHarness();
    expect(failed).toMatchObject({ meaning: '', morphology: [], error: true, loading: false });
    failed.retry(); ExplanationHarness(); await settle();
    expect(ExplanationHarness()).toMatchObject({ meaning: '去了學校', error: false, loading: false });
    expect(mocks.callGemini).toHaveBeenCalledTimes(2);
  });

  it('uses the original explanation when its locale matches and performs no generation', async () => {
    const current = ExplanationHarness({ ...base, locale: 'zh-CN' }); await settle();
    expect(current).toMatchObject({ meaning: sourceToken.meaning, morphology: sourceToken.morphology, loading: false, error: false });
    expect(mocks.callGemini).not.toHaveBeenCalled();
  });
});
