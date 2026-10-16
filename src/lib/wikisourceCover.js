// 중국어·프랑스어 정본 책 표지 — 「초판 장정」 시리즈(LIT-SRC-WS-1, 오너 「권장대로」 2026-10-17 KST — 시안 아티팩트 18rS1ovq5NURKm1vSzsYTU).
//
// 영어 책(victorianCover)과 같은 원칙: 작품마다 그 초판(또는 같은 판 표제지)의 앞표지 구성을 다시 그린다 — 바탕 색·테·글자 자리·글자 방향까지
// 실물 사진·서지 기록과 맞춘다(근거는 docs/literature-pipeline.md §8.5). 퍼블릭 도메인 장정이라 구조를 반영하되 원본을 옮겨 붙이지 않고
// 코드 SVG로 새로 그린다. 사람 몸은 그리지 않고(『La Parure』 표지의 날개 단 여인 → 작품의 다이아몬드 목걸이), 출판사 도안·모노그램은
// 그리지 않는다(Lemerre 도안 → 덩굴 · Hetzel JV·JH 모노그램 → 별).
// 키의 정본은 이 파일 — 빌드(wikisource-build)가 entry.json display를 이것으로 검사한다.

/** 표지 글자 칸 — 칸마다 최대 글자 수, lines: 줄 수(없으면 한 줄). 장정마다 이 중 무엇을 쓰는지(required·optional)를 정한다. */
const FIELDS = Object.freeze({
  coverTitle: { max: 16, lines: 4 },
  coverAuthor: { max: 22 },
  coverSubtitle: { max: 32 },
  coverEdition: { max: 16 },
  coverPart: { max: 20 },
  coverPartTitle: { max: 30, lines: 2 },
  coverTome: { max: 18 },
  coverImprint: { max: 32 },
  coverPlace: { max: 10 },
});

/** 장정 구성 — 앞표지에 어떤 글자가 어디 있는가(실물대로). script: 표지 글자 언어. year: 앞표지에 판 연도(로마 숫자)가 있는가. */
export const WIKISOURCE_BINDINGS = Object.freeze({
  // 新潮社 1923 『呐喊』 초판(루쉰 직접 설계): 통째 붉은 바탕 · 가운데 위 검은 판 · 붉은 가는 테 · 바탕색으로 뚫린 글자 가로 오른쪽→왼쪽 · 물결줄 · 작가 · 짧은 줄.
  // 두 작품(孔乙己·故乡) 모두 『呐喊』 수록이라 같은 장정에 판 안 제목만 작품 이름.
  nahan: Object.freeze({ script: 'zh-Hans', required: ['coverTitle', 'coverAuthor'], optional: [], titleLines: 1, titleMax: 3, authorMax: 3, year: false, note: 'Xinchao she 1923 Nahan — red ground, black panel, right-to-left cut-out lettering' }),
  // 开明书店 1928 『背影』 — 표지 실물 사진 미확인. 같은 시대 신문학 단행본 관례(생지 종이 · 세로 제목 · 가는 이중 테 · 아래 출판사).
  kaiming: Object.freeze({ script: 'zh-Hans', required: ['coverTitle', 'coverAuthor', 'coverImprint'], optional: [], titleLines: 1, titleMax: 3, authorMax: 4, year: false, note: 'Kaiming 1928 era convention — vertical title, double rule' }),
  // Lemerre 1873 『Contes du lundi』 인쇄 표지: 담황색 종이 · 검은 활자 가운데 정렬 · 테 없음 · (출판사 도안 → 덩굴) · 아래 PARIS·출판사·연도.
  lemerre: Object.freeze({ script: 'fr', required: ['coverTitle', 'coverAuthor', 'coverPlace', 'coverImprint'], optional: ['coverSubtitle'], titleLines: 2, titleMax: 12, year: true, note: 'Lemerre 1873 buff printed wrapper' }),
  // Marpon & Flammarion 1885 『Contes du jour et de la nuit』 그림 표지: 크림 종이 · 위 작가 · 크게 뾰족한 손글씨 제목(계단식) · 왼쪽 꽃덩굴 · 아래 두루마리.
  marpon: Object.freeze({ script: 'fr', required: ['coverTitle', 'coverAuthor', 'coverPlace', 'coverImprint'], optional: ['coverEdition'], titleLines: 2, titleMax: 10, year: false, note: 'Marpon & Flammarion 1885 illustrated wrapper' }),
  // Hetzel 붉은 천 「aux initiales JV-JH」: 먹 뇌문 띠 → 금박 넝쿨 띠 → 뇌문 · 가운데 큰 원에 금박 제목 · 위아래 작은 원(모노그램 → 별).
  hetzel: Object.freeze({ script: 'fr', required: ['coverTitle', 'coverAuthor', 'coverEdition'], optional: [], titleLines: 4, titleMax: 14, year: false, note: 'Hetzel percaline “aux initiales JV-JH” — Greek-key and vine bands, central gilt roundel' }),
  // Pagnerre 1862 『Les Misérables』 — 같은 판 표제지 구성을 푸른 회색 표지 종이(경매 기록 「couverture bleu-gris」)에: 검정·빨강 활자 · 굵고 가는 줄 · 이중 테.
  pagnerre: Object.freeze({ script: 'fr', required: ['coverTitle', 'coverAuthor', 'coverPart', 'coverPartTitle', 'coverTome', 'coverPlace', 'coverImprint'], optional: [], titleLines: 2, titleMax: 12, year: true, note: 'Pagnerre 1862 title-page layout on blue-grey wrapper' }),
});

const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

/** 1873 → 「M DCCC LXXIII」 — 19세기 프랑스 표지의 연도 표기(천 · 백 · 나머지 두 자리를 띄운다 — Lemerre 1873 · Pagnerre 1862 실물). */
export function romanYear(year) {
  if (!Number.isInteger(year) || year < 1000 || year > 2999) throw new Error(`romanYear: ${year}`);
  const groups = [];
  let rest = year;
  for (const unit of [1000, 100, 1]) {
    let value = Math.floor(rest / unit) * unit;
    rest -= value;
    let text = '';
    for (const [n, letters] of ROMAN) while (value >= n) { text += letters; value -= n; }
    if (text) groups.push(text);
  }
  return groups.join(' ');
}

const HAN = /^\p{Script=Han}+$/u;

/**
 * entry.json display → 표지 표기(throw 하면 빌드 실패).
 * @returns {{titleKo, authorKo, binding, coverTitle, coverAuthor, ...장정마다 정한 칸, coverYear?}}
 */
export function validateWikisourceDisplay(display) {
  if (!display || typeof display !== 'object') throw new Error('display가 필요하다(표지 표기)');
  const problems = [];
  for (const field of ['titleKo', 'authorKo']) if (typeof display[field] !== 'string' || !display[field].trim()) problems.push(field);
  const binding = Object.hasOwn(WIKISOURCE_BINDINGS, display.binding) ? WIKISOURCE_BINDINGS[display.binding] : null;
  if (!binding) throw new Error(`display: ${[...problems, `binding(${Object.keys(WIKISOURCE_BINDINGS).join('·')})`].join(' · ')}`);
  const allowed = new Set([...binding.required, ...binding.optional]);
  const known = new Set(['titleKo', 'authorKo', 'binding', 'coverYear', ...Object.keys(FIELDS)]);
  for (const field of Object.keys(display)) {
    if (!known.has(field)) problems.push(`${field}(모르는 칸)`);
    else if (Object.hasOwn(FIELDS, field) && !allowed.has(field)) problems.push(`${field}(이 장정의 앞표지에는 없다)`);
  }
  for (const field of allowed) {
    const value = display[field];
    if (value === undefined) { if (binding.required.includes(field)) problems.push(`${field}(필요)`); continue; }
    const lines = typeof value === 'string' ? value.split('\n') : [];
    const maxLines = field === 'coverTitle' ? binding.titleLines : FIELDS[field].lines || 1;
    const max = field === 'coverTitle' ? binding.titleMax : field === 'coverAuthor' && binding.authorMax ? binding.authorMax : FIELDS[field].max;
    if (!lines.length || lines.length > maxLines || lines.some((line) => !line.trim() || line !== line.trim() || line.length > max)) problems.push(`${field}(${maxLines}줄 이하, 줄마다 ${max}자 이하)`);
    // 중국어 장정은 판 안 글자가 한자뿐이다(오른쪽→왼쪽·세로로 한 자씩 놓는다)
    if (binding.script.startsWith('zh') && ['coverTitle', 'coverAuthor'].includes(field) && !HAN.test(String(value))) problems.push(`${field}(한자만)`);
  }
  if (binding.year !== (display.coverYear !== undefined)) problems.push(binding.year ? 'coverYear(이 장정은 앞표지에 연도가 있다)' : 'coverYear(이 장정은 앞표지에 연도가 없다)');
  if (display.coverYear !== undefined) {
    try { romanYear(display.coverYear); } catch { problems.push('coverYear(1000–2999 정수)'); }
  }
  if (problems.length) throw new Error(`display: ${problems.join(' · ')}`);
  const out = { titleKo: display.titleKo, authorKo: display.authorKo, binding: display.binding };
  for (const field of [...binding.required, ...binding.optional]) if (display[field] !== undefined) out[field] = display[field];
  if (display.coverYear !== undefined) out.coverYear = display.coverYear;
  return out;
}
