import { requireUser } from '@/lib/supabaseServer';
import { fsrsServiceClient, fsrsError } from '@/lib/server/fsrsLearning';
import { readLearningAdmissionStatus, applyLearningAdmissionRequest } from '@/lib/server/learningAdmission';

export const dynamic = 'force-dynamic';
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const failure = error => { const { body, status } = fsrsError(error); return reply(body, status); };
const invalid = () => Object.assign(new Error('fsrs_invalid_request'), { code: 'fsrs_invalid_request', status: 400 });

async function readCommand(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw invalid();
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw Object.assign(new Error('fsrs_invalid_origin'), { code: 'fsrs_invalid_origin', status: 403 });
  const reader = request.body?.getReader();
  if (!reader) throw invalid();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw invalid(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw invalid(); }
}

export async function GET(request) {
  try {
    const auth = await requireUser();
    if (auth.error || !auth.user) return reply({ ok: false, code: 'fsrs_auth_required' }, auth.status || 401);
    if (request && [...new URL(request.url).searchParams].length) throw invalid();
    return reply(await readLearningAdmissionStatus({ authClient: auth.supabase, serviceClient: fsrsServiceClient(), userId: auth.user.id }));
  } catch (error) { return failure(error); }
}

export async function POST(request) {
  try {
    const auth = await requireUser();
    if (auth.error || !auth.user) return reply({ ok: false, code: 'fsrs_auth_required' }, auth.status || 401);
    const body = await readCommand(request);
    return reply(await applyLearningAdmissionRequest({ authClient: auth.supabase, serviceClient: fsrsServiceClient(), userId: auth.user.id, body }));
  } catch (error) { return failure(error); }
}
