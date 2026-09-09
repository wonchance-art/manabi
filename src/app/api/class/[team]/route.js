// 팀 목록 — 해제 토큰(x-class-token) → 교재 과·정리본 목록 (v2-AB R2 상세 5604199672 §3).
// 토큰 없음·위조·만료·pwGen 불일치(암호 변경)는 전부 401. 루트 소유자의 행만 나간다.
import { rateLimit, getClientKey } from '@/lib/server/rateLimit';
import { secretOf, verifyToken, TOKEN_HEADER } from '@/lib/server/classAccess';
import { serviceClient, loadTeamRoot, buildTeamIndex } from '@/lib/server/classIndex';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const unauthorized = () => Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });

/** 토큰·팀·세대 검증 — 세 라우트가 같은 문을 쓴다. */
export async function authorizeTeamRequest(request, key) {
  const secret = secretOf();
  if (!secret) return { error: Response.json({ error: 'not_configured' }, { status: 503, headers: NO_STORE }) };
  const rl = rateLimit(`class-read:${getClientKey(request)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) return { error: Response.json({ error: 'rate_limited' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } }) };
  const v = verifyToken(request.headers.get(TOKEN_HEADER), secret);
  if (!v.ok || v.team !== key) return { error: unauthorized() };
  const admin = serviceClient();
  const loaded = await loadTeamRoot(admin, key);
  if (!loaded || loaded.team.pwGen !== v.gen) return { error: unauthorized() };
  return { admin, ...loaded };
}

export async function GET(request, { params }) {
  const { team: key } = await params;
  try {
    const auth = await authorizeTeamRequest(request, key);
    if (auth.error) return auth.error;
    const index = await buildTeamIndex(auth.admin, auth.root, auth.team);
    return Response.json(index, { headers: NO_STORE });
  } catch (err) {
    console.error('[api/class/index]', err?.message);
    return Response.json({ error: 'internal' }, { status: 500, headers: NO_STORE });
  }
}
