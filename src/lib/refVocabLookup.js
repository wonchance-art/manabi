/**
 * 언어별 정본 어휘 조회 — 뷰어 만남 기록의 대조 지점 (rfc-vocab-encounter §4.7·§4.8).
 * ja는 기존 정본(japaneseVocabRegistry.findWord)에 위임하고, fr/zh/en은 refLangs 레지스트리
 * (content/<lang> — 본편+보강 병합 완료본)에서 표제어 키 인덱스를 지연 구축한다.
 * fr는 굴절 대응(§4.8)으로 활용형 키를 2패스에 추가 전개한다(frInflect — 표제어 우선).
 * 콘텐츠 임포트는 전부 동적 — 이 모듈의 정적 비용은 정규화 함수뿐이라 뷰어가 가볍게 문다.
 * 낮은 레벨이 이긴다(A1→C2 첫 등록 우선 — ja N5 우선과 같은 원칙).
 */
import { normalizeRefWordKey } from './refWordNormalize';
import { loadVocabEncounters } from '../components/world/vocabEncounters';

/** 자료 언어 → 만남 조회 코드 (§4.7 — en은 2026-08-22 오너 "en 뷰어 기록도 ㄱㄱ"로 편입). */
export function encounterLookupLang(materialLang) {
  return { Japanese: 'ja', French: 'fr', Chinese: 'zh', English: 'en' }[materialLang] || null;
}

function buildRegistryIndex(code, registry, mainOf, { headKeys, expand } = {}) {
  const idx = new Map();
  const entries = [];
  for (const meta of registry.LEVEL_META || []) {
    const vocab = registry.getVocab(meta.key);
    if (!vocab) continue;
    for (const theme of vocab.themes || []) {
      for (const word of theme.words || []) {
        const main = mainOf(word);
        const entry = { level: meta.key, word, main };
        const keys = headKeys ? headKeys(main) : [normalizeRefWordKey(code, main)];
        for (const key of keys) {
          if (key && !idx.has(key)) idx.set(key, entry);
        }
        if (expand) entries.push(entry);
      }
    }
  }
  // 2패스 — 활용형(§4.8)은 표제어 키를 절대 덮지 않는다: porte(명사)가 porter(동사)의
  // 3인칭 단수에 밀리지 않게, 표제어 전량을 먼저 깔고 남은 자리에만 변화형을 넣는다.
  if (expand) {
    for (const entry of entries) {
      for (const variant of expand(entry)) {
        const key = normalizeRefWordKey(code, variant);
        if (key && !idx.has(key)) idx.set(key, entry);
      }
    }
  }
  return {
    findWord(text) {
      const key = normalizeRefWordKey(code, text);
      return (key && idx.get(key)) || null;
    },
  };
}

// fr — 대안 표기("beau / belle")는 전 항을 표제어 키로 깔고(§4.8), 각 항을 pos별로 전개한다.
const FR_ALT_SPLIT = /[/,]| ou /;

const LOADERS = {
  ja: async () => {
    const { JAPANESE_VOCAB_REF } = await import('./japaneseVocabRegistry');
    return {
      findWord(text) {
        const hit = JAPANESE_VOCAB_REF.findWord(text);
        return hit ? { level: hit.level, word: hit.word, main: hit.word.ja } : null;
      },
    };
  },
  fr: async () => {
    const [{ default: french }, { frInflectionVariants }] = await Promise.all([
      import('../content/french'),
      import('./frInflect'),
    ]);
    const headKeys = (main) => String(main || '')
      .split(FR_ALT_SPLIT)
      .map((seg) => normalizeRefWordKey('fr', seg))
      .filter(Boolean);
    const expand = (entry) => headKeys(entry.main)
      .flatMap((headKey) => frInflectionVariants(headKey, entry.word?.pos));
    return buildRegistryIndex('fr', french, (w) => w.fr, { headKeys, expand });
  },
  zh: async () => {
    const { default: chinese } = await import('../content/chinese');
    return buildRegistryIndex('zh', chinese, (w) => w.zh);
  },
  en: async () => {
    const { default: english } = await import('../content/english');
    return buildRegistryIndex('en', english, (w) => w.en);
  },
};

const cache = new Map();

/** 조회기 지연 로드 — { findWord(text) → { level, word, main } | null }. 미지원 코드는 null. */
export function loadRefVocabLookup(code) {
  const loader = LOADERS[code];
  if (!loader) return Promise.resolve(null);
  if (!cache.has(code)) {
    cache.set(code, loader().catch((e) => { cache.delete(code); throw e; }));
  }
  return cache.get(code);
}

/**
 * 만남 기록 → 뷰어 점 비교용 키 집합. 저장은 저작 표기(refMain — 사전 필터·서버 정본과
 * 동일 문자열), 비교만 정규화 키로 한다(fr 관사 접기·en 소문자화). ja는 원문 그대로 불변.
 */
export function loadMetWordKeys(code, storage) {
  const keys = new Set();
  for (const w of loadVocabEncounters(code, storage)) {
    const key = normalizeRefWordKey(code, w);
    if (key) keys.add(key);
  }
  return keys;
}
