/**
 * 추천 수집 소스 편성 — 순수 함수 (v2-F R2, #1077).
 *
 * 크론 라우트에 묻어 있던 두 결정을 끄집어냈다. 둘 다 **공급이 ja/en에 갇혀 있던 원인**이라
 * 계약으로 고정할 값어치가 있다:
 *   ① 기본값 보충 — 예전엔 `dbSources.length > 0 ? dbSources : DEFAULTS`라, DB에 ja/en 행이
 *      하나라도 있으면 기본값 전체가 죽었다. 새 언어를 코드로 열 방법이 없었다.
 *   ② 언어 그룹핑 — 예전엔 `{ Japanese: [], English: [] }` 고정이라, DB에 French 행을 넣어도
 *      `if (byLang[s.language])`에서 조용히 버려졌다. 진짜 병목이 여기였다.
 */

/**
 * DB `content_sources`에 그 언어 행이 하나도 없을 때 쓰는 기본 소스.
 * 언어별로 보충되므로 여기 언어를 추가하면 **배포만으로 그 언어 공급이 열린다** —
 * 오너의 DB 수작업이 필요 없다(하드리밋 「운영 DB 적용은 오너 수동」을 건드리지 않는다).
 *
 * Chinese는 일부러 없다 — 하드리밋 「중화권 정치 서술 완전 배제」. 뉴스 피드는 정치 기사를
 * 자동으로 추천 카드에 올리게 된다. `wikinews_zh` 디스패처는 있으니, 오너가 켜기로 하면
 * `content_sources`에 행 하나면 된다.
 */
export const DEFAULT_SOURCES = Object.freeze([
  Object.freeze({ language: 'Japanese', source_type: 'qiita',       config: { level: 'N2 상급' } }),
  Object.freeze({ language: 'Japanese', source_type: 'nhk_rss',     config: { level: 'N3 중급' } }),
  Object.freeze({ language: 'English',  source_type: 'devto',       config: { level: 'B1 중급' } }),
  Object.freeze({ language: 'French',   source_type: 'wikinews_fr', config: { level: 'B1 중급' } }),
]);

/**
 * DB 행 + 기본값 → 이번 실행에서 돌릴 소스 목록.
 *
 * 「그 언어가 DB에 설정돼 있는가」와 「지금 켜져 있는가」는 다른 질문이다. 그래서 입력은
 * `is_active`로 거르지 않은 **전체 행**이어야 한다:
 *   · DB가 아는 언어 → 그 언어의 **활성 행만** 쓴다(의도적 비활성을 기본값이 되살리지 않는다)
 *   · DB가 모르는 언어 → 기본값으로 연다
 */
export function resolveActiveSources(dbSources, defaults = DEFAULT_SOURCES) {
  const rows = Array.isArray(dbSources) ? dbSources : [];
  const configuredLangs = new Set(rows.map((s) => s?.language));
  return [
    ...rows.filter((s) => s?.is_active),
    ...defaults.filter((d) => !configuredLangs.has(d.language)),
  ];
}

/** 소스 목록 → `Map<language, source[]>`. 언어 목록을 고정하지 않고 소스에서 유도한다. */
export function groupByLanguage(sources) {
  const byLang = new Map();
  for (const s of sources || []) {
    if (!s?.language) continue;
    if (!byLang.has(s.language)) byLang.set(s.language, []);
    byLang.get(s.language).push(s);
  }
  return byLang;
}
