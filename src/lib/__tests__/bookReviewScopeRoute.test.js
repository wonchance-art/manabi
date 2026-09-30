import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../supabaseServer',()=>({requireUser:vi.fn()}));
import { requireUser } from '../supabaseServer';
import { GET } from '../../app/api/learning/book-review/route';
let chain;
beforeEach(()=>{
 chain={select:vi.fn(),eq:vi.fn(),order:vi.fn(),range:vi.fn()};
 for(const key of ['select','eq','order'])chain[key].mockReturnValue(chain);
 chain.range.mockResolvedValue({data:Array.from({length:201},(_,i)=>({id:`ctx${i}`,user_vocabulary:{id:Math.floor(i/2),user_id:'owner'}})),error:null});
 requireUser.mockResolvedValue({user:{id:'owner'},supabase:{from:vi.fn(()=>chain)}});
});
describe('N5 vocabulary scope read API',()=>{
 it('keeps both ownership constraints and all editions, with bounded pagination',async()=>{
  const response=await GET(new Request('https://local/api/learning/book-review?scope=1&offset=200'));
  expect(response.status).toBe(200);
  const body=await response.json();expect(body.wordIds).toHaveLength(100);expect(body.nextOffset).toBe(400);
  expect(chain.eq.mock.calls).toEqual([['user_id','owner'],['user_vocabulary.user_id','owner'],['kind','textbook'],['locator->>bookId','japanese-n5']]);
  expect(chain.range).toHaveBeenCalledWith(200,400);
  expect(response.headers.get('Cache-Control')).toContain('private, no-store');
 });
 it('rejects anonymous requests before any query',async()=>{
  requireUser.mockResolvedValue({error:'login required',status:401});
  expect((await GET(new Request('https://local/api/learning/book-review?scope=1'))).status).toBe(401);
  expect(chain.select).not.toHaveBeenCalled();
 });
 it('does not report an empty scope when the database fails',async()=>{
  chain.range.mockResolvedValue({error:{message:'database offline'}});
  expect((await GET(new Request('https://local/api/learning/book-review?scope=1'))).status).toBe(503);
 });
 it('rejects invalid pagination before the database',async()=>{
  expect((await GET(new Request('https://local/api/learning/book-review?scope=1&offset=-1'))).status).toBe(400);
  expect(chain.select).not.toHaveBeenCalled();
 });
});
