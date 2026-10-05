'use client';

/**
 * 오늘 복습 단어 주입 훅 (#1077-16+17 UI 라운드) — pickOutputWords 엔진의 조회 배선.
 * 오늘(KST)의 유효 채점부터 읽고, stable word_id로 소유한 활성 단어를 조회한다.
 * 게스트·실패는 빈 배열(무해성 — 칩 줄만 생략).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { kstDayStartIso } from './growthStats';
import { pickOutputWords } from './outputWords';
import { dropUndoneEvents } from './undoneReviews';
import { isGradedReviewEvent } from './weeklyReport';

/** 단일 조회가 잘린 경우 다음 페이지를 읽는다. 건수 변동/빈 중간 페이지는 불완전으로 거부한다. */
async function completeRows(build, pageSize = 500) {
  const rows = [];
  let total = null;
  const seen = new Set();
  while (total === null || rows.length < total) {
    const result = await build().range(rows.length, rows.length + pageSize - 1);
    if (result.error) throw result.error;
    if (!Number.isSafeInteger(result.count) || result.count < 0 || !Array.isArray(result.data)
        || (total !== null && result.count !== total)) throw new Error('output_words_incomplete');
    total = result.count;
    if ((!result.data.length && rows.length < total) || rows.length + result.data.length > total) {
      throw new Error('output_words_incomplete');
    }
    for (const row of result.data) {
      if (row.id == null || seen.has(row.id)) throw new Error('output_words_incomplete');
      seen.add(row.id);
    }
    rows.push(...result.data);
  }
  return { data: rows, count: total };
}

export async function fetchTodayReviewRows(userId, { client = supabase, now = Date.now() } = {}) {
  const iso = kstDayStartIso(now);
  // 실제 채점 시각·stable word_id부터 읽는다. 신규 FSRS의 보존된 legacy last_reviewed_at은 필터가 아니다.
  const events = await completeRows(() => client.from('review_events')
    .select('id, source, item_key, correct, created_at, detail', { count: 'exact' })
    .eq('user_id', userId).gte('created_at', iso).lte('created_at', new Date(now).toISOString())
    .order('created_at', { ascending: true }).order('id', { ascending: true }));
  const effective = dropUndoneEvents(events.data);
  const ids = [...new Set(effective.filter(isGradedReviewEvent).map(e => e.detail?.word_id).filter(Boolean))];
  const candidates = [];
  for (let from = 0; from < ids.length; from += 100) {
    const batch = await completeRows(() => client.from('active_vocabulary')
      .select('id, word_text, meaning, language, last_reviewed_at', { count: 'exact' })
      .eq('user_id', userId).in('id', ids.slice(from, from + 100)).order('id', { ascending: true }));
    candidates.push(...batch.data);
  }
  // 과거 word_id 없는 이력의 기존 폴백만 보존. undo한 채점을 last_reviewed_at으로 되살리지 않는다.
  const allowFallback = !events.data.some(e => isGradedReviewEvent(e) && e.detail?.word_id != null)
    && !events.data.some(e => e.source === 'ui' && e.detail?.qtype === 'undo');
  if (allowFallback) {
    const fallback = await completeRows(() => client.from('active_vocabulary')
      .select('id, word_text, meaning, language, last_reviewed_at', { count: 'exact' })
      .eq('user_id', userId).gte('last_reviewed_at', iso).lte('last_reviewed_at', new Date(now).toISOString())
      .order('id', { ascending: true }));
    candidates.push(...fallback.data);
  }
  const vocabRows = [...new Map(candidates.map(row => [row.id, row])).values()];
  return { vocabRows, events: dropUndoneEvents(events.data || []), allowFallback, now };
}

export function useOutputWords(language) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['output-words', user?.id],
    queryFn: () => fetchTodayReviewRows(user.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
  if (!user || !data) return [];
  return pickOutputWords({ ...data, language });
}
