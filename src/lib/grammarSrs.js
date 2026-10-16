/**
 * 문법 SRS 복습 큐 (grammar_review 테이블)
 * 챕터 퀴즈(패턴 체크)를 통과한 챕터가 FSRS 스케줄로 되돌아온다.
 * 컬럼 규약은 user_vocabulary와 동일: interval→stability, ease_factor→difficulty,
 * repetitions→lapses (src/lib/fsrs.js 참고).
 * 모든 함수는 방어적 — 테이블 부재·비로그인·네트워크 실패 시 조용히 기본값을 돌려준다
 * (배포와 마이그레이션 적용 순서에 독립).
 */
import { supabase } from './supabase.js';

/** 정답률 → FSRS rating (1 Again / 2 Hard / 3 Good / 4 Easy) */
export function ratingFromScore(right, total) {
  if (!total) return 1;
  const r = right / total;
  if (r >= 1) return 4;
  if (r >= 0.75) return 3;
  if (r >= 0.5) return 2;
  return 1;
}

/** 첫 등록 상태 — 신규 카드(interval 0), 첫 복습은 내일 */
export function initialQueueRow(userId, lang, slug, now = new Date()) {
  const first = new Date(now);
  first.setDate(first.getDate() + 1);
  return {
    user_id: userId,
    lang,
    slug,
    interval: 0,
    ease_factor: 0,
    repetitions: 0,
    next_review_at: first.toISOString(),
  };
}

/**
 * 백필 스케줄 계산 — 이미 통과했지만 큐에 없는 챕터를 하루 perDay개씩 분산 등록.
 * 오래전에 통과한 챕터부터(입력 순서 유지) 첫 묶음은 오늘 바로 due.
 * @param {string} userId
 * @param {Array<{lang: string, slug: string}>} passed - 통과 챕터(오래된 순)
 * @param {Set<string>} existingKeys - 이미 큐에 있는 `${lang}:${slug}`
 * @returns {Array} grammar_review insert rows
 */
export function staggerBackfillRows(userId, passed, existingKeys, now = new Date(), perDay = 10) {
  const rows = [];
  const seen = new Set(existingKeys);
  let i = 0;
  for (const p of passed) {
    if (!p?.lang || !p?.slug) continue;
    const key = `${p.lang}:${p.slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const at = new Date(now);
    at.setDate(at.getDate() + Math.floor(i / perDay));
    rows.push({
      user_id: userId,
      lang: p.lang,
      slug: p.slug,
      interval: 0,
      ease_factor: 0,
      repetitions: 0,
      next_review_at: at.toISOString(),
    });
    i++;
  }
  return rows;
}

/** 챕터 퀴즈 통과 → 복습 큐 등록. 이미 있으면 무시(복습 진행 상태 보존). */
export function enqueueGrammarReview(userId, lang, slug) {
  if (!userId || !lang || !slug) return;
  supabase
    .from('grammar_review')
    .upsert(initialQueueRow(userId, lang, slug), {
      onConflict: 'user_id,lang,slug',
      ignoreDuplicates: true,
    })
    .then(() => {}, () => {});
}

/** 복습 기한이 된 챕터 목록 (기한 오래된 순) */
export async function fetchDueGrammar(userId, { limit = 10 } = {}) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('grammar_review')
      .select('*')
      .eq('user_id', userId)
      .lte('next_review_at', new Date().toISOString())
      .order('next_review_at', { ascending: true })
      .limit(limit);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

/** 홈 카드용 due 카운트 */
export async function countDueGrammar(userId) {
  if (!userId) return 0;
  try {
    const { count, error } = await supabase
      .from('grammar_review')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('next_review_at', new Date().toISOString());
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

// FSRS 모듈은 첫 채점 때 동적으로 불러온다. 한 번 불러온 뒤에는 pagehide처럼 기다릴 수 없는 자리에서도
// 같은 계산을 동기로 쓸 수 있게 붙잡아 둔다(sendGrammarGradeKeepalive).
let fsrsModule = null;

/** 채점 시각(reviewedAt)보다 이전에 채점된 행만 바꾼다 — 같은 채점이 두 번 닿아도(재시도 · keepalive) 한 번만 반영된다. */
const olderThan = reviewedAt => `last_reviewed_at.is.null,last_reviewed_at.lt."${reviewedAt}"`;

/** gradeGrammarReview · keepalive가 같은 값을 쓴다 — 저장 경로가 둘이어도 일정 계산은 하나다. */
function grammarGradeUpdates(row, rating, reviewedAt) {
  return { ...fsrsModule.calculateFSRS(rating, row), last_reviewed_at: reviewedAt };
}

/**
 * 복습 결과 반영 — FSRS로 다음 스케줄 계산 후 저장. 성공 시 갱신 행 반환.
 * reviewedAt을 주면(보류함 재시도) 그 시각을 last_reviewed_at으로 싣고, 서버 행이 그보다 이전에 채점됐을 때만 바꾼다
 * — 응답만 잃은 저장을 다시 보내도 간격이 두 번 늘지 않고, 그사이 다른 기기의 더 최신 채점을 덮지 않는다
 * (reviewOutbox.shouldApplyGrade와 같은 원칙). 조건에 걸려 바꾸지 않은 것도 성공이다 — 이미 반영된 채점이다.
 */
export async function gradeGrammarReview(row, rating, { reviewedAt = null } = {}) {
  if (!row?.user_id) return null;
  try {
    fsrsModule ||= await import('./fsrs.js');
    const updates = grammarGradeUpdates(row, rating, reviewedAt || new Date().toISOString());
    let query = supabase
      .from('grammar_review')
      .update(updates)
      .eq('user_id', row.user_id)
      .eq('lang', row.lang)
      .eq('slug', row.slug);
    if (reviewedAt) query = query.or(olderThan(reviewedAt));
    const { error } = await query;
    if (error) return null;
    return { ...row, ...updates };
  } catch {
    return null;
  }
}

/**
 * 페이지가 닫히는 순간(pagehide)의 마지막 시도 — supabase-js는 요청마다 keepalive를 줄 수 없고 인증 헤더도
 * 비동기로 붙여, 탭을 닫으면 요청이 나가기 전에 끊긴다. 그래서 같은 PostgREST UPDATE(같은 값 · 같은 reviewedAt 조건)를
 * keepalive fetch로 그 자리에서 보낸다. 토큰은 세션 계정의 것을 호출부가 미리 받아 둔다. FSRS 모듈이 아직 없으면 보내지 않는다.
 * @returns {Promise<boolean>}
 */
export function sendGrammarGradeKeepalive(row, rating, {
  reviewedAt, accessToken,
  url = process.env.NEXT_PUBLIC_SUPABASE_URL, apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  fetchImpl = typeof fetch === 'function' ? fetch : null,
} = {}) {
  if (!row?.user_id || !row?.slug || !reviewedAt || !accessToken || !url || !apiKey || !fetchImpl || !fsrsModule) {
    return Promise.resolve(false);
  }
  try {
    const query = new URLSearchParams({
      user_id: `eq.${row.user_id}`, lang: `eq.${row.lang}`, slug: `eq.${row.slug}`, or: `(${olderThan(reviewedAt)})`,
    });
    return fetchImpl(`${url}/rest/v1/grammar_review?${query}`, {
      method: 'PATCH',
      keepalive: true,
      headers: { apikey: apiKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(grammarGradeUpdates(row, rating, reviewedAt)),
    }).then(res => !!res?.ok, () => false);
  } catch {
    return Promise.resolve(false);
  }
}

/** 보류한 문법 재채점을 다시 보내는 최대 횟수(첫 시도 제외). 넘으면 버리고 알린다 — 끝없이 붙잡지 않는다. */
export const GRAMMAR_RETRY_LIMIT = 3;

const browserOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/**
 * 문법 재스케줄 보류함 — gradeGrammarReview가 실패(null)하면 그 챕터 채점을 남겨 두었다가
 * retry()(온라인 복귀 · 세션 종료 · 화면 떠남)에서 같은 정본 함수로 다시 보낸다.
 * review_events는 오프라인 큐로 살아남는데 grammar_review 일정만 조용히 사라지던 틈을 메운다.
 * 같은 챕터(사용자 · 언어 · slug)가 다시 들어오면 마지막 채점만 남긴다.
 *
 * 범위: 이 보류함은 **같은 화면 안**(메모리)이다. 오프라인인 채로 화면을 떠나거나 탭을 닫으면 남지 않는다 —
 * 그때 호출부가 알린다. 기기 큐(reviewOutbox · fsrsOperationOutbox)는 어휘 이벤트 · 어휘 FSRS 작업 전용 형식이라
 * 문법 일정을 싣지 않는다(StudySessionPage 주석 참고).
 * - 오프라인(navigator.onLine === false)일 때 retry는 시도 횟수를 쓰지 않는다 — 실패할 게 뻔한 시도로 상한을 태우지 않는다.
 * - 채점 시각(reviewedAt)을 첫 제출 때 고정해 모든 재시도에 싣는다 — 두 번 닿아도 한 번만 반영된다.
 * @param {{grade?: Function, limit?: number, onGiveUp?: Function, isOnline?: Function, now?: Function}} [options]
 */
export function createGrammarRetry({
  grade = gradeGrammarReview, limit = GRAMMAR_RETRY_LIMIT, onGiveUp = () => {}, isOnline = browserOnline, now = () => new Date(),
} = {}) {
  const pending = new Map(); // key → { row, rating, reviewedAt, retries }
  let running = null;
  const keyOf = row => `${row.user_id}:${row.lang}:${row.slug}`;
  const attempt = async (key, entry, send = grade, { mayGiveUp = true } = {}) => {
    let saved = null;
    try { saved = await send(entry.row, entry.rating, { reviewedAt: entry.reviewedAt }); } catch { saved = null; }
    if (pending.get(key) !== entry) return; // 그사이 같은 챕터의 새 채점이 들어왔다 — 그쪽이 정본이다.
    if (saved) { pending.delete(key); return; }
    if (mayGiveUp && entry.retries >= limit) { pending.delete(key); onGiveUp(entry.row); }
  };
  const accepted = accept => [...pending].filter(([, entry]) => accept(entry.row));
  return {
    /** 첫 시도 — 성공하면 보류할 것이 없다. 실패하면 보류(같은 챕터는 덮어쓴다). */
    async submit(row, rating) {
      if (!row?.user_id || !row?.slug) return null;
      const key = keyOf(row), entry = { row, rating, reviewedAt: now().toISOString(), retries: 0 };
      pending.set(key, entry);
      await attempt(key, entry);
      return pending.get(key) === entry ? null : true;
    },
    /** 보류분을 다시 보낸다. 겹쳐 부르면 진행 중인 한 번을 같이 기다린다. accept로 계정이 바뀐 보류분은 건너뛴다. */
    retry(accept = () => true) {
      if (running) return running;
      if (!isOnline()) return Promise.resolve(); // 연결이 없다 — 횟수를 쓰지 않고 online을 기다린다.
      const entries = accepted(accept);
      if (!entries.length) return Promise.resolve();
      running = Promise.all(entries.map(([key, entry]) => { entry.retries += 1; return attempt(key, entry); }))
        .finally(() => { running = null; });
      return running;
    },
    /**
     * 페이지가 닫히는 순간의 마지막 시도 — send(keepalive)로 보내고, 횟수를 쓰지도 포기하지도 않는다
     * (닫히지 않고 bfcache로 돌아오면 보류분은 그대로 남아 다음 retry가 다시 보낸다 — 두 번 닿아도 reviewedAt 조건이 한 번만 반영).
     */
    beacon(accept = () => true, send) {
      if (!send || !isOnline()) return Promise.resolve();
      return Promise.all(accepted(accept).map(([key, entry]) => attempt(key, entry, send, { mayGiveUp: false })));
    },
    size: () => pending.size,
  };
}

/**
 * 단일 문법 카드의 즉시 채점 등록/갱신.
 *
 * ChapterDrills처럼 "등록과 첫 채점"이 같은 순간에 일어나는 호출부용이다.
 * 기존 행이 있으면 현재 FSRS 상태에서 이어 가고, 없으면 신규 카드 상태에서 시작한다.
 * upsert 충돌 키는 기존 grammar_review 계약(user_id,lang,slug)을 그대로 쓴다.
 */
export async function upsertRatedGrammarReview(userId, lang, slug, rating, now = new Date()) {
  if (!userId || !lang || !slug || ![1, 2, 3, 4].includes(rating)) return null;
  try {
    const { data, error } = await supabase
      .from('grammar_review')
      .select('*')
      .eq('user_id', userId)
      .eq('lang', lang)
      .eq('slug', slug)
      .maybeSingle();
    if (error) return null;

    const previous = data || initialQueueRow(userId, lang, slug, now);
    const { calculateFSRS } = await import('./fsrs.js');
    const next = calculateFSRS(rating, previous);
    const row = {
      ...previous,
      ...next,
      user_id: userId,
      lang,
      slug,
      last_reviewed_at: now.toISOString(),
    };
    const { error: writeError } = await supabase
      .from('grammar_review')
      .upsert(row, { onConflict: 'user_id,lang,slug' });
    if (writeError) return null;
    return row;
  } catch {
    return null;
  }
}
