/**
 * 조건을 바꿔도 목록이 비었다가 다시 차지 않게(LIST-KEEP — 오너 「앱처럼」 2026-10-16) — React Query v5 `placeholderData`.
 *
 * 새 조건(폴더 · 정렬 · 검색 · 언어 칩)을 받는 동안 **같은 사용자**의 이전 조건 결과를 그대로 보여 준다. 화면은
 * `isPlaceholderData`로 그 목록에 aria-busy와 흐림을 준다 — 이전 결과가 새 조건의 답인 것처럼 읽히지 않게.
 *
 * 다른 사용자 · 로그아웃으로 키가 바뀌면 남기지 않는다: 이전 쿼리 키의 [1](계정 id)이 지금 계정과 다르면 undefined.
 * 계정이 없으면(로그아웃 · 손님) 언제나 undefined. 그래서 쿼리 키는 `[이름, userId, ...조건]` 모양이어야 한다.
 */
export function keepPreviousForUser(userId) {
  return (previousData, previousQuery) => (userId && previousQuery?.queryKey?.[1] === userId ? previousData : undefined);
}
