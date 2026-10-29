import { createClient } from '@supabase/supabase-js';
import { kstDateString } from '../growthStats';
import { SUGGESTION_FIELDS, SUGGESTION_ID, canReadSuggestion, suggestionSource } from '../suggestionReading';
import { ONDEMAND_SOURCE, isOnDemandSuggestion } from '../suggestionSources';

export function suggestionClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
}

// A global suggestion may never point visitors at somebody else's private import.
// Explicit public scope is required even when an older permissive RLS policy exists.
export async function publicSuggestionTargets(client, rows) {
  const ids = [...new Set(rows.filter(s => !isOnDemandSuggestion(s)).map(s => s.material_id).filter(Boolean))];
  const ready = new Set();
  if (ids.length) {
    const result = await client.from('reading_materials').select('id, processed_json->status')
      .in('id', ids).eq('visibility', 'public');
    if (!result.error) for (const row of result.data || []) {
      if (['completed', 'partial'].includes(row.status)) ready.add(String(row.id));
    }
  }
  return rows.map(s => ({ ...s, material_id: ready.has(String(s.material_id)) ? s.material_id : null,
    transcript: isOnDemandSuggestion(s) ? null : s.transcript }));
}

export async function readSuggestion(client, id) {
  if (!SUGGESTION_ID.test(id || '')) return null;
  const { data, error } = await client.from('daily_suggestions').select(SUGGESTION_FIELDS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await publicSuggestionTargets(client, [data]))[0];
}

// 판(ISR)을 만드는 동안 조회를 기다리는 한도 — 넘기면 본문 없이 굽고 브라우저가 예전처럼 받는다(판이 DB에 묶여 멈추지 않게).
export const SUGGESTION_PREFETCH_BUDGET_MS = 1500;

/**
 * 추천 읽을거리 한 편의 판(/suggestions/[id] ISR — GUEST-STATIC-001 6단계 · FIELD-AUDIT F5)이 첫 HTML에 실을 행.
 * /api/suggestions/[id]와 같은 조회(readSuggestion · 쿠키 없는 anon 클라이언트 · 공개 자료 링크만)라 판은 누구에게나 같은 바이트다.
 * 없는 글 · 실패 · 시간 초과 → null — 판은 본문 없이 굽고, 브라우저가 지금처럼 받아 안내 · 다시 시도를 그린다.
 * @returns {Promise<null | { data: object, at: number }>} at = 조회 시각(브라우저 쿼리의 initialDataUpdatedAt — 오래된 판이면 브라우저가 다시 받는다)
 */
export async function prefetchSuggestion(id, { budgetMs = SUGGESTION_PREFETCH_BUDGET_MS, client = suggestionClient } = {}) {
  let timer;
  try {
    const data = await Promise.race([readSuggestion(client(), id), new Promise((resolve) => { timer = setTimeout(resolve, budgetMs, null); })]);
    return data ? { data, at: Date.now() } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 오늘의 추천 — /api/suggestions/today와 발견 서가(SHELF-001)가 같은 조회를 쓴다(따로 짓지 않는다).
 * 실패는 빈 날과 같다(부가 기능). 읽을 수 있는 글과 원본 영상 카드만 돌려준다.
 */
export async function todaySuggestions(client) {
  // KST 날짜 정본 — 수집 크론과 같은 함수(UTC 날짜를 쓰면 KST 아침부터 빈 카드가 된다)
  const today = kstDateString();
  const { data, error } = await client
    .from('daily_suggestions')
    .select(SUGGESTION_FIELDS)
    .eq('date', today)
    // 본문이 있는 글 소스 **또는** 클릭 시점 반입 영상(transcript는 NULL이 정상).
    // 이 줄이 `.not(transcript, is, null)` 하나였을 때 영상 카드가 통째로 안 보였다.
    .or(`transcript.not.is.null,material_id.not.is.null,source.eq.${ONDEMAND_SOURCE}`)
    .order('language')
    .order('created_at');
  if (error) {
    console.error('[suggestions/today]', error.message);
    return [];
  }
  const readings = await publicSuggestionTargets(client, data || []);
  return readings.filter(s => canReadSuggestion(s) || suggestionSource(s).kind === 'video');
}
