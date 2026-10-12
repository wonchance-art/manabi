// 자료의 legacy DB 언어와 표시 locale은 별도 계약이다. 기존 자료/카드는 변경하지 않는다.
export const VIEWER_UI_LOCALES = Object.freeze(['ko', 'zh-CN', 'zh-TW']);
export const VIEWER_LANGUAGE_PREF_KEY = 'viewer_language:v1';
const DEFAULT_PREFERENCES = Object.freeze({ uiLocale: 'ko', explanationLocale: 'ko' });
const CAPABILITIES = ['text', 'analysis', 'speech', 'save', 'review', 'courses', 'pdf'];
const CAPABILITY_STATES = ['supported', 'unsupported', 'pending', 'blocked', 'unverified'];

/** 등록 자체가 출시/품질 검수를 뜻하지 않는다. 미선언 기능은 켜지지 않는다. */
export function createViewerLanguageRegistry(entries) {
  const registry = {};
  for (const entry of entries) {
    if (!entry || typeof entry.language !== 'string' || typeof entry.code !== 'string'
      || !/^[A-Za-z]+$/.test(entry.language) || !/^[a-z]{2,3}$/.test(entry.code)
      || registry[entry.language] || Object.values(registry).some(info => info.code === entry.code)) {
      throw new TypeError('Invalid or duplicate viewer language registration');
    }
    const capabilities = Object.fromEntries(CAPABILITIES.map(key => {
      const state = entry.capabilities?.[key] ?? 'unsupported';
      if (!CAPABILITY_STATES.includes(state)) throw new TypeError('Invalid viewer capability state');
      return [key, state];
    }));
    const explanationLocales = [...new Set(entry.explanationLocales ?? [])];
    if (explanationLocales.some(locale => !VIEWER_UI_LOCALES.includes(locale))) {
      throw new TypeError('Unregistered explanation locale');
    }
    registry[entry.language] = Object.freeze({
      language: entry.language,
      code: entry.code,
      labelKo: entry.labelKo ?? entry.language,
      speechLocale: entry.speechLocale ?? null,
      readingType: entry.readingType ?? null,
      analysisMethod: entry.analysisMethod ?? null,
      releaseStatus: entry.releaseStatus ?? 'unreviewed',
      capabilities: Object.freeze(capabilities),
      explanationLocales: Object.freeze(explanationLocales),
    });
  }
  return Object.freeze(registry);
}

const legacyCapabilities = { text: 'supported', analysis: 'supported', speech: 'supported', save: 'supported', review: 'supported' };
export const VIEWER_LANGUAGES = createViewerLanguageRegistry([
  { language: 'Japanese', code: 'ja', labelKo: '일본어', speechLocale: 'ja-JP', readingType: 'kana', analysisMethod: 'kuromoji', releaseStatus: 'legacy', capabilities: legacyCapabilities, explanationLocales: ['ko'] },
  { language: 'Chinese', code: 'zh', labelKo: '중국어', speechLocale: 'zh-CN', readingType: 'pinyin', analysisMethod: 'jieba', releaseStatus: 'legacy', capabilities: legacyCapabilities, explanationLocales: ['ko'] },
  { language: 'English', code: 'en', labelKo: '영어', speechLocale: 'en-US', readingType: 'ipa', analysisMethod: 'hybrid', releaseStatus: 'legacy', capabilities: legacyCapabilities, explanationLocales: ['ko'] },
  { language: 'French', code: 'fr', labelKo: '프랑스어', speechLocale: 'fr-FR', readingType: 'ipa', analysisMethod: 'llm', releaseStatus: 'legacy', capabilities: legacyCapabilities, explanationLocales: ['ko'] },
  {
    language: 'Korean', code: 'ko', labelKo: '한국어', speechLocale: 'ko-KR', analysisMethod: 'llm', releaseStatus: 'unreviewed',
    capabilities: { text: 'supported', analysis: 'supported', speech: 'unverified', save: 'blocked', review: 'blocked' },
    explanationLocales: ['ko', 'zh-CN', 'zh-TW'],
  },
]);

/** 텍스트 읽기 자료로 열 수 있는 언어 — 등록부의 text·analysis가 모두 supported(자료 입구들의 공통 조건). */
export function textReadingSupported(info) {
  return info?.capabilities.text === 'supported' && info.capabilities.analysis === 'supported';
}

/** 알려진 DB 이름 또는 선언된 BCP47 태그만 매핑한다. 표기 추측/목표어 폴백은 없다. */
export function viewerLanguageInfo(language, registry = VIEWER_LANGUAGES) {
  if (typeof language !== 'string') return null;
  const value = language.trim();
  const legacy = Object.values(registry).find(info => info.language.toLowerCase() === value.toLowerCase());
  if (legacy) return legacy;
  try {
    const [tag] = Intl.getCanonicalLocales(value.replaceAll('_', '-'));
    const code = tag.split('-')[0];
    return Object.values(registry).find(info => info.code === code) ?? null;
  } catch { return null; }
}

export function canonicalViewerLocale(input) {
  if (typeof input !== 'string') return null;
  try {
    const [tag] = Intl.getCanonicalLocales(input.trim().replaceAll('_', '-'));
    const locale = new Intl.Locale(tag);
    if (locale.language === 'ko' && (!locale.region || locale.region === 'KR') && !locale.script) return 'ko';
    if (locale.language !== 'zh') return null;
    if (locale.region === 'CN' && (!locale.script || locale.script === 'Hans')) return 'zh-CN';
    if (locale.region === 'TW' && (!locale.script || locale.script === 'Hant')) return 'zh-TW';
    // zh/zh-Hans/zh-Hant만으로 지역을 단정하지 않는다. 호출자의 명시적인 기본값을 쓴다.
    return null;
  } catch { return null; }
}

export function normalizeViewerLocale(input, fallback = 'ko') {
  return canonicalViewerLocale(input) ?? canonicalViewerLocale(fallback) ?? 'ko';
}

/** 손상된 JSON은 기본값으로 읽고, 저장소 접근 실패는 호출자에게 전달한다. */
export function readViewerLanguagePreferences(storage) {
  const raw = storage?.getItem(VIEWER_LANGUAGE_PREF_KEY);
  let stored;
  try { stored = JSON.parse(raw ?? 'null'); } catch { stored = null; }
  if (stored?.version !== 1) return { ...DEFAULT_PREFERENCES };
  return {
    uiLocale: normalizeViewerLocale(stored.uiLocale),
    explanationLocale: normalizeViewerLocale(stored.explanationLocale),
  };
}

/** 한 설정만 바꿔도 다른 설정은 보존한다. 자료 언어/metadata는 저장하지 않는다. */
export function writeViewerLanguagePreferences(storage, settings) {
  const previous = readViewerLanguagePreferences(storage);
  const next = {
    uiLocale: normalizeViewerLocale(settings?.uiLocale, previous.uiLocale),
    explanationLocale: normalizeViewerLocale(settings?.explanationLocale, previous.explanationLocale),
  };
  storage.setItem(VIEWER_LANGUAGE_PREF_KEY, JSON.stringify({ version: 1, ...next }));
  return next;
}

/** 전체 scope를 직렬화해 prefix/text 잘림에 의한 충돌을 피한다. UI locale은 포함하지 않는다. */
export function viewerExplanationScope({ language, locale, explanationLocale = locale ?? 'ko',
  materialId = '', revision = '', accountId = '', promptVersion = '1', analysisVersion = '1', text = '' } = {}) {
  const info = viewerLanguageInfo(language);
  const normalized = canonicalViewerLocale(explanationLocale);
  if (!info || !normalized || !info.explanationLocales.includes(normalized)) return null;
  return JSON.stringify(['viewer_explanation:v1', info.language, normalized, accountId,
    materialId, revision, analysisVersion, promptVersion, text]);
}
