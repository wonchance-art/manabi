/**
 * 주간 리포트 재료 조회 — 2주 윈도 4조회 (rfc-weekly-report R2).
 * ProfileStats(이번 주 카드)와 학습 그룹(스냅샷 push)이 같은 재료를 쓴다 — 중복 신설 금지.
 * 실패한 조회는 빈 배열로 흘러 그 축이 0이 될 뿐(무해성 — 엔진의 0 무표기가 흡수).
 */
import { supabase } from './supabase';
import { kstWeekStartMs } from './growthStats';

export async function fetchWeeklyReportRows(userId) {
  const prevStartIso = new Date(kstWeekStartMs() - 7 * 86400000).toISOString();
  const [ev, vocab, enc, reads] = await Promise.all([
    supabase.from('review_events').select('source, correct, created_at')
      .eq('user_id', userId).gte('created_at', prevStartIso).limit(2000),
    supabase.from('user_vocabulary').select('created_at')
      .eq('user_id', userId).gte('created_at', prevStartIso),
    supabase.from('user_vocab_encounters').select('first_met_at')
      .eq('user_id', userId).gte('first_met_at', prevStartIso),
    supabase.from('reading_progress').select('completed_at')
      .eq('user_id', userId).eq('is_completed', true).gte('completed_at', prevStartIso),
  ]);
  return {
    events: ev.data || [],
    vocabRows: vocab.data || [],
    encounterRows: enc.data || [],
    readRows: reads.data || [],
  };
}
