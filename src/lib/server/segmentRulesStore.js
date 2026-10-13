// 서버 전용 — /api/analyze가 분석 때 단어 경계 규칙(② 사용자 · ③ 공유)을 읽는다. 뷰어 v2 AD-R3 PR④ §5.1 · §5.2.
// · 사용자 JWT를 실은 RLS 클라이언트로 읽는다(api/explain/route.js 선례). service_role로 user_id를 직접 거르지 않는다 —
//   user_id 조건은 색인(UNIQUE user_id, language, surface)을 타기 위한 것이고, 본인 행만 보이는 것은 RLS가 정한다.
// · 요청당 표마다 1회(병렬 2개 · 줄마다 읽지 않는다). 표마다 SEGMENT_RULE_LIMITS.maxRows까지.
// · 표가 없으면(PGRST205/42P01 — 롤백 · 미적용) 그 표의 규칙은 없다. 그 밖의 오류도 규칙 없이 분석을 계속한다(경고만).
//   규칙 읽기 실패가 분석 실패가 되지 않는다.
import { createClient } from '@supabase/supabase-js';
import { SEGMENT_RULE_LIMITS, SEGMENT_RULE_TABLES, compileSegmentRules, segmentRulesTableMissing } from '../segmentRules';

export function segmentRulesClient(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  );
}

async function readTable(query, table) {
  try {
    const { data, error } = await query;
    if (error) {
      if (!segmentRulesTableMissing(error)) console.warn(`[analyze] ${table} read failed:`, error.message);
      return { rows: [], missing: segmentRulesTableMissing(error) };
    }
    return { rows: Array.isArray(data) ? data : [], missing: false };
  } catch (error) {
    console.warn(`[analyze] ${table} read failed:`, error?.message);
    return { rows: [], missing: false };
  }
}

/**
 * 규칙 읽기. 결과 {user:[규칙…], shared:[규칙…], missing:{user, shared}} — 규칙은 compileSegmentRules로 검증 · 정렬된 것.
 * client = RLS 클라이언트(segmentRulesClient). 두 표 모두 language로만 거르고 surface · cuts만 받는다.
 */
export async function loadSegmentRules(client, { userId, language }) {
  const [user, shared] = await Promise.all([
    readTable(client.from(SEGMENT_RULE_TABLES.user).select('surface, cuts')
      .eq('user_id', userId).eq('language', language).limit(SEGMENT_RULE_LIMITS.maxRows), SEGMENT_RULE_TABLES.user),
    readTable(client.from(SEGMENT_RULE_TABLES.shared).select('surface, cuts')
      .eq('language', language).limit(SEGMENT_RULE_LIMITS.maxRows), SEGMENT_RULE_TABLES.shared),
  ]);
  return {
    user: compileSegmentRules(user.rows, language),
    shared: compileSegmentRules(shared.rows, language),
    missing: { user: user.missing, shared: shared.missing },
  };
}
