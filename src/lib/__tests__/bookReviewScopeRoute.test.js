import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../supabaseServer',()=>({requireUserForRead:vi.fn()}));
import { requireUserForRead } from '../supabaseServer';
import { GET } from '../../app/api/learning/book-review/route';
let chain;
beforeEach(()=>{
 chain={select:vi.fn(),eq:vi.fn(),in:vi.fn(),order:vi.fn(),range:vi.fn()};
 for(const key of ['select','eq','in','order'])chain[key].mockReturnValue(chain);
 chain.range.mockResolvedValue({data:Array.from({length:201},(_,i)=>({id:`ctx${i}`,user_vocabulary:{id:Math.floor(i/2),user_id:'owner'}})),error:null});
 requireUserForRead.mockResolvedValue({user:{id:'owner'},supabase:{from:vi.fn(()=>chain)}});
});
describe('N5 vocabulary scope read API',()=>{
 it('keeps both ownership constraints and all editions, with bounded pagination',async()=>{
  const response=await GET(new Request('https://local/api/learning/book-review?scope=1&offset=200'));
  expect(response.status).toBe(200);
  const body=await response.json();expect(body.wordIds).toHaveLength(100);expect(body.nextOffset).toBe(400);
  expect(chain.eq.mock.calls).toEqual([['user_id','owner'],['user_vocabulary.user_id','owner'],['kind','textbook'],['locator->>bookId','japanese-n5']]);
  expect(chain.range).toHaveBeenCalledWith(200,400);
  expect(chain.in).not.toHaveBeenCalled();
  expect(response.headers.get('Cache-Control')).toContain('private, no-store');
 });
 it('a lesson range (REV-SCOPE-R1A) narrows to those chapters and keeps both ownership constraints',async()=>{
  expect((await GET(new Request('https://local/api/learning/book-review?scope=1&from=5&to=7'))).status).toBe(200);
  expect(chain.eq.mock.calls).toEqual([['user_id','owner'],['user_vocabulary.user_id','owner'],['kind','textbook'],['locator->>bookId','japanese-n5']]);
  expect(chain.in).toHaveBeenCalledWith('chapter_slug',['n5-book-u05','n5-book-u06','n5-book-u07']);
 });
 it('the whole-book range is the old unfiltered scope (contexts without a chapter stay in)',async()=>{
  expect((await GET(new Request('https://local/api/learning/book-review?scope=1&from=1&to=42'))).status).toBe(200);
  expect(chain.in).not.toHaveBeenCalled();
 });
 it.each(['from=5','to=5','from=0&to=3','from=7&to=5','from=1&to=43','from=05&to=6','from=a&to=b'])('rejects an invalid lesson range %s before the database',async query=>{
  expect((await GET(new Request(`https://local/api/learning/book-review?scope=1&${query}`))).status).toBe(400);
  expect(chain.select).not.toHaveBeenCalled();
 });
 it('rejects anonymous requests before any query',async()=>{
  requireUserForRead.mockResolvedValue({error:'login required',status:401});
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
