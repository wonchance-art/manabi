/**
 * 목표 속도 제안 재료 조회 (v2-I R1b R2).
 * I-a가 완독 이벤트 detail에 남긴 측정만 읽는다 — 새 테이블·새 이벤트 0(설계 §2).
 * 언어로 좁히는 게 핵심이다: 같은 사람도 중국어와 영어의 자/분이 몇 배 다르다.
 * 실패는 빈 배열로 흘러 제안이 없을 뿐이고, 그러면 언어별 기본값이 그대로 쓰인다.
 */
import { supabase } from './supabase';

/** 최근 완독 이벤트(최신순). 유효 표본은 순수 로직(readingSpeedHistory)이 걸러낸다. */
export async function fetchReadingSpeedRows(userId, lang) {
  if (!userId || !lang) return [];
  try {
    const { data, error } = await supabase
      .from('review_events')
      .select('detail, created_at')
      .eq('user_id', userId)
      .eq('source', 'reading')
      .eq('lang', lang)
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}
