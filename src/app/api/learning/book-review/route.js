import { requireUser } from '@/lib/supabaseServer';
import { reply, errorReply, checkDb, fail } from '@/lib/server/learningContext';
import { sourceHref } from '@/lib/learningSources';
import { BOOK_ID } from '@/lib/textbook/contract';

export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireUser();
  if (auth.error) return reply({ error: auth.error }, auth.status);
  try {
    const raw = new URL(request.url).searchParams.get('offset') || '0';
    if (!/^\d{1,7}$/.test(raw)) fail(400, '목록 위치를 확인해 주세요.');
    const offset = Number(raw), size = 40;
    const { data, error } = await auth.supabase.from('vocabulary_contexts')
      .select('id,kind,lang,chapter_slug,locator,quote,translation,created_at,user_vocabulary!inner(id,user_id,word_text,meaning,furigana)')
      .eq('user_id', auth.user.id).eq('user_vocabulary.user_id', auth.user.id)
      .eq('kind', 'textbook').eq('locator->>bookId', BOOK_ID)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + size);
    checkDb(error);
    const rows = data || [];
    const items = rows.slice(0, size).map(row => ({ id: row.id, quote: row.quote, translation: row.translation, chapter: row.chapter_slug, href: sourceHref(row), word: { id: row.user_vocabulary.id, text: row.user_vocabulary.word_text, meaning: row.user_vocabulary.meaning, furigana: row.user_vocabulary.furigana } })).filter(row => row.href);
    return reply({ items, nextOffset: rows.length > size ? offset + size : null });
  } catch (error) { return errorReply(error); }
}
