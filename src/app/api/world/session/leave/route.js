/**
 * 학습 월드 세션 반납 API — 퇴장(닫기/이탈) 시 임대 반납 + 최종 좌표 저장.
 *
 *  POST { token, scene, x, y } → release_world_session + world_positions upsert → 204.
 *
 * sendBeacon 겸용(쿠키 인증) — pagehide 에서 임대를 즉시 반납해 다른 기기/탭이 곧바로 입장할 수
 * 있게 한다(반납 실패해도 TTL 60초로 자연 만료 — 무해). 최종 좌표를 함께 저장해 재접속 스폰에 쓴다.
 *
 * ⚠️ 이번 웨이브 미사용(Codex 전환 대기) — 현재 임대 반납은 net.js 가 release_world_session() 를
 *    직접 호출한다. Codex 가 claim 을 라우트로 옮길 때 이 leave 도 함께 배선한다.
 *
 * 인증: requireUser()(전체 로그인 유저 개방). 좌표 upsert 는 사용자 세션 클라이언트(own-only RLS). service_role 금지.
 */
import { requireUser } from '@/lib/supabaseServer';
import { normalizePosition } from '@/lib/world/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireUser();
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const { supabase, user } = auth;

  // 최종 좌표 저장(있으면) — 반납보다 먼저 저장해 퇴장 자리를 확실히 남긴다.
  const pos = normalizePosition(body);
  if (pos) {
    await supabase
      .from('world_positions')
      .upsert(
        { user_id: user.id, scene: pos.scene, x: pos.x, y: pos.y, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
  }

  // 임대 반납 — 내 토큰의 행만 서버가 삭제(후임 임대는 못 건드림). 토큰 없으면 좌표만 저장.
  const token = body?.token;
  if (token) {
    await supabase.rpc('release_world_session', { p_token: token });
  }

  return new Response(null, { status: 204 });
}
