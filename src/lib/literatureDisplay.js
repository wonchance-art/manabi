// 정본 문학책 표지·목차 표기(AOZORA-P0-5, 오너 확정 2026-10-14 「표지 직접 만들기 · 1과 2과 개편」) — 순수 함수.
//
// 표지: 원서 표지·삽화 이미지는 쓰지 않는다(IP 정책 §2.1 금지⑴ — 표지는 타이포그래피만). 작품마다 entry.json의
// display{titleReading, titleKo, authorKo, cover}를 빌드가 정본 대조표(manifest.generated.json)에 싣고, 화면은 그 표로
// 같은 틀(세로 제목·책등·아래 선)에 작품 색과 문양(motif)만 바꿔 그린다. 색은 자유 값이 아니라 아래 팔레트 이름이다
// (대비·다크 처리를 CSS 한 곳에서 지킨다).
// 목차: 작가의 見出し(一·二…)는 그대로, manabi가 분량으로 나눈 장은 「1/2」, 한 장이면 「전문」(「전편」은 前篇으로 읽힌다) — 교재의 「과」를 쓰지 않는다.
// 장 줄에는 그 장 첫 문장(incipit)을 단다. 이름표가 아니라 본문이 장을 알아보게 한다.
// 이 모듈은 빌드(scripts/lib/literature-build.mjs)도 쓰므로 대조표를 import하지 않는다 — 작품 찾기는 literatureCanonical.literatureWork.

/**
 * 표지 바탕 — 작품과 그 시대 장정에서 고른 이름(쪽빛 눈밤·여우 주홍·숲·먹 천·메이지 生成り · 2차: 해 질 녘 녹·심연·
 * 달밤 보라·바다 하늘·잿빛 비둘기·밤 보라·강·호두). CSS `.lit-cover--<name>`이
 * 값을 갖는다. 앱 주색·일본어 서재 표지(로즈 #994a5a)와 같은 색상 계열은 피한다(디자이너 검토).
 */
export const LITERATURE_COVER_COLORS = Object.freeze(['snow', 'vermilion', 'forest', 'ink', 'cream',
  'rust', 'abyss', 'twilight', 'sky', 'dove', 'nightjar', 'river', 'walnut', 'plum',
  'ash', 'pear', 'meadow', 'olive', 'peach', 'wine', 'amber']);

/**
 * 표지 그림(모티프) — 작품 분위기에서 고른 자작 SVG(LiteratureCoverArt). 원서 표지·삽화·알려진 캐릭터를 옮기지 않는다
 * (IP 정책 §2.1 금지⑴, 오너 지시 2026-10-14 KST 「책에 어울리는 분위기·이미지·문양」). 작품마다 하나, 겹치지 않게.
 */
export const LITERATURE_COVER_MOTIFS = Object.freeze(['snow-night', 'higanbana', 'forest-doors', 'ink-steam', 'birdcage',
  'rain-gate', 'lotus-thread', 'moon-tiger', 'steam-sea', 'lemon-books', 'nightjar-star', 'night-boat', 'cello-night', 'night-train',
  'kamakura-letter', 'crab-pear', 'wind-hill', 'dusk-rails', 'peach-house', 'deco-chair', 'spider-sun']);

const filled = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * 표지 세로 제목 한 줄 상한 — 모든 작품 같은 11px로 썸네일(60×84) 높이에 여섯 자. 여섯 자 이하는 줄을 나누지 않는다
 * (반반 떠서 아래가 비어 보인다 — 오너 지적). 넘는 제목만 display.coverTitle에 줄바꿈을 두고, 첫 줄을 길게 끊는다.
 */
export const LITERATURE_COVER_LINE_MAX = 6;

// display.titleKo는 **원제 직역**이다(학습자에게 일본어 제목을 풀어 주는 줄) — 국내 번역본의 의역 제목(「금빛 여우」·
// 「장갑을 사러 간 아기여우」)을 쓰지 않는다. authorKo는 국립국어원 외래어 표기법.

/** entry.json display 검사(빌드) — 빠지거나 팔레트 밖이거나 표지 제목이 작품명과 다르면 throw. */
export function validateLiteratureDisplay(display, title) {
  if (!display || typeof display !== 'object' || Array.isArray(display)) throw new Error('display is required');
  for (const field of ['titleReading', 'titleKo', 'authorKo']) {
    if (!filled(display[field])) throw new Error(`display.${field} is required`);
  }
  if (!/^[ぁ-ゟ゠-ヿー\s]+$/u.test(display.titleReading)) throw new Error('display.titleReading must be kana');
  if (!LITERATURE_COVER_COLORS.includes(display.cover)) throw new Error(`display.cover must be one of ${LITERATURE_COVER_COLORS.join('·')}`);
  if (!LITERATURE_COVER_MOTIFS.includes(display.motif)) throw new Error(`display.motif must be one of ${LITERATURE_COVER_MOTIFS.join('·')}`);
  const coverTitle = display.coverTitle ?? title;
  if (typeof coverTitle !== 'string' || coverTitle.replace(/\n/gu, '') !== title) throw new Error('display.coverTitle must be the title with line breaks only');
  const lines = coverTitle.split('\n');
  if (lines.some((line) => !line || line.length > LITERATURE_COVER_LINE_MAX)) {
    throw new Error(`cover title lines must be 1-${LITERATURE_COVER_LINE_MAX} characters — break it in display.coverTitle`);
  }
  if (lines.length > 1 && (title.length <= LITERATURE_COVER_LINE_MAX || lines[0].length < lines[lines.length - 1].length)) {
    throw new Error('display.coverTitle breaks only titles that do not fit one line, with the first line the longer one');
  }
  return { titleReading: display.titleReading, titleKo: display.titleKo, authorKo: display.authorKo, cover: display.cover, motif: display.motif,
    ...(display.coverTitle ? { coverTitle: display.coverTitle } : {}) };
}

/**
 * 장 첫 문장 — 목차 줄에 단다(원문 그대로). 에디터 검토(2026-10-14): 낱말 한가운데·마침표 뒤에서 자르지 않는다.
 *   ① 첫 문장(。까지)이 30자 이하면 문장 전체(「…」 없음) ② 길면 앞 28자 안, 12자 이후의 마지막 「、」에서 자르고 「…」
 *   ③ 쉼표도 없으면 24자에서 자르고 「…」.
 */
export function literatureIncipit(rawText) {
  const first = String(rawText || '').trim().split(/\n/u)[0].trim();
  const end = first.indexOf('。');
  const sentence = end === -1 ? first : first.slice(0, end + 1);
  if (sentence.length <= 30 && (end !== -1 || first.length <= 30)) return sentence;
  const comma = first.slice(0, 28).lastIndexOf('、');
  return comma >= 12 ? `${first.slice(0, comma)}…` : `${first.slice(0, 24)}…`;
}

/** 목차 줄 앞 표지 — 見出し 그대로 · 「1/2」 · 「전문」. 표에 없는 장이면 순서 숫자. */
export function literatureChapterLabel(work, order) {
  return work?.chapters.find((chapter) => chapter.order === Number(order))?.title ?? String(order ?? '');
}

const NATIVE_COUNT = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];

/**
 * 책 묶음 카드 메타 — 나눈 방식을 말한다(작가의 장인지, manabi가 나눈 것인지). 「번」은 고유어 수(아홉까지 한글 —
 * 「2번」은 번호로 읽힌다), 작가의 장은 「N장 구성」(「6장」만으로는 종이 장수로 읽힌다).
 */
export function literatureDivisionLabel(work) {
  if (!work) return '';
  if (work.division === 'heading') return `${work.total}장 구성`;
  if (work.division === 'whole') return '한 번에 읽기';
  return `${NATIVE_COUNT[work.total] || work.total} 번에 나눠 읽기`;
}

/** 장 제목(뷰어 머리) — 「ごん狐 — 一」 · 「鼻 (1/2)」 · 「手袋を買いに」. 저장된 자료 제목이 예전 표기여도 표를 따른다. */
export function literatureChapterTitle(work, order) {
  const label = literatureChapterLabel(work, order);
  if (!work) return '';
  if (work.division === 'whole') return work.title;
  return work.division === 'heading' ? `${work.title} — ${label}` : `${work.title} (${label})`;
}
