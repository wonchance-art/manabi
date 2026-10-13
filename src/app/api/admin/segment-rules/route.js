// 관리자 전용 — 공유 단어 경계 규칙(③ 「모든 사용자」, shared_segment_rules) 쓰기. 뷰어 v2 AD-R3 PR④ §5.2.
// POST   { language, surface, cuts?, note? } → 검증(segmentRules.validateSegmentRule) 뒤 upsert(같은 꼴이면 칼선 · 메모만 바꿈)
// DELETE { language, surface }              → 그 꼴 하나 지우기(없어도 성공)
// · 로그인 401 · 비관리자 403(requireAdmin — profiles.role==='admin'). 읽기는 인증 사용자 RLS(분석 때 /api/analyze)라 여기 없다.
// · 표는 쓰기 정책이 없어 service_role로만 쓴다. 표가 없으면(PGRST205/42P01) 503 'segment_rules_unavailable' — 화면은 ③을 숨긴다.
// · 이미 분석된 자료는 바꾸지 않는다(모든 사용자의 다음 분석부터). 단어장 · 평가 이력 · 사전에 쓰지 않는다.
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/server/auth';
import { SEGMENT_RULE_LANGUAGES, SEGMENT_RULE_TABLES, normalizeSegmentSurface, segmentRulesTableMissing, validateSegmentRule } from '@/lib/segmentRules';

export const runtime = 'nodejs';

const NOTE_MAX = 200;

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}

async function readBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

function writeFailed(error) {
  if (segmentRulesTableMissing(error)) return Response.json({ error: 'segment_rules_unavailable' }, { status: 503 });
  console.warn('[admin/segment-rules] write failed:', error?.message);
  return Response.json({ error: '규칙을 저장하지 못했어요.' }, { status: 500 });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const body = await readBody(request);
  if (!body) return Response.json({ error: 'Bad JSON' }, { status: 400 });
  const checked = validateSegmentRule({ language: body.language, surface: body.surface, cuts: body.cuts });
  if (!checked.ok) return Response.json({ error: 'invalid_rule', reason: checked.reason }, { status: 400 });
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, NOTE_MAX) : null;
  const { rule } = checked;
  const { error } = await serviceClient().from(SEGMENT_RULE_TABLES.shared).upsert(
    { language: rule.language, surface: rule.surface, cuts: rule.cuts, created_by: auth.user.id, note },
    { onConflict: 'language,surface' },
  );
  if (error) return writeFailed(error);
  return Response.json({ rule: { language: rule.language, surface: rule.surface, cuts: rule.cuts } });
}

export async function DELETE(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const body = await readBody(request);
  if (!body) return Response.json({ error: 'Bad JSON' }, { status: 400 });
  const { language } = body;
  const surface = typeof body.surface === 'string' ? normalizeSegmentSurface(language, body.surface) : '';
  if (!SEGMENT_RULE_LANGUAGES.includes(language) || !surface) {
    return Response.json({ error: 'invalid_rule' }, { status: 400 });
  }
  const { error } = await serviceClient().from(SEGMENT_RULE_TABLES.shared).delete().eq('language', language).eq('surface', surface);
  if (error) return writeFailed(error);
  return Response.json({ ok: true });
}
