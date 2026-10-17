// 화면 표시용 정본 대조표(LIT-DISPLAY-001) — 전체 대조표(manifest.generated.json)에서 파생한다. 손으로 고치지 않는다.
//
// 전체 대조표는 장마다 원문 SHA-256 · 출처 크레딧(권리 · 판권) · 장 첫 문장을 싣는다(아오조라 34편 · 621장 = 165KB). 홈은 정본 장
// 제목 한 줄(literatureDisplayTitle) 때문에 그 전체를 실었다(운영 청크 64KB 전송, 2026-10-17 KST 실측). 화면이 표지 · 제목 · 카드 메타를
// 그리는 데는 아래 필드만 쓴다 — 그것만 따로 내고, 해시 대조(뷰어 출처 줄 · 게시 검증)는 계속 전체 대조표를 쓴다.
//   display   작품: 제목 · 작가 · 레벨 · 장 수 · 나눈 방식 · 분량 · 표지 표기 · 발표 연도 / 장: 순서 · 이름
//   incipits  장 첫 문장(서재 책 카드 목차 줄)만 — 아오조라. 홈은 쓰지 않아서 따로 둔다(장 첫 문장만 40KB).

/** 표시용 작품 필드 — 이 목록 밖은 싣지 않는다(전체 대조표에 새 필드가 생겨도 홈 번들로 새지 않게). */
export const DISPLAY_WORK_FIELDS = Object.freeze(['title', 'author', 'level', 'total', 'division', 'chars', 'words', 'display', 'language', 'size', 'unit']); // language · size · unit — 위키문헌 · 전자책 사이트(서재 카드 lang · 분량)
/** 표시용 장 필드. */
export const DISPLAY_CHAPTER_FIELDS = Object.freeze(['order', 'title']);

const pick = (source, fields) => Object.fromEntries(fields.filter((field) => Object.hasOwn(source, field)).map((field) => [field, source[field]]));

/** 전체 대조표 → 표시용 대조표. 크레딧은 발표 연도(카드 메타)만 남긴다. */
export function createDisplayManifest(manifest) {
  const works = {};
  for (const [key, work] of Object.entries(manifest.works)) {
    works[key] = {
      ...pick(work, DISPLAY_WORK_FIELDS),
      ...(work.literature && Object.hasOwn(work.literature, 'publishedYear') ? { literature: { publishedYear: work.literature.publishedYear } } : {}),
      chapters: work.chapters.map((chapter) => pick(chapter, DISPLAY_CHAPTER_FIELDS)),
    };
  }
  return { schemaVersion: manifest.schemaVersion, works };
}

/** 전체 대조표 → 장 첫 문장 표(작품 key → 장 순서 → 첫 문장). 첫 문장이 없는 장은 싣지 않는다. */
export function createIncipitManifest(manifest) {
  const works = {};
  for (const [key, work] of Object.entries(manifest.works)) {
    works[key] = Object.fromEntries(work.chapters.filter((chapter) => typeof chapter.incipit === 'string').map((chapter) => [String(chapter.order), chapter.incipit]));
  }
  return { schemaVersion: manifest.schemaVersion, works };
}
