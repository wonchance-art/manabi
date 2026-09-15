import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),llm:vi.fn(),limit:vi.fn()}));
vi.mock('@/lib/supabaseServer',()=>({requireUser:mocks.auth}));
vi.mock('@/lib/server/llm',()=>({callLLM:mocks.llm}));
vi.mock('@/lib/server/rateLimit',()=>({rateLimit:mocks.limit}));
import {POST} from '../../app/api/notes/[id]/recognize/route';
import {newStudyNote,noteMaterialRow} from '../studyNotes';
import {recognitionFingerprint} from '../noteRecognition';
const owner='11111111-1111-4111-8111-111111111111',revision='22222222-2222-4222-8222-222222222222';
const context={params:Promise.resolve({id:'55'})};
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
let row,body,calls;
const req=(value=body)=>new Request('http://localhost/api/notes/55/recognize',{method:'POST',body:JSON.stringify(value)});
function db(rows){return {from(){const filters=[];calls.push(filters);const q={select(){return q;},eq(...args){filters.push(args);return q;},maybeSingle(){return Promise.resolve({data:rows.shift()});}};return q;}};}
beforeEach(async()=>{
 vi.clearAllMocks();calls=[];
 const note=newStudyNote(crypto.randomUUID(),'p');note.board.pages[0].elements=[{id:'a',type:'freedraw',x:0,y:0,width:20,height:20,points:[[0,0],[20,20]]}];
 row={id:55,...noteMaterialRow(owner,'Private title must not be transmitted',note,revision)};
 body={consent:'selected-ink-to-gemini',revision,pageId:'p',elementIds:['a'],fingerprint:await recognitionFingerprint(note.board.pages[0],['a']),image:png};
 mocks.auth.mockResolvedValue({user:{id:owner},supabase:db([row,row])});mocks.limit.mockReturnValue({ok:true});mocks.llm.mockResolvedValue({text:JSON.stringify({expressions:[{original:'はし',choices:[{text:'箸',meaning:'젓가락'}]}]})});
});
describe('private selected handwriting API',()=>{
 it('requires login, explicit recognition action, and private ownership before contacting Gemini',async()=>{
  mocks.auth.mockResolvedValueOnce({error:'로그인 필요',status:401});expect((await POST(req(),context)).status).toBe(401);
  expect((await POST(req({...body,consent:undefined}),context)).status).toBe(400);
  mocks.auth.mockResolvedValueOnce({user:{id:owner},supabase:db([{...row,owner_id:'someone-else'}])});expect((await POST(req(),context)).status).toBe(404);
  expect(mocks.llm).not.toHaveBeenCalled();
 });
 it('checks current revision, exact selected contents, and a real visible page before sending',async()=>{
  for(const patch of [{revision:'old'},{fingerprint:'wrong'},{elementIds:['missing']},{pageId:'other'}]){
   mocks.auth.mockResolvedValueOnce({user:{id:owner},supabase:db([row])});
   expect([400,409]).toContain((await POST(req({...body,...patch}),context)).status);
  }
  expect(mocks.llm).not.toHaveBeenCalled();
 });
 it('bounds request bytes, png dimensions, and rate before an external request',async()=>{
  const big=Buffer.from(png.split(',')[1],'base64');big.writeUInt32BE(9999,16);
  for(const image of ['https://example.com/private.png','data:image/jpeg;base64,AAAA','data:image/png;base64,'+big.toString('base64')]){
   mocks.auth.mockResolvedValueOnce({user:{id:owner},supabase:db([row])});expect((await POST(req({...body,image}),context)).status).toBe(400);
  }
  expect((await POST(req({...body,image:'x'.repeat(2100000)}),context)).status).toBe(413);
  mocks.auth.mockResolvedValueOnce({user:{id:owner},supabase:db([row])});mocks.limit.mockReturnValue({ok:false});expect((await POST(req(),context)).status).toBe(429);
  expect(mocks.llm).not.toHaveBeenCalled();
 });
 it('sends just the PNG and language instruction to Gemini, forbids other-provider fallback and performs no write',async()=>{
  const response=await POST(req(),context);expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');
  const [tier,input,options]=mocks.llm.mock.calls[0];expect(tier).toBe('standard');expect(options).toMatchObject({groq:false,route:'note-recognize',retry:{max:0}});
  expect(input[0].parts[1]).toEqual({inlineData:{mimeType:'image/png',data:png.split(',')[1]}});
  expect(JSON.stringify(input)).not.toContain(row.title);expect(calls).toHaveLength(2);for(const filters of calls)expect(filters).toContainEqual(['owner_id',owner]);
  expect((await response.json()).expressions[0]).toMatchObject({original:'はし',uncertain:true});
 });
 it('rejects results when another device changes or removes the note during recognition',async()=>{
  for(const next of [null,{...row,processed_json:{...row.processed_json,metadata:{...row.processed_json.metadata,studyNote:{...row.processed_json.metadata.studyNote,revision:crypto.randomUUID()}}}}]){
   mocks.auth.mockResolvedValueOnce({user:{id:owner},supabase:db([row,next])});expect([404,409]).toContain((await POST(req(),context)).status);
  }
 });
 it('sanitizes provider failure/malformed JSON and returns an empty result without inventing words',async()=>{
  mocks.llm.mockRejectedValueOnce(new Error('provider private detail'));const response=await POST(req(),context);expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('private detail');
  mocks.auth.mockResolvedValueOnce({user:{id:owner},supabase:db([row,row])});mocks.llm.mockResolvedValueOnce({text:'{"expressions":[]}'});expect((await(await POST(req(),context)).json()).expressions).toEqual([]);
 });
});
