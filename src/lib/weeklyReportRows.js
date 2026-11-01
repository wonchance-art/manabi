/**
 * 주간 리포트 재료 조회 — 2주 윈도 4조회 (rfc-weekly-report R2).
 * ProfileStats(이번 주 카드)와 학습 그룹(스냅샷 push)이 같은 재료를 쓴다 — 중복 신설 금지.
 * 실패한 조회는 빈 배열로 흘러 그 축이 0이 될 뿐(무해성 — 엔진의 0 무표기가 흡수).
 *
 * review_events는 정본 완전 조회(REVIEW-ROWS-CAP-001, 2026-10-17 KST): 전에는 .limit(2000)이었지만 PostgREST가 한 응답을
 * 1000행에서 말없이 잘라, 2주에 1000번 넘게 채점한 사람의 앞쪽(오래된) 주가 비었다. 지금 시각을 상한으로 고정해
 * 페이지 사이에 새 채점이 끼어들어도 건수가 흔들리지 않게 하고, 건수가 바뀌면(불완전) 1회 다시 읽은 뒤 그래도 실패면 빈 축.
 */
import { supabase } from './supabase';
import { readCompleteLegacyRows } from './legacyReviewSync';
import { learningWeekStartMs } from './growthStats';
import { dropUndoneEvents } from './undoneReviews';
import { fetchUndoMarkers } from './undoneReviewsRows';

export async function fetchWeeklyReportRows(userId) {
  const prevStartIso = new Date(learningWeekStartMs() - 7 * 86400000).toISOString();
  const untilIso = new Date().toISOString();
  // item_key는 되돌린 채점 대조 키(W 후속 ②) — detail은 얹지 않고 마커만 아래 전용 조회로 붙인다
  const readEvents = () => readCompleteLegacyRows(() => supabase.from('review_events')
    .select('id, source, item_key, correct, created_at', { count: 'exact' })
    .eq('user_id', userId).gte('created_at', prevStartIso).lte('created_at', untilIso),
  { orderBy: ['created_at', 'id'] });
  const [ev, vocab, enc, reads, undo, conv] = await Promise.all([
    readEvents().catch(() => readEvents()).then(data => ({ data }), () => ({ data: [] })),
    // 1000행 상한에 잘리지 않게 정본 완전 조회(가져오기로 2주에 1000개 넘게 담을 수 있다). 실패는 기존대로 빈 축.
    // 담은 곳(출처) 나누기에 source_material_id · source_ref를 함께 받는다(STATS-MAP-001 S7).
    readCompleteLegacyRows(() => supabase.from('user_vocabulary').select('id, created_at, source_material_id, source_ref', { count: 'exact' })
      .eq('user_id', userId).gte('created_at', prevStartIso)).then(data => ({ data }), () => ({ data: [] })),
    supabase.from('user_vocab_encounters').select('first_met_at')
      .eq('user_id', userId).gte('first_met_at', prevStartIso),
    supabase.from('reading_progress').select('completed_at')
      .eq('user_id', userId).eq('is_completed', true).gte('completed_at', prevStartIso),
    fetchUndoMarkers(userId, { sinceIso: prevStartIso }),
    // 대화 성과 — 최근 대화 자료 50개의 내 말 · 고친 말 · 다시 꺼내기(대화 모드 reaskFor와 같은 길, 새 기록 0).
    supabase.from('reading_materials')
      .select('id,turns:processed_json->metadata->conversation->turns,reask:processed_json->metadata->conversation->reask')
      .eq('owner_id', userId).not('processed_json->metadata->conversation', 'is', null)
      .order('id', { ascending: false }).limit(50),
  ]);
  return {
    events: dropUndoneEvents(ev.data || [], undo),
    vocabRows: vocab.data || [],
    encounterRows: enc.data || [],
    readRows: reads.data || [],
    conversationRows: conv?.data || [],
  };
}
