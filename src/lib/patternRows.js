/**
 * 문법 표시 '복습할 것' 필터 재료 조회 (v2-G R2, #1077 설계 §4).
 *
 * 이미 쌓이고 있는 `grammar_review` 큐를 **읽기만** 한다 — 새 테이블도 새 이벤트도
 * 없다(설계 §5). 복습이 다가온 문법을 본문에서 다시 만나면 그 자체가 복습이 되므로,
 * 큐와 뷰어를 잇는 데 필요한 건 slug 목록 하나뿐이다.
 *
 * 실패는 빈 배열: 필터가 아무것도 못 고를 뿐이고 본문 읽기는 그대로 돈다(goalRows 결).
 */
import { supabase } from './supabase';

/**
 * 이 언어에서 복습이 다가온 챕터 큐.
 * `grammar_review`는 챕터 slug 단위라 문형의 `ch`와 그대로 맞물린다.
 * 시각 절단을 조회에서 하는 건 due 판정 선례(review/grammar)를 따르는 것이고,
 * 클라이언트가 오래 열어 둔 사이 넘어간 행은 순수 함수(dueChapterSet)가 다시 거른다.
 */
export async function fetchDuePatternRows(userId, lang) {
  if (!userId || !lang) return [];
  try {
    const { data, error } = await supabase
      .from('grammar_review')
      .select('slug, next_review_at')
      .eq('user_id', userId)
      .eq('lang', lang)
      .lte('next_review_at', new Date().toISOString());
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}
