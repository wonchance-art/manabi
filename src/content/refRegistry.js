/**
 * 언어 레퍼런스 공용 레지스트리 팩토리
 * 프랑스어·일본어·영어 레퍼런스가 같은 조회 API를 공유한다.
 * 콘텐츠 형식은 각 언어 디렉토리의 SCHEMA.md 참고.
 */
const norm = key => String(key || '').toUpperCase();

const chapterOrder = chapter => (
  Number.isFinite(chapter?.order) ? chapter.order : Number.MAX_SAFE_INTEGER
);

// #693 계약: eager/lazy 경로가 이 exact 함수 객체를 Array#sort에 공유한다.
export const GRAMMAR_CHAPTER_COMPARATOR = (a, b) => chapterOrder(a) - chapterOrder(b);

export function sortGrammarChapters(chapters) {
  return (chapters || []).slice().sort(GRAMMAR_CHAPTER_COMPARATOR);
}

export function createRegistry(levelMeta, grammarMap, vocabMap) {
  /** 레벨별 order 정렬 뷰 — order 없는 챕터는 뒤에 원래 순서대로(안정 정렬).
   * 기존 비교자(a.order - b.order)는 order 미도입 챕터에서 NaN이 되어
   * 결과가 엔진 구현에 좌우됐다. 목록(getGrammarChapters)도 같은 뷰를 쓴다. */
  const SORTED = new Map(levelMeta.map(meta => [
    meta.key,
    sortGrammarChapters(grammarMap[meta.key]),
  ]));
  const ALL_CHAPTERS = levelMeta.flatMap(meta => SORTED.get(meta.key));
  const BY_SLUG = new Map(ALL_CHAPTERS.map((ch, idx) => [ch.slug, idx]));

  return {
    LEVEL_META: levelMeta,
    ALL_CHAPTERS,
    SORT_COMPARATOR: GRAMMAR_CHAPTER_COMPARATOR,

    // 인트로 레벨(각 언어 levelMeta 첫 항목 — JA/EN/ZH의 'OT', FR의 'A0').
    // "간단히 알고 가면 좋을 것" — 학습 관문·복습 대상이 아니다.
    INTRO_LEVEL: levelMeta[0]?.key,
    isIntroLevel(levelKey) { return norm(levelKey) === levelMeta[0]?.key; },

    getLevelMeta(key) {
      return levelMeta.find(m => m.key === norm(key)) || null;
    },

    getGrammarChapters(levelKey) {
      return SORTED.get(norm(levelKey)) || [];
    },

    /** slug로 챕터 + 이전/다음 챕터(레벨 경계 넘어 연속) 조회 */
    getChapter(slug) {
      const idx = BY_SLUG.get(slug);
      if (idx == null) return null;
      return {
        chapter: ALL_CHAPTERS[idx],
        prev: idx > 0 ? ALL_CHAPTERS[idx - 1] : null,
        next: idx < ALL_CHAPTERS.length - 1 ? ALL_CHAPTERS[idx + 1] : null,
      };
    },

    getVocab(levelKey) {
      return vocabMap[norm(levelKey)] || null;
    },

    countVocab(levelKey) {
      const v = vocabMap[norm(levelKey)];
      if (!v) return 0;
      return v.themes.reduce((sum, t) => sum + t.words.length, 0);
    },
  };
}

/**
 * 문법 상세 route 전용 lazy registry.
 *
 * cold 호출은 loadGrammarLevel/loadChapter를 await한다. 반환된 loaded view에서는
 * 기존 getGrammarChapters(levelKey) 동기 signature와 full Chapter[] shape를 유지한다.
 */
export function createLazyRegistry(levelMeta, manifest, loaders, facade = {}) {
  const manifestLevels = new Map(
    (manifest?.levels || []).map(level => [norm(level.key), level]),
  );
  const manifestChapters = (manifest?.levels || []).flatMap(level =>
    (level.chapters || []).map(chapter => ({ ...chapter, level: norm(chapter.level || level.key) })),
  );
  const manifestBySlug = new Map(manifestChapters.map((chapter, index) => [
    chapter.slug,
    { chapter, index },
  ]));
  if (manifestBySlug.size !== manifestChapters.length) {
    throw new Error('[refRegistry] generated manifest contains duplicate slugs');
  }
  const loaded = new Map();
  const pending = new Map();

  function getLoadedChapter(slug) {
    const entry = manifestBySlug.get(slug);
    if (!entry) return null;
    return (loaded.get(entry.chapter.level) || []).find(chapter => chapter.slug === slug) || null;
  }

  function createLoadedView() {
    return {
      ...facade,
      LEVEL_META: levelMeta,
      INTRO_LEVEL: levelMeta[0]?.key,
      SORT_COMPARATOR: GRAMMAR_CHAPTER_COMPARATOR,

      isIntroLevel(levelKey) {
        return norm(levelKey) === levelMeta[0]?.key;
      },

      getLevelMeta(key) {
        return levelMeta.find(meta => meta.key === norm(key)) || null;
      },

      getGrammarChapters(levelKey) {
        return loaded.get(norm(levelKey)) || [];
      },

      getChapter(slug) {
        const entry = manifestBySlug.get(slug);
        const chapter = getLoadedChapter(slug);
        if (!entry || !chapter) return null;
        const prevSlug = manifestChapters[entry.index - 1]?.slug;
        const nextSlug = manifestChapters[entry.index + 1]?.slug;
        return {
          chapter,
          prev: prevSlug ? getLoadedChapter(prevSlug) : null,
          next: nextSlug ? getLoadedChapter(nextSlug) : null,
        };
      },
    };
  }

  function validateLevel(levelKey, chapters) {
    if (!Array.isArray(chapters)) {
      throw new TypeError(`[refRegistry] ${levelKey} loader must return a chapter array`);
    }

    const sorted = sortGrammarChapters(chapters);
    const expected = manifestLevels.get(levelKey)?.chapters || [];
    const actualKeys = sorted.map(chapter => [
      chapter?.slug,
      norm(chapter?.level),
      Number.isFinite(chapter?.order) ? chapter.order : null,
    ]);
    const expectedKeys = expected.map(chapter => [
      chapter.slug,
      norm(chapter.level || levelKey),
      Number.isFinite(chapter.order) ? chapter.order : null,
    ]);

    if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
      throw new Error(`[refRegistry] ${levelKey} payload does not match generated manifest`);
    }
    return sorted;
  }

  async function loadLevelData(levelKey) {
    const key = norm(levelKey);
    if (!manifestLevels.has(key)) {
      throw new Error(`[refRegistry] unknown grammar level: ${key || '(empty)'}`);
    }
    if (loaded.has(key)) return loaded.get(key);
    if (pending.has(key)) return pending.get(key);

    const expected = manifestLevels.get(key)?.chapters || [];
    const loader = loaders[key];
    if (!loader && expected.length > 0) {
      throw new Error(`[refRegistry] missing grammar loader: ${key}`);
    }

    const promise = Promise.resolve(loader ? loader() : [])
      .then(chapters => validateLevel(key, chapters))
      .then(chapters => {
        loaded.set(key, chapters);
        return chapters;
      });
    pending.set(key, promise);

    try {
      return await promise;
    } finally {
      if (pending.get(key) === promise) pending.delete(key);
    }
  }

  async function loadGrammarLevel(levelKey) {
    await loadLevelData(levelKey);
    return createLoadedView();
  }

  async function loadChapter(slug) {
    const entry = manifestBySlug.get(slug);
    if (!entry) return { registry: createLoadedView(), data: null };

    const adjacent = [
      manifestChapters[entry.index - 1],
      manifestChapters[entry.index + 1],
    ].filter(Boolean);
    const requiredLevels = new Set([
      entry.chapter.level,
      ...adjacent.map(chapter => chapter.level),
    ]);
    await Promise.all([...requiredLevels].map(loadLevelData));

    const registry = createLoadedView();
    return { registry, data: registry.getChapter(slug) };
  }

  return {
    SORT_COMPARATOR: GRAMMAR_CHAPTER_COMPARATOR,
    loadGrammarLevel,
    loadChapter,
  };
}
