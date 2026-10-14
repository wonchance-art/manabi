// 정본 문학책 표지·목차 표기(AOZORA-P0-5, 오너 확정 2026-10-14 「표지 직접 만들기 · 1과 2과 개편」) — 순수 함수.
//
// 표지: 원서 표지·삽화 이미지는 쓰지 않는다(IP 정책 §2.1 금지⑴ — 표지는 타이포그래피만). 작품마다 entry.json의
// display{titleReading, titleKo, authorKo, cover}를 빌드가 정본 대조표(manifest.generated.json)에 싣고, 화면은 그 표로
// 같은 틀(세로 제목·작가·한국어 제목)에 작품 색 하나만 바꿔 그린다. 색은 자유 값이 아니라 아래 팔레트 이름이다
// (대비·다크 처리를 CSS 한 곳에서 지킨다).
// 목차: 작가의 見出し(一·二…)는 그대로, manabi가 분량으로 나눈 장은 「1/2」, 한 장이면 「전편」 — 교재의 「과」를 쓰지 않는다.
// 장 줄에는 그 장 첫 문장(incipit)을 단다. 이름표가 아니라 본문이 장을 알아보게 한다.
// 이 모듈은 빌드(scripts/lib/literature-build.mjs)도 쓰므로 대조표를 import하지 않는다 — 작품 찾기는 literatureCanonical.literatureWork.

/** 표지 색 — 작품 이미지에서 고른 이름(눈·여우 주홍·숲·먹·매화). CSS `.lit-cover--<name>`이 값을 갖는다. */
export const LITERATURE_COVER_COLORS = Object.freeze(['snow', 'vermilion', 'forest', 'ink', 'plum']);

const filled = (value) => typeof value === 'string' && value.trim() !== '';

/** 표지 세로 제목 한 줄 상한 — 썸네일(60×84) 높이에 11px로 다섯 자. 긴 제목은 display.coverTitle에 줄바꿈을 직접 둔다. */
export const LITERATURE_COVER_LINE_MAX = 5;

/** entry.json display 검사(빌드) — 빠지거나 팔레트 밖이거나 표지 제목이 작품명과 다르면 throw. */
export function validateLiteratureDisplay(display, title) {
  if (!display || typeof display !== 'object' || Array.isArray(display)) throw new Error('display is required');
  for (const field of ['titleReading', 'titleKo', 'authorKo']) {
    if (!filled(display[field])) throw new Error(`display.${field} is required`);
  }
  if (!/^[ぁ-ゟ゠-ヿー\s]+$/u.test(display.titleReading)) throw new Error('display.titleReading must be kana');
  if (!LITERATURE_COVER_COLORS.includes(display.cover)) throw new Error(`display.cover must be one of ${LITERATURE_COVER_COLORS.join('·')}`);
  const coverTitle = display.coverTitle ?? title;
  if (typeof coverTitle !== 'string' || coverTitle.replace(/\n/gu, '') !== title) throw new Error('display.coverTitle must be the title with line breaks only');
  if (coverTitle.split('\n').some((line) => !line || line.length > LITERATURE_COVER_LINE_MAX)) {
    throw new Error(`cover title lines must be 1-${LITERATURE_COVER_LINE_MAX} characters — break it in display.coverTitle`);
  }
  return { titleReading: display.titleReading, titleKo: display.titleKo, authorKo: display.authorKo, cover: display.cover,
    ...(display.coverTitle ? { coverTitle: display.coverTitle } : {}) };
}

/** 장 첫 문단의 앞부분 — 목차 줄에 단다(원문 그대로, 길면 「…」). */
export function literatureIncipit(rawText, max = 24) {
  const first = String(rawText || '').trim().split(/\n/u)[0].trim();
  return first.length > max ? `${first.slice(0, max)}…` : first;
}

/** 목차 줄 앞 표지 — 見出し 그대로 · 「1/2」 · 「전편」. 표에 없는 장이면 순서 숫자. */
export function literatureChapterLabel(work, order) {
  return work?.chapters.find((chapter) => chapter.order === Number(order))?.title ?? String(order ?? '');
}

/** 책 묶음 카드 메타 — 나눈 방식을 말한다(작가의 장인지, manabi가 나눈 것인지). */
export function literatureDivisionLabel(work) {
  if (!work) return '';
  if (work.division === 'heading') return `${work.total}장`;
  if (work.division === 'whole') return '한 번에 읽기';
  return `${work.total}번에 나눠 읽기`;
}

/** 장 제목(뷰어 머리) — 「ごん狐 — 一」 · 「鼻 (1/2)」 · 「手袋を買いに」. 저장된 자료 제목이 예전 표기여도 표를 따른다. */
export function literatureChapterTitle(work, order) {
  const label = literatureChapterLabel(work, order);
  if (!work) return '';
  if (work.division === 'whole') return work.title;
  return work.division === 'heading' ? `${work.title} — ${label}` : `${work.title} (${label})`;
}
