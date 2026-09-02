/**
 * undo 마커 전용 조회 (W 후속 ②) — 로더가 detail 없이 긁거나(주간 리포트 2주 2000행) source를
 * 좁혀 긁는(헷갈림 큐 source='vocab') 경로에 마커만 따로 붙인다. detail 전체를 2000행에 얹지
 * 않는 이유는 weaknessRows.js 머리말과 같다. 마커는 review_events 안에서 source:'ui' +
 * detail.qtype='undo'로만 식별된다(undoneReviews.isUndoEvent와 같은 조건을 서버 필터로).
 * 실패는 빈 배열 — 마커가 없으면 필터가 아무것도 빼지 않을 뿐(현행 집계로 수렴).
 */
import { supabase } from './supabase';

/**
 * @param {string} userId
 * @param {{sinceIso?: string, limit?: number}} [opts] sinceIso 미지정이면 전 기간(limit 안에서)
 */
export async function fetchUndoMarkers(userId, { sinceIso, limit = 200 } = {}) {
  if (!userId) return [];
  try {
    let query = supabase
      .from('review_events')
      .select('source, item_key, created_at, detail')
      .eq('user_id', userId)
      .eq('source', 'ui')
      .eq('detail->>qtype', 'undo')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (sinceIso) query = query.gte('created_at', sinceIso);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}
