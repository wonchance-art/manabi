// 팀 해제 — 암호 → 해제 토큰(30일) + 목록 (v2-AB R2, #1077 5603827169 §6 · 5604199672 §3).
// 틀린 암호·없는 팀·6자 미만이 **같은 404**(존재 노출 0). IP 분당 10회. SHARE_LINK_SECRET 없으면 503.
import { rateLimit, getClientKey } from '@/lib/server/rateLimit';
import { secretOf, signToken, verifyPassword, TOKEN_TTL_MS } from '@/lib/server/classAccess';
import { serviceClient, loadTeamRoot, buildTeamIndex } from '@/lib/server/classIndex';
import { TEAM_KEY_RE, TEAM_PW_MIN } from '@/lib/classBoard';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const notFound = () => Response.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });

export async function POST(request, { params }) {
  const { team: key } = await params;
  const secret = secretOf();
  if (!secret) return Response.json({ error: 'not_configured' }, { status: 503, headers: NO_STORE });

  const rl = rateLimit(`class-unlock:${getClientKey(request)}`, { limit: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return Response.json({ error: 'rate_limited' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } });
  }

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'bad_json' }, { status: 400, headers: NO_STORE }); }
  const pw = String(body?.pw ?? '');
  if (!TEAM_KEY_RE.test(String(key || '')) || pw.trim().length < TEAM_PW_MIN) return notFound();

  try {
    const admin = serviceClient();
    const loaded = await loadTeamRoot(admin, key);
    // 팀이 없어도 해시 비용을 똑같이 치른다 — 응답 시간으로 존재가 새지 않게.
    const ok = await verifyPassword(pw, loaded?.team || null);
    if (!loaded || !ok) return notFound();
    const exp = Date.now() + TOKEN_TTL_MS;
    const token = signToken({ team: key, gen: loaded.team.pwGen, exp }, secret);
    const index = await buildTeamIndex(admin, loaded.root, loaded.team);
    return Response.json({ token, exp, pwGen: loaded.team.pwGen, index }, { headers: NO_STORE });
  } catch (err) {
    console.error('[api/class/unlock]', err?.message);
    return Response.json({ error: 'internal' }, { status: 500, headers: NO_STORE });
  }
}
