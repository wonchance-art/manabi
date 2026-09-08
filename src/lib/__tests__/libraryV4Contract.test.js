import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const migration=read('supabase/migrations/20260908025511_personal_library_catalog.sql');
function sourceGuard(sql){
 if(/security\s+definer/i.test(sql))throw new Error('INVOCER_REQUIRED');
 if(/(?:update|delete from)\s+(?:public\.)?(?:reading_materials|reading_progress|user_vocabulary|uploaded_pdfs)\b/i.test(sql))throw new Error('SOURCE_MUTATION');
 if(!sql.includes('new.opened_at=clock_timestamp()'))throw new Error('SERVER_CLOCK_REQUIRED');
}
describe('library projection boundaries',()=>{
 it('does not gain elevated privileges or modify any source/progress',()=>{expect(()=>sourceGuard(migration)).not.toThrow();});
 it('detects privilege, source-write and fabricated-clock mutations',()=>{
  expect(()=>sourceGuard(migration.replace('security invoker','security definer'))).toThrow('INVOCER_REQUIRED');
  expect(()=>sourceGuard(migration+'\nupdate public.reading_materials set title=title;')).toThrow('SOURCE_MUTATION');
  expect(()=>sourceGuard(migration.replace('new.opened_at=clock_timestamp()','new.opened_at=new.opened_at'))).toThrow('SERVER_CLOCK_REQUIRED');
 });
 it('normal rendering gates recent writes and local file positions do not become grades',()=>{
  const activity=read('src/components/library/useLibraryActivity.js');expect(activity).toContain("document.visibilityState!=='visible'");expect(activity).toContain('requestAnimationFrame(record)');expect(activity).toContain('getBoundingClientRect');
  const original=read('src/components/materials/OriginalMaterialReader.jsx');expect(original).toContain('<OriginalFileReader');
  const file=read('src/components/materials/OriginalFileReader.jsx');expect(file).toContain('onReady={readyRef.current}');expect(file).toContain('originalPositionKey(');
  const pdf=read('src/views/PdfViewerPage.jsx');expect(pdf).toContain('legacyPdfPositionKey(user.id,id)');expect(pdf).not.toContain('update({ last_page_read:');
  expect(read('src/lib/libraryActivity.js')).not.toContain('reading_progress');expect(read('src/lib/libraryActivity.js')).not.toContain('persistVocabGrade');
 });
 it('has one composer entry, owned cache identities and bounded root pagination',()=>{
  const shelf=read('src/components/library/LibraryShelf.jsx');expect(shelf).toContain('libraryComposerHref(returnTo,filters.collection)');expect(shelf).toContain("['personal-library',user.id");expect(shelf).not.toContain('from(\'reading_materials\')');
  expect(read('src/components/library/LibraryRow.jsx')).toContain("['library-children',ownerId,");
  expect(migration).toContain('least(coalesce(p_limit,20),50)');expect(migration).toContain("to_jsonb(p)-'children'-'listed'-'ord'");
 });
});
