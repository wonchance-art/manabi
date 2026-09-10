import {beforeEach,describe,it,expect,vi} from 'vitest';
const mock=vi.hoisted(()=>({requireUser:vi.fn(),authorize:vi.fn(),rpc:vi.fn(),from:vi.fn()}));
vi.mock('@/lib/server/auth',()=>({requireUser:mock.requireUser}));
vi.mock('@/app/api/class/[team]/route',()=>({authorizeTeamRequest:mock.authorize}));
import {POST} from '@/app/api/class/[team]/copy/route';
import {sharedSnapshot} from '../classCopyModel';
const material=()=>({id:30,owner_id:'student',title:'교재',raw_text:'图书馆',processed_json:{status:'completed',sequence:['id_0_one'],dictionary:{id_0_one:{text:'图书馆',meaning:'도서관',pos:'명사'}},metadata:{language:'Chinese',source_ref:'12'}}});
let state;
const request=body=>POST(new Request('https://manabi.invalid/api/class/team/copy',{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({team:'team'})});
beforeEach(()=>{
 vi.resetAllMocks();const copy=material();state={copy,source:sharedSnapshot(copy),base:sharedSnapshot(copy),sourceRevision:'rev1'};
 mock.requireUser.mockResolvedValue({user:{id:'student'}});
 mock.authorize.mockResolvedValue({root:{id:1},team:{pwGen:2},admin:{rpc:mock.rpc,from:mock.from}});
 mock.rpc.mockImplementation(async name=>({data:name==='classroom_update_copy'?state.copy:state,error:null}));
 const q={select:()=>q,eq:()=>q,order:()=>q,range:async()=>({data:[],error:null})};mock.from.mockReturnValue(q);
});
describe('수업 사본 API 권한·갱신 계약',()=>{
 it('requires both account and current class capability',async()=>{
  mock.requireUser.mockResolvedValueOnce({error:'login',status:401});expect((await request({sourceId:12,action:'open'})).status).toBe(401);expect(mock.authorize).not.toHaveBeenCalled();
  mock.authorize.mockResolvedValueOnce({error:Response.json({error:'expired'},{status:401})});expect((await request({sourceId:12,action:'open'})).status).toBe(401);expect(mock.rpc).not.toHaveBeenCalled();
 });
 it('derives owner, root and generation from verified credentials, ignoring body overrides',async()=>{
  const response=await request({sourceId:12,action:'open',ownerId:'victim',rootId:999,generation:0});expect(response.status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith('classroom_copy_state',{p_owner:'student',p_root:1,p_generation:2,p_source:'12',p_create:true,p_preferred:null});
 });
 it('never treats database failure as missing copy',async()=>{
  mock.rpc.mockResolvedValue({data:null,error:{code:'XX000'}});expect((await request({sourceId:12,action:'open'})).status).toBe(500);expect(mock.rpc).toHaveBeenCalledTimes(1);expect(mock.from).not.toHaveBeenCalled();
 });
 it('returns explicit legacy duplicate choices without overwriting rows',async()=>{
  mock.rpc.mockResolvedValue({data:{state:'choose',candidates:[{id:30},{id:31}]}});const r=await request({sourceId:12,action:'open'});expect((await r.json()).state).toBe('choose');expect(mock.rpc).toHaveBeenCalledTimes(1);
 });
 it('fails closed if server returns a different owner',async()=>{
  state.copy.owner_id='victim';expect((await request({sourceId:12,action:'inspect'})).status).toBe(403);expect(mock.from).not.toHaveBeenCalled();
 });
 it('blocks updates if correction history cannot be read',async()=>{
  const q={select:()=>q,eq:()=>q,order:()=>q,range:async()=>({error:{code:'offline'}})};mock.from.mockReturnValue(q);expect((await request({sourceId:12,action:'update'})).status).toBe(500);expect(mock.rpc).toHaveBeenCalledTimes(1);
 });
 it('requires the reviewed source AND personal copy revision',async()=>{
  state.source.processed_json.dictionary.id_0_one.meaning='새 뜻';
  const inspected=await (await request({sourceId:12,action:'inspect'})).json();expect(inspected.state).toBe('update');mock.rpc.mockClear();
  const stale=await request({sourceId:12,action:'update',copyRevision:'stale',sourceRevision:inspected.sourceRevision});expect(stale.status).toBe(409);expect(mock.rpc).toHaveBeenCalledTimes(1);
 });
 it('computes updates on the server and never accepts arbitrary client material',async()=>{
  state.source.processed_json.dictionary.id_0_one.meaning='새 뜻';state.copy.processed_json.dictionary.id_0_one.meaning='내가 적은 뜻';
  const inspected=await (await request({sourceId:12,action:'inspect'})).json();mock.rpc.mockClear();
  const response=await request({sourceId:12,action:'update',copyRevision:inspected.copyRevision,sourceRevision:inspected.sourceRevision,material:{raw_text:'injected'}});expect(response.status).toBe(200);
  const args=mock.rpc.mock.calls.find(([name])=>name==='classroom_update_copy')[1];expect(args.p_next.raw_text).toBe('图书馆');expect(args.p_next.processed_json.dictionary.id_0_one.meaning).toBe('내가 적은 뜻');expect(args.p_expected).toEqual(state.copy);
 });
 it('rejects malformed actions and identifiers before any mutation',async()=>{
  for(const body of [{sourceId:'../x',action:'open'},{sourceId:12,action:'delete'},{sourceId:12,action:'open',preferred:'0'}])expect((await request(body)).status).toBe(400);
  expect(mock.rpc).not.toHaveBeenCalled();
 });
});
