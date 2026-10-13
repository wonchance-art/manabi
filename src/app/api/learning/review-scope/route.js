import { requireUser } from '@/lib/supabaseServer';
import { reply, errorReply, checkDb, fail } from '@/lib/server/learningContext';
import { parseReviewScope } from '@/lib/reviewScope';

// 자료 · 노트 복습 범위(REV-SCOPE R1-A): 그 자료에서 담은 본인 표현 id만 돌려준다. 읽기 전용.
// 자료 = 담은 자리(source_material_id) ∪ 문맥(vocabulary_contexts.material_id). 노트 = 노트 위치가 있는 문맥.
// 범위를 못 읽으면 넓히지 않고 실패한다(클라이언트는 「전체」로 새지 않는다).
export const dynamic = 'force-dynamic';
const PAGE = 500;

export async function GET(request) {
  const auth = await requireUser();
  if (auth.error) return reply({ error: auth.error }, auth.status);
  try {
    const params = new URL(request.url).searchParams;
    const src = params.getAll('src');
    const parsed = src.length === 1 ? parseReviewScope({ src: src[0], lang: 'Japanese' }) : null;
    const kind = parsed?.invalid === false ? parsed.scope.src.kind : null;
    if (kind !== 'material' && kind !== 'note') fail(400, '복습 범위를 확인해 주세요.');
    const ids = parsed.scope.src.ids;
    const wordIds = new Set();
    for (let offset = 0; ; offset += PAGE) {
      let query = auth.supabase.from('vocabulary_contexts').select('id,user_vocabulary!inner(id,user_id)')
        .eq('user_id', auth.user.id).eq('user_vocabulary.user_id', auth.user.id).eq('kind', 'reading').in('material_id', ids);
      if (kind === 'note') query = query.not('locator->>noteCandidate', 'is', null);
      const { data, error } = await query.order('id', { ascending: true }).range(offset, offset + PAGE - 1);
      checkDb(error);
      for (const row of data || []) wordIds.add(row.user_vocabulary.id);
      if ((data || []).length < PAGE) break;
      if (offset >= PAGE * 40) fail(413, '범위가 너무 커요. 자료를 나눠 골라 주세요.');
    }
    if (kind === 'material') {
      const { data, error } = await auth.supabase.from('user_vocabulary').select('id')
        .eq('user_id', auth.user.id).in('source_material_id', ids).limit(5000);
      checkDb(error);
      for (const row of data || []) wordIds.add(row.id);
    }
    return reply({ wordIds: [...wordIds] });
  } catch (error) { return errorReply(error); }
}
