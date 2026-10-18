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

// 받는 중인 과(BOOKS-FLOW-002) — 미리 받기와 실제 열기가 같은 과를 두 번 받지 않게 같은 요청을 함께 쓴다.
const inflight = new Map(); // key → Promise<sections>
/** 이 과의 본문 — 기억에 있으면 그대로, 받는 중이면 그 요청을, 아니면 한 번 받아 기억한다(공개 판본만 부른다). */
export function loadUnit(key, url, fetchImpl = fetch) {
  const hit = rememberedUnit(key);
  if (hit) return Promise.resolve(hit);
  if (inflight.has(key)) return inflight.get(key);
  const request = fetchImpl(url)
    .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || '본문을 불러오지 못했어요.'); return data.sections; })
    .then(sections => { rememberUnit(key, sections); return sections; })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}
/** 다음 과 미리 받기 — 이미 기억했거나 받는 중이면 아무것도 하지 않는다. 실패는 조용히 버린다(열 때 다시 받는다). */
export function prefetchUnit(key, url, fetchImpl = fetch) {
  if (unitMemory.has(key) || inflight.has(key)) return false;
  loadUnit(key, url, fetchImpl).catch(() => {});
  return true;
}
export const forgetUnits = () => { unitMemory.clear(); inflight.clear(); }; // 단위 계약용
