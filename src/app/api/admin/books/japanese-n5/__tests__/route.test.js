import {beforeEach,describe,it,expect,vi} from 'vitest';
const auth=vi.hoisted(()=>({admin:vi.fn(),client:vi.fn()}));
vi.mock('@/lib/supabaseServer',()=>({requireAdmin:auth.admin,createSupabaseServerClient:auth.client}));
import * as editor from '../route';
import * as asset from '@/app/api/books/japanese-n5/[edition]/asset/route';
import {currentCandidate,contentHash} from '@/lib/textbook/server';
import {withField} from '@/lib/textbook/contract';
let b,db,state;
const request=body=>new Request('https://fixture.test/api/admin/books/japanese-n5',{method:'POST',body:JSON.stringify(body)});
beforeEach(async()=>{b=await currentCandidate();state={draft:null,release:null,edition:null,error:null};db={rpc:vi.fn(async(name,args)=>({data:name==='save_textbook_book_draft'?{manuscript:args.p_manuscript,content_hash:args.p_content_hash,version:1}:{edition_id:args.p_edition_id,version:1}})),from:vi.fn(table=>{const result=()=>({data:table==='textbook_book_drafts'?state.draft:table==='textbook_book_releases'?state.release:state.edition,error:state.error});const q={select:()=>q,eq:()=>q,order:()=>q,maybeSingle:async()=>result(),then:r=>Promise.resolve({...result(),data:table==='textbook_book_editions'?[]:result().data}).then(r)};return q})};auth.admin.mockResolvedValue({user:{id:'admin'},supabase:db});auth.client.mockResolvedValue(db)});
describe('private drafts and immutable publication routes',()=>{
 it('rejects unauthenticated and nonadmin edits before reading files or DB',async()=>{for(const status of [401,403]){auth.admin.mockResolvedValue({error:'denied',status});expect((await editor.GET()).status).toBe(status);expect((await editor.POST(request({action:'save'}))).status).toBe(status)}expect(db.from).not.toHaveBeenCalled();expect(db.rpc).not.toHaveBeenCalled()});
 it('saves content with server hash and requires a concurrency version',async()=>{expect((await editor.POST(request({action:'save',manuscript:b.manuscript}))).status).toBe(428);const manuscript=withField(b.manuscript,['lessons',0,'title'],'첫 인사');const res=await editor.POST(request({action:'save',manuscript,expectedDraftVersion:null}));expect(res.status).toBe(200);expect(res.headers.get('cache-control')).toBe('private, no-store');expect(db.rpc).toHaveBeenCalledWith('save_textbook_book_draft',expect.objectContaining({p_content_hash:contentHash(manuscript),p_expected_version:null}));expect((await res.json()).draft.version).toBe(1)});
 it('refuses structural changes and invalid JSON',async()=>{const manuscript=structuredClone(b.manuscript);manuscript.lessons.pop();expect((await editor.POST(request({action:'save',manuscript,expectedDraftVersion:null}))).status).toBe(400);for(const value of ['null','[]','{'])expect((await editor.POST(new Request('https://fixture.test',{method:'POST',body:value}))).status).toBe(400)});
 it('continues editing a saved draft after the generated candidate advances',async()=>{
  const manuscript=withField(b.manuscript,['lessons',0,'title'],'다음 개정의 첫 인사');
  manuscript.revision='0'.repeat(24);manuscript.source={url:'https://old-preview.example.test'};
  const response=await editor.POST(request({action:'save',manuscript,expectedDraftVersion:3}));
  expect(response.status).toBe(200);
  const saved=db.rpc.mock.calls.at(-1)[1];
  expect(saved.p_manuscript.lessons[0].title).toBe('다음 개정의 첫 인사');
  expect(saved.p_manuscript.revision).toBe(b.manuscript.revision);
  expect(saved.p_manuscript.source).toEqual(b.manuscript.source);
  expect(saved.p_content_hash).toBe(contentHash(manuscript));
  expect(saved.p_expected_version).toBe(3);
 });
 it('reports stale saves without leaking database errors',async()=>{db.rpc.mockResolvedValue({error:{code:'40001',message:'private SQL'}});expect((await editor.POST(request({action:'save',manuscript:b.manuscript,expectedDraftVersion:1}))).status).toBe(409);db.rpc.mockResolvedValue({error:{code:'other',message:'private SQL'}});const res=await editor.POST(request({action:'save',manuscript:b.manuscript,expectedDraftVersion:1}));expect(res.status).toBe(503);expect(await res.text()).not.toContain('private SQL')});
 it('publishes only a matching checked candidate, rejects newer draft and missing versions',async()=>{const body={action:'publish',editionId:b.editionId,expectedDraftVersion:null,expectedReleaseVersion:null};expect((await editor.POST(request(body))).status).toBe(200);expect(db.rpc).toHaveBeenCalledWith('publish_textbook_book',expect.objectContaining({p_content_hash:b.contentHash,p_restore:false,p_artifact_manifest:b.artifactManifest}));state.draft={version:1,content_hash:'f'.repeat(64)};expect((await editor.POST(request({...body,expectedDraftVersion:1}))).status).toBe(409);expect((await editor.POST(request({...body,expectedDraftVersion:undefined}))).status).toBe(428)});
 it('restoration requires published history and advances only the pointer',async()=>{const body={action:'restore',editionId:b.editionId,expectedReleaseVersion:2};expect((await editor.POST(request(body))).status).toBe(404);state.edition={content_hash:b.contentHash,artifact_manifest:b.artifactManifest};expect((await editor.POST(request(body))).status).toBe(200);expect(db.rpc.mock.calls.at(-1)[1]).toMatchObject({p_restore:true,p_expected_release_version:2,p_expected_draft_version:null})});
 it('draft assets are unavailable to anonymous readers; published assets validate manifest hashes',async()=>{const req=new Request(`https://fixture.test/api/books/japanese-n5/${b.editionId}/asset?file=index.html`),params={params:Promise.resolve({edition:b.editionId})};auth.admin.mockResolvedValue({error:'denied',status:401});expect((await asset.GET(req,params)).status).toBe(401);state.edition={content_hash:b.contentHash,artifact_manifest:b.artifactManifest};const res=await asset.GET(req,params);expect(res.status).toBe(200);expect(await res.text()).toContain('data-book-source');expect(res.headers.get('cache-control')).toBe('private, no-store');state.edition.content_hash='f'.repeat(64);expect((await asset.GET(req,params)).status).toBe(503)});
 it('never serves manuscript files by guessing an asset URL',async()=>{const req=new Request(`https://fixture.test/?file=bundle.json`);expect((await asset.GET(req,{params:Promise.resolve({edition:b.editionId})})).status).toBe(404)});
 it('withholds the unapproved PDF in a web-only publication',async()=>{
  expect(b.artifactManifest.media).toMatchObject({web:true,pdf:false});
  state.edition={content_hash:b.contentHash,artifact_manifest:b.artifactManifest};
  const req=new Request('https://fixture.test/?file=output/pdf/manabi-japanese-n5-complete.pdf');
  expect((await asset.GET(req,{params:Promise.resolve({edition:b.editionId})})).status).toBe(404);
 });
});
