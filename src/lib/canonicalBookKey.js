// 정본 책 key 판정 — 이어 적기 · 과 추가 · 과 번호 수정을 막는 쪽으로만 쓴다(fail closed). 대조표를 import하지 않는 가벼운 모듈이다.
// 정본 key는 생성기가 접두사로 만든다(아오조라 aozora- · Standard Ebooks se- · 위키문헌 ws- · 전자책 사이트 pd- · 그림 한 장 읽기 art- = artBookKey).
// 사용자 책 key는 makeBookKey()의 bk_라 겹치지 않는다. 정본 책에 장을 더하거나 순서를 바꾸면 정본 게시가
// unknown-order · text-differs 충돌(409)로 막힌다(리뷰 2026-10-17 KST). 접두사와 대조표 · 생성기의 일치는 canonicalBookKey.test.js가 지킨다.
export const CANONICAL_BOOK_KEY_PREFIXES = Object.freeze(['aozora-', 'se-', 'ws-', 'pd-', 'art-']);

export const isCanonicalBookKey = (key) => typeof key === 'string' && CANONICAL_BOOK_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
