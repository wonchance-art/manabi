/**
 * 언어별 정본 어휘 조회 — 뷰어 만남 기록의 대조 지점 (rfc-vocab-encounter §4.7).
 * ja는 기존 정본(japaneseVocabRegistry.findWord)에 위임하고, fr/zh/en은 refLangs 레지스트리
 * (content/<lang> — 본편+보강 병합 완료본)에서 표제어 키 인덱스를 지연 구축한다.
 * 콘텐츠 임포트는 전부 동적 — 이 모듈의 정적 비용은 정규화 함수뿐이라 뷰어가 가볍게 문다.
 * 낮은 레벨이 이긴다(A1→C2 첫 등록 우선 — ja N5 우선과 같은 원칙).
 */
import { normalizeRefWordKey } from './refWordNormalize';
import { loadVocabEncounters } from '../components/world/vocabEncounters';

/** 자료 언어 → 만남 조회 코드 (§4.7 — en은 2026-08-22 오너 "en 뷰어 기록도 ㄱㄱ"로 편입). */
export function encounterLookupLang(materialLang) {
  return { Japanese: 'ja', French: 'fr', Chinese: 'zh', English: 'en' }[materialLang] || null;
}

function buildRegistryIndex(code, registry, mainOf) {
  const idx = new Map();
  for (const meta of registry.LEVEL_META || []) {
    const vocab = registry.getVocab(meta.key);
    if (!vocab) continue;
    for (const theme of vocab.themes || []) {
      for (const word of theme.words || []) {
        const main = mainOf(word);
        const key = normalizeRefWordKey(code, main);
        if (key && !idx.has(key)) idx.set(key, { level: meta.key, word, main });
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
    const { default: french } = await import('../content/french');
    return buildRegistryIndex('fr', french, (w) => w.fr);
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
