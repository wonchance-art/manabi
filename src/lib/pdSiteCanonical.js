// 퍼블릭 도메인 전자책 사이트 정본 책 대조(LIT-SRC-PD-1) — 뷰어 출처 줄 · 서재 카드용. 위키문헌(wikisourceCanonical)과 같은 원리:
// 크레딧은 자료 metadata가 아니라 리포 정본 대조표(manifest.generated.json)에서 읽고, 자료 raw_text의 SHA-256이 그 장의 정본 해시와
// 같을 때만 돌려준다.
import manifest from '../content/literature/pdsite/manifest.generated.json';
import { sha256Hex } from './literatureCanonical';
import { PD_PROVIDER } from './pdSite';

/** 자료 metadata.book → 대조표의 {work, chapter}. 이 출처의 장이 아니거나 표에 없으면 null. */
export function pdSiteChapter(metadata, works = manifest.works) {
  if (metadata?.literature?.provider !== PD_PROVIDER) return null;
  const key = metadata?.book?.key;
  const order = Number(metadata?.book?.order);
  const work = typeof key === 'string' && Object.hasOwn(works, key) ? works[key] : null;
  const chapter = work?.chapters.find((item) => item.order === order) || null;
  return work && chapter ? { work, chapter } : null;
}

/** 책 key → 대조표의 작품(표지·카드 표기). 없으면 null. */
export function pdSiteWork(key, works = manifest.works) {
  return typeof key === 'string' && Object.hasOwn(works, key) ? works[key] : null;
}

/** 책 묶음(groupByBook) → 작품 — 첫 장이 이 출처의 정본 자료이고 key가 대조표에 있을 때만. */
export function pdSiteWorkOfBook(book, works = manifest.works) {
  const metadata = book?.chapters?.[0]?.processed_json?.metadata;
  return metadata?.literature?.provider === PD_PROVIDER ? pdSiteWork(book.key, works) : null;
}

/** 출처 줄 크레딧 — 원문이 정본 장과 같을 때만 대조표의 literature. 아니면 null. */
export async function verifiedPdSiteLiterature(material, works = manifest.works) {
  const found = pdSiteChapter(material?.processed_json?.metadata, works);
  if (!found || typeof material?.raw_text !== 'string') return null;
  try {
    return (await sha256Hex(material.raw_text)) === found.chapter.sha256 ? found.work.literature : null;
  } catch {
    return null;
  }
}
