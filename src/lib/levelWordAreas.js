// 단어 페이지(HSK · JLPT) 네 영역 체크 — 단어 · 문장 · 뜻 · 소리(오너 승인 2026-10-21 KST · 시안 「단어 네 영역 체크」).
// 순수 모듈: 화면 · 계약 테스트가 같은 판정을 쓴다. 새 표 · 새 열 없음 — 이미 있는 기록 셋만 읽는다:
//   단어 영역 = 단어장 카드(복습실 · 뷰어와 같은 FSRS 일정)의 마지막 결과. 실제 일정은 이 영역만 바꾼다.
//   문장 · 뜻 · 소리 = 연습 답(review_events source 'level' — 10-19 바퀴 답과 같은 모양, 활동 전용) + 10-15 탭별 O · X(user_word_facets, 읽기만).
// 영역마다 학습일(04시 경계)의 첫 답만 진도에 들어간다. 같은 날 다른 영역에서 먼저 본 단어의 「알아요」는 세지 않는다(놓침은 센다).
// 연습 영역의 맞힘은 첫 답들을 같은 FSRS 엔진으로 다시 돌려 기억률이 목표(90%) 아래로 내려가면 흐려진다. 단어 영역은 복습일에 흐려진다.
import { FSRS_POLICY, learningDay, practiceRecall, replayPracticeMemory, schedulerTime } from './fsrsScheduler.js';
import { normalizeKnownWord } from './knownWordControl.js';
import { vocabularyRetrievability } from './vocabularyLearningRead.js';

/** 저장 이름(review_events detail.view · user_word_facets.facet와 같다). 화면 탭 「소리」는 'sound'라 audio로 옮긴다. */
export const LEVEL_AREAS = Object.freeze(['word', 'sentence', 'meaning', 'audio']);
export const PRACTICE_AREAS = Object.freeze(['sentence', 'meaning', 'audio']);
export const AREA_LABEL = Object.freeze({ word: '단어', sentence: '문장', meaning: '뜻', audio: '소리' });
export const areaOfView = (view) => (view === 'sound' ? 'audio' : LEVEL_AREAS.includes(view) ? view : null);
export const viewOfArea = (area) => (area === 'audio' ? 'sound' : area);

/**
 * 세 상태(정함 2026-10-21 KST) — 네 칸 이름(다시 · 어려움 · 알맞음 · 쉬움) · 상태 표시(오늘 · 복습 · 졸업)와 겹치지 않는 말.
 * 흐려진 맞힘(faded)은 진도에서 빠지고 처음처럼 보인다. 연습 순서에서만 처음보다 앞에 둔다.
 */
export const AREA_STATES = Object.freeze({
  hit: Object.freeze({ id: 'hit', mark: '✓', ko: '맞힘', en: 'Hit', zhHans: '答对', zhHant: '答對' }),
  miss: Object.freeze({ id: 'miss', mark: '✕', ko: '놓침', en: 'Miss', zhHans: '答错', zhHant: '答錯' }),
  new: Object.freeze({ id: 'new', mark: '·', ko: '처음', en: 'New', zhHans: '新词', zhHant: '新詞' }),
});
export const shownState = (state) => (state === 'faded' ? 'new' : state);

const DAY = 86400000;
const dayOf = (ms) => learningDay(ms);
const wordKey = (word) => normalizeKnownWord(word);

/**
 * 연습 답 줄 → 단어마다 · 영역마다 그날의 첫 답(오래된 순).
 * rows = review_events(source 'level') 줄(순서 무관) — { item_key, correct, detail: { view, cancel?, sameDay? }, created_at }.
 * facets = 10-15 탭 표시 줄 — { word_text, facet, mark: 'o' | 'x', marked_at }. 한 표시 = marked_at의 답 한 건.
 * 취소 줄은 같은 단어 · 영역의 바로 앞 답을 지운다. 같은 날 규칙에 걸린 「알아요」(sameDay)가 그날 첫 답이면 그날은 세지 않는다.
 * @returns {Map<string, Map<string, Array<{day: number, at: number, correct: boolean}>>>} 단어 → 영역 → 첫 답들
 */
export function practiceFirstAnswers(rows, facets = []) {
  const lines = [];
  for (const r of rows || []) {
    const area = r?.detail?.view;
    if (!PRACTICE_AREAS.includes(area) || !r.item_key || typeof r.correct !== 'boolean') continue;
    const at = Date.parse(r.created_at);
    if (!Number.isFinite(at)) continue;
    lines.push({ word: wordKey(r.item_key), area, at, correct: r.correct, cancel: r.detail.cancel === true, sameDay: r.detail.sameDay === true });
  }
  for (const f of facets || []) {
    if (!PRACTICE_AREAS.includes(f?.facet) || (f.mark !== 'o' && f.mark !== 'x') || !f.word_text) continue;
    const at = Date.parse(f.marked_at);
    if (!Number.isFinite(at)) continue;
    lines.push({ word: wordKey(f.word_text), area: f.facet, at, correct: f.mark === 'o', cancel: false, sameDay: false });
  }
  lines.sort((a, b) => a.at - b.at);
  const kept = new Map(); // `${단어}|${영역}` → 답들(취소 반영)
  for (const l of lines) {
    const k = `${l.word}|${l.area}`;
    const list = kept.get(k) || [];
    if (l.cancel) list.pop(); else list.push(l);
    kept.set(k, list);
  }
  const out = new Map();
  for (const [k, list] of kept) {
    const firsts = [];
    let day = null;
    for (const l of list) {
      const d = dayOf(l.at);
      if (d === day) continue;
      day = d;
      if (l.correct && l.sameDay) continue; // 그날 첫 답이 같은 날 규칙에 걸린 알아요 — 그날은 진도 없음
      firsts.push({ day: d, at: l.at, correct: l.correct });
    }
    if (!firsts.length) continue;
    const [word, area] = k.split('|');
    if (!out.has(word)) out.set(word, new Map());
    out.get(word).set(area, firsts);
  }
  return out;
}

/** 연습 영역 하나의 상태 — { state: 'hit' | 'faded' | 'miss' | 'new', recall }. */
export function practiceAreaState(firsts, at = Date.now()) {
  const memory = replayPracticeMemory(firsts);
  if (!memory) return { state: 'new', recall: 0 };
  if (!memory.last) return { state: 'miss', recall: 0 };
  const recall = practiceRecall(memory, dayOf(schedulerTime(at)));
  return { state: recall >= FSRS_POLICY.retention ? 'hit' : 'faded', recall };
}

/**
 * 단어 영역 — 단어장 카드의 마지막 결과(복습실 · 뷰어 채점 포함).
 *   맞힘 = 학습 단계를 지나 다음 복습이 하루 이상 뒤이고 아직 복습일 전 · 옛 「아는 단어」 표시 · 복습 제외
 *   놓침 = 학습 · 재학습 단계(다음 차례가 하루 안) · 이 기기에서 오늘 첫 단어 채점이 다시 · 어려움
 *   흐려짐 = 복습일이 됨(진도에서 빠진다) · 처음 = 채점한 적 없음
 * todayFirst = 이 기기에서 오늘 이 단어의 첫 단어 채점(1–4) 또는 null.
 */
export function wordAreaState({ projection, known = false, todayFirst = null, at = Date.now() } = {}) {
  if (known || projection?.review?.known || projection?.review?.excluded) return 'hit';
  const m = projection?.memory;
  const last = m?.lastReview ? schedulerTime(m.lastReview) : null;
  const graded = !!projection && (projection.source === 'fsrs-v1' ? m.state !== 'New' : last !== null || Number(m?.stability) > 0);
  if (!graded) return 'new';
  if (todayFirst !== null && todayFirst <= 2) return 'miss';
  const nextAt = projection.review.nextQuestionAt;
  if (nextAt === null) return 'miss';
  const next = schedulerTime(nextAt), now = schedulerTime(at);
  // 다음 차례가 하루 안쪽(학습 · 재학습 단계) = 놓침. 등급과 함께 담은 행은 마지막 채점 칸이 비어 담은 시각으로 잰다.
  // 반나절로 가르는 까닭은 fsrs.js REVIEW_GAP_MS와 같다(하루 간격도 몇 ms 모자라게 찍힌다).
  const born = Date.parse(projection.vocabulary?.created_at ?? '');
  const from = last ?? (Number.isFinite(born) ? born : null);
  if (from !== null && next - from < DAY / 2) return 'miss';
  return next <= now ? 'faded' : 'hit';
}

/** 오늘(04시 경계) 이 단어를 어느 영역에서든 먼저 봤는가 — 단어 채점 · 연습 답 · 이 기기에서 펼친 영역. area = 지금 답하는 영역(같은 영역은 빼고 본다). */
export function seenTodayElsewhere({ area, wordGradedToday = false, answeredToday = [], openedIn = null }) {
  if (area !== 'word' && wordGradedToday) return true;
  if (answeredToday.some((a) => a !== area)) return true;
  return openedIn !== null && openedIn !== area;
}

/**
 * 단어 영역 기억률 — 맞힘 · 흐려짐만 단어장 상세 카드와 같은 계산(vocabularyRetrievability)으로 재고, 놓침 · 처음은 0
 * (오너 선택 2026-10-21 KST — FSRS는 답한 직후를 늘 100%로 재므로 방금 놓친 칸이 높게 보이지 않게 한다).
 * 옛 「아는 단어」 · 복습 제외는 본인이 안다고 표시한 단어라 100%. 잴 수 없는 카드(기억 강도 없음 · 시계 역행)는 0.
 */
export function wordAreaRecall({ state, projection, known = false, at = Date.now() }) {
  if (state !== 'hit' && state !== 'faded') return 0;
  if (known || projection?.review?.known || projection?.review?.excluded) return 1;
  try { return vocabularyRetrievability(projection, at) ?? 0; } catch { return 0; }
}

/** 칸 % — 0–100 정수(내림: 맞힘 칸이 반올림으로 100%가 되어 보이지 않게). */
export const areaPercent = (cell) => Math.max(0, Math.min(100, Math.floor((Number(cell?.recall) || 0) * 100 + 1e-9)));

/** 한 단어의 네 영역 — { word, sentence, meaning, audio } 각각 { state, recall }. */
export function levelWordAreas({ firsts, projection, known, todayFirst, at = Date.now() }) {
  const word = wordAreaState({ projection, known, todayFirst, at });
  const out = { word: { state: word, recall: wordAreaRecall({ state: word, projection, known, at }) } };
  for (const area of PRACTICE_AREAS) out[area] = practiceAreaState(firsts?.get(area), at);
  return out;
}

const RANK = { miss: 0, faded: 1, new: 2, hit: 3 };
/**
 * 연습 탭 순서 — 놓침 → 흐려진 맞힘(기억률 낮은 것부터) → 처음 → 맞힘(기억률 낮은 것부터), 오늘 이미 본 단어는 맨 뒤(같은 순서로).
 * entries = 목록 순 단어들, stateOf(key) = { state, recall }, seenToday(key) = boolean.
 */
export function practiceOrder(entries, stateOf, seenToday = () => false) {
  const rows = (entries || []).map((e, i) => {
    const s = stateOf(e.key) || { state: 'new', recall: 0 };
    return { e, i, late: seenToday(e.key) ? 1 : 0, rank: RANK[s.state] ?? 2, recall: s.recall || 0 };
  });
  rows.sort((a, b) => a.late - b.late || a.rank - b.rank || ((a.rank === 1 || a.rank === 3) ? a.recall - b.recall : 0) || a.i - b.i);
  return rows.map((r) => r.e);
}

/** 연습 순서 칩 — 놓침 · 처음(흐려짐 포함) · 맞힘 수. */
export function practiceCounts(keys, stateOf) {
  const out = { miss: 0, new: 0, hit: 0 };
  for (const k of keys || []) out[shownState(stateOf(k)?.state || 'new')] += 1;
  return out;
}

// ── 이 기기의 오늘 기록 — 첫 단어 채점 · 펼쳐 본 영역(다른 기기 · 뷰어에서 펼친 것은 못 잡는다: 받아들인 오차) ──
export const AREA_DAY_KEY = 'manabi:level-areas-day';
/** 저장 값 → 오늘 기록. 날이 바뀌었으면 빈 기록. { day, first: { 단어: 1–4 }, opened: { 단어: 영역 } } */
export function readAreaDay(raw, at = Date.now()) {
  const day = dayOf(schedulerTime(at));
  if (!raw || raw.day !== day) return { day, first: {}, opened: {} };
  if (raw.first && typeof raw.first === 'object' && raw.opened && typeof raw.opened === 'object') return raw; // 같은 날 · 온전한 값은 그대로(화면이 다시 세지 않게)
  return { day, first: raw.first && typeof raw.first === 'object' ? raw.first : {}, opened: raw.opened && typeof raw.opened === 'object' ? raw.opened : {} };
}
/** 첫 단어 채점만 남긴다(같은 날 두 번째부터는 그대로). */
export function noteWordGrade(dayRec, word, rating) {
  const k = wordKey(word);
  if (dayRec.first[k]) return dayRec;
  return { ...dayRec, first: { ...dayRec.first, [k]: rating } };
}
/** 처음 펼친 영역만 남긴다. area = 'word' | 연습 영역 | 'all'(전체 탭 · 찾기 카드). */
export function noteOpened(dayRec, word, area) {
  const k = wordKey(word);
  if (dayRec.opened[k]) return dayRec;
  return { ...dayRec, opened: { ...dayRec.opened, [k]: area } };
}

/** 오늘 이 단어를 단어 영역에서 채점했는가 — 카드의 마지막 채점이 오늘 학습일. */
export function wordGradedOn(projection, at = Date.now()) {
  const last = projection?.memory?.lastReview;
  return !!last && dayOf(schedulerTime(last)) === dayOf(schedulerTime(at));
}

/** 「소리로 확인할 단어」 — 어제까지 단어 영역에서 본 단어 중 소리가 맞힘이 아닌 것(오늘 본 단어는 같은 날 규칙에 걸린다). */
export function soundCheckKeys(entries, { projectionOf, areasOf, at = Date.now() }) {
  const today = dayOf(schedulerTime(at));
  return (entries || []).filter((e) => {
    const last = projectionOf(e.key)?.memory?.lastReview;
    if (!last || dayOf(schedulerTime(last)) >= today) return false;
    return areasOf(e.key)?.audio?.state !== 'hit';
  }).map((e) => e.key);
}
