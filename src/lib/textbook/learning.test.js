import {beforeEach,describe,it,expect,vi} from 'vitest';
const {auth}=vi.hoisted(()=>({auth:vi.fn()}));
vi.mock('@/lib/supabaseServer',()=>({requireUser:auth}));
vi.mock('@/lib/contentOverrides',async actual=>({...await actual(),getOverridesForLang:async()=>new Map()}));
import {resolveSave} from '@/lib/server/learningContext';
import * as links from '@/app/api/learning/material-links/route';
import {currentCandidate} from './server';
let b,db,state;const user='11111111-1111-4111-8111-111111111111';
beforeEach(async()=>{b=await currentCandidate();state={edition:{edition_id:b.editionId,content_hash:b.contentHash,artifact_manifest:b.artifactManifest,manuscript:b.manuscript},material:{id:1,owner_id:user,title:'내 자료',visibility:'private'},links:[]};db={from:vi.fn(table=>{const result=()=>({data:table==='textbook_book_editions'?state.edition:table==='textbook_book_releases'?{edition_id:b.editionId}:table==='reading_materials'?state.material:table==='textbook_material_links'?state.links:[],error:null});const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,maybeSingle:async()=>result(),upsert:vi.fn(()=>q),then:r=>Promise.resolve(result()).then(r)};return q})};auth.mockResolvedValue({user:{id:user},supabase:db})});
const payload=()=>({word:{word_text:'ちち',meaning:'아버지',language:'Japanese'},source:{kind:'textbook',bookId:'japanese-n5',editionId:b.editionId,pageId:'u03-study1',quote:'ちちは せんせいです。'}});
describe('book provenance and personal materials',()=>{
 it('resolves the published snapshot and keeps stable book/page coordinates',async()=>{const v=await resolveSave(db,user,payload());expect(v.source.locator).toMatchObject({editionId:b.editionId,pageId:'u03-study1'});expect(v.source.chapterSlug).toBe('n5-book-u03')});
 it('unpublished, wrong-language, forged and missing editions cannot become review sources',async()=>{state.edition=null;await expect(resolveSave(db,user,payload())).rejects.toMatchObject({status:404});state.edition={content_hash:'0'.repeat(64)};await expect(resolveSave(db,user,payload())).rejects.toMatchObject({status:503});const p=payload();p.word.language='English';await expect(resolveSave(db,user,p)).rejects.toMatchObject({status:400})});
 it('viewer catalog contains the 42 published book chapters with edition URLs',async()=>{const res=await links.GET(new Request('https://fixture.test/?lang=Japanese&kind=reading&id=1'));expect(res.status).toBe(200);const book=(await res.json()).catalog.find(x=>x.level==='N5 한 권');expect(book.chapters).toHaveLength(42);expect(book.chapters[2].href).toContain(`?edition=${b.editionId}#u03`)});
 it('cannot attach someone else’s private material to a book chapter',async()=>{state.material.owner_id='other';const res=await links.POST(new Request('https://fixture.test/',{method:'POST',body:JSON.stringify({lang:'Japanese',slug:'n5-book-u03',kind:'reading',materialId:1})}));expect(res.status).toBe(404)});
 it('deleted linked material is not returned as an openable source',async()=>{state.links=[{id:'link',chapter_slug:'n5-book-u03',material_id:1,reading_materials:null}];const res=await links.GET(new Request('https://fixture.test/?lang=Japanese&kind=reading&id=1'));expect((await res.json()).links).toEqual([])});
});
