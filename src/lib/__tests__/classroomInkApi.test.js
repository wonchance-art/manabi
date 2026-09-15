import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),llm:vi.fn(),limit:vi.fn()}));
vi.mock('@/lib/supabaseServer',()=>({requireUser:mocks.auth}));
vi.mock('@/lib/server/llm',()=>({callLLM:mocks.llm}));
vi.mock('@/lib/server/rateLimit',()=>({rateLimit:mocks.limit}));
import {POST} from '../../app/api/classroom/recognize/route';
const owner='11111111-1111-4111-8111-111111111111';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const root={id:1,owner_id:owner,processed_json:{metadata:{team:{key:'team-a',root:true,lang:'Japanese',name:'private class',pwHash:'private hash'}}}};
const body={rootId:'1',teamKey:'team-a',consent:'selected-ink-to-gemini',fingerprint:'a'.repeat(64),image:png};
const request=(patch={})=>new Request('http://localhost/api/classroom/recognize',{method:'POST',body:JSON.stringify({...body,...patch})});
let calls;
function db(rows=[root,root]){return {from(table){const filters=[];calls.push({table,filters});const q={select(){return q;},eq(...args){filters.push(args);return q;},maybeSingle(){return Promise.resolve({data:rows.shift()});}};return q;}};}
beforeEach(()=>{vi.clearAllMocks();calls=[];mocks.auth.mockResolvedValue({user:{id:owner},supabase:db()});mocks.limit.mockReturnValue({ok:true});mocks.llm.mockResolvedValue({text:JSON.stringify({expressions:[{original:'はし',reading:'はし',choices:[{text:'箸',meaning:'젓가락'}]}]})});});
describe('teacher selected handwriting API',()=>{
  it('rejects anonymous, student, another team, and a global admin without ownership before any image leaves',async()=>{
    mocks.auth.mockResolvedValueOnce({error:'로그인 필요',status:401});expect((await POST(request())).status).toBe(401);
    for(const record of [null,{...root,owner_id:'other'},{...root,processed_json:{metadata:{team:{key:'team-a',root:false}}}}]){
      mocks.auth.mockResolvedValueOnce({user:{id:owner,role:'admin'},supabase:db([record])});expect((await POST(request())).status).toBe(403);
    }
    mocks.auth.mockResolvedValueOnce({user:{id:owner},supabase:db([root])});expect((await POST(request({teamKey:'team-b'}))).status).toBe(403);
    expect(mocks.llm).not.toHaveBeenCalled();
  });
  it('requires consent and bounded local PNG/fingerprint; never fetches external image URLs',async()=>{
    for(const patch of [{consent:null},{rootId:'bad'},{fingerprint:'old'},{image:'https://example.com/private.png'}]){
      mocks.auth.mockResolvedValueOnce({user:{id:owner},supabase:db()});expect((await POST(request(patch))).status).toBe(400);
    }
    expect((await POST(request({image:'x'.repeat(2100000)}))).status).toBe(413);
    mocks.limit.mockReturnValue({ok:false});expect((await POST(request())).status).toBe(429);expect(mocks.llm).not.toHaveBeenCalled();
  });
  it('uses team language, sends only image+instruction, forbids other-provider fallback, performs no writes',async()=>{
    const response=await POST(request({language:'Chinese',privateContent:'must not transmit'}));expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const [,messages,options]=mocks.llm.mock.calls[0];expect(messages[0].parts[0].text).toContain('Japanese');
    expect(JSON.stringify(messages)).not.toMatch(/private class|private hash|must not transmit|team-a/);
    expect(messages[0].parts[1]).toEqual({inlineData:{mimeType:'image/png',data:png.split(',')[1]}});
    expect(options).toMatchObject({groq:false,route:'class-ink-recognize',retry:{max:0}});
    expect(calls).toHaveLength(2);for(const call of calls)expect(call.filters).toContainEqual(['owner_id',owner]);
    expect(await response.json()).toMatchObject({fingerprint:body.fingerprint,source:'gemini',expressions:[{original:'はし',uncertain:true}]});
  });
  it('rechecks ownership and language after the model finishes',async()=>{
    mocks.auth.mockResolvedValueOnce({user:{id:owner},supabase:db([root,null])});expect((await POST(request())).status).toBe(403);
    mocks.auth.mockResolvedValueOnce({user:{id:owner},supabase:db([root,{...root,processed_json:{metadata:{team:{key:'team-a',root:true,lang:'Chinese'}}}}])});expect((await POST(request())).status).toBe(409);
  });
  it('sanitizes provider failures, malformed output, and empty recognition',async()=>{
    mocks.llm.mockRejectedValueOnce(new Error('private provider detail'));const response=await POST(request());expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('private provider');
    mocks.auth.mockResolvedValueOnce({user:{id:owner},supabase:db()});mocks.llm.mockResolvedValueOnce({text:'{"expressions":[]}'});expect((await(await POST(request())).json()).expressions).toEqual([]);
  });
});
