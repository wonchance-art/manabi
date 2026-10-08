// 팀 코스 — 해제 토큰(x-class-token) 또는 팀 루트 소유자(선생님 로그인) → 코스 페이로드.
// 학생은 목록 라우트와 같은 문(authorizeTeamRequest)을 쓴다. 선생님은 수업 홈에서 토큰 없이
// RLS로 보므로 Bearer 로그인 + 루트 소유자 확인으로 연다. 코스가 연결되지 않은 팀은 404.
import { authorizeTeamRequest } from '../route';
import { TOKEN_HEADER } from '@/lib/server/classAccess';
import { requireUser } from '@/lib/server/auth';
import { serviceClient, loadTeamRoot } from '@/lib/server/classIndex';
import { TEAM_KEY_RE } from '@/lib/classBoard';
import { loadCourse } from '@/lib/server/classCourse';
import { rateLimit, getClientKey } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const reply = (data, status = 200) => Response.json(data, { status, headers: NO_STORE });

async function authorizeOwner(request, key) {
  const rl = rateLimit(`class-course:${getClientKey(request)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) return { error: reply({ error: 'rate_limited' }, 429) };
  const auth = await requireUser(request);
  if (auth.error) return { error: reply({ error: 'unauthorized' }, 401) };
  const loaded = await loadTeamRoot(serviceClient(), key);
  if (!loaded || loaded.root.owner_id !== auth.user.id) return { error: reply({ error: 'unauthorized' }, 401) };
  return loaded;
}

export async function GET(request, { params }) {
  try {
    const { team: key } = await params;
    if (!TEAM_KEY_RE.test(String(key || ''))) return reply({ error: 'not_found' }, 404);
    const access = request.headers.get(TOKEN_HEADER)
      ? await authorizeTeamRequest(request, key)
      : await authorizeOwner(request, key);
    if (access.error) return access.error;
    const course = loadCourse(access.team.course);
    if (!course) return reply({ error: 'no_course' }, 404);
    return reply({ team: { key: access.team.key, name: access.team.name, lang: access.team.lang, schedule: access.team.schedule || null }, course });
  } catch (err) {
    console.error('[api/class/course]', err?.message);
    return reply({ error: 'internal' }, 500);
  }
}
