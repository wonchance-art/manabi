// 「그림 한 장 읽기」 큐레이션 책 판별(ART-P0-3) — 의존성 없는 작은 모듈.
// 뷰어·재분석 보존(클라이언트 번들)은 이 파일만 가져온다. artBook.js는 작품 카탈로그 JSON 전체를 끌어오므로
// 정보 카드 대조가 필요할 때(useArtBookChapter)만 동적 import로 늦게 불러온다.

export const ART_BOOK_PROVIDER = 'art';

/** 큐레이션 책 자료인가(동기 — metadata만 본다). 원문 수정 차단 판정에 쓴다. */
export function isArtBookMaterial(material) {
  return material?.processed_json?.metadata?.literature?.provider === ART_BOOK_PROVIDER;
}
