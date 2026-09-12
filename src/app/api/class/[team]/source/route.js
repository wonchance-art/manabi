import { authorizeTeamRequest } from '../route';
import { loadTeamMaterial } from '@/lib/server/classIndex';
import { sourceFromClassNote } from '@/lib/classSource';
import { classSourceRequest } from '@/lib/classHistoryNavigation';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
const missing = () => Response.json({ error: '지금 공유되는 교재 위치를 확인하지 못했어요.' }, { status: 404, headers });
export async function GET(request, { params }) {
  try {
    const { team } = await params;
    const access = await authorizeTeamRequest(request, team);
    if (access.error) return access.error;
    const query = new URL(request.url).searchParams;
    query.set('sourceClass', team);
    const sourceRequest = classSourceRequest(query);
    if (!sourceRequest) return missing();
    const note = await loadTeamMaterial(access.admin, access.root, access.team, sourceRequest.note);
    if (note?.kind !== 'note') return missing();
    const source = sourceFromClassNote(note, sourceRequest.entry);
    if (!source) return missing();
    const chapter = await loadTeamMaterial(access.admin, access.root, access.team, source.materialId);
    if (chapter?.kind !== 'chapter') return missing();
    return Response.json({ source }, { headers });
  } catch {
    return Response.json({ error: '교재 위치를 불러오지 못했어요. 다시 시도해 주세요.' }, { status: 503, headers });
  }
}
