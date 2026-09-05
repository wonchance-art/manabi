import { requireUser } from '@/lib/supabaseServer';
import { resolveSave, reply, errorReply, checkDb, fail, readBody } from '@/lib/server/learningContext';
import { UUID, sourceHref } from '@/lib/learningSources';

export const dynamic = 'force-dynamic';
export async function POST(request) {
  const auth = await requireUser();
  if (auth.error) return reply({ error: auth.error }, auth.status);
  try {
    const body = await readBody(request);
    if (!body || typeof body !== 'object') fail(400, '입력 내용을 확인해 주세요.');
    const saved = await resolveSave(auth.supabase, auth.user.id, body);
    if (body.confirmId && !UUID.test(body.confirmId)) fail(400, '기존 단어를 다시 확인해 주세요.');
    const { data, error } = await auth.supabase.rpc('save_vocabulary_context', {
      p_word: saved.word, p_source: saved.source, p_confirm_id: body.confirmId || null, p_confirm_meaning: body.confirmMeaning ?? null,
    });
    if (error?.message?.includes('vocabulary_meaning_conflict')) {
      let query = auth.supabase.from('user_vocabulary').select('id,meaning').eq('user_id', auth.user.id);
      query = UUID.test(error.details || '') ? query.eq('id',error.details) : query.eq('word_text',saved.word.word_text);
      const { data: existing, error: readError } = await query.maybeSingle();
      checkDb(readError);
      return reply({ error: '같은 뜻인지 확인해 주세요.', code: 'meaning_conflict', existing, incomingMeaning: saved.word.meaning }, 409);
    }
    if (error?.message?.includes('vocabulary_language_conflict')) return reply({ error: '같은 표기의 단어가 다른 언어로 저장되어 있어요. 기존 카드를 합치지 않았습니다.', code: 'language_conflict' },409);
    if (error?.message?.includes('vocabulary_ambiguous_match')) return reply({error:'이 표현의 기존 카드가 여러 개 있어요. 단어장에서 중복 카드를 확인한 뒤 다시 담아 주세요.',code:'ambiguous_match'},409);
    checkDb(error);
    return reply(data);
  } catch (error) { return errorReply(error); }
}

export async function GET(request) {
  const auth = await requireUser();
  if (auth.error) return reply({ error: auth.error }, auth.status);
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!UUID.test(id || '')) fail(400, '단어를 선택해 주세요.');
    const { data, error } = await auth.supabase.from('vocabulary_contexts')
      .select('id,kind,lang,chapter_slug,material_id,pdf_id,locator,quote,translation,created_at')
      .eq('user_id', auth.user.id).eq('vocabulary_id', id).order('created_at', { ascending: true }).limit(50);
    checkDb(error);
    return reply({ contexts: (data || []).map(source => ({ ...source, href: sourceHref(source) })).filter(source => source.href) });
  } catch (error) { return errorReply(error); }
}

export async function DELETE(request) {
  const auth = await requireUser();
  if (auth.error) return reply({ error: auth.error }, auth.status);
  try {
    const { id } = await readBody(request);
    if (!UUID.test(id || '')) fail(400, '출처를 선택해 주세요.');
    const { error } = await auth.supabase.from('vocabulary_contexts').delete().eq('user_id', auth.user.id).eq('id', id);
    checkDb(error); return reply({ ok: true });
  } catch (error) { return errorReply(error); }
}
