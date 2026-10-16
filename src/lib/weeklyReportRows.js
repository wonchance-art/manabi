/**
 * 주간 리포트 재료 조회 — 2주 윈도 4조회 (rfc-weekly-report R2).
 * ProfileStats(이번 주 카드)와 학습 그룹(스냅샷 push)이 같은 재료를 쓴다 — 중복 신설 금지.
 * 실패한 조회는 빈 배열로 흘러 그 축이 0이 될 뿐(무해성 — 엔진의 0 무표기가 흡수).
 */
import { supabase } from './supabase';
import { readCompleteLegacyRows } from './legacyReviewSync';
import { kstWeekStartMs } from './growthStats';
import { dropUndoneEvents } from './undoneReviews';
import { fetchUndoMarkers } from './undoneReviewsRows';

export async function fetchWeeklyReportRows(userId) {
  const prevStartIso = new Date(kstWeekStartMs() - 7 * 86400000).toISOString();
  const [ev, vocab, enc, reads, undo] = await Promise.all([
    // item_key는 되돌린 채점 대조 키(W 후속 ②) — detail은 얹지 않고 마커만 아래 전용 조회로 붙인다
    supabase.from('review_events').select('source, item_key, correct, created_at')
      .eq('user_id', userId).gte('created_at', prevStartIso).limit(2000),
    // 1000행 상한에 잘리지 않게 정본 완전 조회(가져오기로 2주에 1000개 넘게 담을 수 있다). 실패는 기존대로 빈 축.
    readCompleteLegacyRows(() => supabase.from('user_vocabulary').select('id, created_at', { count: 'exact' })
      .eq('user_id', userId).gte('created_at', prevStartIso)).then(data => ({ data }), () => ({ data: [] })),
    supabase.from('user_vocab_encounters').select('first_met_at')
      .eq('user_id', userId).gte('first_met_at', prevStartIso),
    supabase.from('reading_progress').select('completed_at')
      .eq('user_id', userId).eq('is_completed', true).gte('completed_at', prevStartIso),
    fetchUndoMarkers(userId, { sinceIso: prevStartIso }),
  ]);
  return {
    events: dropUndoneEvents(ev.data || [], undo),
    vocabRows: vocab.data || [],
    encounterRows: enc.data || [],
    readRows: reads.data || [],
  };
}
