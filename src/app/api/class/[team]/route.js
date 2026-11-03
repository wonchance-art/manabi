// 팀 목록 — 해제 토큰(x-class-token) → 교재 과·정리본 목록 (v2-AB R2 상세 5604199672 §3).
// 토큰 없음·위조·만료·pwGen 불일치(암호 변경)는 전부 401. 루트 소유자의 행만 나간다.
import { rateLimit } from '@/lib/server/rateLimit';
import { secretOf, verifyToken, TOKEN_HEADER } from '@/lib/server/classAccess';
import { serviceClient, loadTeamRoot, buildTeamIndex } from '@/lib/server/classIndex';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const unauthorized = () => Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });

/** 토큰·팀·세대 검증 — 세 라우트가 같은 문을 쓴다. */
export async function authorizeTeamRequest(request, key) {
  const secret = secretOf();
  if (!secret) return { error: Response.json({ error: 'not_configured' }, { status: 503, headers: NO_STORE }) };
  const token = request.headers.get(TOKEN_HEADER);
  const v = verifyToken(token, secret);
  if (!v.ok || v.team !== key) return { error: unauthorized() };
  // 읽기 제한은 해제 토큰(= 학생 기기 하나)마다 센다. IP로 세면 한 교실 와이파이의 반 전체가 분당 60회를 나눠 쓴다.
  // 서명 검증 뒤라 위조 토큰으로 칸을 늘릴 수 없고, 틀린 토큰은 DB에 닿기 전에 401이다.
  const rl = rateLimit(`class-read:${token.slice(-22)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) return { error: Response.json({ error: 'rate_limited' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } }) };
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
