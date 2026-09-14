import {describe,it,expect,vi,beforeEach} from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),limit:vi.fn(),llm:vi.fn(),result:vi.fn(),db:vi.fn()}));
vi.mock('@/lib/server/auth',()=>({requireUser:mocks.auth}));
vi.mock('@/lib/server/rateLimit',()=>({rateLimit:mocks.limit}));
vi.mock('@/lib/server/llm',()=>({callLLM:mocks.llm}));
vi.mock('@supabase/supabase-js',()=>({createClient:mocks.db}));
import {POST} from '../route';
const request=body=>new Request('http://localhost/api/classroom/lookup',{method:'POST',headers:{authorization:'Bearer fixture'},body:JSON.stringify(body)});
beforeEach(()=>{
 vi.clearAllMocks();mocks.auth.mockResolvedValue({user:{id:'teacher'}});mocks.limit.mockReturnValue({ok:true});
 const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:mocks.result};mocks.db.mockReturnValue({from:()=>query});
 mocks.result.mockResolvedValue({data:null,error:null});mocks.llm.mockResolvedValue({text:JSON.stringify({reading:'xué xí',senses:[{meaning:'배우다',pos:'동사'}]})});
});
describe('read-only classroom lookup',()=>{
 it('requires a valid session and rejects oversized or unsupported input before lookup',async()=>{
  mocks.auth.mockResolvedValueOnce({error:'login',status:401});expect((await POST(request({}))).status).toBe(401);expect(mocks.db).not.toHaveBeenCalled();
  for(const body of [{language:'unknown',text:'x'},{language:'Chinese',text:'x'.repeat(501)}])expect((await POST(request(body))).status).toBe(400);
 });
 it('returns existing meanings with honest provenance, no LLM or writes',async()=>{
  mocks.result.mockResolvedValue({data:{reading:'xué xí',meanings:[{meaning:'공부하다'}],source:'gemini'}});
  const response=await POST(request({language:'Chinese',text:'学习'}));
  expect(response.headers.get('cache-control')).toBe('private, no-store');expect(await response.json()).toMatchObject({source:'gemini',senses:[{meaning:'공부하다'}]});expect(mocks.llm).not.toHaveBeenCalled();
 });
 it('handles phrases as one query and returns AI fallback without inserting dictionary rows',async()=>{
  const response=await POST(request({language:'Chinese',text:'学以致用'}));expect(response.status).toBe(200);expect(await response.json()).toMatchObject({text:'学以致用',source:'ai'});
  expect(mocks.llm.mock.calls[0][1]).toContain('学以致用');expect(mocks.llm.mock.calls[0][2]).toMatchObject({timeoutMs:12000,retry:0});
 });
 it('supports French and preserves a manual path on unavailable or malformed results',async()=>{
  mocks.llm.mockResolvedValueOnce({text:'not json'});expect((await POST(request({language:'French',text:'prendre soin'}))).status).toBe(503);
  mocks.llm.mockRejectedValueOnce(Error('provider'));expect((await POST(request({language:'Japanese',text:'学校'}))).status).toBe(503);
 });
 it('limits requests before calling data providers',async()=>{mocks.limit.mockReturnValue({ok:false});expect((await POST(request({language:'Chinese',text:'学习'}))).status).toBe(429);expect(mocks.db).not.toHaveBeenCalled();});
});
