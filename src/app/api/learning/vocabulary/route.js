import { requireUser } from '@/lib/supabaseServer';
import { resolveSave, reply, errorReply, checkDb, fail, readBody, accessibleMaterial } from '@/lib/server/learningContext';
import { UUID, sourceArchived, sourceHref } from '@/lib/learningSources';
import { requireLearningCapability } from '@/lib/server/learningCapabilities';
import { gradeToInitialStats } from '@/lib/vocabIO';
import { fsrsServiceClient, fsrsError } from '@/lib/server/fsrsLearning';
import { readVocabularyLearningSnapshot, saveManualVocabulary } from '@/lib/server/fsrsVocabulary';
import { VOCABULARY_LEARNING_SUMMARY_FIELDS } from '@/lib/vocabularyLearningRead';

const vocabularyErrorReply = error => {
  if (error?.code?.startsWith('fsrs_')) { const result = fsrsError(error); return reply(result.body, result.status); }
  return errorReply(error);
};

async function readVocabularyJson(request) {
  // 기존 문맥 저장도 충분히 담는 상한이다. 파싱 전에 끊어 청크 전송 역시 무제한 읽지 않는다.
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('invalid_json');
  const chunks = []; let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 65536) {
      await reader.cancel();
      throw Object.assign(new Error('fsrs_invalid_request'), { code: 'fsrs_invalid_request', status: 400 });
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(combined));
}

export const dynamic = 'force-dynamic';
export async function POST(request) {
  const auth = await requireUser();
  if (auth.error) return reply({ error: auth.error }, auth.status);
  try {
    const body = await readBody({ json: () => readVocabularyJson(request) });
    if (body?.action === 'save') {
      const origin = request.headers.get('origin');
      if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')
          || JSON.stringify(body).length > 8192) return reply({ ok: false, code: 'fsrs_invalid_request' }, 400);
      if (origin && origin !== new URL(request.url).origin) return reply({ ok: false, code: 'fsrs_invalid_origin' }, 403);
      return reply(await saveManualVocabulary({ authClient: auth.supabase, serviceClient: fsrsServiceClient(), userId: auth.user.id, body }));
    }
    if (!body || typeof body !== 'object') fail(400, '입력 내용을 확인해 주세요.');
    const korean = body.word?.language === 'Korean';
    if (korean) {
      if ((body.accountId ?? body.word?.user_id) !== auth.user.id
        || (body.word?.user_id !== undefined && body.word.user_id !== auth.user.id)) {
        fail(409, '계정이 바뀌었어요. 다시 선택해 주세요.');
      }
      await requireLearningCapability(auth.supabase, 'Korean');
      if (body.initialGrade !== undefined && (!Number.isInteger(body.initialGrade) || body.initialGrade < 1 || body.initialGrade > 4)) {
        fail(400, '저장할 단어의 평가를 다시 선택해 주세요.');
      }
    }
    const saved = await resolveSave(auth.supabase, auth.user.id, body);
    if (korean && body.initialGrade !== undefined) {
      Object.assign(saved.word, gradeToInitialStats(body.initialGrade));
    }
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
    if (korean) {
      if (!UUID.test(data?.vocabularyId || '')) fail(503, '저장한 단어를 다시 확인해 주세요.');
      const { data: vocabulary, error: readError } = await auth.supabase.from('user_vocabulary')
        .select('*').eq('user_id', auth.user.id).eq('id', data.vocabularyId).maybeSingle();
      checkDb(readError);
      if (!vocabulary || vocabulary.user_id !== auth.user.id || vocabulary.language !== 'Korean') {
        fail(503, '저장한 단어를 다시 확인해 주세요.');
      }
      return reply({ ...data, vocabulary });
    }
    return reply(data);
  } catch (error) { return vocabularyErrorReply(error); }
}

export async function GET(request) {
  const auth = await requireUser();
  if (auth.error) return reply({ error: auth.error }, auth.status);
  try {
    const params = new URL(request.url).searchParams;
    if (params.has('view')) {
      if (params.get('view') !== 'learning' || (params.has('fields') && params.get('fields') !== 'summary')
          || params.size !== (params.has('fields') ? 2 : 1)) return reply({ ok: false, code: 'fsrs_invalid_request' }, 400);
      const snapshot = await readVocabularyLearningSnapshot({ authClient: auth.supabase, serviceClient: fsrsServiceClient(), userId: auth.user.id });
      if (params.get('fields') === 'summary') return reply({ ...snapshot, rows: snapshot.rows.map(row =>
        Object.fromEntries(VOCABULARY_LEARNING_SUMMARY_FIELDS.filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]]))) });
      return reply(snapshot);
    }
    const contextId = params.get('contextId');
    if(params.has('contextId')) {
      if(!UUID.test(contextId || '')) fail(400,'저장한 문맥을 다시 선택해 주세요.');
      const {data:context,error}=await auth.supabase.from('vocabulary_contexts')
        .select('id,kind,material_id,locator,quote').eq('user_id',auth.user.id).eq('id',contextId).maybeSingle();
      checkDb(error);
      if(!context || context.kind!=='reading' || String(context.material_id)!==params.get('materialId')) fail(404,'접근할 수 없는 문맥입니다.');
      await accessibleMaterial(auth.supabase,auth.user.id,'reading',context.material_id);
      return reply({context});
    }
    const id = params.get('id');
    if (!UUID.test(id || '')) fail(400, '단어를 선택해 주세요.');
    const { data, error } = await auth.supabase.from('vocabulary_contexts')
      .select('id,kind,lang,chapter_slug,material_id,pdf_id,locator,quote,translation,created_at')
      .eq('user_id', auth.user.id).eq('vocabulary_id', id).order('created_at', { ascending: true }).limit(50);
    checkDb(error);
    // 보관된 옛 교재 문맥은 링크 없이 문장과 보관 표시로 남긴다(행은 읽기만 — VIEWER-R0-BUGS-001 버그 3).
    return reply({ contexts: (data || []).map(source => ({ ...source, href: sourceHref(source), ...(sourceArchived(source) ? { archived: true } : {}) })).filter(source => source.href || source.archived) });
  } catch (error) { return vocabularyErrorReply(error); }
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
