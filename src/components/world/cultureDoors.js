// 🚪 도시 파사드 → 문화 문법 챕터 연결 계약.
// Phaser 노드를 React 근접 상태로 넘길 때 chapter 를 빠뜨리지 않고,
// 라우터에는 고정된 ot-XX-slug 형식만 전달한다.

const CULTURE_CHAPTER_RE = /^ot-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const READING_TEXT_RE = /^n5-tokyo-\d{2}$/;

export function toInteractiveNode(node) {
  if (!node) return null;
  return {
    id: node.id,
    name: node.name,
    desc: node.desc,
    gate: node.gate,
    npc: node.npc,
    noStamp: node.noStamp,
    chapter: node.chapter,
    reading: node.reading,
    openNow: node.openNow,
  };
}

export function cultureChapterHref(chapter) {
  if (typeof chapter !== 'string' || !CULTURE_CHAPTER_RE.test(chapter)) return null;
  return `/japanese/grammar/${encodeURIComponent(chapter)}`;
}

// 프랑스어 트랙 도어 — 슬러그 형식은 a0-02-alphabet 류(레벨-번호-주제). 유럽 1차(몽생미셸·
// 그랑파리) 도어가 사용. 일본어 ot-XX 계약과 병렬이며 서로 간섭하지 않는다.
const LEVEL_CHAPTER_RE = /^[abc][012]-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FRENCH_CHAPTER_RE = LEVEL_CHAPTER_RE;

export function frenchChapterHref(chapter) {
  if (typeof chapter !== 'string' || !FRENCH_CHAPTER_RE.test(chapter)) return null;
  return `/french/grammar/${encodeURIComponent(chapter)}`;
}

// 트랙 명시 라우팅 — 영어·프랑스어 슬러그가 같은 형태(a1-01-…)라 정규식만으론 구분 불가.
// 도어 노드가 track 필드를 실으면 이 함수가 우선하고, 미지정 레거시는 기존 폴백 체인 유지.
const TRACK_ROUTES = Object.freeze({
  japanese: Object.freeze({ pattern: CULTURE_CHAPTER_RE, base: '/japanese/grammar/' }),
  french: Object.freeze({ pattern: LEVEL_CHAPTER_RE, base: '/french/grammar/' }),
  english: Object.freeze({ pattern: LEVEL_CHAPTER_RE, base: '/english/grammar/' }),
});

export function trackChapterHref(track, chapter) {
  const route = TRACK_ROUTES[track];
  if (!route || typeof chapter !== 'string' || !route.pattern.test(chapter)) return null;
  return `${route.base}${encodeURIComponent(chapter)}`;
}

export function readingTextHref(reading) {
  if (typeof reading !== 'string' || !READING_TEXT_RE.test(reading)) return null;
  return `/japanese/reading?node=${encodeURIComponent(reading)}`;
}
