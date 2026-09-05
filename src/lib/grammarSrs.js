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

/** 복습 결과 반영 — FSRS로 다음 스케줄 계산 후 저장. 성공 시 갱신 행 반환. */
export async function gradeGrammarReview(row, rating) {
  if (!row?.user_id) return null;
  try {
    const { calculateFSRS } = await import('./fsrs.js');
    const next = calculateFSRS(rating, row);
    const updates = { ...next, last_reviewed_at: new Date().toISOString() };
    const { error } = await supabase
      .from('grammar_review')
      .update(updates)
      .eq('user_id', row.user_id)
      .eq('lang', row.lang)
      .eq('slug', row.slug);
    if (error) return null;
    return { ...row, ...updates };
  } catch {
    return null;
  }
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
