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
  // 틀 장정(tpl-*)만 — 바탕 색 · 앞면 장식(LIT-IMPORT-1). 값은 정해진 목록에서만(TEMPLATE_PALETTES · TEMPLATE_ORNAMENTS)
  coverPalette: { enum: 'palette' },
  coverOrnament: { enum: 'ornament' },
});

/**
 * 틀 장정(LIT-IMPORT-1, 오너 「언제든 불러오고 … 다듬는 과정까지 모두 프로세스 최적화」 2026-10-17 KST) — 작품마다 그리던 초판 장정을
 * 데이터로 짓는다. 3차 묶음 실측: 19세기 천 장정 셋은 「천 색 + 민압 테」, 18세기 넷은 「속표지 글자 줄」, 프랑스 인쇄 표지는 「테 + 글자 줄」 —
 * 구성이 같고 색 · 글자 · 테만 다르다. 가져오기(import)가 시대 · 언어로 틀을 고르고 카탈로그의 실물 조사(색 · 장식 · 글자)를 채운다.
 * 실물 재구성(작품 전용 장정)은 그대로 더 할 수 있다 — 틀은 「표지가 없어 못 싣는」 일을 없애는 기본값이다.
 */
export const TEMPLATE_PALETTES = Object.freeze({
  // 천(cloth) — 19세기 출판사 천 색(3차 실측: Parker 초콜릿 · Sonnenschein 적갈 · Bell and Daldy 자줏빛)
  maroon: { material: 'cloth', ground: '#5a2b2c', ink: '#431f20', light: '#73403f', gilt: '#c9a85a' },
  brown: { material: 'cloth', ground: '#4a3a3a', ink: '#382b2b', light: '#5f4d4d', gilt: '#c7a65c' },
  green: { material: 'cloth', ground: '#2f4a3c', ink: '#22382d', light: '#46624f', gilt: '#c9ab5e' },
  blue: { material: 'cloth', ground: '#2d3e55', ink: '#202e41', light: '#43566f', gilt: '#c8aa60' },
  plum: { material: 'cloth', ground: '#4a2c45', ink: '#372034', light: '#62415c', gilt: '#c6a75d' },
  olive: { material: 'cloth', ground: '#4f4b2e', ink: '#3b3822', light: '#666140', gilt: '#cdb066' },
  red: { material: 'cloth', ground: '#7a2422', ink: '#5c1a19', light: '#93403b', gilt: '#d1b16a' },
  // 종이(paper) — 속표지 · 인쇄 표지 · 재킷 바탕
  cream: { material: 'paper', ground: '#efe6d2', ink: '#2b2620', accent: '#a8322b' },
  buff: { material: 'paper', ground: '#e0cca3', ink: '#2a231b', accent: '#9c2e26' },
  grey: { material: 'paper', ground: '#cfccc1', ink: '#23211d', accent: '#8f2a24' },
  blue_grey: { material: 'paper', ground: '#b9c2c3', ink: '#1d2124', accent: '#8a1f1b' },
  yellow: { material: 'paper', ground: '#e6cf86', ink: '#262017', accent: '#962b22' },
  rose: { material: 'paper', ground: '#e4c6b8', ink: '#2a1f1c', accent: '#7d2420' },
});
/** 앞면 장식 — 천은 민압 테 · 판 · 금박 제목, 종이는 테 없음 · 홑 테 · 겹 테. */
export const TEMPLATE_ORNAMENTS = Object.freeze({
  cloth: Object.freeze(['blind-frame', 'blind-panel', 'gilt-title']),
  paper: Object.freeze(['plain', 'single-rule', 'double-rule']),
});
/** 틀 장정의 바탕 · 잉크 — 표기의 coverPalette에서. 틀이 아니거나 모르는 색이면 null. */
export function templateTone(display) {
  if (!Object.hasOwn(TEMPLATE_BINDINGS, display?.binding ?? '')) return null;
  return Object.hasOwn(TEMPLATE_PALETTES, display.coverPalette ?? '') ? TEMPLATE_PALETTES[display.coverPalette] : null;
}

/**
 * 장정 구성 — 앞표지에 어떤 글자가 어디 있는가(실물대로). script: 표지 글자 언어. year: 앞표지에 판 연도(로마 숫자)가 있는가.
 * material: 앞표지 재질(paper 종이 표지·재킷 · cloth 천 장정 · board 종이 보드 · burlap 갈포) — 시리즈 공통 결·낡음의 세기를 정한다(FirstEditionCover).
 */
export const FIRST_EDITION_MATERIALS = Object.freeze(['paper', 'cloth', 'board', 'burlap']);

// 틀 장정 — 재질은 틀마다 하나, 색(coverPalette)은 그 재질의 색만(검사가 맞춰 본다). 출판사 · 출판지는 조사한 판에만 — 지어내지 않도록 선택 칸.
const TEMPLATE_BINDINGS_SOURCE = Object.freeze({
  // 19세기 출판사 천 장정 — 앞면 민압(또는 금박 제목) · 글자는 책등(Parker 1859 · Sonnenschein 1887 · Harper 1851 실측 구성)
  'tpl-cloth': Object.freeze({ material: 'cloth', script: 'latin', template: true, required: ['coverTitle', 'coverPalette', 'coverOrnament'], optional: [], titleLines: 3, titleMax: 22, year: false, note: 'Template — publisher’s cloth, blind or gilt front' }),
  // 18세기 속표지(영국 · 미국) — 캐즐론 글자 줄 · 이중 괘선 · 출판지 · 출판사 · 로마 숫자 연도(Strahan 1776 · Millar 1759 실측 구성)
  'tpl-title-page': Object.freeze({ material: 'paper', script: 'latin', template: true, required: ['coverTitle', 'coverAuthor', 'coverPalette'], optional: ['coverSubtitle', 'coverPlace', 'coverImprint'], titleLines: 6, titleMax: 24, authorMax: 32, year: true, note: 'Template — 18th-century English title page (issued in plain boards)' }),
  // 프랑스 인쇄 표지 — 테 · 작가 · 제목 · 부제 · 출판지 · 출판사 · 연도(Lemerre · Marpon · Pagnerre · Hartmann 실측 구성)
  'tpl-wrapper': Object.freeze({ material: 'paper', script: 'latin', template: true, required: ['coverTitle', 'coverAuthor', 'coverPalette', 'coverOrnament'], optional: ['coverSubtitle', 'coverPlace', 'coverImprint'], titleLines: 3, titleMax: 18, year: true, note: 'Template — French printed paper wrapper' }),
  // 20세기 활판 재킷(영 · 미) — 바탕 한 색 · 큰 제목 · 작가 · 출판사(그림 없는 활판 재킷)
  'tpl-jacket': Object.freeze({ material: 'paper', script: 'latin', template: true, required: ['coverTitle', 'coverAuthor', 'coverPalette'], optional: ['coverSubtitle', 'coverImprint'], titleLines: 3, titleMax: 16, year: false, note: 'Template — typographic 20th-century dust jacket' }),
  // 동아시아 세로 표지 — 생지 · 세로 제목 · 작가 · 가는 이중 테 · 출판사(开明 1928 · 근대 한국 단행본 관례)
  'tpl-cjk-vertical': Object.freeze({ material: 'paper', script: 'cjk', template: true, required: ['coverTitle', 'coverAuthor', 'coverPalette'], optional: ['coverImprint'], titleLines: 2, titleMax: 8, authorMax: 8, year: false, note: 'Template — East Asian vertical-title cover (two columns at most, right to left)' }),
});

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
  // 『동백꽃』 붉은 동백 판(오너가 준 실물 사진 2026-10-17 KST — 판 미상) — 회베이지 종이 · 왼쪽 위 붓 세로 제목 · 붉은 동백 두 송이와 먹빛 잎(스텐실 찍기) · 떨어진 꽃잎.
  // 1938 삼문사 판은 앞표지가 무지라 대신 이 판을 쓴다(오너 결정).
  dongbaek: Object.freeze({ material: 'paper', script: 'ko', required: ['coverTitle'], optional: [], titleLines: 1, titleMax: 4, year: false, note: 'Dongbaekkot — red camellias, stencil leaves, brush title (owner photo)' }),
  // 『이상선집』 백양당 1949(오너 「날개는 이상 선집」 2026-10-17 KST — 「날개」는 잡지 초출이라 첫 단행본) — 바랜 크림 종이 · 왼쪽 큰 붓 한자 세로 제목
  // 「李箱選集」(적갈) · 오른쪽 아래 빗금을 끌고 나는 짙은 초록 새. 장정가 미확인(복각본 기준).
  isang: Object.freeze({ material: 'paper', script: 'ko', required: ['coverTitle'], optional: [], titleLines: 1, titleMax: 4, year: false, note: 'Yi Sang seonjip 1949 — brush Hanja title, dark green bird' }),
  // 『감자』 한성도서 1935 — 주황 종이 · 위·좌·우 먹 덩굴 테 · 큰 붓글씨 세로 제목 · 오른쪽 「金東仁 作」 · 왼쪽 「短篇小說集」 · 아래 먹 꽃.
  gamja: Object.freeze({ material: 'paper', script: 'ko', required: ['coverTitle', 'coverAuthor', 'coverSubtitle'], optional: [], titleLines: 1, titleMax: 3, year: false, note: 'Gamja 1935 — orange paper, ink vine border and flowers' }),
  // 『진달내ᄭᅩᆺ』 매문사 1925 중앙서림 총판본(등록문화유산 470-1, 오너 「1925년 초판본 '달내ᄭᅩᆺ'으로」 2026-10-17 KST) — 연초록 종이 · 활자만:
  // 작은 「金素月詩集」 · 큰 「진달내ᄭᅩᆺ」(가로 오른쪽→왼쪽) · 그 아래 가는 줄 · 맨 아래 「—1925—」. 그림 없음. 제목은 옛한글 그대로(표지만 — 본문은 현대어 칸).
  jindallae: Object.freeze({ material: 'paper', script: 'ko', required: ['coverTitle', 'coverSubtitle', 'coverEdition'], optional: [], titleLines: 1, titleMax: 6, year: false, note: 'Jindallaekkot 1925 Jungang Seorim issue (470-1) — type only, old Hangul title' }),
  // 『하늘과 바람과 별과 詩』 정음사 1955 증보판(시 89 · 산문 4, 오너 「1955년 재판본으로」 2026-10-17 KST) — 국방색 종이 · 왼쪽 위 굵은 도안 글자 세로 제목
  // (하늘 · 바람 · 별 · 詩는 크게, 「과」는 작게). 표지 그림(학 · 붉은 꽃)은 김환기(1913–1974) 작품이라 한국에서 보호 중 — 그리지 않는다(1948 이정 판화도 같은 이유).
  'jeongeum-1955': Object.freeze({ material: 'paper', script: 'ko', required: ['coverTitle', 'coverSubtitle'], optional: [], titleLines: 1, titleMax: 14, year: false, note: 'Jeongeumsa 1955 enlarged edition — heavy vertical title (painting omitted: Kim Whanki, protected)' }),
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
  ...TEMPLATE_BINDINGS_SOURCE,
});
/** 틀 장정 키 — 여러 작품이 같은 틀을 쓴다(작품 전용 장정은 작품마다 하나). */
export const TEMPLATE_BINDINGS = Object.freeze(Object.fromEntries(Object.keys(TEMPLATE_BINDINGS_SOURCE).map((key) => [key, FIRST_EDITION_BINDINGS[key]])));

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
  // 틀 장정 — 색은 목록에서, 그 색의 재질이 틀의 재질과 같아야(천 틀에 종이 색 안 됨), 장식은 그 재질의 목록에서
  if (binding.template) {
    const palette = Object.hasOwn(TEMPLATE_PALETTES, display.coverPalette ?? '') ? TEMPLATE_PALETTES[display.coverPalette] : null;
    if (!palette) problems.push(`coverPalette(${Object.keys(TEMPLATE_PALETTES).join('·')})`);
    else if (palette.material !== binding.material) problems.push(`coverPalette(${binding.material} 색만 — ${Object.keys(TEMPLATE_PALETTES).filter((key) => TEMPLATE_PALETTES[key].material === binding.material).join('·')})`);
    if (allowed.has('coverOrnament') && !TEMPLATE_ORNAMENTS[binding.material].includes(display.coverOrnament)) problems.push(`coverOrnament(${TEMPLATE_ORNAMENTS[binding.material].join('·')})`);
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
