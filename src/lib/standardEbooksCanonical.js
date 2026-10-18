// Standard Ebooks 정본 책 대조(LIT-SRC-EN-1) — 뷰어 출처 줄용. 아오조라(literatureCanonical.verifiedCanonicalLiterature)와 같은 원리:
// 크레딧은 자료 metadata가 아니라 리포 정본 대조표(manifest.generated.json)에서 읽고, 자료 raw_text의 SHA-256이 그 장의 정본 해시와
// 같을 때만 돌려준다. 남이 자기 공개 자료에 provider 'standardebooks' metadata를 꾸며 넣어도 가짜 크레딧이 보이지 않는다.
// 화면 표지 · 제목(standardEbooksWork · standardEbooksWorkOfBook)은 표시용 대조표만 읽는 standardEbooksWorks로 옮겼다(LIT-DISPLAY-001).
// 여기서는 다시 내보내기만 한다 — 화면 파일은 standardEbooksWorks를 직접 import한다.
import manifest from '../content/literature/standardebooks/manifest.generated.json';
import { sha256Hex } from './literatureCanonical';
import { canonicalChapterOf } from './literatureDisplay';
import { SE_PROVIDER } from './standardEbooks';

export { standardEbooksWork, standardEbooksWorkOfBook } from './standardEbooksWorks';

/** 자료 metadata.book → 대조표(전체 — 장 원문 해시 · 크레딧)의 {work, chapter}. Standard Ebooks 장이 아니거나 표에 없으면 null. */
export function standardEbooksChapter(metadata, works = manifest.works) {
  return canonicalChapterOf(metadata, SE_PROVIDER, works);
}

/** 출처 줄 크레딧 — 원문이 정본 장과 같을 때만 대조표의 literature. 아니면 null. */
export async function verifiedStandardEbooksLiterature(material, works = manifest.works) {
  const found = standardEbooksChapter(material?.processed_json?.metadata, works);
  if (!found || typeof material?.raw_text !== 'string') return null;
  try {
    return (await sha256Hex(material.raw_text)) === found.chapter.sha256 ? found.work.literature : null;
  } catch {
    return null;
  }
}
