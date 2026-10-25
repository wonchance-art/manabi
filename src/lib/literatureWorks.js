// 정본 문학책(아오조라) 표지 · 제목 찾기 — 화면용 가벼운 모듈(LIT-DISPLAY-001).
//
// 표시용 대조표(manifest.display.generated.json — 전체 대조표에서 빌드가 파생)만 읽는다: 장 원문 해시 · 출처 크레딧 · 장 첫 문장이 없다.
// 홈(이어 읽기 제목)과 서재(책 카드 표지)는 이 모듈을 import한다 — 전체 대조표(165KB)를 화면 번들에 싣지 않는다.
// 판정은 전과 같다: 자료 metadata의 아오조라 표식 + 책 key(+ 장 순서)가 표에 있을 때만 정본 표기, 아니면 저장된 표기 그대로.
// 출처 줄 크레딧 · 원문 대조(verifiedCanonicalLiterature)는 이 모듈이 하지 않는다 — literatureCanonical(전체 대조표).
import display from '../content/literature/aozora/manifest.display.generated.json';
import { canonicalChapterOf, canonicalWorkOf, literatureChapterTitle } from './literatureDisplay';

/** 책 key → 정본 작품(표지 · 목차 표기 — literatureDisplay). 정본이 아니면 null. */
export function literatureWork(key, works = display.works) {
  return canonicalWorkOf(key, works);
}

/** 책 묶음(groupByBook) → 정본 작품. 첫 장이 아오조라 정본 자료이고 key가 대조표에 있을 때만(아니면 null — 일반 책 표기 그대로). */
export function literatureWorkOfBook(book, works = display.works) {
  const metadata = book?.chapters?.[0]?.processed_json?.metadata;
  return metadata?.literature?.provider === 'aozora' ? literatureWork(book.key, works) : null;
}

/**
 * 저장된 자료 제목 대신 보일 정본 장 제목(「鼻 (1/2)」 · 「ごん狐 — 一」 · 「手袋を買いに」). 정본 장이 아니면 저장된 제목 그대로.
 * 예전 표기(「鼻 — 1편」)로 서재에 옮겨 둔 사본도 다시 받지 않고 표를 따르게 한다 — 책 카드(literatureWorkOfBook)와 같은
 * metadata 판정이다(제목 표기만 바꾸므로 원문 해시 대조는 하지 않는다 — 크레딧은 verifiedCanonicalLiterature 몫).
 */
export function literatureDisplayTitle(metadata, storedTitle, works = display.works) {
  const found = canonicalChapterOf(metadata, 'aozora', works);
  return found ? literatureChapterTitle(found.work, found.chapter.order) : storedTitle;
}
