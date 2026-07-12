/**
 * 학습 월드 세션 임대 API — 계정 단위 동시 접속 차단(서버 권위).
 *
 *  POST  (입장)         → claim_world_session_v2(p_ip) 로 임대 획득.
 *                          성공 { token, expiresAt, spawn }  (spawn = 본인 마지막 좌표 | null)
 *                          중복  409 { reason: 'duplicate-account' }
 *                          기타 오류 503.
 *  PATCH (하트비트+좌표) → { token, scene, x, y } → heartbeat_world_session + world_positions upsert.
 *                          토큰 상실(다른 세션 인수) 410. 성공 204.
 *
 * ⚠️ 이번 웨이브에서는 아직 호출되지 않는다(미사용·Codex 전환 대기).
 *    현재 임대는 net.js(src/lib/world/net.js)가 claim_world_session() 를 직접 부른다. 이 라우트로
 *    이중 임대를 하면 서로 충돌하므로, WorldPage 는 지금 이 POST 를 부르지 않는다. Codex 후속
 *    라운드에서 net.js 의 claim 을 "POST /api/world/session" 경유로 바꾼다.
 *    IP 는 계속 기록하되(p_ip) 동시접속 차단은 계정 단위만 유지한다 — 같은 IP 다중 접속은 허용
 *    (오너 확정). duplicate-ip 는 더 이상 발생하지 않는다(미래 재활성 시 v2 에 복원).
 *
 * 인증: requireUser()(쿠키 세션 — 전체 로그인 유저 개방). IP 는 서버만 신뢰 가능하므로 라우트가
 * 헤더에서 추출해 RPC 에 넘긴다(기록용). 좌표 upsert 는 사용자 세션 클라이언트로(world_positions
 * own-only RLS 방어). service_role 금지.
 */
import { requireUser } from '@/lib/supabaseServer';
import { extractClientIp, normalizePosition } from '@/lib/world/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 임대 만료 창(ms). net.js LEASE_TTL_MS(60s)·SQL '60 seconds' 와 일치 — 클라가 만료 전 갱신하도록 안내.
const LEASE_TTL_MS = 60000;

export async function POST(request) {
  const auth = await requireUser();
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const { supabase, user } = auth;
  const ip = extractClientIp((name) => request.headers.get(name));

  const { data, error } = await supabase.rpc('claim_world_session_v2', { p_ip: ip });
  if (error) return Response.json({ error: error.message }, { status: 503 });

  const reason = data?.reason || null;
  if (!data?.token) {
    // 계정 중복 — 멀티 입장 차단(같은 IP 는 허용). WorldPage 가 사유별 안내를 띄운다.
    return Response.json({ reason: reason || 'duplicate-account' }, { status: 409 });
  }

  // 스폰 위치 — 본인 마지막 좌표(없으면 null). 입장 응답에 실어 재접속 스폰에 쓴다.
  const { data: posRow } = await supabase
    .from('world_positions')
    .select('scene, x, y')
    .eq('user_id', user.id)
    .maybeSingle();
  const spawn = posRow ? { scene: posRow.scene, x: posRow.x, y: posRow.y } : null;

  return Response.json({ token: data.token, expiresAt: Date.now() + LEASE_TTL_MS, spawn });
}

export async function PATCH(request) {
  const auth = await requireUser();
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '잘못된 JSON입니다.' }, { status: 400 });
  }
  const token = body?.token;
  if (!token) return Response.json({ error: 'token이 필요합니다.' }, { status: 400 });

  const { supabase, user } = auth;
  const { data: alive, error } = await supabase.rpc('heartbeat_world_session', { p_token: token });
  if (error) return Response.json({ error: error.message }, { status: 503 });
  if (alive !== true) {
    // 토큰 상실(다른 세션이 만료 인수) — 이 세션은 물러나야 한다.
    return Response.json({ error: '세션이 만료되었어요.' }, { status: 410 });
  }

  // 좌표 동봉(선택) — 있으면 함께 저장한다(하트비트 격자에 좌표를 실어 왕복 1회로 합침).
  const pos = normalizePosition(body);
  if (pos) {
    await supabase
      .from('world_positions')
      .upsert(
        { user_id: user.id, scene: pos.scene, x: pos.x, y: pos.y, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
  }
  return new Response(null, { status: 204 });
}
