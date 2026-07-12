/**
 * 학습 월드 좌표 영속화 API — 재접속 시 "나간 자리" 스폰용.
 *
 *  GET  → { position: { scene, x, y } | null }   본인 마지막 좌표(없으면 null).
 *  POST { scene, x, y } → 204   본인 좌표 upsert. 주기 저장(10초 스로틀)·pagehide sendBeacon 겸용.
 *
 * 인증: requireUser()(쿠키 세션 — 전체 로그인 유저 개방). 쓰기는 사용자 세션 클라이언트로 수행해
 *   world_positions 의 own-only RLS 가 최종 방어(본인 행만). service_role 키는 쓰지 않는다.
 * 좌표는 타일 인덱스(월드 px 아님) — WorldPage 가 local:state(px)를 /TILE 로 변환해 보낸다.
 * (세션 임대는 별도의 /api/world/session 이 담당 — 이 라우트는 좌표만 다룬다.)
 */
import { requireUser } from '@/lib/supabaseServer';
import { normalizePosition } from '@/lib/world/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const { supabase, user } = auth;
  const { data } = await supabase
    .from('world_positions')
    .select('scene, x, y')
    .eq('user_id', user.id)
    .maybeSingle();

  const position = data ? { scene: data.scene, x: data.x, y: data.y } : null;
  return Response.json({ position });
}

export async function POST(request) {
  const auth = await requireUser();
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '잘못된 JSON입니다.' }, { status: 400 });
  }
  const pos = normalizePosition(body);
  if (!pos) return Response.json({ error: 'scene, x, y가 올바르지 않습니다.' }, { status: 400 });

  const { supabase, user } = auth;
  const { error } = await supabase
    .from('world_positions')
    .upsert(
      { user_id: user.id, scene: pos.scene, x: pos.x, y: pos.y, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 204 No Content — sendBeacon/keepalive 응답을 읽지 않으므로 본문 없이 반환한다.
  return new Response(null, { status: 204 });
}
