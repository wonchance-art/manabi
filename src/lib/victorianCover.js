// 영어 정본 책 표지 — 「빅토리아 천 장정」 시리즈(LIT-SRC-EN-1, 오너 「그럼 B로」 → 「실물에 가깝게」 2026-10-16 KST).
//
// 작품마다 그 초판 출판사 천 장정(publisher's cloth)의 앞표지 구성을 다시 그린다 — 천 색, 테두리, 금박·먹·민압의 자리,
// 글자 자리(제목·작가가 앞표지에 있는지까지)를 실물 사진·서지 기록과 맞춘다(근거는 docs/literature-pipeline.md §8.4).
// 세 장정 모두 퍼블릭 도메인이라 구조·화풍을 반영할 수 있지만(IP 정책 §2.1 「퍼블릭 도메인 표지는 예외」), 원본을 옮겨 붙이지 않고
// 코드 SVG로 새로 그린다. 사람 몸은 그리지 않고(시리즈 A와 같은 원칙 — Alice 표지의 앨리스는 빼고 돼지만), 상표·총서 표지는
// 그리지 않는다(Newnes 거리 그림 위 간판의 총서 이름 「The Strand Library」는 비운다).
// 키의 정본은 이 파일 — 빌드(standard-ebooks-build)가 entry.json display를 이것으로 검사한다.

/** 천 — cloth(바탕) · deep(민압 자국·글자 테) · 근거. 색은 실물 사진에서 잰 값(빛바램 보정 없음)을 바탕으로, 일본 책(시리즈 A) 천 색과
 * CIELAB 색차 12 이상(victorianCover.test). */
export const VICTORIAN_CLOTHS = Object.freeze({
  // Macmillan 1866 「Alice」 — red cloth(Carroll이 고른 빨강)
  'madder-red': Object.freeze({ cloth: '#9b1b25', deep: '#520a10', note: 'Macmillan 1866 red cloth' }),
  // Newnes 1892 「The Adventures of Sherlock Holmes」 — 서지 기록은 light blue, 실물은 청록에 가까운 연파랑(사진 실측 #5a999e)
  'pale-blue': Object.freeze({ cloth: '#5a999e', deep: '#1f4448', note: 'Newnes 1892 light blue cloth' }),
  // Chapman & Hall 1843 「A Christmas Carol」 — cinnamon vertically-ribbed cloth
  cinnamon: Object.freeze({ cloth: '#93552b', deep: '#57290f', note: 'Chapman & Hall 1843 cinnamon ribbed cloth' }),
});

/** 장정 구성 — 앞표지에 무엇이 어디 있는가. title/author: 앞표지에 그 글자가 있는가(실물대로). */
export const VICTORIAN_BINDINGS = Object.freeze({
  // Macmillan 1866: 금박 삼중 줄 테두리 + 가운데 작은 금박 원형 그림(앨리스와 돼지). 앞표지에 글자 없음 — 제목은 책등에만.
  medallion: Object.freeze({ title: false, author: false, note: 'Macmillan 1866 — triple gilt rules, central gilt medallion, no lettering on the front' }),
  // Newnes 1892: 테두리 없음 · 위에 금박 제목 · 오른쪽 아래 먹 테 거리 그림(「The Strand Library」 간판 — 여기서는 비움) · 아래 금박 작가, 경사진 판.
  pictorial: Object.freeze({ title: true, author: true, note: 'Newnes 1892 — gilt title, black-framed street vignette, gilt author, bevelled boards' }),
  // Chapman & Hall 1843: 민압 호랑가시·담쟁이 테두리 + 가운데 금박 호랑가시 화환(아래 리본) 안에 제목·작가.
  wreath: Object.freeze({ title: true, author: true, note: 'Chapman & Hall 1843 — blind holly-and-ivy border, title and author within a gilt holly wreath' }),
});

const LINE_MAX = 12;
const KICKER_MAX = 18;
const AUTHOR_MAX = 18;

/**
 * entry.json display → 표지 표기(throw 하면 빌드 실패).
 * coverTitle: 표지 큰 글자(한두 줄, 줄마다 12자 이하) · coverKicker: 그 위 작은 글자(「The Adventures of」 「A」 — 있을 때만) ·
 * coverAuthor: 앞표지 작가(실물에 있을 때만 — 장정 구성의 author와 맞아야 한다). 글자가 없는 장정(medallion)도 coverTitle은 둔다(서재 정본 제목 줄).
 * @returns {{titleKo, authorKo, coverTitle, coverKicker?, coverAuthor?, cloth, binding}}
 */
export function validateVictorianDisplay(display) {
  const problems = [];
  if (!display || typeof display !== 'object') throw new Error('display가 필요하다(표지 표기)');
  for (const field of ['titleKo', 'authorKo', 'coverTitle']) if (typeof display[field] !== 'string' || !display[field].trim()) problems.push(field);
  const lines = String(display.coverTitle || '').split('\n');
  if (lines.length > 2 || lines.some((line) => !line.trim() || line.length > LINE_MAX)) problems.push(`coverTitle(한두 줄, 줄마다 ${LINE_MAX}자 이하)`);
  if (display.coverKicker !== undefined && (typeof display.coverKicker !== 'string' || !display.coverKicker.trim() || display.coverKicker.length > KICKER_MAX || display.coverKicker.includes('\n'))) problems.push(`coverKicker(한 줄, ${KICKER_MAX}자 이하)`);
  if (!Object.hasOwn(VICTORIAN_CLOTHS, display.cloth)) problems.push(`cloth(${Object.keys(VICTORIAN_CLOTHS).join('·')})`);
  const binding = Object.hasOwn(VICTORIAN_BINDINGS, display.binding) ? VICTORIAN_BINDINGS[display.binding] : null;
  if (!binding) problems.push(`binding(${Object.keys(VICTORIAN_BINDINGS).join('·')})`);
  const hasAuthor = display.coverAuthor !== undefined;
  if (hasAuthor && (typeof display.coverAuthor !== 'string' || !display.coverAuthor.trim() || display.coverAuthor.length > AUTHOR_MAX)) problems.push(`coverAuthor(${AUTHOR_MAX}자 이하)`);
  if (binding && binding.author !== hasAuthor) problems.push(binding.author ? 'coverAuthor(이 장정은 앞표지에 작가가 있다)' : 'coverAuthor(이 장정은 앞표지에 작가가 없다)');
  if (binding && !binding.title && display.coverKicker !== undefined) problems.push('coverKicker(이 장정은 앞표지에 글자가 없다)');
  if (problems.length) throw new Error(`display: ${problems.join(' · ')}`);
  const { titleKo, authorKo, coverTitle, coverKicker, coverAuthor, cloth } = display;
  return { titleKo, authorKo, coverTitle, ...(coverKicker ? { coverKicker } : {}), ...(coverAuthor ? { coverAuthor } : {}), cloth, binding: display.binding };
}
