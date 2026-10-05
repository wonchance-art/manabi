import { requireUser } from '@/lib/supabaseServer';
import { fsrsServiceClient, readFsrsStatus, applyFsrsRequest, fsrsError } from '@/lib/server/fsrsLearning';

export const dynamic = 'force-dynamic';
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const failure = error => { const { body, status } = fsrsError(error); return reply(body, status); };

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.error || !auth.user) return reply({ ok: false, code: 'fsrs_auth_required' }, auth.status || 401);
    return reply(await readFsrsStatus({ authClient: auth.supabase, serviceClient: fsrsServiceClient(), userId: auth.user.id }));
  } catch (error) { return failure(error); }
}

export async function POST(request) {
  try {
    const auth = await requireUser();
    if (auth.error || !auth.user) return reply({ ok: false, code: 'fsrs_auth_required' }, auth.status || 401);
    // 인증된 작은 명령만 받는다. 임의 카드/이력 snapshot은 입력 계약에 없다.
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return reply({ ok: false, code: 'fsrs_invalid_request' }, 400);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return reply({ ok: false, code: 'fsrs_invalid_origin' }, 403);
    const source = await request.text();
    if (source.length > 4096) return reply({ ok: false, code: 'fsrs_invalid_request' }, 400);
    let body;
    try { body = JSON.parse(source); } catch { return reply({ ok: false, code: 'fsrs_invalid_request' }, 400); }
    return reply(await applyFsrsRequest({ authClient: auth.supabase, serviceClient: fsrsServiceClient(), userId: auth.user.id, body }));
  } catch (error) { return failure(error); }
}
