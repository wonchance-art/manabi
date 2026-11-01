// 카드 종류 — 단어 하나에 카드 셋(단어 → 뜻 · 뜻 → 단어 · 듣기) · CARD-TYPES-001(오너 방향 승인 2026-11-01 KST · 설계 docs/design/card-types.md §2 · §3).
//
// 순수 모듈(네트워크 · supabase 없음). 서버 규칙의 정본은 DB(20261101120000_fsrs_card_kinds — fsrs_private.variant_enrollment_open ·
// fsrs_apply_operation)이고, 여기는 화면 · 줄 짜기가 같은 규칙을 미리 보는 거울이다(서버가 다시 본다).
// - 카드 항목(fsrs_list_states · fsrs_read_state · 반영 응답)은 종류 카드에만 kind · vocabularyId를 싣는다(서버 JS publicState). 칸이 없으면
//   단어 → 뜻 카드이고 카드 id = 단어 id다(영구 CHECK) — 단계 2 전 항목 · 지금 화면이 받는 항목 모양 그대로.
// - 켜진 종류의 기본값은 DB 한 곳(fsrs_private.admission_settings.default_card_kinds — 3단계 스위치)에만 있다. 입장 상태(cardKinds)를 못 받으면
//   단어 → 뜻 하나로 본다(RECOGNITION_ONLY — 스위치가 아니라 「모르면 지금처럼」).
// - 형제 규칙(Anki 「bury siblings」): 같은 단어의 카드는 학습일(04:00 KST) 하나에 한 장. 파생 규칙이라 표 · 서버 칸이 없다 —
//   카드의 lastReview(마지막 채점 시각)가 오늘 학습일이면 그 카드는 오늘 「꺼낸」 카드다. 되돌리기는 lastReview를 되돌려 자연히 풀린다.
import { learningDay } from './fsrsScheduler.js';

export const CARD_KINDS = Object.freeze(['recognition', 'production', 'listening']);
export const RECOGNITION_ONLY = Object.freeze(['recognition']);
const ORDER = Object.fromEntries(CARD_KINDS.map((kind, index) => [kind, index]));
const fail = code => { throw Object.assign(new Error(code), { code }); };
// 화면 시계(now() + 서버 시차)는 밀리초 소수일 수 있다 — 학습일만 보므로 버린다.
const dayAt = at => learningDay(typeof at === 'number' ? Math.trunc(at) : at);

export const cardKindOf = entry => entry?.kind ?? 'recognition';
/** 카드가 묻는 단어 id — 단어 → 뜻 카드는 카드 id 그대로. */
export const cardVocabularyId = entry => entry?.vocabularyId ?? entry?.cardId;

/** 켜진 종류 → 정해진 순서(단어 → 뜻 · 뜻 → 단어 · 듣기)의 얼린 배열. 단어 → 뜻이 없거나 모르는 종류 · 겹침이면 거절(서버 CHECK와 같은 네 집합). */
export function normalizeCardKinds(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > CARD_KINDS.length
    || value.some(kind => !Object.hasOwn(ORDER, kind)) || new Set(value).size !== value.length || !value.includes('recognition')) fail('invalid_card_kinds');
  return Object.freeze([...value].sort((a, b) => ORDER[a] - ORDER[b]));
}

/** 입장 상태의 켜진 종류(없거나 잘못되면 단어 → 뜻 하나). */
export function admissionCardKinds(status) {
  try { return status?.cardKinds ? normalizeCardKinds(status.cardKinds) : RECOGNITION_ONLY; } catch { return RECOGNITION_ONLY; }
}

/** 첫 문제가 하루 새 단어 몫을 쓰는 카드인가 — 단어 → 뜻(새 단어 도입)의 첫 질문만(서버 fsrs_apply_operation · fsrs_apply_learning_operation과 같다). */
export const fsrsTakesNewQuota = entry => cardKindOf(entry) === 'recognition' && entry?.card?.state === 'New' && !entry?.firstQuestionAt;

const dayOf = (value, card) => learningDay(value, card?.timeZone || undefined, Number.isInteger(card?.rolloverHour) ? card.rolloverHour : undefined);
/** 이 카드를 학습일 day에 채점했나(마지막 채점 = lastReview). */
export function answeredOnDay(card, day) {
  if (!card?.lastReview) return false;
  try { return dayOf(card.lastReview, card) === day; } catch { return false; }
}

/**
 * 형제 규칙 — 줄 후보(candidates: 지금 물을 수 있는 카드 항목) 가운데 단어마다 오늘 낼 카드만 남긴다. cards = 그 사용자의 카드 전부(후보 밖 형제가
 * 오늘 채점됐는지 보려고 — 기본 = 후보). 규칙(설계 §3):
 *   ① 오늘 이미 채점한 카드는 그대로 이어 푼다(학습 단계 1분 · 10분을 끊지 않는다)
 *   ② 같은 단어의 다른 카드를 오늘 채점했으면 그날 처음 꺼낼 카드는 다음 학습일로(기한은 그대로 — 줄에서만 뺀다)
 *   ③ 아무것도 채점하지 않았으면 후보 중 한 장 — 더 오래 밀린 것(기한이 이른 것), 같으면 단어 → 뜻 · 뜻 → 단어 · 듣기 순
 * 단어마다 카드가 한 장이면 아무것도 빼지 않는다(지금 줄 그대로 — 계약 테스트). 순서는 후보 순서 그대로다.
 */
export function pickSiblings(candidates, { cards = candidates, at = Date.now() } = {}) {
  const list = candidates || [];
  const byWord = new Map();
  for (const entry of [...(cards || []), ...list]) {
    const word = cardVocabularyId(entry);
    if (!byWord.has(word)) byWord.set(word, new Map());
    byWord.get(word).set(entry.cardId, entry);
  }
  if ([...byWord.values()].every(group => group.size <= 1)) return [...list];
  const today = dayAt(at);
  const due = entry => { const ms = Date.parse(entry?.card?.due); return Number.isFinite(ms) ? ms : Infinity; };
  const rank = (a, b) => (due(a) - due(b)) || (ORDER[cardKindOf(a)] - ORDER[cardKindOf(b)]) || String(a.cardId).localeCompare(String(b.cardId));
  const chosen = new Map();
  for (const entry of list) {
    if (answeredOnDay(entry.card, today)) continue;
    const word = cardVocabularyId(entry), best = chosen.get(word);
    if (!best || rank(entry, best) < 0) chosen.set(word, entry);
  }
  return list.filter(entry => {
    const group = byWord.get(cardVocabularyId(entry));
    if (group.size <= 1 || answeredOnDay(entry.card, today)) return true;
    if ([...group.values()].some(other => other.cardId !== entry.cardId && answeredOnDay(other.card, today))) return false;
    return chosen.get(cardVocabularyId(entry))?.cardId === entry.cardId;
  });
}

/**
 * 차례로 붙이기(설계 §2 · §3) — 이 단어에 지금 붙일 다음 종류('production' | 'listening') 또는 null. 서버 등록 조건의 거울
 * (fsrs_private.variant_enrollment_open — 서버가 다시 본다): cards = 그 단어의 카드 전부, cardKinds = 켜진 종류, hasExample = 예문이 있나
 * (듣기는 예문 기준 — 서버는 화면의 예문을 모르므로 등록 요청이 hasExample: true를 주장한다).
 *   ① 단어 → 뜻이 날 단위(Review)로 넘어갔고 마지막 채점이 앞 학습일 ② 오늘 붙인 종류 카드가 없다(단어당 하루 한 장)
 *   ③ 뜻 → 단어 먼저, 듣기는 뜻 → 단어가 앞 학습일에 생긴 뒤(뜻 → 단어가 꺼져 있고 없으면 단어 → 뜻 바로 뒤).
 * 붙은 날은 카드의 introducedAt으로 본다(서버는 enrolled_at — 같은 등록 시각, 서버 시계).
 */
export function nextVariantKind({ cards = [], cardKinds = RECOGNITION_ONLY, hasExample = false, at = Date.now() } = {}) {
  let kinds;
  try { kinds = normalizeCardKinds(cardKinds); } catch { return null; }
  const today = dayAt(at);
  const recognition = cards.find(entry => cardKindOf(entry) === 'recognition');
  if (!recognition || recognition.card?.state !== 'Review' || !recognition.card.lastReview) return null;
  let reviewed;
  try { reviewed = dayOf(recognition.card.lastReview, recognition.card); } catch { return null; }
  if (!(reviewed < today)) return null;
  const variants = cards.filter(entry => cardKindOf(entry) !== 'recognition');
  const introduced = entry => { try { return dayOf(entry.card.introducedAt, entry.card); } catch { return Infinity; } };
  if (variants.some(entry => introduced(entry) >= today)) return null;
  const of = kind => variants.find(entry => cardKindOf(entry) === kind);
  if (kinds.includes('production') && !of('production')) return 'production';
  if (kinds.includes('listening') && hasExample === true && !of('listening')) {
    const production = of('production');
    if (production ? introduced(production) < today : !kinds.includes('production')) return 'listening';
  }
  return null;
}
