// 과 본문 기억(BOOKS-FLOW-001) — 공개 판본의 본문은 판본 id + 과가 정하는 고정 출력물이고 사용자 값이 없다(reading route
// · bookReadingCache.test.js). 과를 오갈 때마다(다음 과 → 뒤로 · 다른 화면에서 뒤로) 같은 과를 다시 받으면 304라도 왕복과
// 서버 발행 확인을 기다리며 본문이 비었다. 이 탭에서 최근 과 몇 개만 기억해 바로 그린다 — 관리자 미리보기(미발행)는 기억하지 않는다.
const UNIT_MEMORY_MAX = 8;
const unitMemory = new Map(); // `${bookId}:${edition}:${unit}` → sections (최근 쓴 순서)
export function rememberedUnit(key) {
  const hit = unitMemory.get(key);
  if (hit) { unitMemory.delete(key); unitMemory.set(key, hit); }
  return hit || null;
}
export function rememberUnit(key, sections) {
  unitMemory.delete(key); unitMemory.set(key, sections);
  while (unitMemory.size > UNIT_MEMORY_MAX) unitMemory.delete(unitMemory.keys().next().value);
}
export const forgetUnits = () => unitMemory.clear(); // 단위 계약용
