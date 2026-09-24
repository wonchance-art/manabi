import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const {getUser,callLLM,from}=vi.hoisted(()=>({getUser:vi.fn(),callLLM:vi.fn(),from:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser},from})}));
vi.mock('@/lib/server/llm',()=>({callLLM}));
import {POST} from '../route';
const token={meaningChoice:true,sentence:'今天我请客，我来当东道主。',word:'东道主',surface:'东道主',currentMeaning:'주최국',pos:'명사'};
const request=(patch={},auth=true)=>new Request('http://localhost/api/explain',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer test-only'}:{})},body:JSON.stringify({language:'Chinese',token,...patch})});
beforeEach(()=>{vi.clearAllMocks();getUser.mockResolvedValue({data:{user:{id:'qa-'+Math.random()}},error:null});vi.stubEnv('GEMINI_API_KEY','test-placeholder');callLLM.mockResolvedValue({text:JSON.stringify({word:token.word,meaning:'손님을 맞이하는 주인',uncertain:false,reason:'请客가 단서예요.'})});});
afterEach(()=>vi.unstubAllEnvs());
it('returns a proposal without dictionary, material, vocabulary or correction writes',async()=>{
 const response=await POST(request());expect(response.status).toBe(200);expect((await response.json()).candidate.meaning).toBe('손님을 맞이하는 주인');expect(from).not.toHaveBeenCalled();expect(callLLM).toHaveBeenCalledTimes(1);
 expect(callLLM.mock.calls[0][1]).toContain(token.sentence);expect(callLLM.mock.calls[0][1]).not.toContain(token.currentMeaning);
});
it('requires authenticated access before any provider request',async()=>{
 expect((await POST(request({},false))).status).toBe(401);getUser.mockResolvedValue({data:{user:null},error:{message:'expired'}});expect((await POST(request())).status).toBe(401);expect(callLLM).not.toHaveBeenCalled();
});
it('rejects missing surface or wrong language without calling the provider',async()=>{
 expect((await POST(request({token:{...token,surface:'汽车'}}))).status).toBe(400);expect((await POST(request({language:'Japanese'}))).status).toBe(400);expect(callLLM).not.toHaveBeenCalled();
});
it('provider failures and invalid candidates are recoverable 502 responses',async()=>{
 callLLM.mockRejectedValueOnce(Error('provider detail'));expect((await POST(request())).status).toBe(502);callLLM.mockResolvedValue({text:'{"word":"东道主","meaning":"host","uncertain":false,"reason":"설명"}'});expect((await POST(request())).status).toBe(502);expect(from).not.toHaveBeenCalled();
});
