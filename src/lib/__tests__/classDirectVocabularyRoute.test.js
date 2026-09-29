import {beforeEach,describe,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({auth:vi.fn(),access:vi.fn(),rpc:vi.fn(),from:vi.fn(),filters:[]}));
vi.mock('@/lib/server/auth',()=>({requireUser:m.auth}));
vi.mock('@/app/api/class/[team]/route',()=>({authorizeTeamRequest:m.access}));
import {POST,GET} from '@/app/api/class/[team]/vocabulary/route';
import {revisionOf} from '../server/classIndex';
let row,body,context;
const owner='00000000-0000-4000-8000-000000000088';
const request=(data=body)=>POST(new Request('https://manabi.invalid/api/class/team/vocabulary',{method:'POST',body:JSON.stringify(data)}),{params:Promise.resolve({team:'team'})});
beforeEach(()=>{
 vi.clearAllMocks();m.filters=[];
 row={id:12,owner_id:'teacher',raw_text:'学习',processed_json:{sequence:['id_0_one'],dictionary:{id_0_one:{text:'学习',meaning:'공부하다',furigana:'xué xí',pos:'동사'}},metadata:{language:'Chinese',book:{key:'book',order:1}}}};
 context={id:owner,kind:'class',locator:{team:'team',materialId:'12'},quote:'学习'};
 body={word:{word_text:'learning',meaning:'injected',language:'Chinese'},source:{kind:'class',team:'team',materialId:'12',tokenId:'id_0_one',revision:revisionOf(row)},grade:3};
 m.auth.mockResolvedValue({user:{id:owner}});
 m.access.mockResolvedValue({root:{id:1,owner_id:'teacher'},team:{key:'team',bookKey:'book',pwGen:2},admin:{rpc:m.rpc,from:m.from}});
 m.rpc.mockResolvedValue({data:{created:true,vocabularyId:owner}});
 m.from.mockImplementation(table=>{const q={select:()=>q,eq:(k,v)=>{m.filters.push([table,k,v]);return q;},maybeSingle:async()=>({data:table==='reading_materials'?row:table==='vocabulary_contexts'?context:{id:owner,meaning:'개인 뜻'}})};return q;});
});
describe('class vocabulary API',()=>{
 it('requires login and current class capability before any write',async()=>{
  m.auth.mockResolvedValueOnce({error:'login',status:401});expect((await request()).status).toBe(401);expect(m.access).not.toHaveBeenCalled();
  m.access.mockResolvedValueOnce({error:Response.json({error:'revoked'},{status:401})});expect((await request()).status).toBe(401);expect(m.rpc).not.toHaveBeenCalled();
 });
 it('derives word, initial grade and scope from authorized current material and verified identity',async()=>{
  const response=await request({...body,ownerId:'victim',root:99});expect(response.status).toBe(200);
  const [name,args]=m.rpc.mock.calls[0];expect(name).toBe('classroom_save_vocabulary');expect(args).toMatchObject({p_owner:owner,p_root:1,p_generation:2,p_material:12,p_word:{word_text:'学习',meaning:'공부하다',furigana:'xué xí'}});expect(args.p_initial.interval).toBeGreaterThan(0);
  expect(args.p_source).toEqual({kind:'class',quote:'学习',translation:'공부하다',locator:{tokenId:'id_0_one',surface:'学习',team:'team',materialId:'12'}});
 });
 it('rejects stale revision, another teacher, outside team, malformed grade and unknown source',async()=>{
  expect((await request({...body,source:{...body.source,revision:'stale'}})).status).toBe(409);
  expect((await request({...body,grade:99})).status).toBe(400);
  row.owner_id='another';expect((await request()).status).toBe(404);
  row.owner_id='teacher';row.processed_json.metadata.book.key='outside';expect((await request()).status).toBe(404);expect(m.rpc).not.toHaveBeenCalled();
 });
 it('returns a meaning conflict scoped to the authenticated student, never overwrites it',async()=>{
  m.rpc.mockResolvedValue({error:{message:'vocabulary_meaning_conflict',details:owner}});
  const result=await request();expect(result.status).toBe(409);expect(await result.json()).toMatchObject({code:'meaning_conflict',existing:{meaning:'개인 뜻'},incomingMeaning:'공부하다'});
  expect(m.filters).toContainEqual(['user_vocabulary','user_id',owner]);
 });
 it('resolves saved contexts only for the same student, class and original',async()=>{
  const get=()=>GET(new Request(`https://manabi.invalid/api/class/team/vocabulary?contextId=${owner}&materialId=12`),{params:Promise.resolve({team:'team'})});
  expect((await get()).status).toBe(200);expect(m.filters).toContainEqual(['vocabulary_contexts','user_id',owner]);
  context.locator.team='other';expect((await get()).status).toBe(404);
 });
});
