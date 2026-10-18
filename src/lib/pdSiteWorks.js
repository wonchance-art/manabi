// 퍼블릭 도메인 전자책 사이트 정본 책 표지 · 제목 찾기 — 화면용 가벼운 모듈(LIT-DISPLAY-001, standardEbooksWorks와 같은 원리).
// 표시용 대조표(manifest.display.generated.json — 해시 · 크레딧 없음)만 읽는다. 출처 줄 크레딧 · 원문 대조는 pdSiteCanonical(전체 대조표).
import display from '../content/literature/pdsite/manifest.display.generated.json';
import { canonicalWorkOf } from './literatureDisplay';
import { PD_PROVIDER } from './pdSite';

/** 책 key → 대조표의 작품(표지 · 카드 표기). 없으면 null. */
export function pdSiteWork(key, works = display.works) {
  return canonicalWorkOf(key, works);
}

/** 책 묶음(groupByBook) → 작품 — 첫 장이 이 출처의 정본 자료이고 key가 대조표에 있을 때만. */
export function pdSiteWorkOfBook(book, works = display.works) {
  const metadata = book?.chapters?.[0]?.processed_json?.metadata;
  return metadata?.literature?.provider === PD_PROVIDER ? pdSiteWork(book.key, works) : null;
}
