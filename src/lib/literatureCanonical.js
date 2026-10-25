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
// 화면 표지 · 제목(literatureWork · literatureWorkOfBook · literatureDisplayTitle)은 표시용 대조표만 읽는 literatureWorks로 옮겼다
// (LIT-DISPLAY-001 — 홈 번들에 전체 대조표가 실리지 않게). 여기서는 다시 내보내기만 한다 — 화면 파일은 literatureWorks를 직접 import한다.
import manifest from '../content/literature/aozora/manifest.generated.json';
import { canonicalChapterOf } from './literatureDisplay';

export { literatureDisplayTitle, literatureWork, literatureWorkOfBook } from './literatureWorks';

// 원문 수정 차단 판정 · 문구는 대조표가 필요 없어 literatureCanonicalProvider로 옮겼다(ROUTE-AUDIT-2 F5 — 수업 · 노트 첫 JS에 이 파일의 대조표가 실리지 않게).
// 여기서는 다시 내보내기만 한다.
export { CANONICAL_LITERATURE_EDIT_BLOCKED, CANONICAL_LITERATURE_PROVIDERS, isCanonicalLiteratureMaterial } from './literatureCanonicalProvider';

/** 자료 metadata.book → 정본 대조표(전체 — 장 원문 해시 · 크레딧)의 {work, chapter}. 표에 없는 작품·장이면 null. */
export function canonicalLiteratureChapter(metadata, works = manifest.works) {
  return canonicalChapterOf(metadata, 'aozora', works);
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
