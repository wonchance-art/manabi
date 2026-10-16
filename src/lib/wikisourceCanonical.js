// Wikisource 정본 책 대조(LIT-SRC-WS-1) — 뷰어 출처 줄 · 서재 카드용. Standard Ebooks(standardEbooksCanonical)와 같은 원리:
// 크레딧은 자료 metadata가 아니라 리포 정본 대조표(manifest.generated.json)에서 읽고, 자료 raw_text의 SHA-256이 그 장의 정본 해시와
// 같을 때만 돌려준다. 남이 자기 공개 자료에 provider 'wikisource' metadata를 꾸며 넣어도 가짜 크레딧이 보이지 않는다.
import manifest from '../content/literature/wikisource/manifest.generated.json';
import { sha256Hex } from './literatureCanonical';
import { WS_PROVIDER, WS_SCRIPT } from './wikisource';

/** 자료 metadata.book → 대조표의 {work, chapter}. Wikisource 장이 아니거나 표에 없으면 null. */
export function wikisourceChapter(metadata, works = manifest.works) {
  if (metadata?.literature?.provider !== WS_PROVIDER) return null;
  const key = metadata?.book?.key;
  const order = Number(metadata?.book?.order);
  const work = typeof key === 'string' && Object.hasOwn(works, key) ? works[key] : null;
  const chapter = work?.chapters.find((item) => item.order === order) || null;
  return work && chapter ? { work, chapter } : null;
}

/** 책 key → 대조표의 작품(표지·카드 표기). 없으면 null. */
export function wikisourceWork(key, works = manifest.works) {
  return typeof key === 'string' && Object.hasOwn(works, key) ? works[key] : null;
}

/** 책 묶음(groupByBook) → 작품 — 첫 장이 Wikisource 정본 자료이고 key가 대조표에 있을 때만(아니면 일반 책 카드 그대로). */
export function wikisourceWorkOfBook(book, works = manifest.works) {
  const metadata = book?.chapters?.[0]?.processed_json?.metadata;
  return metadata?.literature?.provider === WS_PROVIDER ? wikisourceWork(book.key, works) : null;
}

/** 출처 줄 크레딧 — 원문이 정본 장과 같을 때만 대조표의 literature. 아니면 null. */
export async function verifiedWikisourceLiterature(material, works = manifest.works) {
  const found = wikisourceChapter(material?.processed_json?.metadata, works);
  if (!found || typeof material?.raw_text !== 'string') return null;
  try {
    return (await sha256Hex(material.raw_text)) === found.chapter.sha256 ? found.work.literature : null;
  } catch {
    return null;
  }
}

/**
 * 번체로 읽기(LIT-SRC-WS-1) — 자료 metadata.scriptVariants[variant]가 정본 대조표의 그 장 해시와 같고, 원문도 정본과 같을 때만
 * 그 글자를 돌려준다. 아니면 null(간체로만 보인다 — 남의 자료에 꾸며 넣은 「번체」가 보이지 않는다).
 */
export async function verifiedScriptVariant(material, variant = WS_SCRIPT.alternate, works = manifest.works) {
  const found = wikisourceChapter(material?.processed_json?.metadata, works);
  const text = material?.processed_json?.metadata?.scriptVariants?.[variant];
  const expected = found?.chapter.variants?.[variant];
  if (!found || !expected || typeof text !== 'string' || typeof material?.raw_text !== 'string' || text.length !== material.raw_text.length) return null;
  try {
    const [raw, alternate] = await Promise.all([sha256Hex(material.raw_text), sha256Hex(text)]);
    return raw === found.chapter.sha256 && alternate === expected ? text : null;
  } catch {
    return null;
  }
}
