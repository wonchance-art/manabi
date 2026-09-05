import { loadChapter, getGrammarManifest } from '@/content/refGrammarLoaders';
import { loadPublishedRegistry } from '@/lib/publishedChapter';
import { LEARNING_LANGUAGES, materialIdValid, normalizeLearningWord, tokenContext } from '@/lib/learningSources';

export const fail = (status, message, extra = {}) => { throw Object.assign(new Error(message), { status, ...extra }); };
export function checkDb(error) { if (error) fail(503, '자료 연결을 저장하거나 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); }
export function reply(data, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } }); }
export function errorReply(error) {
  if (error instanceof SyntaxError) return reply({error:'입력 내용을 확인해 주세요.'},400);
  return reply({ error: error.status ? error.message : '요청을 처리하지 못했어요.', ...(error.extra || {}) }, error.status || 500);
}
export async function readBody(request) {
  const body = await request.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400,'입력 내용을 확인해 주세요.');
  return body;
}
export function chapterMeta(lang, slug) {
  if (!LEARNING_LANGUAGES.includes(lang) || typeof slug !== 'string') fail(400, '교재를 선택해 주세요.');
  const manifest = getGrammarManifest(lang);
  const chapter = manifest.levels.flatMap(level => level.chapters).find(c => c.slug === slug);
  if (!chapter) fail(404, '교재 단원을 찾을 수 없어요.');
  return chapter;
}

export async function accessibleMaterial(supabase, userId, kind, id) {
  if (!materialIdValid(kind, id)) fail(400, '자료 주소가 올바르지 않아요.');
  const table = kind === 'pdf' ? 'uploaded_pdfs' : 'reading_materials';
  const fields = kind === 'pdf' ? 'id,title,owner_id,page_count,language' : 'id,title,owner_id,visibility,processed_json,raw_text';
  const { data, error } = await supabase.from(table).select(fields).eq('id', id).maybeSingle();
  checkDb(error);
  // 기존 permissive RLS가 남은 환경에서도 명시적인 접근 검사로 비공개 내용을 반환하지 않는다.
  if (!data || (data.owner_id !== userId && !(kind === 'reading' && data.visibility === 'public'))) fail(404, '접근할 수 없는 자료입니다.');
  return data;
}

export async function resolveSave(supabase, userId, payload) {
  const { source = {}, word = {} } = payload;
  if (!source || typeof source !== 'object' || !word || typeof word !== 'object') fail(400,'입력 내용을 확인해 주세요.');
  const lang = word.language;
  if (!LEARNING_LANGUAGES.includes(lang)) fail(400, '지원하는 언어를 선택해 주세요.');
  let normalized = { word_text: normalizeLearningWord(word.base_form || word.word_text), meaning: String(word.meaning || '').trim(), language: lang,
    furigana: String(word.furigana || '').slice(0, 500), pos: String(word.pos || '').slice(0, 80) };
  let resolved;
  if (source.kind === 'reading') {
    const material = await accessibleMaterial(supabase, userId, 'reading', source.materialId);
    const context = tokenContext(material.processed_json, source.tokenId);
    if (context) {
      if (context.language !== lang) fail(400, '자료의 언어를 다시 확인해 주세요.');
      const token = context.token;
      normalized = { ...normalized, word_text: normalizeLearningWord(token.sep_link || token.base_form || token.text), meaning: String(token.meaning || normalized.meaning).trim(), furigana: token.furigana || token.reading || '', pos: token.pos || '' };
      resolved = { kind: 'reading', materialId: String(material.id), quote: context.quote.slice(0,4000), translation: '', locator: { tokenId: source.tokenId, surface: token.text } };
    } else {
      const quote = String(source.quote || '').trim(), surface = String(source.surface || '').trim();
      const compact = text => String(text || '').normalize('NFC').replace(/\s+/g,'');
      if (!quote || quote.length > 4000 || !surface || !compact(quote).includes(compact(surface)) || !compact(material.raw_text).includes(compact(quote))) fail(400,'자료에서 문장을 다시 선택해 주세요.');
      const actualLang = material.processed_json?.metadata?.language;
      if (actualLang && actualLang !== lang) fail(400,'자료의 언어를 다시 확인해 주세요.');
      resolved = {kind:'reading',materialId:String(material.id),quote,translation:'',locator:{surface}};
    }
  } else if (source.kind === 'pdf') {
    const pdf = await accessibleMaterial(supabase, userId, 'pdf', source.pdfId);
    const page = source.page == null || source.page === '' ? null : Number(source.page);
    if (page !== null && (!Number.isInteger(page) || page < 1 || page > (pdf.page_count || 100000))) fail(400, 'PDF 쪽수를 확인해 주세요.');
    const quote = String(source.quote || '').trim();
    if (!quote || quote.length > 4000) fail(400, '출처 문장을 4,000자 이내로 입력해 주세요.');
    // 네이티브 PDF 뷰어의 선택문/쪽수는 사용자 입력이며 자동 추출 위치라고 주장하지 않는다.
    resolved = { kind: 'pdf', pdfId: pdf.id, quote, translation: '', locator: { page, userSelected: true } };
  } else if (source.kind === 'textbook') {
    chapterMeta(lang, source.chapterSlug);
    const { registry, data } = await loadChapter(lang, source.chapterSlug);
    const ref = await loadPublishedRegistry(lang, registry), chapter = ref.resolve(data.chapter);
    const si = source.sectionIndex, ei = source.exampleIndex, vi = source.vocabIndex;
    if (!Number.isInteger(si) || si < 0 || !chapter.sections[si]) fail(400, '교재 위치를 다시 선택해 주세요.');
    const section = chapter.sections[si], origins = ref.getChapterSources(chapter);
    let quote, translation, blockId;
    if (Number.isInteger(vi) && vi >= 0 && section.vocabs?.[vi]) {
      const vocab = section.vocabs[vi];
      normalized = { ...normalized, word_text: vocab.word, meaning: vocab.meanings.join(', ') };
      quote = vocab.exampleSentence || vocab.word; translation = normalized.meaning;
      blockId = origins.sections[si].sectionId;
    } else {
      const origin = Number.isInteger(ei) && ei >= 0 ? origins.sections[si].examples[ei] : null;
      if (!origin?.quote) fail(400, '예문을 다시 선택해 주세요.');
      quote = origin.quote; translation = origin.translation; blockId = origin.blockId;
      if (!quote.toLocaleLowerCase().includes(normalized.word_text.toLocaleLowerCase())) fail(400, '예문에 있는 단어나 표현을 입력해 주세요.');
    }
    resolved = { kind: 'textbook', chapterSlug: chapter.slug, quote, translation, locator: { blockId, revision: origins.revision } };
  } else fail(400, '출처를 선택해 주세요.');
  if (!normalized.word_text || normalized.word_text.length > 300 || !normalized.meaning || normalized.meaning.length > 2000) fail(400, '표현과 뜻을 입력해 주세요.');
  // JSONB key 순서에 무관한 위치/발췌로 DB에서 중복 제거. 외부 URL·서명된 파일 주소는 저장하지 않는다.
  return { word: normalized, source: resolved };
}
