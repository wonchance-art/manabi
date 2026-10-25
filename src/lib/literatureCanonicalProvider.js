// 정본 문학책 판정 중 대조표가 필요 없는 부분 — metadata만 본다(동기 · 의존성 0).
// literatureCanonical.js는 장 원문 해시 · 크레딧 대조표(manifest.generated.json, 228 kB 원문 · gz 67 kB)를 import한다. 원문 수정 차단 판정만
// 쓰는 재분석 보존(reanalysisPreservation) → 수업 모델(classroomModel)을 거쳐 /class · /class/* · /notes/[id] 첫 JS에 그 표가 통째로 실렸다
// (ROUTE-AUDIT-2 F5, 2026-10-25 KST). 판정 · 문구는 여기 한 곳에 두고 literatureCanonical이 그대로 다시 내보낸다(호출부 API 무변화).
export const CANONICAL_LITERATURE_EDIT_BLOCKED = '정본 책의 원문은 고칠 수 없어요. 단어 뜻·발음 교정과 다시 분석은 그대로 쓸 수 있어요.';

/** 원문 수정을 막는 정본 문학책 출처 — 青空文庫 · Standard Ebooks(LIT-SRC-EN-1) · Wikisource(LIT-SRC-WS-1) · 전자책 사이트(LIT-SRC-PD-1). 큐레이션 책('art')은 artBookProvider가 따로 막는다. */
export const CANONICAL_LITERATURE_PROVIDERS = Object.freeze(['aozora', 'standardebooks', 'wikisource', 'pdsite']);

/** 정본 문학책 자료인가(원문 수정 차단 판정) — metadata만 본다(동기). */
export function isCanonicalLiteratureMaterial(material) {
  return CANONICAL_LITERATURE_PROVIDERS.includes(material?.processed_json?.metadata?.literature?.provider);
}
