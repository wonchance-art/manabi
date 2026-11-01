/**
 * 배움(홈) 첫 화면 데이터의 react-query 키 앞머리 — 화면(HomePage)과 무효화하는 곳(채점 · 아는 표시 · 제외 · 읽던 위치 ·
 * 프로필 저장)이 같은 이름을 쓰게 한 곳에 둔다. 키를 'home-v3'으로 올릴 때 무효화 목록 넷이 'home-v2'에 남아,
 * 복습 · 아는 표시 뒤 홈의 「N개 대기」 · 오늘 목표가 최대 60초 낡아 보였다(STATS-MAP-001, 계약 queryKeyConsumers.test.js).
 * import가 없는 작은 모듈이다 — 뷰어(useScrollRestore)도 불러오므로 무거운 모듈을 끌어오지 않는다.
 */
export const HOME_DATA_KEY = 'home-v3';
