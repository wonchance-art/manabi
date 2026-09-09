// 팀 자료 페이로드 — 해제 토큰 → 과·정리본 한 편(raw_text·processed_json·metadata) (v2-AB R2 §3).
// 팀 밖 id(다른 책·다른 소유자·학생 복제본)는 토큰이 있어도 404.
import { authorizeTeamRequest } from '../../route';
import { loadTeamMaterial } from '@/lib/server/classIndex';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET(request, { params }) {
  const { team: key, id } = await params;
  try {
    const auth = await authorizeTeamRequest(request, key);
    if (auth.error) return auth.error;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) return Response.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
    const payload = await loadTeamMaterial(auth.admin, auth.root, auth.team, numericId);
    if (!payload) return Response.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
    return Response.json(payload, { headers: NO_STORE });
  } catch (err) {
    console.error('[api/class/material]', err?.message);
    return Response.json({ error: 'internal' }, { status: 500, headers: NO_STORE });
  }
}
