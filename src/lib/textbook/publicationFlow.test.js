import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const auth=vi.hoisted(()=>({admin:vi.fn(),user:vi.fn(),client:vi.fn()}));
vi.mock('@/lib/supabaseServer',()=>({requireAdmin:auth.admin,requireUser:auth.user,createSupabaseServerClient:auth.client}));
import * as editor from '@/app/api/admin/books/japanese-n5/route';
import * as vocabulary from '@/app/api/learning/vocabulary/route';
import * as review from '@/app/api/learning/book-review/route';
import {publishedReading} from '@/lib/server/bookReading';
import {candidate,contentHash} from './server';
import {withField} from './contract';

const owner='00000000-0000-4000-8000-000000000042';
let db,client,old,next,savedDraft,release,role='admin';
const request=body=>new Request('https://fixture.invalid/',{method:'POST',body:JSON.stringify(body)});
// Only the Supabase transport is modeled; the existing migrations/RLS/RPCs execute in PostgreSQL.
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select '${owner}'::uuid$$;
 create function public.is_admin() returns boolean language sql stable as $$select current_setting('qa.admin',true)='true'$$;
 grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid(),public.is_admin() to authenticated,anon;
 insert into auth.users values('${owner}');
 create table reading_materials(id bigint primary key,owner_id uuid,visibility text);alter table reading_materials enable row level security;
 create table uploaded_pdfs(id uuid primary key,owner_id uuid);
 create table user_vocabulary(id uuid primary key default gen_random_uuid(),user_id uuid,word_text text,base_form text,meaning text,furigana text,pos text,language text,source_sentence text,source_material_id bigint,next_review_at timestamptz,stability float default 0,difficulty float default 0,reps int default 0,unique(user_id,word_text));
 alter table user_vocabulary enable row level security;create policy own on user_vocabulary to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
 grant select,insert,update on user_vocabulary to authenticated;grant select on reading_materials,uploaded_pdfs to authenticated,anon;`);
 for(const name of ['20260905065205_textbook_material_contexts.sql','20260906024758_textbook_book_editions.sql'])await db.exec(fs.readFileSync(`supabase/migrations/${name}`,'utf8'));
 client={from(table){
  const filters=[];let single=false,range=null;
  const execute=async()=>{
   try{
    if(!['textbook_book_drafts','textbook_book_releases','textbook_book_editions','user_vocabulary','vocabulary_contexts'].includes(table))throw Error('unexpected table');
    let rows=(await db.query(`select * from ${table}`)).rows;
    if(table==='vocabulary_contexts')for(const row of rows)row.user_vocabulary=(await db.query('select * from user_vocabulary where id=$1',[row.vocabulary_id])).rows[0];
    for(const [key,value]of filters)rows=rows.filter(row=>(key==='locator->>bookId'?row.locator?.bookId:key==='user_vocabulary.user_id'?row.user_vocabulary?.user_id:row[key])===value);
    if(range)rows=rows.slice(range[0],range[1]+1);
    return {data:single?rows[0]||null:rows,error:null};
   }catch(error){return {data:null,error};}
  };
  const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q},order:()=>q,range:(a,b)=>{range=[a,b];return q},maybeSingle:()=>{single=true;return execute()},then:(resolve,reject)=>execute().then(resolve,reject)};return q;
 },async rpc(name,args){
   const signatures={save_textbook_book_draft:['p_book_id','p_manuscript','p_content_hash','p_expected_version'],publish_textbook_book:['p_book_id','p_edition_id','p_content_hash','p_manuscript','p_artifact_manifest','p_expected_draft_version','p_expected_release_version','p_restore'],save_vocabulary_context:['p_word','p_source','p_confirm_id','p_confirm_meaning']};
   const keys=signatures[name];if(!keys)throw Error('unexpected RPC');
   try{return {data:(await db.query(`select to_jsonb(${name}(${keys.map((_,i)=>'$'+(i+1)).join(',')})) result`,keys.map(k=>args[k]))).rows[0].result};}catch(error){return {error:{code:error.code,message:error.message,details:error.detail}};}
 }};
 auth.admin.mockImplementation(async()=>role==='admin'?{user:{id:owner},supabase:client}:{error:'관리자 전용',status:403});
 auth.user.mockImplementation(async()=>({user:{id:owner},supabase:client}));auth.client.mockResolvedValue(client);
 old=await candidate('7f572327dc67893e9453246c');next=await candidate('f09e3e1faa4ee5a35b0fb2a6');
 await db.exec("set role authenticated;set qa.admin='true'");
 let response=await editor.POST(request({action:'publish',editionId:old.editionId,expectedDraftVersion:null,expectedReleaseVersion:null}));expect(response.status).toBe(200);release=(await response.json()).release;
 savedDraft=withField(old.manuscript,['lessons',0,'title'],'보존할 선생님 초안');
 response=await editor.POST(request({action:'save',editionId:old.editionId,manuscript:savedDraft,expectedDraftVersion:null}));expect(response.status).toBe(200);
});
afterAll(async()=>{await db?.close()});

it('selects the latest candidate without replacing an older saved draft or public edition',async()=>{
 const response=await editor.GET(new Request('https://fixture.invalid/'));const data=await response.json();
 await expect(publishedReading(next.editionId)).rejects.toMatchObject({status:404});
 expect((await publishedReading(next.editionId,true)).preview).toBe(true);
 role='member';await expect(publishedReading(next.editionId,true)).rejects.toMatchObject({status:403});role='admin';
 expect(data.candidate.editionId).toBe(next.editionId);expect(data.draft.manuscript).toEqual(savedDraft);expect(data.release.edition_id).toBe(old.editionId);
 expect((await (await editor.GET(new Request(`https://fixture.invalid/?edition=${old.editionId}`))).json()).base).toEqual(old.manuscript);
 expect((await editor.GET(new Request('https://fixture.invalid/?edition=../../bad'))).status).toBe(404);
});
it('protects the old draft behind explicit replacement and a matching concurrency version',async()=>{
 const body={action:'save',editionId:next.editionId,manuscript:next.manuscript,expectedDraftVersion:1};
 expect((await editor.POST(request(body))).status).toBe(409);
 expect((await editor.POST(request({...body,replaceDraftHash:'f'.repeat(64)}))).status).toBe(409);
 expect((await client.from('textbook_book_drafts').select().maybeSingle()).data.manuscript).toEqual(savedDraft);
 expect((await editor.POST(request({...body,replaceDraftHash:contentHash(savedDraft),expectedDraftVersion:9}))).status).toBe(409);
 expect((await editor.POST(request({...body,replaceDraftHash:contentHash(savedDraft)}))).status).toBe(200);
 expect((await client.from('textbook_book_releases').select().maybeSingle()).data.edition_id).toBe(old.editionId);
});
it('publishes the selected matching candidate atomically and rejects stale publication',async()=>{
 const body={action:'publish',editionId:next.editionId,expectedDraftVersion:2,expectedReleaseVersion:release.version};
 expect((await editor.POST(request({...body,expectedDraftVersion:1}))).status).toBe(409);
 const response=await editor.POST(request(body));expect(response.status).toBe(200);release=(await response.json()).release;
 expect((await editor.POST(request(body))).status).toBe(409);
 expect((await publishedReading()).book.editionId).toBe(next.editionId);
});
it('saves, deduplicates and resolves the exact new-edition source without resetting a learned card',async()=>{
 role='member';await db.exec("set qa.admin='false'");
 expect((await editor.GET()).status).toBe(403);
 expect((await publishedReading(next.editionId)).preview).toBe(false);
 const word={word_text:'ちち',meaning:'아버지',language:'Japanese'};
 const source={kind:'textbook',bookId:'japanese-n5',editionId:next.editionId,pageId:'u03-study1',quote:'ちちは せんせいです。'};
 const send=(w=word,s=source,extra={})=>vocabulary.POST(request({word:w,source:s,...extra}));
 let response=await send();expect(response.status).toBe(200);const first=await response.json();expect(first).toMatchObject({created:true,contextAdded:true});
 await db.query("update user_vocabulary set stability=22,difficulty=3,reps=9,next_review_at='2027-01-01' where id=$1",[first.vocabularyId]);
 const original=(await db.query('select * from user_vocabulary where id=$1',[first.vocabularyId])).rows[0];
 expect(await (await send()).json()).toMatchObject({created:false,contextAdded:false});
 response=await send({...word,meaning:'우리 아버지'});expect(response.status).toBe(409);const conflict=await response.json();expect(conflict.code).toBe('meaning_conflict');
 response=await send({...word,meaning:'우리 아버지'},source,{confirmId:conflict.existing.id,confirmMeaning:conflict.existing.meaning});expect(response.status).toBe(200);
 expect((await db.query('select * from user_vocabulary where id=$1',[first.vocabularyId])).rows[0]).toEqual(original);
 const list=await (await review.GET(new Request('https://fixture.invalid/'))).json();expect(list.items).toHaveLength(1);expect(list.items[0].href).toBe(`/books/japanese-n5?edition=${next.editionId}#u03-study1`);
 expect((await send(word,{...source,quote:'偽の出典'})).status).toBe(400);
 expect((await send(word,{...source,editionId:'54f70824da508cbcea7dd578'})).status).toBe(404);
});
it('restores the old public pointer while preserving both published snapshots and saved source returns',async()=>{
 role='admin';await db.exec("set qa.admin='true'");
 const response=await editor.POST(request({action:'restore',editionId:old.editionId,expectedReleaseVersion:release.version}));expect(response.status).toBe(200);
 expect((await publishedReading()).book.editionId).toBe(old.editionId);
 expect((await publishedReading(next.editionId)).book.manuscript).toEqual(next.manuscript);
 expect((await client.from('textbook_book_editions').select().eq('edition_id',old.editionId).maybeSingle()).data.manuscript).toEqual(old.manuscript);
 const list=await (await review.GET(new Request('https://fixture.invalid/'))).json();expect(list.items[0].href).toContain(next.editionId);
 await expect(db.query('update textbook_book_editions set manuscript=$1 where edition_id=$2',[{},old.editionId])).rejects.toMatchObject({code:'42501'});
});
