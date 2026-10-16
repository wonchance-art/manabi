// 영어 정본 책 표지 — 「빅토리아 천 장정」 시리즈(LIT-SRC-EN-1, 오너 「그럼 B로」 2026-10-16 KST).
//
// 1840–1890년대 영국 출판사 천 장정(publisher's cloth)의 관례를 빌린다: 천 바탕 · 테두리(금박 삼중 줄 | 민압 blind) · 금박 제목 ·
// 가운데 금박(또는 금박+먹) 장식. 천 색·찍는 방식·테두리는 그 작품 초판 장정의 기록을 따른다(고증 — 아래 표, 근거는
// docs/literature-pipeline.md §8.4). 초판의 특정 그림(앨리스와 돼지·체셔 고양이, Newnes 거리 표지판, Dickens의 화환 도안)은
// 옮기지 않는다(IP 정책 §2.1 금지⑴) — 문양은 작품 속 물건에서 새로 고르고 사람 몸은 그리지 않는다(시리즈 A와 같은 원칙).
// 색·문양·테두리 키의 정본은 이 파일 — 빌드(standard-ebooks-build)가 entry.json display를 이것으로 검사한다.

/** 천 — cloth(바탕) · deep(민압·그림자) · soft(같은 색 계열 판) · 초판 근거. 일본 책(시리즈 A) 천 색과도 CIELAB 색차 12 이상(victorianCover.test). */
export const VICTORIAN_CLOTHS = Object.freeze({
  // Macmillan 1865/66 「Alice」 — red cloth, gilt
  'madder-red': Object.freeze({ cloth: '#9b1b25', deep: '#520a10', soft: '#b23c42', note: 'Macmillan 1865/66 red cloth' }),
  // Newnes 1892 「The Adventures of Sherlock Holmes」 — light blue cloth, gilt and black
  'pale-blue': Object.freeze({ cloth: '#7f9fb8', deep: '#3f5d75', soft: '#9ab5c9', note: 'Newnes 1892 light blue cloth' }),
  // Chapman & Hall 1843 「A Christmas Carol」 — cinnamon ribbed cloth, blind-stamped border, gilt
  cinnamon: Object.freeze({ cloth: '#93552b', deep: '#57290f', soft: '#ab6f47', note: 'Chapman & Hall 1843 cinnamon cloth' }),
});

/** 테두리 — 금박 삼중 줄(Alice) · 민압 이중 줄(Carol) · 먹 이중 줄(Newnes 금박+먹). */
export const VICTORIAN_BORDERS = Object.freeze(['triple-gilt', 'blind', 'black']);
/** 찍는 방식 — 금박만 · 금박+먹(먹 판 위 금박 글자). */
export const VICTORIAN_STAMPINGS = Object.freeze(['gilt', 'gilt-black']);
/** 장식 — 작품 속 물건(사람 몸 없음). */
export const VICTORIAN_MOTIFS = Object.freeze(['pocket-watch', 'magnifier', 'holly-candle']);

const COVER_LINE_MAX = 12;

/**
 * entry.json display → 표지 표기(throw 하면 빌드 실패). coverTitle은 서재용 짧은 제목 — 한두 줄(\n), 줄마다 12자 이하.
 * @returns {{titleKo, authorKo, coverTitle, cloth, border, stamping, motif}}
 */
export function validateVictorianDisplay(display) {
  const problems = [];
  if (!display || typeof display !== 'object') throw new Error('display가 필요하다(표지 표기)');
  for (const field of ['titleKo', 'authorKo', 'coverTitle']) if (typeof display[field] !== 'string' || !display[field].trim()) problems.push(field);
  const lines = String(display.coverTitle || '').split('\n');
  if (lines.length > 2 || lines.some((line) => !line.trim() || line.length > COVER_LINE_MAX)) problems.push(`coverTitle(한두 줄, 줄마다 ${COVER_LINE_MAX}자 이하)`);
  if (!Object.hasOwn(VICTORIAN_CLOTHS, display.cloth)) problems.push(`cloth(${Object.keys(VICTORIAN_CLOTHS).join('·')})`);
  if (!VICTORIAN_BORDERS.includes(display.border)) problems.push(`border(${VICTORIAN_BORDERS.join('·')})`);
  if (!VICTORIAN_STAMPINGS.includes(display.stamping)) problems.push(`stamping(${VICTORIAN_STAMPINGS.join('·')})`);
  if (!VICTORIAN_MOTIFS.includes(display.motif)) problems.push(`motif(${VICTORIAN_MOTIFS.join('·')})`);
  if (problems.length) throw new Error(`display: ${problems.join(' · ')}`);
  const { titleKo, authorKo, coverTitle, cloth, border, stamping, motif } = display;
  return { titleKo, authorKo, coverTitle, cloth, border, stamping, motif };
}
