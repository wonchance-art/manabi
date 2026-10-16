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
  coverAuthor: { max: 26 },
  coverSubtitle: { max: 32 },
  coverEdition: { max: 28 },
  coverPart: { max: 20 },
  coverPartTitle: { max: 30, lines: 2 },
  coverTome: { max: 18 },
  coverImprint: { max: 32 },
  coverPlace: { max: 10 },
});

/**
 * 장정 구성 — 앞표지에 어떤 글자가 어디 있는가(실물대로). script: 표지 글자 언어. year: 앞표지에 판 연도(로마 숫자)가 있는가.
 * material: 앞표지 재질(paper 종이 표지·재킷 · cloth 천 장정 · board 종이 보드 · burlap 갈포) — 시리즈 공통 결·낡음의 세기를 정한다(FirstEditionCover).
 */
export const FIRST_EDITION_MATERIALS = Object.freeze(['paper', 'cloth', 'board', 'burlap']);

export const FIRST_EDITION_BINDINGS = Object.freeze({
  // 新潮社 1923 『呐喊』 초판(루쉰 직접 설계): 통째 붉은 바탕 · 가운데 위 검은 판 · 붉은 가는 테 · 바탕색으로 뚫린 글자 가로 오른쪽→왼쪽 · 물결줄 · 작가 · 짧은 줄.
  // 두 작품(孔乙己·故乡) 모두 『呐喊』 수록이라 같은 장정에 판 안 제목만 작품 이름.
  nahan: Object.freeze({ material: 'paper', script: 'zh-Hans', required: ['coverTitle', 'coverAuthor'], optional: [], titleLines: 1, titleMax: 3, authorMax: 3, year: false, note: 'Xinchao she 1923 Nahan — red ground, black panel, right-to-left cut-out lettering' }),
  // 开明书店 1928 『背影』 — 표지 실물 사진 미확인. 같은 시대 신문학 단행본 관례(생지 종이 · 세로 제목 · 가는 이중 테 · 아래 출판사).
  kaiming: Object.freeze({ material: 'paper', script: 'zh-Hans', required: ['coverTitle', 'coverAuthor', 'coverImprint'], optional: [], titleLines: 1, titleMax: 3, authorMax: 4, year: false, note: 'Kaiming 1928 era convention — vertical title, double rule' }),
  // Lemerre 1873 『Contes du lundi』 인쇄 표지: 담황색 종이 · 검은 활자 가운데 정렬 · 테 없음 · (출판사 도안 → 덩굴) · 아래 PARIS·출판사·연도.
  lemerre: Object.freeze({ material: 'paper', script: 'fr', required: ['coverTitle', 'coverAuthor', 'coverPlace', 'coverImprint'], optional: ['coverSubtitle'], titleLines: 2, titleMax: 12, year: true, note: 'Lemerre 1873 buff printed wrapper' }),
  // Marpon & Flammarion 1885 『Contes du jour et de la nuit』 그림 표지: 크림 종이 · 위 작가 · 크게 뾰족한 손글씨 제목(계단식) · 왼쪽 꽃덩굴 · 아래 두루마리.
  marpon: Object.freeze({ material: 'paper', script: 'fr', required: ['coverTitle', 'coverAuthor', 'coverPlace', 'coverImprint'], optional: ['coverEdition'], titleLines: 2, titleMax: 10, year: false, note: 'Marpon & Flammarion 1885 illustrated wrapper' }),
  // Hetzel 붉은 천 「aux initiales JV-JH」: 먹 뇌문 띠 → 금박 넝쿨 띠 → 뇌문 · 가운데 큰 원에 금박 제목 · 위아래 작은 원(모노그램 → 별).
  hetzel: Object.freeze({ material: 'cloth', script: 'fr', required: ['coverTitle', 'coverAuthor', 'coverEdition'], optional: [], titleLines: 4, titleMax: 14, year: false, note: 'Hetzel percaline “aux initiales JV-JH” — Greek-key and vine bands, central gilt roundel' }),
  // Pagnerre 1862 『Les Misérables』 — 같은 판 표제지 구성을 푸른 회색 표지 종이(경매 기록 「couverture bleu-gris」)에: 검정·빨강 활자 · 굵고 가는 줄 · 이중 테.
  pagnerre: Object.freeze({ material: 'paper', script: 'fr', required: ['coverTitle', 'coverAuthor', 'coverPart', 'coverPartTitle', 'coverTome', 'coverPlace', 'coverImprint'], optional: [], titleLines: 2, titleMax: 12, year: true, note: 'Pagnerre 1862 title-page layout on blue-grey wrapper' }),
  // ── 2차 묶음(오너 「원본 책 재구성하는 방식으로 표지 만들기까지 완성」 2026-10-17 KST) — 근거는 docs/literature-pipeline.md §8.7 ──
  // 한국어
  // 『開闢』 1924.6(48호) 첫 발표 — 『조선의 얼골』(1926) 표지 사진 미확인. 개벽 후기 표지 기록(검정 바탕 · 빨강·흰 음각 제호)을 따르는 관례안.
  gaebyeok: Object.freeze({ material: 'paper', script: 'ko', required: ['coverTitle', 'coverAuthor', 'coverImprint', 'coverEdition'], optional: [], titleLines: 1, titleMax: 8, year: false, note: 'Gaebyeok 1924 — black ground, red/white incised masthead (record, no photo)' }),
  // 『이효석단편선』 박문문고 1941(A6, 레클람 문고 본뜸) — 표지 사진 미확인. 문고 관례(가는 이중 테 · 세로 제목 · 아래 출판사).
  bakmun: Object.freeze({ material: 'paper', script: 'ko', required: ['coverTitle', 'coverAuthor', 'coverImprint'], optional: ['coverEdition'], titleLines: 1, titleMax: 10, year: false, note: 'Bakmun bunko 1941 — series convention (no photo)' }),
  // 『동백꽃』 1938 속표지 — 회베이지 종이 · 붓글씨 세로 제목 · 왼쪽 위 「短篇集」 · 오른쪽 아래 「金裕貞 著」(장정 하드커버는 무지).
  dongbaek: Object.freeze({ material: 'paper', script: 'ko', required: ['coverTitle', 'coverAuthor', 'coverSubtitle'], optional: [], titleLines: 1, titleMax: 4, year: false, note: 'Dongbaekkot 1938 title page — brush vertical title' }),
  // 『이상선집』 백양당 1949 — 바랜 크림 종이 · 붓글씨 세로 제목(적갈) · 오른쪽에 날아가는 초록 새와 가는 물결선. 판 안 제목만 작품 이름.
  isang: Object.freeze({ material: 'paper', script: 'ko', required: ['coverTitle'], optional: [], titleLines: 1, titleMax: 4, year: false, note: 'Yi Sang seonjip 1949 — brush title, green bird' }),
  // 『감자』 한성도서 1935 — 주황 종이 · 위·좌·우 먹 덩굴 테 · 큰 붓글씨 세로 제목 · 오른쪽 「金東仁 作」 · 왼쪽 「短篇小說集」 · 아래 먹 꽃.
  gamja: Object.freeze({ material: 'paper', script: 'ko', required: ['coverTitle', 'coverAuthor', 'coverSubtitle'], optional: [], titleLines: 1, titleMax: 3, year: false, note: 'Gamja 1935 — orange paper, ink vine border and flowers' }),
  // 『진달내꽃』 매문사 1925(등록문화재 470-4) — 황갈 종이 · 위 짙은 붓띠 안에 밝게 빠진 제목(가로 오른쪽→왼쪽) · 「詩集」 · 진달래 가지와 바위 선화 · 아래 짙은 띠.
  jindallae: Object.freeze({ material: 'paper', script: 'ko', required: ['coverTitle', 'coverSubtitle'], optional: [], titleLines: 1, titleMax: 5, year: false, note: 'Jindallaekkot 1925 (470-4) — brush band, azalea and rock drawing' }),
  // 『하늘과 바람과 별과 시』 정음사 1948 — 갈포(거친 베) 위 흰 종이 제첨 · 둥근 모서리 테 안 3줄(유고집 · 제목 · 출판사).
  // 이정(1924–1995)의 청색 목판화 표지는 한국에서 보호 중이라 쓰지 않는다.
  jeongeum: Object.freeze({ material: 'burlap', script: 'ko', required: ['coverTitle', 'coverSubtitle', 'coverImprint'], optional: [], titleLines: 1, titleMax: 12, year: false, note: 'Jeongeumsa 1948 — burlap with white paper label' }),
  // 영어
  // Secker & Warburg 1945 재킷 — 왼쪽 아래→오른쪽 위 대각선(위 회베이지 · 아래 초록) · 크림 손글씨풍 기울임 대문자 · 「by」 필기체 · 굵은 작가.
  'secker-diagonal': Object.freeze({ material: 'paper', script: 'en', required: ['coverTitle', 'coverSubtitle', 'coverAuthor'], optional: [], titleLines: 2, titleMax: 8, year: false, note: 'Secker & Warburg 1945 Animal Farm jacket' }),
  // Secker & Warburg 1949 적색 재킷 — 가운데 크고 옅은 세리프 숫자 · 흰 붓 필기체 작가·제목·「a novel」(띠지는 그리지 않는다).
  'secker-numerals': Object.freeze({ material: 'paper', script: 'en', required: ['coverTitle', 'coverAuthor', 'coverSubtitle', 'coverEdition'], optional: [], titleLines: 2, titleMax: 12, year: false, note: 'Secker & Warburg 1949 Nineteen Eighty-Four red jacket' }),
  // Scribner 1925 진녹색 천 — 위 민압 세리프 대문자 제목 두 줄 · 아래 민압 작가(재킷은 얼굴 그림이라 천 장정).
  'scribner-blind': Object.freeze({ material: 'cloth', script: 'en', required: ['coverTitle', 'coverAuthor'], optional: [], titleLines: 2, titleMax: 10, year: false, note: 'Scribner 1925 The Great Gatsby green cloth, blind-stamped' }),
  // Scribner 1952 하늘색 천 — 앞면 무지(오른쪽 아래 서명 민압은 실존 인물 서명이라 흘림선으로만).
  'scribner-plain': Object.freeze({ material: 'cloth', script: 'en', required: ['coverTitle'], optional: [], titleLines: 2, titleMax: 16, year: false, note: 'Scribner 1952 The Old Man and the Sea blue cloth' }),
  // Hogarth 1929 재킷(Vanessa Bell, 1961 사망 — 한국 만료) — 버프 바탕 · 남흑 한 색 · 손글씨 소문자 제목 · 아치 벽감 안 벽난로 선반과 시계 · 술 장식 띠.
  'hogarth-bell': Object.freeze({ material: 'paper', script: 'en', required: ['coverTitle', 'coverAuthor'], optional: [], titleLines: 2, titleMax: 12, year: false, note: 'Hogarth Press 1929 A Room of One’s Own jacket (Vanessa Bell)' }),
  // B. W. Huebsch 1916 청색 천 — 위 민압 혼합 대소문자 세리프 세 줄 · 물결표 · 작가.
  huebsch: Object.freeze({ material: 'cloth', script: 'en', required: ['coverTitle', 'coverAuthor'], optional: [], titleLines: 3, titleMax: 14, year: false, note: 'B. W. Huebsch 1916 A Portrait of the Artist blue cloth' }),
  // Harper 1851 자줏빛 갈색 천 — 민압 굵은 괘선 테두리, 앞면 글자 없음(가운데 출판사 문장은 그리지 않는다).
  'harper-blind': Object.freeze({ material: 'cloth', script: 'en', required: ['coverTitle'], optional: [], titleLines: 2, titleMax: 12, year: false, note: 'Harper & Brothers 1851 Moby-Dick cloth, blind rules' }),
  // Ticknor and Fields 1854 갈색 세로결 천 — 민압 삼중 괘선 · 네 모서리 꽃장식 · 가운데 큰 아라베스크 마름모, 앞면 글자 없음.
  'ticknor-arabesque': Object.freeze({ material: 'cloth', script: 'en', required: ['coverTitle'], optional: [], titleLines: 1, titleMax: 12, year: false, note: 'Ticknor and Fields 1854 Walden brown cloth, blind arabesque' }),
  // T. Egerton 1813 원판 보드(drab) — 앞면 무지.
  'egerton-boards': Object.freeze({ material: 'board', script: 'en', required: ['coverTitle'], optional: [], titleLines: 2, titleMax: 12, year: false, note: 'T. Egerton 1813 Pride and Prejudice drab boards' }),
  // 프랑스어
  // Gallimard 1942 collection blanche — 크림 종이 · 검정 단선 + 빨강 이중선 테 · 작가 · 빨강 제목 · 「ROMAN」 · 아래 출판사(nrf 모노그램은 그리지 않는다).
  'gallimard-blanche': Object.freeze({ material: 'paper', script: 'fr', required: ['coverTitle', 'coverAuthor', 'coverSubtitle', 'coverImprint'], optional: [], titleLines: 1, titleMax: 12, year: false, note: 'Gallimard 1942 L’Étranger, collection blanche' }),
  // Gallimard 1942 「Les Essais」 XII — 테 없는 레이드지 · 빨강 제목 두 줄 · 「PAR ALBERT CAMUS」 · 빨강 총서 이름(포도잎 목판 문장 · nrf는 그리지 않는다).
  'gallimard-essais': Object.freeze({ material: 'paper', script: 'fr', required: ['coverTitle', 'coverAuthor', 'coverEdition', 'coverImprint'], optional: [], titleLines: 2, titleMax: 12, year: false, note: 'Gallimard 1942 Le Mythe de Sisyphe, Les Essais XII' }),
  // Reynal & Hitchcock 1943 재킷 배치 — 크림 · 위 청회 대문자 작가 · 검정 제목 · 노란 별들 · 왼쪽 아래 작은 글씨(왕자 그림 · 소행성은 그리지 않는다 — 캐릭터 그림).
  reynal: Object.freeze({ material: 'paper', script: 'fr', required: ['coverTitle', 'coverAuthor', 'coverEdition'], optional: [], titleLines: 1, titleMax: 16, year: false, note: 'Reynal & Hitchcock 1943 Le Petit Prince jacket layout, without the figure' }),
  // ── 3차 묶음(오너 「되는 언어로만 ㄱㄱ」 2026-10-17 KST — FirstEditionCoverThird) ──
  // 18세기 책은 출판사 표지가 없었다(민짜 종이 표지·보드로 팔림) → 앞면은 그 판의 속표지. 19세기 천 장정은 앞면 민압만(글자는 책등).
  // Buisson 1791 — 자서전의 첫 판(프랑스어). 속표지: 대문자 다섯 줄 · 이탤릭 두 줄 · 꽃 · A PARIS · 출판사 · 이중 괘선 · 연도.
  'buisson-1791': Object.freeze({ material: 'paper', script: 'fr', required: ['coverTitle', 'coverPartTitle', 'coverPlace', 'coverImprint', 'coverEdition'], optional: [], titleLines: 5, titleMax: 24, year: false, note: 'Buisson 1791 Mémoires de la vie privée de Benjamin Franklin — title page (issued in plain wrappers)' }),
  // John W. Parker and Son 1859 — 초콜릿 갈색 천 · 민압 세 줄 테 + 계단 모서리 판, 앞면 글자 없음.
  'parker-1859': Object.freeze({ material: 'cloth', script: 'en', required: ['coverTitle'], optional: [], titleLines: 2, titleMax: 12, year: false, note: 'John W. Parker and Son 1859 On Liberty brown cloth, blind panel' }),
  // Bell and Daldy 1862 — 자줏빛 적갈색 알갱이 결 천, 앞면 무지(가는 민압 테는 관례 — 확신 낮음).
  'bell-daldy-1862': Object.freeze({ material: 'cloth', script: 'en', required: ['coverTitle'], optional: [], titleLines: 2, titleMax: 12, year: false, note: 'Bell and Daldy 1862 Thoughts of M. Aurelius Antoninus (Long) plum cloth' }),
  // Strahan & Cadell 1776 — 속표지(캐즐론) 여섯 줄 제목 · 저자 · 권 · 이중 괘선 · LONDON · 출판사 · 연도(띄우지 않은 로마 숫자).
  'strahan-1776': Object.freeze({ material: 'paper', script: 'en', required: ['coverTitle', 'coverAuthor', 'coverTome', 'coverPlace', 'coverImprint'], optional: [], titleLines: 6, titleMax: 18, authorMax: 32, year: true, note: 'W. Strahan and T. Cadell 1776 Wealth of Nations vol. I — title page (issued in plain boards)' }),
  // A. Millar 1759 — 속표지(캐즐론): THE · THEORY · OF · MORAL SENTIMENTS · 저자 · 직함 · 꽃 · LONDON · 출판사 · 띄운 로마 숫자 연도.
  'millar-1759': Object.freeze({ material: 'paper', script: 'en', required: ['coverTitle', 'coverAuthor', 'coverSubtitle', 'coverPlace', 'coverImprint'], optional: [], titleLines: 4, titleMax: 18, year: true, note: 'A. Millar 1759 Theory of Moral Sentiments — title page (issued in plain boards)' }),
  // Houghton Mifflin 1946 재킷 — 청록→복숭아빛 · 헝클어진 국화와 칼 · 흰 손글씨 제목 · 소개 글 · 로만 대문자 작가(뒷날개 사진은 그리지 않는다).
  'houghton-1946': Object.freeze({ material: 'paper', script: 'en', required: ['coverTitle', 'coverAuthor'], optional: [], titleLines: 3, titleMax: 14, year: false, note: 'Houghton Mifflin 1946 The Chrysanthemum and the Sword jacket' }),
  // Swan Sonnenschein, Lowrey & Co. 1887 — 적갈색 천 · 민압 두 줄 테 + 두 줄 판, 앞면 글자 없음(출판사 문장은 그리지 않는다).
  'sonnenschein-1887': Object.freeze({ material: 'cloth', script: 'en', required: ['coverTitle'], optional: [], titleLines: 2, titleMax: 12, year: false, note: 'Swan Sonnenschein, Lowrey & Co. 1887 Capital (Moore and Aveling) maroon cloth, blind rules' }),
  // 제네바 1782 『Les Confessions … suivies des Rêveries』 2권 — 속표지: LES · CONFESSIONS · DE · 그림자 대문자 작가 · Suivies DES RÊVERIES · 권 · A GENEVE · 연도.
  'geneve-1782': Object.freeze({ material: 'paper', script: 'fr', required: ['coverTitle', 'coverPartTitle', 'coverSubtitle', 'coverTome', 'coverPlace'], optional: [], titleLines: 4, titleMax: 16, year: true, note: 'Geneva 1782 Les Confessions suivies des Rêveries du promeneur solitaire, tome II — title page' }),
  // Paul Hartmann 1935 『Poèmes français』 — 크림 종이 표지 · 두 색 가라몽 대문자(작가 · 빨강 제목 · 실린 시집 · 연도 · 빨강 출판사 · 주소).
  'hartmann-1935': Object.freeze({ material: 'paper', script: 'fr', required: ['coverTitle', 'coverAuthor', 'coverImprint', 'coverEdition'], optional: [], titleLines: 2, titleMax: 10, year: true, note: 'Paul Hartmann 1935 Rilke, Poèmes français wrapper' }),
  // 1919 보성사 『宣言書』 — 가로 긴 한 장의 오른쪽 첫머리: 큰 「宣言書」 + 본문 세로줄 오른쪽→왼쪽.
  'boseongsa-1919': Object.freeze({ material: 'paper', script: 'ko', required: ['coverTitle'], optional: [], titleLines: 1, titleMax: 3, year: false, note: 'Boseongsa 1919 Declaration of Independence sheet, right-hand opening' }),
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
export function validateFirstEditionDisplay(display) {
  if (!display || typeof display !== 'object') throw new Error('display가 필요하다(표지 표기)');
  const problems = [];
  for (const field of ['titleKo', 'authorKo']) if (typeof display[field] !== 'string' || !display[field].trim()) problems.push(field);
  const binding = Object.hasOwn(FIRST_EDITION_BINDINGS, display.binding) ? FIRST_EDITION_BINDINGS[display.binding] : null;
  if (!binding) throw new Error(`display: ${[...problems, `binding(${Object.keys(FIRST_EDITION_BINDINGS).join('·')})`].join(' · ')}`);
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
