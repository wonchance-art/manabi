import { requireUser } from '@/lib/supabaseServer';
import { reply, errorReply, checkDb, fail, readBody, accessibleMaterial } from '@/lib/server/learningContext';
import { tokenContext, UUID } from '@/lib/learningSources';
import { VOCABULARY_LANGUAGES, exclusionWord, loadVocabularyExclusions } from '@/lib/vocabularyExclusion';

export const dynamic = 'force-dynamic';
export async function GET() {
  const auth = await requireUser();
  if (auth.error) return reply({ error: auth.error }, auth.status);
  try {
    // PostgREST 응답 상한 때문에 1,000개 뒤의 제외 상태가 사라지지 않게 페이지를 모두 읽는다.
    const items = await loadVocabularyExclusions(auth.supabase, auth.user.id);
    return reply({ items });
  } catch (error) { return errorReply(error); }
}

export async function POST(request) {
  const auth = await requireUser();
  if (auth.error) return reply({ error: auth.error }, auth.status);
  try {
    const body = await readBody(request);
    if (body.accountId !== auth.user.id) fail(409, '계정이 바뀌었어요. 다시 선택해 주세요.');
    if (typeof body.excluded !== 'boolean') fail(400, '제외 상태를 선택해 주세요.');
    let vocabularyId = null, exclusionId = null, language = null, word = null;
    if (body.exclusionId) {
      if (!UUID.test(body.exclusionId) || body.excluded) fail(400, '제외된 단어를 다시 선택해 주세요.');
      exclusionId = body.exclusionId;
    } else if (body.vocabularyId) {
      if (!UUID.test(body.vocabularyId)) fail(400, '단어를 다시 선택해 주세요.');
      vocabularyId = body.vocabularyId;
    } else {
      const material = await accessibleMaterial(auth.supabase, auth.user.id, 'reading', body.materialId);
      const context = tokenContext(material.processed_json, body.tokenId);
      if (!context || !VOCABULARY_LANGUAGES.includes(context.language)) fail(400, '자료의 단어를 다시 선택해 주세요.');
      language = context.language; word = exclusionWord(context.token);
      if (!word || word.length > 300) fail(400, '단어 표기를 확인해 주세요.');
    }
    const { data, error } = await auth.supabase.rpc('set_vocabulary_exclusion', {
      p_language: language, p_word: word, p_vocabulary_id: vocabularyId, p_excluded: body.excluded, p_exclusion_id: exclusionId,
    });
    if (error?.message?.includes('vocabulary_ambiguous_match')) fail(409, '같은 기본형의 기존 카드가 여러 개예요.');
    if (error?.code === '42501') fail(404, '접근할 수 없는 단어입니다.');
    checkDb(error); return reply(data);
  } catch (error) { return errorReply(error); }
}
