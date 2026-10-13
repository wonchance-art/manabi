import { requireUser } from '@/lib/supabaseServer';
import { reply, errorReply, checkDb, fail } from '@/lib/server/learningContext';

// 자료 범위 조회(REV-SCOPE-R1A) — 읽기 전용, 본인 행만. 이 자료(노트 포함)에서 담은 내 단어 id =
// user_vocabulary.source_material_id ∪ vocabulary_contexts.material_id. 자료의 공개 여부와 무관하게
// 돌려주는 것은 내 단어 id뿐이다(자료 본문 · 다른 사람 행은 읽지 않는다).
const MATERIAL_ID = /^[1-9]\d{0,17}$/;
const MAX_MATERIALS = 20;
const PAGE = 500;

function materialIds(raw) {
  const ids = String(raw || '').split(',');
  if (!raw || ids.length > MAX_MATERIALS || !ids.every(id => MATERIAL_ID.test(id)) || new Set(ids).size !== ids.length) fail(400, '자료 범위를 확인해 주세요.');
  return ids.map(Number);
}

export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireUser();
  if (auth.error) return reply({ error: auth.error }, auth.status);
  try {
    const params = new URL(request.url).searchParams;
    const ids = materialIds(params.get('ids'));
    const raw = params.get('offset') || '0';
    if (!/^\d{1,7}$/.test(raw)) fail(400, '목록 위치를 확인해 주세요.');
    const offset = Number(raw);
    // 두 출처를 같은 offset으로 한 쪽씩 읽는다. 어느 한 쪽이라도 더 있으면 다음 offset을 준다(클라이언트가 합친다).
    const [saved, contexts] = await Promise.all([
      auth.supabase.from('user_vocabulary').select('id')
        .eq('user_id', auth.user.id).in('source_material_id', ids)
        .order('id', { ascending: true }).range(offset, offset + PAGE),
      auth.supabase.from('vocabulary_contexts').select('id,user_vocabulary!inner(id,user_id)')
        .eq('user_id', auth.user.id).eq('user_vocabulary.user_id', auth.user.id).in('material_id', ids)
        .order('id', { ascending: true }).range(offset, offset + PAGE),
    ]);
    checkDb(saved.error);
    checkDb(contexts.error);
    const savedRows = saved.data || [], contextRows = contexts.data || [];
    const wordIds = [...new Set([...savedRows.slice(0, PAGE).map(row => row.id), ...contextRows.slice(0, PAGE).map(row => row.user_vocabulary.id)])];
    return reply({ wordIds, nextOffset: savedRows.length > PAGE || contextRows.length > PAGE ? offset + PAGE : null });
  } catch (error) { return errorReply(error); }
}
