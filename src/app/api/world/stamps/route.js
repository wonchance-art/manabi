/**
 * 학습 월드 여행 스탬프 API — 노드 첫 방문 수집.
 *
 *  GET  → { stamps: [{ nodeId, at }] }    본인 수집 스탬프 목록(첫 방문 시각 오름차순).
 *  POST { nodeId } → { ok: true }          본인 스탬프 upsert(첫 방문만 기록 · 중복은 무시).
 *
 * 인증: requireUser()(쿠키 세션 — 전체 로그인 유저 개방). 쓰기는 사용자 세션 클라이언트로 수행해
 *   world_stamps 의 own-only RLS 가 최종 방어(본인 행만). service_role 키는 쓰지 않는다.
 * nodeId 는 STAMP_ALBUM_NODES 에 속한 노드만 허용(서버 검증) — 임의 문자열 저장을 막는다.
 */
import { requireUser } from '@/lib/supabaseServer';
import { isStampAlbumNodeId } from '@/lib/world/stampUniverse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const { supabase, user } = auth;
  const { data } = await supabase
    .from('world_stamps')
    .select('node_id, at')
    .eq('user_id', user.id)
    .order('at', { ascending: true });

  const stamps = (data || []).map((r) => ({ nodeId: r.node_id, at: r.at }));
  return Response.json({ stamps });
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
  const nodeId = typeof body?.nodeId === 'string' ? body.nodeId : '';
  // 앨범 정본 노드만 허용 — 렌더 가능하지만 수집 금지인 노드와 임의 id를 함께 차단한다.
  if (!isStampAlbumNodeId(nodeId)) {
    return Response.json({ error: 'nodeId가 올바르지 않습니다.' }, { status: 400 });
  }

  const { supabase, user } = auth;
  // ignoreDuplicates — 이미 수집한 노드면 DO NOTHING(첫 방문 시각 at 을 덮어쓰지 않는다).
  const { error } = await supabase
    .from('world_stamps')
    .upsert(
      { user_id: user.id, node_id: nodeId, at: new Date().toISOString() },
      { onConflict: 'user_id,node_id', ignoreDuplicates: true },
    );
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
