/**
 * 언어 레퍼런스 공용 레지스트리 팩토리
 * 프랑스어·일본어·영어 레퍼런스가 같은 조회 API를 공유한다.
 * 콘텐츠 형식은 각 언어 디렉토리의 SCHEMA.md 참고.
 */
export function createRegistry(levelMeta, grammarMap, vocabMap) {
  /** 레벨별 order 정렬 뷰 — order 없는 챕터는 뒤에 원래 순서대로(안정 정렬).
   * 기존 비교자(a.order - b.order)는 order 미도입 챕터에서 NaN이 되어
   * 결과가 엔진 구현에 좌우됐다. 목록(getGrammarChapters)도 같은 뷰를 쓴다. */
  const ord = ch => (Number.isFinite(ch?.order) ? ch.order : Number.MAX_SAFE_INTEGER);
  const SORTED = new Map(levelMeta.map(meta => [
    meta.key,
    (grammarMap[meta.key] || []).slice().sort((a, b) => ord(a) - ord(b)),
  ]));
  const ALL_CHAPTERS = levelMeta.flatMap(meta => SORTED.get(meta.key));
  const BY_SLUG = new Map(ALL_CHAPTERS.map((ch, idx) => [ch.slug, idx]));

  const norm = key => String(key || '').toUpperCase();

  return {
    LEVEL_META: levelMeta,
    ALL_CHAPTERS,

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
