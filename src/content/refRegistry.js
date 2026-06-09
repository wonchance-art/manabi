/**
 * 언어 레퍼런스 공용 레지스트리 팩토리
 * 프랑스어·일본어·영어 레퍼런스가 같은 조회 API를 공유한다.
 * 콘텐츠 형식은 각 언어 디렉토리의 SCHEMA.md 참고.
 */
export function createRegistry(levelMeta, grammarMap, vocabMap) {
  /** 레벨 순서·챕터 order 순으로 평탄화된 전체 챕터 목록 */
  const ALL_CHAPTERS = levelMeta.flatMap(meta =>
    (grammarMap[meta.key] || []).slice().sort((a, b) => a.order - b.order)
  );
  const BY_SLUG = new Map(ALL_CHAPTERS.map((ch, idx) => [ch.slug, idx]));

  const norm = key => String(key || '').toUpperCase();

  return {
    LEVEL_META: levelMeta,
    ALL_CHAPTERS,

    getLevelMeta(key) {
      return levelMeta.find(m => m.key === norm(key)) || null;
    },

    getGrammarChapters(levelKey) {
      return grammarMap[norm(levelKey)] || [];
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
