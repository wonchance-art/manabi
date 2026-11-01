// 단어 페이지의 카드 종류(CARD-TYPES-001 3단계 — 설계 docs/design/card-types.md §2 · §3 · §5) — 순수 모듈(네트워크 · supabase 없음).
// 줄 규칙의 정본은 공유 모듈 fsrsCardKinds(형제 pickSiblings · 차례로 붙이기 nextVariantKind)이고 서버가 다시 본다. 여기는 단어 페이지가
// 그 규칙을 「단어 열쇠(entry.key)」 세계에 잇는 일만 한다:
//   카드 열쇠 — 단어 → 뜻 = 단어 열쇠 그대로(지금 줄 · 리스트 · 되돌리기 열쇠가 그대로), 종류 카드 = 「단어 열쇠@@종류」.
//   종류 카드의 투영 — 단어장 읽기(단어당 단어 → 뜻 한 줄)에는 종류 카드가 없다(단계 2 결정). 카드 목록(fsrs_list_states — 복습실과 같은
//   읽기)의 항목을 단어장 투영과 같은 함수(projectVocabularyLearning)로 바꿔, 상태 · 네 칸 미리보기 · 미리 학습 판정을 지금 함수 그대로 쓴다.
//   단어 → 뜻만 켜진 동안(기본값)에는 이 모듈이 아무것도 만들지 않는다 — 카드 목록을 읽지도 않는다(화면이 켜진 종류를 보고 정한다).
import { CARD_KINDS, RECOGNITION_ONLY, cardKindOf, cardVocabularyId, nextVariantKind, normalizeCardKinds, pickSiblings } from './fsrsCardKinds.js';
import { projectVocabularyLearning } from './vocabularyLearningRead.js';
import { learningDay, schedulerTime } from './fsrsScheduler.js';

const SEP = '@@';
/** 카드 열쇠 — 단어 → 뜻은 단어 열쇠 그대로. */
export const levelCardKey = (wordKey, kind = 'recognition') => (kind === 'recognition' ? wordKey : `${wordKey}${SEP}${kind}`);
/** 카드 열쇠 → { wordKey, kind }. 종류가 붙지 않은 열쇠는 단어 → 뜻. */
export function parseLevelCardKey(key) {
  const text = String(key ?? '');
  const at = text.lastIndexOf(SEP);
  const kind = at > 0 ? text.slice(at + SEP.length) : '';
  return CARD_KINDS.includes(kind) && kind !== 'recognition' ? { wordKey: text.slice(0, at), kind } : { wordKey: text, kind: 'recognition' };
}

/** 리스트 · 한 단어 카드가 그릴 앞면(설계 §2) — 단어 → 뜻 = 'word', 뜻 → 단어 = 'meaning', 듣기 = 'sound'(소리 단추만). */
export const LEVEL_KIND_VIEW = Object.freeze({ recognition: 'word', production: 'meaning', listening: 'sound' });
export const levelKindView = (kind) => LEVEL_KIND_VIEW[kind] || 'word';

/** 「카드」 줄(학습 옵션 시트) 세 칸 — 이름은 이 표 한 곳. 단어 → 뜻은 늘 켜짐(잠김). */
export const LEVEL_CARD_KIND_ITEMS = Object.freeze([
  Object.freeze({ id: 'recognition', label: '단어 → 뜻', locked: true }),
  Object.freeze({ id: 'production', label: '뜻 → 단어' }),
  Object.freeze({ id: 'listening', label: '듣기' }),
]);
export const LEVEL_CARD_KIND_NOTE = '단어 → 뜻은 늘 켜짐 · 끈 카드는 일정을 지우지 않고 쉬어요';

/** 「카드」 줄에서 한 칸을 눌렀을 때의 다음 집합(정해진 순서) — 단어 → 뜻(잠김)은 그대로 돌려준다. */
export function toggleLevelCardKind(kinds, kind) {
  let current;
  try { current = normalizeCardKinds(kinds); } catch { current = RECOGNITION_ONLY; }
  if (kind === 'recognition' || !CARD_KINDS.includes(kind)) return current;
  return normalizeCardKinds(current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind]);
}

/**
 * 카드 목록 항목(fsrs_list_states · 서버 publicState) → 단어장 투영 모양. 상태 · 미리보기 · 기다림 판정이 단어 → 뜻과 같은 함수를 쓴다.
 * 쉬는 카드(resting — 꺼진 종류) · 제외 · 아는 단어는 묻지 않는다(available false). 읽을 수 없는 항목은 null.
 */
export function variantProjection(entry, { actorId, at = Date.now() } = {}) {
  if (!entry?.card || !actorId) return null;
  const known = entry.known === true, excluded = entry.excluded === true;
  try {
    return projectVocabularyLearning({ actorId, vocabulary: { id: entry.cardId, user_id: actorId }, enabled: true, registryAvailable: true, complete: true,
      at: Math.max(schedulerTime(at), Date.parse(entry.card.lastReview || 0) || 0, Date.parse(entry.card.introducedAt || 0) || 0),
      registry: { cardId: entry.cardId, userId: actorId, enrolled: true, card: entry.card, known, excluded,
        eligible: entry.eligible !== false && entry.resting !== true && !known && !excluded,
        nextQuestionAt: entry.nextQuestionAt ?? entry.card.due, firstQuestionAt: entry.firstQuestionAt ?? null,
        attempt: entry.attempt ? { ...entry.attempt, userId: actorId, cardId: entry.cardId } : null } });
  } catch { return null; }
}

/** 카드 목록 → 단어 id마다 그 단어의 카드 전부(단어 → 뜻 포함). */
export function cardsByVocabulary(cards) {
  const out = new Map();
  for (const entry of cards || []) {
    if (!entry?.cardId || !entry.card) continue;
    const id = cardVocabularyId(entry);
    if (!out.has(id)) out.set(id, []);
    out.get(id).push(entry);
  }
  return out;
}

/** 학습일 day 안에 차례가 오는(또는 이미 지난) 카드인가 — 오늘 줄 후보. */
function dueOnOrBefore(entry, day) {
  const next = Date.parse(entry?.nextQuestionAt ?? entry?.card?.due ?? '');
  if (!Number.isFinite(next)) return false;
  try { return learningDay(next) <= day; } catch { return false; }
}

/**
 * 단어 페이지의 종류 카드 계획 — 화면이 줄 · 리스트 · 시트에 쓰는 값 셋.
 *   variants  = 카드 열쇠 → { key, wordKey, kind, entry(카드 목록 항목), projection } — 켜진 종류 · 이 레벨 단어의 종류 카드만(쉬는 카드 빼고)
 *   hidden    = 오늘 줄에 세우지 않는 카드 열쇠(형제 규칙 — 같은 단어의 다른 카드가 오늘 나온다 · 이미 나왔다). 단어 → 뜻 열쇠도 들 수 있다.
 *   enroll    = 지금 붙일 종류 카드 { wordKey, vocabularyId, kind, hasExample } — nextVariantKind(서버 등록 조건의 거울)가 고른 것
 * entries = 이 레벨 단어(목록 순), vocabularyIdOf(wordKey) = 그 단어의 단어장 id(없으면 null), hasExampleOf(wordKey) = 예문이 있나,
 * cards = 카드 목록 항목 전부, cardKinds = 켜진 종류. 단어 → 뜻만 켜져 있으면 셋 다 빈 값이다(지금 화면 그대로).
 */
export function planLevelCardKinds({ entries, vocabularyIdOf, hasExampleOf = () => false, cards, cardKinds = RECOGNITION_ONLY, actorId, at = Date.now() }) {
  const empty = { variants: new Map(), hidden: new Set(), enroll: [] };
  let kinds;
  try { kinds = normalizeCardKinds(cardKinds); } catch { return empty; }
  if (kinds.length < 2 || !actorId) return empty;
  const byWord = cardsByVocabulary(cards);
  const today = learningDay(schedulerTime(at));
  const out = { variants: new Map(), hidden: new Set(), enroll: [] };
  for (const e of entries || []) {
    const vocabularyId = vocabularyIdOf(e.key);
    const own = vocabularyId ? byWord.get(vocabularyId) : null;
    if (!own?.length) continue;
    const on = own.filter((c) => kinds.includes(cardKindOf(c)) && c.resting !== true);
    for (const c of on) {
      const kind = cardKindOf(c);
      if (kind === 'recognition') continue;
      const projection = variantProjection(c, { actorId, at });
      if (!projection) continue;
      const key = levelCardKey(e.key, kind);
      out.variants.set(key, { key, wordKey: e.key, kind, entry: c, projection });
    }
    // 형제 규칙 — 오늘 줄 후보(오늘 학습일 안에 차례 · 묻을 수 있는 카드) 중 단어마다 오늘 낼 카드만. 후보 밖 형제(오늘 채점 · 내일 차례)도 본다.
    const candidates = on.filter((c) => c.eligible !== false && !c.known && !c.excluded && dueOnOrBefore(c, today));
    if (candidates.length > 1 || (candidates.length === 1 && on.length > 1)) {
      const kept = new Set(pickSiblings(candidates, { cards: own, at }).map((c) => c.cardId));
      for (const c of candidates) if (!kept.has(c.cardId)) out.hidden.add(levelCardKey(e.key, cardKindOf(c)));
    }
    const hasExample = hasExampleOf(e.key) === true;
    const kind = nextVariantKind({ cards: own, cardKinds: kinds, hasExample, at });
    if (kind) out.enroll.push({ wordKey: e.key, vocabularyId, kind, ...(kind === 'listening' ? { hasExample: true } : {}) });
  }
  return out;
}
