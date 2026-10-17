// 팀 key 형식 · 팀 루트 판정 — 의존성 없는 작은 모듈. 자료 목록(MaterialsPage)이 isTeamRoot 하나 때문에
// classBoard → classCourse · classSchedule · krHolidays를 끌고 오던 것을 끊는다(2026-10-17 KST 번들 조사). classBoard가 다시 내보낸다.
export const TEAM_KEY_RE = /^[a-z0-9][a-z0-9-]{0,15}$/;

export const isTeamKey = (v) => typeof v === 'string' && TEAM_KEY_RE.test(v);

/** 팀 루트 자료인가 — 자료실 목록에서 숨기는 판정(설정 행이 자료로 보이면 안 된다). getTeam(...)?.root === true와 같다. */
export function isTeamRoot(material) {
  const t = material?.processed_json?.metadata?.team;
  return !!t && typeof t === 'object' && isTeamKey(t.key) && t.root === true;
}
