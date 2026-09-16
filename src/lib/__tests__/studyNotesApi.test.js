import {beforeEach,describe,expect,it,vi} from 'vitest';
const {auth}=vi.hoisted(()=>({auth:vi.fn()}));
vi.mock('@/lib/supabaseServer',()=>({requireUser:auth}));
import {readOwnNote,updateOwnNote} from '../server/studyNotes';
import {resolveSave} from '../server/learningContext';
import {POST} from '../../app/api/notes/route';
import {GET,PUT} from '../../app/api/notes/[id]/route';
import {GET as dictionary} from '../../app/api/notes/dictionary/route';
import {newStudyNote,noteMaterialRow} from '../studyNotes';

const owner='11111111-1111-4111-8111-111111111111',key='22222222-2222-4222-8222-222222222222',revision='33333333-3333-4333-8333-333333333333',candidate='44444444-4444-4444-8444-444444444444';
function fixture(){const document=newStudyNote(key,'page-1');document.candidates=[{id:candidate,pageId:'page-1',elementIds:[],originKey:'typed-1',original:'はし → 다리',text:'橋',base:'橋',reading:'はし',meaning:'다리',language:'Japanese',reviewed:true,excluded:false}];return {id:23,...noteMaterialRow(owner,'내 노트',document,revision)};}
// Captures authorization and CAS predicates separately from returned fixture rows.
function client(results){const calls=[];return {calls,from(table){const call={table,filters:[]};calls.push(call);const query={select(value){call.select=value;return query;},eq(...args){call.filters.push(args);return query;},in(...args){call.filters.push(args);return query;},insert(value){call.insert=value;return query;},update(value){call.update=value;return query;},maybeSingle(){return Promise.resolve(results.shift());},single(){return Promise.resolve(results.shift());},then(resolve,reject){return Promise.resolve(results.shift()).then(resolve,reject);}};return query;}};}
const request=body=>new Request('http://localhost/api/notes',{method:'POST',body:JSON.stringify(body)});

beforeEach(()=>auth.mockReset());
describe('personal notes API authorization and persistence',()=>{
 it('requires login for reads, writes, creation, and stored dictionary lookup',async()=>{
  auth.mockResolvedValue({error:'로그인 필요',status:401});
  const context={params:Promise.resolve({id:'23'})};
  for(const response of [await GET(request({}),context),await PUT(request({}),context),await POST(request({})),await dictionary(new Request('http://localhost/api/notes/dictionary?q=はし&language=Japanese'))])expect(response.status).toBe(401);
 });
 it('enforces owner + private even if an older database policy returns another owner or public material',async()=>{
  for(const row of [{...fixture(),owner_id:'someone'},{...fixture(),visibility:'public'},null]){
   const db=client([{data:row}]);await expect(readOwnNote(db,owner,'23')).rejects.toMatchObject({status:404});expect(db.calls[0].filters).toContainEqual(['owner_id',owner]);
  }
 });
 it('uses a server revision predicate and does not overwrite a concurrent update',async()=>{
  const row=fixture(),db=client([{data:row},{data:null}]);
  await expect(updateOwnNote(db,owner,'23',{title:'수정',document:row.processed_json.metadata.studyNote.document,revision})).rejects.toMatchObject({status:409});
  expect(db.calls[1].filters).toContainEqual(['processed_json->metadata->studyNote->>revision',revision]);expect(db.calls[1].filters).toContainEqual(['owner_id',owner]);
 });
 it('rejects stale revisions and changed note identity before issuing any update',async()=>{
  const row=fixture();for(const body of [{revision:key,document:row.processed_json.metadata.studyNote.document},{revision,document:{...row.processed_json.metadata.studyNote.document,key:revision}}]){
   const db=client([{data:row}]);await expect(updateOwnNote(db,owner,'23',body)).rejects.toMatchObject({status:body.revision===key?409:400});expect(db.calls).toHaveLength(1);
  }
 });
 it('retrying creation with the same account + note key returns the existing note',async()=>{
  const row=fixture(),db=client([{data:row}]);auth.mockResolvedValue({user:{id:owner},supabase:db});
  const response=await POST(request({title:'내 노트',document:row.processed_json.metadata.studyNote.document}));
  expect(response.status).toBe(200);expect((await response.json()).id).toBe('23');expect(db.calls).toHaveLength(1);expect(db.calls[0].filters).toContainEqual(['processed_json->metadata->>importAttempt',key]);
 });
 it('resolves vocabulary from the reviewed private candidate and ignores forged text/meaning',async()=>{
  const db=client([{data:fixture()}]);
  const result=await resolveSave(db,owner,{source:{kind:'reading',materialId:'23',noteCandidateId:candidate},word:{word_text:'fake',meaning:'fake',language:'Japanese'}});
  expect(result.word).toMatchObject({word_text:'橋',meaning:'다리',furigana:'はし'});expect(result.source).toMatchObject({quote:'はし → 다리',locator:{noteCandidate:candidate,notePage:'page-1'}});
 });
 it('does not save unreviewed, excluded, missing, or other-language candidates',async()=>{
  for(const changes of [{reviewed:false},{excluded:true},{id:key},{language:'Chinese'}]){
   const row=fixture();Object.assign(row.processed_json.metadata.studyNote.document.candidates[0],changes);
   await expect(resolveSave(client([{data:row}]),owner,{source:{kind:'reading',materialId:'23',noteCandidateId:candidate},word:{language:'Japanese'}})).rejects.toMatchObject({status:400});
  }
 });
 it('retrieves kanji candidates and glosses solely from the existing stored dictionary',async()=>{
  const db=client([{data:[{base_form:'橋',reading:'はし',meanings:['다리']}]}]);auth.mockResolvedValue({user:{id:owner},supabase:db});
  const response=await dictionary(new Request('http://localhost/api/notes/dictionary?q=はし&language=Japanese')),data=await response.json();
  expect(response.status).toBe(200);expect(data.candidates).toContainEqual(expect.objectContaining({text:'橋',meaning:'다리'}));expect(db.calls[0].table).toBe('morpheme_dictionary');
 });
});
