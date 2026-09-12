import {it,expect,vi,afterEach} from 'vitest';
const {auth}=vi.hoisted(()=>({auth:vi.fn()}));
vi.mock('@/lib/server/auth',()=>({requireUser:auth}));
import {GET} from '../route';
afterEach(()=>vi.resetAllMocks());
it('requires verified authentication',async()=>{auth.mockResolvedValue({error:'로그인',status:401});expect((await GET(new Request('http://test/api/classroom/kana?q=はし'))).status).toBe(401);});
it('returns bounded ambiguous candidates with private cache policy',async()=>{auth.mockResolvedValue({user:{id:'teacher'}});const result=await GET(new Request('http://test/api/classroom/kana?q=はし'));expect(result.headers.get('cache-control')).toBe('private, no-store');expect((await result.json()).candidates.map(v=>v.text)).toEqual(expect.arrayContaining(['橋','箸']));});
