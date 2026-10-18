// 위키문헌 정본 책 표지 · 제목 찾기 — 화면용 가벼운 모듈(LIT-DISPLAY-001, Standard Ebooks standardEbooksWorks와 같은 원리).
// 표시용 대조표(manifest.display.generated.json — 전체 대조표에서 빌드가 파생, 해시 · 크레딧 없음)만 읽는다. 서재 책 카드가 import한다.
// 출처 줄 크레딧 · 원문 대조 · 간체/번체(verifiedWikisourceLiterature · verifiedScriptVariant)는 wikisourceCanonical(전체 대조표).
import display from '../content/literature/wikisource/manifest.display.generated.json';
import { canonicalWorkOf } from './literatureDisplay';
import { WS_PROVIDER } from './wikisource';

/** 책 key → 대조표의 작품(표지 · 카드 표기). 없으면 null. */
export function wikisourceWork(key, works = display.works) {
  return canonicalWorkOf(key, works);
}

/** 책 묶음(groupByBook) → 작품 — 첫 장이 위키문헌 정본 자료이고 key가 대조표에 있을 때만(아니면 일반 책 카드 그대로). */
export function wikisourceWorkOfBook(book, works = display.works) {
  const metadata = book?.chapters?.[0]?.processed_json?.metadata;
  return metadata?.literature?.provider === WS_PROVIDER ? wikisourceWork(book.key, works) : null;
}
