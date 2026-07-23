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
    track: node.track,
    reading: node.reading,
    openNow: node.openNow,
    ...(node.tideCopyKey ? { tideCopyKey: node.tideCopyKey } : {}),
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

// 중국어 트랙 — ot-XX(발음 오리엔테이션 이식분)가 일본어 ot-XX와 동형이라 track 명시 필수(영/프 선례).
// 본편은 h1~h6(HSK 급수) 슬러그.
const CHINESE_CHAPTER_RE = /^(?:ot|h[1-6])-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

// 일본어 track 명시 도어는 n5 본편 챕터도 연다(가와구치코 ja 도어 — n5-04b류 문자 접미 포함).
// 레거시(track 미지정) 폴백 cultureChapterHref 는 ot-XX 전용 그대로 — 기존 도시 무영향.
// n5-tokyo-XX(독해 텍스트)는 자리수 불일치로 여기 걸리지 않는다(readingTextHref 전용 유지).
const JAPANESE_TRACK_CHAPTER_RE = /^(?:ot-\d{2}|n5-\d{2}[a-z]?)-[a-z0-9]+(?:-[a-z0-9]+)*$/;

// 트랙 명시 라우팅 — 영어·프랑스어 슬러그가 같은 형태(a1-01-…)라 정규식만으론 구분 불가.
// 도어 노드가 track 필드를 실으면 이 함수가 우선하고, 미지정 레거시는 기존 폴백 체인 유지.
const TRACK_ROUTES = Object.freeze({
  japanese: Object.freeze({ pattern: JAPANESE_TRACK_CHAPTER_RE, base: '/japanese/grammar/' }),
  french: Object.freeze({ pattern: LEVEL_CHAPTER_RE, base: '/french/grammar/' }),
  english: Object.freeze({ pattern: LEVEL_CHAPTER_RE, base: '/english/grammar/' }),
  chinese: Object.freeze({ pattern: CHINESE_CHAPTER_RE, base: '/chinese/grammar/' }),
});

export function trackChapterHref(track, chapter) {
  const route = Object.prototype.hasOwnProperty.call(TRACK_ROUTES, track)
    ? TRACK_ROUTES[track]
    : null;
  if (!route || typeof chapter !== 'string' || !route.pattern.test(chapter)) return null;
  return `${route.base}${encodeURIComponent(chapter)}`;
}

// WorldPage 도어 라우팅 정본.
// track 미지정 노드만 레거시 일본어→프랑스어 폴백을 허용한다. explicit track은 언어 선택의
// 권위값이므로 unknown/형식 불일치에서 다른 언어로 추측하지 않고 닫는다.
export function resolveCultureChapterHref(track, chapter) {
  const hasExplicitTrack = track !== undefined;
  if (!hasExplicitTrack) {
    return cultureChapterHref(chapter) ?? frenchChapterHref(chapter);
  }

  const href = trackChapterHref(track, chapter);
  if (href) return href;

  if (!Object.prototype.hasOwnProperty.call(TRACK_ROUTES, track)) {
    console.warn('[WorldPage] Unknown explicit culture track; chapter routing disabled.', track);
  }
  return null;
}

export function readingTextHref(reading) {
  if (typeof reading !== 'string' || !READING_TEXT_RE.test(reading)) return null;
  return `/japanese/reading?node=${encodeURIComponent(reading)}`;
}
