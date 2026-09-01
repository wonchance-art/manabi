/**
 * ChapterDrills → 기존 문법 SRS 연결.
 *
 * 로그인 사용자는 grammar_review를 재사용하고, 게스트는 같은 행 형식을 localStorage에
 * 보관한다. 드릴 스키마는 건드리지 않으며 카드 식별자는 전역 유일한 drill.id다.
 */
import { calculateFSRS } from './fsrs.js';
import { supabase } from './supabase.js';
import { initialQueueRow, upsertRatedGrammarReview } from './grammarSrs.js';
import { logReviewEvents } from './reviewEvents.js';
import { encounterLookupLang, loadRefVocabLookup } from './refVocabLookup.js';
import { recordVocabEncounters } from '../components/world/vocabEncounters.js';
import DRILL_REFS from './data/drillRefs.json';

export const DRILL_QUEUE_PREFIX = 'drill:';
export const GUEST_DRILL_QUEUE_KEY = 'manabi-drill-review-v1';

/** 채점 결과 → FSRS rating (정답 Good / 오답 Again). */
export function ratingFromDrillResult(correct) {
  return correct ? 3 : 1;
}

export function drillQueueSlug(drillId) {
  return drillId ? `${DRILL_QUEUE_PREFIX}${drillId}` : '';
}

export function drillIdFromQueueSlug(slug) {
  return typeof slug === 'string' && slug.startsWith(DRILL_QUEUE_PREFIX)
    ? slug.slice(DRILL_QUEUE_PREFIX.length)
    : null;
}

/** review_events용 문항 유형 — 기존 숙련 신호 이름과 맞춘다. */
export function drillQuestionType(type) {
  return ({ choice: 'choice', fill: 'cloze', dictation: 'listening', order: 'order' })[type] || 'choice';
}

export function buildDrillReviewEvent(lang, drill, correct) {
  if (!lang || !drill?.id || typeof correct !== 'boolean') return null;
  return {
    lang,
    source: 'grammar',
    item_key: drill.id,
    correct,
    detail: { qtype: drillQuestionType(drill.type), drill_type: drill.type },
  };
}

/**
 * 순수 게스트 큐 갱신. calculator 주입으로 rating 계약과 멱등 등록을 결정적으로 검증한다.
 * 같은 drill id를 다시 풀면 행을 추가하지 않고 그 카드의 FSRS 상태만 전진시킨다.
 */
export function applyDrillResultToQueue(
  rows,
  { lang, drillId, correct },
  { now = new Date(), calculator = calculateFSRS } = {},
) {
  if (!lang || !drillId || typeof correct !== 'boolean') {
    return { rows: Array.isArray(rows) ? [...rows] : [], row: null, rating: null, added: false };
  }
  const current = Array.isArray(rows) ? rows : [];
  const slug = drillQueueSlug(drillId);
  const index = current.findIndex((row) => row?.lang === lang && row?.slug === slug);
  const previous = index >= 0
    ? current[index]
    : initialQueueRow('guest', lang, slug, now);
  const rating = ratingFromDrillResult(correct);
  const row = {
    ...previous,
    ...calculator(rating, previous),
    user_id: 'guest',
    lang,
    slug,
    last_reviewed_at: now.toISOString(),
  };
  const next = [...current];
  if (index >= 0) next[index] = row;
  else next.push(row);
  return { rows: next, row, rating, added: index < 0 };
}

/**
 * 게스트 복습 세션의 채점 결과를 기기 큐에 반영한다.
 * 로그인 사용자의 gradeGrammarReview와 같은 자리에서 쓰이므로 같은 것을 돌려준다 — 다음 간격(일).
 * 큐에 없는 카드는 만들지 않는다(복습은 이미 등록된 카드에만 일어난다).
 */
export function applyGuestReviewResult(
  { lang, slug, rating },
  { now = new Date(), calculator = calculateFSRS } = {},
) {
  if (!lang || !slug || !rating) return null;
  const rows = loadGuestDrillQueue();
  const index = rows.findIndex((row) => row?.lang === lang && row?.slug === slug);
  if (index < 0) return null;
  const row = {
    ...rows[index],
    ...calculator(rating, rows[index]),
    user_id: 'guest',
    lang,
    slug,
    last_reviewed_at: now.toISOString(),
  };
  const next = [...rows];
  next[index] = row;
  saveGuestDrillQueue(next);
  return Math.max(1, Math.round(row.interval ?? 1));
}

export function loadGuestDrillQueue() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(GUEST_DRILL_QUEUE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGuestDrillQueue(rows) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUEST_DRILL_QUEUE_KEY, JSON.stringify(rows));
  } catch {
    // 저장 실패가 채점 UI를 막지 않게 한다.
  }
}

/* ── 드릴 → 단어 만남 (부채 ①, #1077 5490883012 · 실측 정정 5494648246) ────────────
 * 드릴은 **문법** SRS에는 붙어 있었지만(review_events source:'grammar' + grammar_review)
 * 단어장에는 아무것도 보내지 않았다. 그 이음새를 만남(encounter)으로만 잇는다.
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * 드릴 만남 기록 대상 언어 — 네 언어 전부. **얻는 방법만 다르다.**
 *
 * fr·en은 공백이 단어를 갈라 주므로 실행 시점에 쪼개 정본과 대조한다(R1 실측: fr 229/230 ·
 * en 59/61, 오탐 없음). ja·zh는 공백이 그 일을 안 해 주므로 **생성 시점에** 끝내고
 * `data/drillRefs.json`에 굳힌다 — 실행 시점 분석기 호출 0(그래서 클라이언트가 jieba를
 * 지고 다니지 않는다).
 *
 * ⚠ R1은 여기서 「ja·zh는 기계 추출 불가 → refs 저작」으로 닫았다. R2가 그 결론을 뒤집었다.
 * 틀린 건 '기계'가 아니라 **경계를 어디서 얻느냐**였다. 문장 전체를 분석기에 넘기면 실제로
 * 부서진다(`我有时间` → 我·有时·间 / `おにぎりを` → り). 그런데 zh는 v2-T 후처리가 그 사이에
 * 들어오면서 71문장 전수 실측이 전부 맞았고(我·有·时间), ja는 **드릴 문장이 배열 문제라
 * 사람이 이미 문절마다 띄어 뒀다** — 그 경계 안에서만 맞추면 조각 매치가 성립하지 않는다.
 * 그래서 저작이 아니라 **파생**이 됐다. 상세·감사 = `__tests__/drillRefsBuild.test.js`.
 */
export const DRILL_ENCOUNTER_LANGS = new Set(['en', 'fr', 'ja', 'zh']);

/** 생성 시점 refs로 가는 언어 — 공백이 단어를 안 갈라 주는 쪽. */
export const DRILL_REF_LANGS = new Set(['ja', 'zh']);

/** 문장 → 조각. 공백·구두점만 경계로 본다(형태 분석 없음 — 위 주석의 이유). */
const DRILL_TOKEN_SPLIT = /[\s.,!?;:()[\]{}"'\u2018\u2019\u201C\u201D\u2014\u2013\u00AB\u00BB\u2026]+/u;

/**
 * 드릴 하나가 노출하는 목표어 조각 — 정본 대조 **전**의 후보다. 순수 함수.
 * `sentence`가 있는 타입(order·dictation)만 목표어 문장을 들고 있다. choice·fill은
 * `prompt`가 한국어 메타언어이고 `answer`가 조각(`束`·`りょう`)이라 대조할 것이 없다.
 */
export function drillEncounterTokens(drill) {
  const text = typeof drill?.sentence === 'string' ? drill.sentence : '';
  if (!text) return [];
  return text.split(DRILL_TOKEN_SPLIT).filter(Boolean);
}

/**
 * 드릴 하나의 **정본 표기** — ja·zh 전용. 조각이 아니라 이미 대조가 끝난 `main`이다.
 * 생성기가 정본에 없는 것을 떨궈 놓았으므로 여기서 다시 거를 것이 없다.
 */
export function drillEncounterRefs(drill) {
  const refs = DRILL_REFS[drill?.id];
  return Array.isArray(refs) ? refs : [];
}

/**
 * 드릴에서 만난 말을 만남 기록에 얹는다 — 뷰어·NPC와 **같은 부품**(`recordVocabEncounters`).
 * 새 표·새 쿼리 0. 스키마 무변경.
 *
 * · **FSRS 등급은 주지 않는다**(오너 확정): 문장을 맞힌 것을 그 안의 단어를 인출한 것으로
 *   세지 않는다. 순환은 잇되 단어 일정은 흔들지 않는다.
 * · **정오답과 무관하게 기록한다** — 틀렸어도 그 말을 만난 것은 사실이다(뷰어가 드래그만으로
 *   기록하는 것과 같은 기준).
 * · 저장 표기는 **정본 `main`**이다(뷰어와 같은 계약 — 사전 필터·서버 정본과 같은 문자열).
 * · 문맥은 드릴 문장 자체다(`source: 'drill'`) — 처음 만난 표기에만 남고, 나중에 cloze
 *   예문 재료가 된다(`applyEncounterContextExamples`).
 * · 실패는 조용히 — 부가 기록이 채점 UI를 막지 않는다(뷰어 선례).
 *
 * @returns {Promise<string[]>} 실제로 기록한 정본 표기(테스트·계약용)
 */
export async function recordDrillEncounters(lang, drill, { storage, lookup } = {}) {
  const code = encounterLookupLang(lang);
  if (!code || !DRILL_ENCOUNTER_LANGS.has(code)) return [];

  // ja·zh — 생성 시점에 정본 대조를 끝낸 표기. 실행 시점 분석·조회 없이 그대로 얹는다.
  // 여기서 공백 분할로 흘려보내면 안 된다: ja 문절은 조사가 붙어 있고(`あには`) zh는
  // 문장 하나가 통째로 한 조각이 된다 — R1이 유령을 막으려고 세운 그 자리다.
  if (DRILL_REF_LANGS.has(code)) {
    const met = drillEncounterRefs(drill);
    if (met.length === 0) return [];
    try {
      recordVocabEncounters(code, met, storage, { text: drill.sentence, source: 'drill' });
      return met;
    } catch {
      return [];
    }
  }

  const tokens = drillEncounterTokens(drill);
  if (tokens.length === 0) return [];
  try {
    const idx = lookup ?? await loadRefVocabLookup(code);
    if (!idx?.findWord) return [];
    const met = [];
    for (const t of tokens) {
      const hit = idx.findWord(t);
      // 정본에 없는 조각은 버린다 — 유령 표기를 **쓰기 시점에** 막는다(소비 시점 차단과 이중).
      if (hit?.main && !met.includes(hit.main)) met.push(hit.main);
    }
    if (met.length === 0) return [];
    recordVocabEncounters(code, met, storage, { text: drill.sentence, source: 'drill' });
    return met;
  } catch {
    return [];
  }
}

/** ChapterDrills의 한 번 확정된 결과를 append-only 이벤트 + SRS 카드로 보낸다. */
export function recordChapterDrillResult(userId, { lang, drill, correct }) {
  const event = buildDrillReviewEvent(lang, drill, correct);
  if (!event) return null;
  const rating = ratingFromDrillResult(correct);
  const slug = drillQueueSlug(drill.id);

  // 만남 기록은 **곁가지**다 — 반환 프로미스에 얹지 않는다. 호출부(ChapterDrills)가 실패 시
  // 문항을 다시 열어 주는데, 부가 기록이 실패했다고 문항이 되살아나면 안 된다.
  // 게스트도 기록한다(로컬 우선 — 로그인 시 syncVocabEncounters가 서버로 올린다).
  recordDrillEncounters(lang, drill);

  if (userId) {
    logReviewEvents(userId, [event]);
    return upsertRatedGrammarReview(userId, lang, slug, rating);
  }

  const result = applyDrillResultToQueue(loadGuestDrillQueue(), {
    lang,
    drillId: drill.id,
    correct,
  });
  saveGuestDrillQueue(result.rows);
  return result.row;
}

/**
 * 로그인 시 기기 큐를 서버로 옮긴다 — 게스트로 쌓은 복습이 로그인 후 사라지지 않게.
 *
 * 규칙: **서버가 정본이다.** 같은 카드가 이미 서버에 있으면 건드리지 않는다
 * (다른 기기에서 더 진행됐을 수 있다) — `ignoreDuplicates`로 없는 것만 넣는다.
 * 로컬 큐는 **쓰기 성공을 확인한 뒤에만** 비운다. 실패하면 그대로 두고 다음 기회에 다시 시도한다.
 */
export async function migrateGuestDrillQueue(userId) {
  if (!userId) return { migrated: 0 };
  const rows = loadGuestDrillQueue().filter(
    (row) => row?.lang && typeof row.slug === 'string' && row.slug.startsWith(DRILL_QUEUE_PREFIX),
  );
  if (rows.length === 0) return { migrated: 0 };

  const payload = rows.map((row) => ({
    user_id: userId,
    lang: row.lang,
    slug: row.slug,
    interval: row.interval ?? 0,
    ease_factor: row.ease_factor ?? 0,
    repetitions: row.repetitions ?? 0,
    next_review_at: row.next_review_at ?? new Date().toISOString(),
    last_reviewed_at: row.last_reviewed_at ?? null,
  }));

  try {
    const { error } = await supabase
      .from('grammar_review')
      .upsert(payload, { onConflict: 'user_id,lang,slug', ignoreDuplicates: true });
    if (error) return { migrated: 0, error };
  } catch (error) {
    return { migrated: 0, error };
  }

  saveGuestDrillQueue([]);
  return { migrated: payload.length };
}

/** 레지스트리에서 drill id의 소속 챕터와 원본 문항을 찾는다. */
export function findDrillContext(ref, drillId) {
  if (!ref || !drillId) return null;
  for (const chapter of ref.ALL_CHAPTERS || []) {
    const drill = (chapter.drills || []).find((item) => item?.id === drillId);
    if (drill) return { chapter, drill };
  }
  return null;
}

/** 기존 GrammarReviewSession이 소비하는 한 문항 퀴즈 형태로 변환한다. */
export function buildDrillReviewQuiz(drill) {
  const quiz = { meaning: [], apply: [], produce: [] };
  if (!drill) return quiz;
  if (drill.type === 'choice' && drill.answer && Array.isArray(drill.choices)) {
    quiz.meaning.push({
      sentence: drill.prompt,
      full: drill.answer,
      ko: '정답을 골라 보세요.',
      correct: drill.answer,
      distractors: drill.choices.filter((choice) => choice !== drill.answer),
      pron: null,
    });
  } else if (drill.type === 'order' && drill.sentence) {
    quiz.apply.push({
      type: 'order',
      tokens: drill.sentence.split(/\s+/).filter(Boolean),
      answer: drill.sentence,
      ko: drill.prompt || '문장을 순서대로 배열해 보세요.',
      pron: null,
    });
  } else {
    const main = drill.type === 'dictation' ? drill.sentence : drill.answer;
    if (main) {
      quiz.produce.push({
        ko: drill.prompt || (drill.type === 'dictation' ? '문장을 다시 떠올려 보세요.' : '빈칸에 들어갈 말을 떠올려 보세요.'),
        main,
        pron: null,
      });
    }
  }
  return quiz;
}
