// 여행 매거진 칸의 행선지(DISCOVER-CLASSICS-001) — 매거진 세션이 첫 호를 낼 때 건다. null이면 산책에 매거진 칸을 그리지 않는다(발매 점검 M3).
// 작은 모듈로 둔 까닭: 산책 대기 화면(discover/loading.jsx)도 같은 값을 보는데, DiscoverTiles를 import하면 표지 글꼴 모듈까지 대기 화면에 실린다.
export const MAGAZINE_HREF = null;
