import {requireUser} from '@/lib/server/auth';
import index from '@/lib/data/jaYomiIndex.json';
import {kanaCandidates} from '@/lib/teachingBoard';

export async function GET(request) {
  const auth = await requireUser(request);
  if (auth.error) return Response.json({error: auth.error}, {status: auth.status});
  const candidates = kanaCandidates(index, new URL(request.url).searchParams.get('q'));
  return Response.json({candidates}, {headers: {'Cache-Control': 'private, no-store'}});
}
