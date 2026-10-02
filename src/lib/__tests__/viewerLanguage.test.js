import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VIEWER_UI_LOCALES, VIEWER_LANGUAGES, VIEWER_LANGUAGE_PREF_KEY,
  canonicalViewerLocale, normalizeViewerLocale, viewerLanguageInfo, createViewerLanguageRegistry,
  readViewerLanguagePreferences, writeViewerLanguagePreferences, viewerExplanationScope,
} from '../viewerLanguage';

// Node 환경에서 effect/이벤트 동작을 확인하는 최소 hook runner. 브라우저/분석 API는 호출하지 않는다.
const hooks = vi.hoisted(() => ({ slots: [], cursor: 0, effects: [], mounted: false }));
vi.mock('react', () => ({
  useState(initial) {
    const slot = hooks.cursor++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = typeof initial === 'function' ? initial() : initial;
    return [hooks.slots[slot], value => {
      hooks.slots[slot] = typeof value === 'function' ? value(hooks.slots[slot]) : value;
    }];
  },
  useRef(initial) {
    const slot = hooks.cursor++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = { current: initial };
    return hooks.slots[slot];
  },
  useEffect(effect) { if (!hooks.mounted) hooks.effects.push(effect); },
  useCallback(callback) { return callback; },
}));
import { useViewerLanguage } from '../useViewerLanguage';

function storage(entries = {}) {
  const data = new Map(Object.entries(entries));
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

describe('viewer locale and target language ownership', () => {
  it('canonicalizes explicit region tags and keeps script-only region choice explicit', () => {
    expect(VIEWER_UI_LOCALES).toEqual(['ko', 'zh-CN', 'zh-TW']);
    for (const input of ['zh-cn', 'zh_CN', 'zh-Hans-CN']) expect(canonicalViewerLocale(input)).toBe('zh-CN');
    for (const input of ['zh-tw', 'zh_TW', 'zh-Hant-TW']) expect(canonicalViewerLocale(input)).toBe('zh-TW');
    expect(canonicalViewerLocale('ko-KR')).toBe('ko');
    for (const input of ['zh', 'zh-Hans', 'zh-Hant', 'zh-HK', 'zh-Hans-TW', 'en', '', null, {}]) {
      expect(canonicalViewerLocale(input)).toBeNull();
    }
    expect(normalizeViewerLocale('zh-Hant', 'zh-TW')).toBe('zh-TW');
    expect(normalizeViewerLocale('zh-Hans')).toBe('ko');
    expect(normalizeViewerLocale('broken', 'broken')).toBe('ko');
  });

  it.each([
    ['Japanese', 'ja-JP', 'ja'], ['Chinese', 'zh-Hant', 'zh'], ['English', 'en-US', 'en'],
    ['French', 'fr-FR', 'fr'], ['Korean', 'ko-KR', 'ko'],
  ])('maps declared %s tags without altering the legacy DB key', (language, tag, code) => {
    expect(viewerLanguageInfo(language)).toMatchObject({ language, code });
    expect(viewerLanguageInfo(tag)).toBe(viewerLanguageInfo(language));
  });

  it('returns no target language for missing, malformed or unregistered declarations', () => {
    for (const input of [undefined, null, '', 'Unknown', 'German', 'de-DE', 'zhgarbage', {}, '한글']) {
      expect(viewerLanguageInfo(input)).toBeNull();
    }
  });

  it('separates implemented Korean analysis from unverified persistence, speech and courses', () => {
    expect(viewerLanguageInfo('Korean')).toMatchObject({
      analysisMethod: 'llm', releaseStatus: 'unreviewed', readingType: null, labelKo: '한국어', speechLocale: 'ko-KR',
      capabilities: { text: 'supported', analysis: 'supported', speech: 'unverified', save: 'blocked', review: 'blocked', courses: 'unsupported', pdf: 'unsupported' },
      explanationLocales: ['ko', 'zh-CN', 'zh-TW'],
    });
    for (const language of ['Japanese', 'Chinese', 'English', 'French']) {
      expect(viewerLanguageInfo(language).capabilities).toMatchObject({ save: 'supported', review: 'supported', courses: 'unsupported' });
      expect(viewerLanguageInfo(language).explanationLocales).toEqual(['ko']);
    }
  });

  it('registers a fixture adapter without enabling unimplemented features or changing the production registry', () => {
    const entries = [{ language: 'Fixture', code: 'de', explanationLocales: ['ko'], capabilities: { text: 'supported' } }];
    const registry = createViewerLanguageRegistry(entries);
    entries[0].capabilities.text = 'unsupported';
    expect(viewerLanguageInfo('de-DE', registry)).toMatchObject({ language: 'Fixture', capabilities: { text: 'supported', analysis: 'unsupported', save: 'unsupported', courses: 'unsupported' } });
    expect(Object.isFrozen(registry.Fixture.capabilities)).toBe(true);
    expect(viewerLanguageInfo('de-DE')).toBeNull();
    expect(Object.keys(VIEWER_LANGUAGES)).toHaveLength(5);
    expect(() => createViewerLanguageRegistry([{ language: 'Fixture', code: 'de', capabilities: { save: true } }])).toThrow(TypeError);
    expect(() => createViewerLanguageRegistry([{ code: 'de' }])).toThrow(TypeError);
    expect(() => createViewerLanguageRegistry([{ language: 'Fixture', code: 'de', explanationLocales: ['en'] }])).toThrow(TypeError);
    expect(() => createViewerLanguageRegistry([{ language: 'Fixture', code: 'de' }, { language: 'Other', code: 'de' }])).toThrow(TypeError);
  });
});

describe('independent browser language preferences', () => {
  it('defaults legacy viewers to ko without writing or reading material metadata', () => {
    const legacy = storage({ viewer_preferences_v2: '{"version":2}', document: '{"language":"Chinese"}' });
    expect(readViewerLanguagePreferences(legacy)).toEqual({ uiLocale: 'ko', explanationLocale: 'ko' });
    expect(legacy.getItem(VIEWER_LANGUAGE_PREF_KEY)).toBeNull();
    writeViewerLanguagePreferences(legacy, { uiLocale: 'zh-CN', language: 'Korean', metadata: { language: 'Korean' } });
    expect(legacy.getItem('document')).toBe('{"language":"Chinese"}');
    expect(legacy.getItem('viewer_preferences_v2')).toBe('{"version":2}');
    expect(JSON.parse(legacy.getItem(VIEWER_LANGUAGE_PREF_KEY))).toEqual({ version: 1, uiLocale: 'zh-CN', explanationLocale: 'ko' });
  });

  it('patches each preference independently and retains valid choice for invalid writes', () => {
    const store = storage();
    writeViewerLanguagePreferences(store, { uiLocale: 'zh-CN' });
    expect(writeViewerLanguagePreferences(store, { explanationLocale: 'zh-TW' })).toEqual({ uiLocale: 'zh-CN', explanationLocale: 'zh-TW' });
    expect(writeViewerLanguagePreferences(store, { uiLocale: 'broken', explanationLocale: 'zh-Hant' })).toEqual({ uiLocale: 'zh-CN', explanationLocale: 'zh-TW' });
    expect(readViewerLanguagePreferences(store)).toEqual({ uiLocale: 'zh-CN', explanationLocale: 'zh-TW' });
  });

  it('recovers malformed JSON and validates each field without trusting future schemas', () => {
    for (const raw of ['{broken', 'null', '[]', '{"version":2,"uiLocale":"zh-TW"}']) {
      expect(readViewerLanguagePreferences(storage({ [VIEWER_LANGUAGE_PREF_KEY]: raw }))).toEqual({ uiLocale: 'ko', explanationLocale: 'ko' });
    }
    expect(readViewerLanguagePreferences(storage({ [VIEWER_LANGUAGE_PREF_KEY]: '{"version":1,"uiLocale":"zh-tw","explanationLocale":"garbage"}' }))).toEqual({ uiLocale: 'zh-TW', explanationLocale: 'ko' });
  });

  it('does not hide denied storage access or quota failure from the hook', () => {
    expect(() => readViewerLanguagePreferences({ getItem() { throw Error('denied'); } })).toThrow('denied');
    expect(() => writeViewerLanguagePreferences({ getItem: () => null, setItem() { throw Error('quota'); } }, { uiLocale: 'zh-CN' })).toThrow('quota');
  });
});

describe('explanation cache and response scope', () => {
  const input = { language: 'Korean', explanationLocale: 'zh-CN', materialId: 'doc', revision: 'r1', accountId: 'a', promptVersion: 'p1', analysisVersion: 'a1', text: '학교에 갔어요.' };
  it('isolates explanation locale, material revision, account, language and versions but excludes UI locale', () => {
    const original = viewerExplanationScope(input);
    expect(original).not.toBeNull();
    expect(viewerExplanationScope({ ...input, uiLocale: 'zh-TW' })).toBe(original);
    expect(viewerExplanationScope({ ...input, language: 'ko' })).toBe(original);
    for (const patch of [{ explanationLocale: 'zh-TW' }, { materialId: 'other' }, { revision: 'r2' }, { accountId: 'b' }, { promptVersion: 'p2' }, { analysisVersion: 'a2' }, { text: '학교에 와요.' }]) {
      expect(viewerExplanationScope({ ...input, ...patch })).not.toBe(original);
    }
    expect(viewerExplanationScope({ ...input, language: 'Chinese', explanationLocale: 'ko' })).not.toBe(viewerExplanationScope({ ...input, explanationLocale: 'ko' }));
  });

  it('does not truncate text or allow delimiters to collide and rejects unsupported combinations', () => {
    const text = '가'.repeat(220);
    expect(viewerExplanationScope({ ...input, text: text + '나' })).not.toBe(viewerExplanationScope({ ...input, text: text + '다' }));
    expect(viewerExplanationScope({ ...input, materialId: 'a:b', revision: 'c' })).not.toBe(viewerExplanationScope({ ...input, materialId: 'a', revision: 'b:c' }));
    for (const patch of [{ language: 'Unknown' }, { explanationLocale: 'zh-Hant' }, { explanationLocale: 'en' }, { language: 'Chinese' }]) {
      expect(viewerExplanationScope({ ...input, ...patch })).toBeNull();
    }
    expect(viewerExplanationScope({ language: 'Chinese' })).not.toBeNull();
    expect(viewerExplanationScope({ language: 'Korean', locale: 'zh-TW' })).not.toBeNull();
  });
});

describe('useViewerLanguage browser lifecycle', () => {
  let cleanups;
  let browser;
  function ViewerLanguageFixture() { hooks.cursor = 0; return useViewerLanguage(); }
  const render = ViewerLanguageFixture;
  const mount = () => {
    const initial = render();
    hooks.mounted = true;
    cleanups = hooks.effects.map(effect => effect());
    return initial;
  };
  beforeEach(() => {
    Object.assign(hooks, { slots: [], cursor: 0, effects: [], mounted: false });
    cleanups = [];
    browser = { localStorage: storage(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('window', browser);
  });
  afterEach(() => {
    for (const cleanup of cleanups) cleanup?.();
    vi.unstubAllGlobals();
  });

  it('renders a hydration-safe default then loads user preference and cleans the subscription', () => {
    writeViewerLanguagePreferences(browser.localStorage, { uiLocale: 'zh-CN', explanationLocale: 'zh-TW' });
    expect(mount()).toMatchObject({ uiLocale: 'ko', explanationLocale: 'ko', storageError: false });
    expect(render()).toMatchObject({ uiLocale: 'zh-CN', explanationLocale: 'zh-TW', storageError: false });
    expect(browser.addEventListener).toHaveBeenCalledWith('storage', expect.any(Function));
    cleanups[0]();
    expect(browser.removeEventListener).toHaveBeenCalledWith('storage', browser.addEventListener.mock.calls[0][1]);
    cleanups = [];
  });

  it('keeps independent setters and merges a concurrent other-tab preference update', () => {
    mount();
    const api = render();
    api.setUiLocale('zh-CN');
    api.setExplanationLocale('zh-TW');
    expect(render()).toMatchObject({ uiLocale: 'zh-CN', explanationLocale: 'zh-TW' });
    writeViewerLanguagePreferences(browser.localStorage, { explanationLocale: 'ko' });
    api.setUiLocale(previous => previous === 'zh-CN' ? 'zh-TW' : 'ko');
    expect(render()).toMatchObject({ uiLocale: 'zh-TW', explanationLocale: 'ko' });
  });

  it('reacts to matching localStorage changes and clear, while ignoring unrelated events', () => {
    mount();
    const listener = browser.addEventListener.mock.calls[0][1];
    writeViewerLanguagePreferences(browser.localStorage, { explanationLocale: 'zh-CN' });
    listener({ key: 'other', storageArea: browser.localStorage });
    listener({ key: VIEWER_LANGUAGE_PREF_KEY, storageArea: storage() });
    expect(render().explanationLocale).toBe('ko');
    listener({ key: VIEWER_LANGUAGE_PREF_KEY, storageArea: browser.localStorage });
    expect(render().explanationLocale).toBe('zh-CN');
    browser.localStorage.removeItem(VIEWER_LANGUAGE_PREF_KEY);
    listener({ key: null, storageArea: browser.localStorage });
    expect(render()).toMatchObject({ uiLocale: 'ko', explanationLocale: 'ko' });
  });

  it('preserves session choices on quota failure and retries all unsaved independent changes', () => {
    const backing = browser.localStorage;
    browser.localStorage = { getItem: backing.getItem, setItem() { throw Error('quota'); } };
    mount();
    render().setUiLocale('zh-CN');
    expect(render()).toMatchObject({ uiLocale: 'zh-CN', explanationLocale: 'ko', storageError: true });
    browser.localStorage = backing;
    render().setExplanationLocale('zh-TW');
    expect(render()).toMatchObject({ uiLocale: 'zh-CN', explanationLocale: 'zh-TW', storageError: false });
    expect(readViewerLanguagePreferences(backing)).toEqual({ uiLocale: 'zh-CN', explanationLocale: 'zh-TW' });
  });

  it('reports denied storage getters and still allows session-only choices', () => {
    Object.defineProperty(browser, 'localStorage', { get() { throw Error('denied'); } });
    mount();
    expect(render().storageError).toBe(true);
    render().setExplanationLocale('zh-TW');
    expect(render()).toMatchObject({ uiLocale: 'ko', explanationLocale: 'zh-TW', storageError: true });
  });
});
