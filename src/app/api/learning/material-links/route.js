import {publishedBookCatalog} from '@/lib/textbook/server';
import {bookChapterNumber} from '@/lib/textbook/sources';
import { requireUser } from '@/lib/supabaseServer';
import { getGrammarManifest } from '@/content/refGrammarLoaders';
import { getOverridesForLang, mergeChapter } from '@/lib/contentOverrides';
import { accessibleMaterial, chapterMeta, canReadLegacyTextbook, reply, errorReply, checkDb, fail, readBody } from '@/lib/server/learningContext';
import { UUID, LEARNING_LANGUAGES, LANGUAGE_BASE } from '@/lib/learningSources';

export const dynamic = 'force-dynamic';
export async function GET(request) {
  const auth = await requireUser();
  if (auth.error) return reply({ error: auth.error }, auth.status);
  try {
    const params = new URL(request.url).searchParams, lang = params.get('lang'), slug = params.get('slug');
    const kind = params.get('kind'), id = params.get('id');
    const canReadArchive = await canReadLegacyTextbook(auth.supabase, auth.user.id);
    if (!LEARNING_LANGUAGES.includes(lang)) fail(400, '언어를 선택해 주세요.');
    let query = auth.supabase.from('textbook_material_links')
      .select('id,lang,chapter_slug,material_id,pdf_id,reading_materials:material_id(id,title),uploaded_pdfs:pdf_id(id,title)')
      .eq('user_id', auth.user.id).eq('lang', lang);
    const bookChapters = lang === 'Japanese' ? await publishedBookCatalog(auth.supabase) : [];
    const validateChapter = chapterSlug => { if(bookChapterNumber(chapterSlug)){if(!bookChapters.some(c=>c.slug===chapterSlug))fail(404,'발행된 교재를 선택해 주세요.');}else { if(!canReadArchive)fail(403,'기존 교재는 관리자 보관함으로 이동했어요.'); chapterMeta(lang,chapterSlug); } };
    if (slug) { validateChapter(slug); query = query.eq('chapter_slug', slug); }
    else { await accessibleMaterial(auth.supabase, auth.user.id, kind, id); query = query.eq(kind === 'pdf' ? 'pdf_id' : 'material_id', id); }
    const { data, error } = await query.order('created_at', { ascending: true }).limit(100);
    checkDb(error);
    const catalog = [];
    if (canReadArchive) {
      const manifest = getGrammarManifest(lang);
      const overrides = await getOverridesForLang(lang);
      catalog.push(...manifest.levels.map(level => ({ level: level.key, chapters: level.chapters.map(c => ({ slug: c.slug, title: mergeChapter(c,overrides.get(c.slug)).title, href: `/admin/legacy-textbooks${LANGUAGE_BASE[lang]}/grammar/${c.slug}` })) })));
    }
    if(bookChapters.length)catalog.push({level:'N5 한 권',chapters:bookChapters});
    const links = (data || []).map(row => {
      const chapter = catalog.flatMap(l => l.chapters).find(c => c.slug === row.chapter_slug);
      const material = row.material_id ? row.reading_materials : row.uploaded_pdfs;
      if (!chapter || !material) return null;
      return { id: row.id, title: slug ? material.title : chapter.title,
        href: slug ? (row.material_id ? `/viewer/${row.material_id}` : `/pdf/${row.pdf_id}`) : (chapter.href || `${LANGUAGE_BASE[lang]}/grammar/${row.chapter_slug}`) };
    }).filter(Boolean);
    let candidates = [];
    if (slug) {
      const results = await Promise.all([
        auth.supabase.from('reading_materials').select('id,title').eq('owner_id', auth.user.id).order('created_at',{ascending:false}).limit(100),
        auth.supabase.from('uploaded_pdfs').select('id,title').eq('owner_id',auth.user.id).order('created_at',{ascending:false}).limit(100),
      ]);
      results.forEach(result => checkDb(result.error));
      candidates = results.flatMap((result, index) => (result.data || []).map(row => ({ id: String(row.id), title: row.title, kind: index ? 'pdf' : 'reading' })));
    }
    return reply({ links, candidates, catalog });
  } catch (error) { return errorReply(error); }
}
export async function POST(request) {
  const auth = await requireUser();
  if (auth.error) return reply({error:auth.error},auth.status);
  try {
    const body = await readBody(request);
    if(body.lang==='Japanese' && bookChapterNumber(body.slug)){const chapters=await publishedBookCatalog(auth.supabase);if(!chapters.some(c=>c.slug===body.slug))fail(404,'발행된 교재를 선택해 주세요.');}else { if(!(await canReadLegacyTextbook(auth.supabase, auth.user.id)))fail(403,'기존 교재는 관리자 보관함으로 이동했어요.'); chapterMeta(body.lang, body.slug); }
    await accessibleMaterial(auth.supabase,auth.user.id,body.kind,body.materialId);
    const column = body.kind === 'pdf' ? 'pdf_id' : 'material_id';
    const { error } = await auth.supabase.from('textbook_material_links').upsert({ user_id:auth.user.id,lang:body.lang,chapter_slug:body.slug,[column]:body.materialId },
      { onConflict:`user_id,lang,chapter_slug,${column}`,ignoreDuplicates:true });
    checkDb(error); return reply({ok:true});
  } catch (error) { return errorReply(error); }
}
export async function DELETE(request) {
  const auth = await requireUser();
  if (auth.error) return reply({error:auth.error},auth.status);
  try {
    const { id } = await readBody(request);
    if (!UUID.test(id || '')) fail(400,'연결을 선택해 주세요.');
    const { error } = await auth.supabase.from('textbook_material_links').delete().eq('id',id).eq('user_id',auth.user.id);
    checkDb(error);return reply({ok:true});
  } catch(error) {return errorReply(error);}
}
