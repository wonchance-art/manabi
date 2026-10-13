/**
 * 목표 과정 목록 — 레퍼런스 정본 투영(buildContinueManifest)을 진행바 · 목표 편집에 필요한 만큼만 줄인다
 * (LEARN-HOME-AK-001). 서버(`/api/goal-catalog`)에서만 부른다 — 정본 본문을 클라이언트 번들에 싣지 않는다.
 * 계획 계산은 studyPlan.buildPlan({ languages: catalog }, …) 그대로다. 국기 필드는 싣지 않는다(D-X6).
 */
export function goalCatalog(manifest) {
  return Object.fromEntries(Object.entries(manifest || {}).map(([lang, ref]) => [lang, {
    base: ref.base,
    levels: (ref.levels || []).map(level => ({
      key: level.key, short: level.short, label: level.label,
      chapters: (level.chapters || []).map(chapter => ({ slug: chapter.slug })),
    })),
  }]));
}
