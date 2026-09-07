// Isolated Postgres + IndexedDB verification of the proposed DDL. Never contacts a server.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const modules=process.env.COMPOSER_TEST_MODULES;
if(!modules)throw new Error('Set COMPOSER_TEST_MODULES to isolated test dependencies.');
const {PGlite}=await import(pathToFileURL(resolve(modules,'@electric-sql/pglite/dist/index.js')).href);
await import(pathToFileURL(resolve(modules,'fake-indexeddb/auto/index.mjs')).href);
const {readComposerDraft,writeComposerDraft,removeComposerDraft}=await import('../../src/lib/composerDraft.js');
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const revision='00000000-0000-4000-8000-000000000003';
const db=new PGlite();
try{
 await db.exec(`create role authenticated; create role anon; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table reading_materials(id serial primary key,owner_id uuid,visibility text,title text,raw_text text,processed_json jsonb);
 alter table reading_materials enable row level security;
 create policy owned on reading_materials for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
 grant usage on schema public,auth to authenticated,anon; grant all on reading_materials to authenticated; grant select on reading_materials to anon;
 grant usage on all sequences in schema public to authenticated;
 insert into reading_materials(owner_id,visibility,title,raw_text,processed_json) values('${owner}','private','original','original source','{"metadata":{"composer":{"version":1}},"sequence":["old-token"]}');`);
 const spec=await readFile(new URL('../../docs/manabi-material-editing.md',import.meta.url),'utf8');
 const sql=spec.match(/```sql\n([\s\S]*?)```/)[1];await db.exec(sql);
 await db.exec(`set role authenticated; set test.uid='${owner}';`);
 const doc={version:1,revision,body:'new source',language:'French',assets:[],links:[]};
 let result=await db.query('update reading_materials set title=$1,document_json=$2 where id=1 and document_json is null returning id',['edited',doc]);assert.equal(result.rows.length,1);
 result=await db.query('update reading_materials set document_json=$1 where id=1 and document_json is null returning id',[{...doc,body:'stale overwrite'}]);assert.equal(result.rows.length,0);
 const stored=(await db.query('select * from reading_materials')).rows[0];assert.equal(stored.raw_text,'original source');assert.deepEqual(stored.processed_json.sequence,['old-token']);assert.equal(stored.document_json.body,'new source');
 await assert.rejects(db.query("update reading_materials set raw_text='old client overwrite' where id=1"),/composer_source_is_immutable/);
 await assert.rejects(db.query("update reading_materials set processed_json=jsonb_set(processed_json,'{metadata,composer}','{}') where id=1"),/composer_source_is_immutable/);
 await db.query('update reading_materials set processed_json=jsonb_set(processed_json,\'{status}\',\'"completed"\') where id=1');
 assert.equal((await db.query('select document_json from reading_materials')).rows[0].document_json.body,'new source');
 for(const value of [{...doc,body:null},{...doc,revision:''},{...doc,version:2}])await assert.rejects(db.query('update reading_materials set document_json=$1',[value]),/check constraint/);
 await assert.rejects(db.query("update reading_materials set visibility='public'"),/check constraint/);
 await db.exec(`set test.uid='${other}';`);assert.equal((await db.query('select * from reading_materials')).rows.length,0);
 assert.equal((await db.query('update reading_materials set document_json=$1 returning id',[doc])).rows.length,0);
 await db.exec('reset role; set role anon;');assert.equal((await db.query('select * from reading_materials')).rows.length,0);
 console.log('PASS: additive DDL, original preservation including older clients, stale revision rejection, concurrent analysis isolation, shape/private constraints, non-owner and anon isolation.');
}finally{await db.close();}
const file={hash:'a'.repeat(64),kind:'pdf',name:'a.pdf',size:5,blob:new Blob(['hello'])};
const make=id=>({version:1,id,title:id,body:'text',files:[file],links:[]});
await writeComposerDraft(owner,make('new'));
await writeComposerDraft(owner,make('edit-one'),'42');
await writeComposerDraft(owner,make('edit-two'),'43');
await writeComposerDraft(other,make('other'),'42');
await removeComposerDraft(owner,'42');
assert.equal(await readComposerDraft(owner,'42'),null);
for(const [account,scope,title] of [[owner,'','new'],[owner,'43','edit-two'],[other,'42','other']]){
 const value=await readComposerDraft(account,scope);assert.equal(value.title,title);assert.equal(await value.files[0].blob.text(),'hello');
}
await writeComposerDraft(owner,{...make('remote'),files:[{...file,blob:undefined}]},'44');
assert.equal((await readComposerDraft(owner,'44')).files[0].blob,undefined);
console.log('PASS: account and per-material draft isolation, separate new draft, exact Blob cleanup, remote attachment metadata without duplicate Blob.');
