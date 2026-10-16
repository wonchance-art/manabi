// 정본 문학책(아오조라) 판정·대조 — 뷰어·재분석 공용(AOZORA-P0-2).
//
// 정본 장은 공개 reading_materials 행이고, 그 행의 소유자는 processed_json을 자유롭게 쓸 수 있다(RLS는 소유자 쓰기).
// 그래서 두 가지를 자료 metadata가 아니라 리포 정본에 묶는다:
//   ① 출처 줄 — 빌드 산출물 manifest.generated.json의 크레딧으로 그리고, 자료 raw_text의 SHA-256이 그 장의 정본 해시와
//      같을 때만 그린다. 남이 자기 공개 자료에 아오조라 metadata를 꾸며 넣어도 가짜 크레딧(「원작 퍼블릭 도메인」 포함)이
//      보이지 않는다. 원문이 정본과 똑같다면 그 크레딧은 사실이므로 그려도 된다.
//   ② 원문 수정 차단 — 저자 루비 잠금은 정본 raw_text 기준 문자 위치다. 원문을 고치면 위치가 낡아 잠금이 통째로 꺼지고
//      (applyMaterialRubyLocks fail-closed) 출처 대조도 깨진다. metadata.literature.provider가 'aozora'인 자료는
//      원문 수정(rawTextOverride)을 받지 않는다 — 분석·재분석·단어 교정은 그대로 된다.
import manifest from '../content/literature/aozora/manifest.generated.json';
import { literatureChapterTitle } from './literatureDisplay';

export const CANONICAL_LITERATURE_EDIT_BLOCKED = '정본 책의 원문은 고칠 수 없어요. 단어 뜻·발음 교정과 다시 분석은 그대로 쓸 수 있어요.';

/** 원문 수정을 막는 정본 문학책 출처 — 青空文庫 · Standard Ebooks(LIT-SRC-EN-1). 큐레이션 책('art')은 artBookProvider가 따로 막는다. */
export const CANONICAL_LITERATURE_PROVIDERS = Object.freeze(['aozora', 'standardebooks']);

/** 정본 문학책 자료인가(원문 수정 차단 판정) — metadata만 본다(동기). */
export function isCanonicalLiteratureMaterial(material) {
  return CANONICAL_LITERATURE_PROVIDERS.includes(material?.processed_json?.metadata?.literature?.provider);
}

/** 책 key → 정본 대조표의 작품(표지·목차 표기 — literatureDisplay). 정본이 아니면 null. */
export function literatureWork(key, works = manifest.works) {
  return typeof key === 'string' && Object.hasOwn(works, key) ? works[key] : null;
}

/** 책 묶음(groupByBook) → 정본 작품. 첫 장이 아오조라 정본 자료이고 key가 대조표에 있을 때만(아니면 null — 일반 책 표기 그대로). */
export function literatureWorkOfBook(book, works = manifest.works) {
  const metadata = book?.chapters?.[0]?.processed_json?.metadata;
  return metadata?.literature?.provider === 'aozora' ? literatureWork(book.key, works) : null;
}

/** 자료 metadata.book → 정본 대조표의 {work, chapter}. 표에 없는 작품·장이면 null. */
export function canonicalLiteratureChapter(metadata, works = manifest.works) {
  if (metadata?.literature?.provider !== 'aozora') return null;
  const key = metadata?.book?.key;
  const order = Number(metadata?.book?.order);
  const work = typeof key === 'string' && Object.hasOwn(works, key) ? works[key] : null;
  const chapter = work?.chapters.find((item) => item.order === order) || null;
  return work && chapter ? { work, chapter } : null;
}

/**
 * 저장된 자료 제목 대신 보일 정본 장 제목(「鼻 (1/2)」 · 「ごん狐 — 一」 · 「手袋を買いに」). 정본 장이 아니면 저장된 제목 그대로.
 * 예전 표기(「鼻 — 1편」)로 서재에 옮겨 둔 사본도 다시 받지 않고 표를 따르게 한다 — 책 카드(literatureWorkOfBook)와 같은
 * metadata 판정이다(제목 표기만 바꾸므로 원문 해시 대조는 하지 않는다 — 크레딧은 verifiedCanonicalLiterature 몫).
 */
export function literatureDisplayTitle(metadata, storedTitle, works = manifest.works) {
  const found = canonicalLiteratureChapter(metadata, works);
  return found ? literatureChapterTitle(found.work, found.chapter.order) : storedTitle;
}

export async function sha256Hex(text) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 출처 줄에 쓸 정본 크레딧 — 자료 원문이 정본 장과 바이트 단위로 같을 때만 대조표의 literature를 돌려준다. 아니면 null.
 * @returns {Promise<object|null>}
 */
export async function verifiedCanonicalLiterature(material, works = manifest.works) {
  const found = canonicalLiteratureChapter(material?.processed_json?.metadata, works);
  if (!found || typeof material?.raw_text !== 'string') return null;
  try {
    return (await sha256Hex(material.raw_text)) === found.chapter.sha256 ? found.work.literature : null;
  } catch {
    return null; // 해시를 못 내는 환경 — 확인 못 한 크레딧은 그리지 않는다
  }
}
