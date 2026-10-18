import { requireUser } from '@/lib/supabaseServer';
import { reply, errorReply, checkDb, fail } from '@/lib/server/learningContext';
import { sourceHref } from '@/lib/learningSources';
import { BOOK_ID,isBookId,bookUnitSlug } from '@/lib/textbook/contract';

const BOOK_LESSONS = 42;
const LESSON = /^[1-9]\d?$/;

// 과 범위(REV-SCOPE-R1A): from · to를 함께 주면 그 과(chapter_slug)에서 담은 문맥만. 둘 다 없으면 교재 전체 —
// 전체는 지금처럼 과 조건을 걸지 않는다(과가 없는 옛 문맥도 교재 전체 범위에는 남는다).
function lessonRange(params,bookId) {
  const from = params.get('from'), to = params.get('to');
  if (from === null && to === null) return null;
  if (!LESSON.test(from || '') || !LESSON.test(to || '') || Number(from) > Number(to) || Number(to) > BOOK_LESSONS) fail(400, '과 범위를 확인해 주세요.');
  if (Number(from) === 1 && Number(to) === BOOK_LESSONS) return null;
  return Array.from({ length: Number(to) - Number(from) + 1 }, (_, i) => bookUnitSlug(bookId,Number(from) + i));
}

export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireUser();
  if (auth.error) return reply({ error: auth.error }, auth.status);
  try {
    const params = new URL(request.url).searchParams;
    if(params.getAll('book').length>1)fail(400,'교재를 선택해 주세요.');
    const bookId=params.has('book')?params.get('book'):BOOK_ID;
    if(!isBookId(bookId))fail(400,'교재를 선택해 주세요.');
    const scope = params.get('scope') === '1';
    const raw = params.get('offset') || '0';
    if (!/^\d{1,7}$/.test(raw)) fail(400, '목록 위치를 확인해 주세요.');
    const chapters = lessonRange(params,bookId);
    const offset = Number(raw), size = scope ? 200 : 40;
    let query = auth.supabase.from('vocabulary_contexts')
      .select(scope ? 'id,chapter_slug,user_vocabulary!inner(id,user_id)' : 'id,kind,lang,chapter_slug,locator,quote,translation,created_at,user_vocabulary!inner(id,user_id,word_text,meaning,furigana)')
      .eq('user_id', auth.user.id).eq('user_vocabulary.user_id', auth.user.id)
      .eq('kind', 'textbook').eq('locator->>bookId', bookId);
    if (chapters) query = query.in('chapter_slug', chapters);
    const { data, error } = await query
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + size);
    checkDb(error);
    const rows = data || [];
    if (scope) {
      // 과(chapter_slug)는 복습 줄의 띄우기 단위다(REV-SCOPE-R1B-1 §6-1 ③) — 같은 과의 새 표현끼리 4장 이상 띄운다.
      // 한 단어가 여러 과에서 담겼으면 가장 최근 문맥의 과를 쓴다(정렬이 최신순).
      const page = rows.slice(0, size), chapters = {};
      for (const row of page) if (row.chapter_slug && !(row.user_vocabulary.id in chapters)) chapters[row.user_vocabulary.id] = row.chapter_slug;
      return reply({ wordIds: [...new Set(page.map(row => row.user_vocabulary.id))], chapters, nextOffset: rows.length > size ? offset + size : null });
    }
    const items = rows.slice(0, size).map(row => ({ id: row.id, quote: row.quote, translation: row.translation, chapter: row.chapter_slug, href: sourceHref(row), word: { id: row.user_vocabulary.id, text: row.user_vocabulary.word_text, meaning: row.user_vocabulary.meaning, furigana: row.user_vocabulary.furigana } })).filter(row => row.href);
    return reply({ items, nextOffset: rows.length > size ? offset + size : null });
  } catch (error) { return errorReply(error); }
}
