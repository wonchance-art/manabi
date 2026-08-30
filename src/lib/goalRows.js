/**
 * 목표 궤도 재료 조회 (v2-D R2).
 * R1이 쓰는 것과 같은 행을 같은 테이블에서 읽되, 속도를 재야 하므로 `updated_at`이
 * 한 칸 더 붙는다. 쓰기는 없다 — 진도는 이미 쌓이고 있고 여기는 읽기만 한다.
 * 실패는 빈 배열: 궤도 줄이 사라질 뿐 홈의 나머지는 그대로 돈다(weeklyReportRows 결).
 */
import { supabase } from './supabase';

export async function fetchGoalProgressRows(userId, lang) {
  if (!userId || !lang) return [];
  try {
    const { data, error } = await supabase
      .from('user_ref_progress')
      .select('lang, slug, read, passed, updated_at')
      .eq('user_id', userId)
      .eq('lang', lang);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}
