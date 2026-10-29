import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../supabaseServer',()=>({requireUserForRead:vi.fn()}));
import { requireUserForRead } from '../supabaseServer';
import { GET } from '../../app/api/learning/material-review/route';

// 자료 범위 조회(REV-SCOPE-R1A §6-1 ①) — 읽기 전용 · 본인 행만 · source_material_id ∪ vocabulary_contexts.material_id.
let tables;
function table(rows){const chain={select:vi.fn(),eq:vi.fn(),in:vi.fn(),order:vi.fn(),range:vi.fn().mockResolvedValue({data:rows,error:null})};for(const key of ['select','eq','in','order'])chain[key].mockReturnValue(chain);return chain;}
beforeEach(()=>{
 tables={user_vocabulary:table([{id:'w1'},{id:'w2'}]),vocabulary_contexts:table([{id:'c1',user_vocabulary:{id:'w2',user_id:'owner'}},{id:'c2',user_vocabulary:{id:'w3',user_id:'owner'}}])};
 requireUserForRead.mockResolvedValue({user:{id:'owner'},supabase:{from:vi.fn(name=>tables[name])}});
});
describe('material review scope read API',()=>{
 it('unions saved-from and context sources of the owner only, deduplicated',async()=>{
  const response=await GET(new Request('https://local/api/learning/material-review?ids=91,92'));
  expect(response.status).toBe(200);
  expect((await response.json())).toEqual({wordIds:['w1','w2','w3'],nextOffset:null});
  expect(tables.user_vocabulary.eq.mock.calls).toEqual([['user_id','owner']]);
  expect(tables.user_vocabulary.in).toHaveBeenCalledWith('source_material_id',[91,92]);
  expect(tables.vocabulary_contexts.eq.mock.calls).toEqual([['user_id','owner'],['user_vocabulary.user_id','owner']]);
  expect(tables.vocabulary_contexts.in).toHaveBeenCalledWith('material_id',[91,92]);
  expect(response.headers.get('Cache-Control')).toContain('private, no-store');
 });
 it('pages when either source has more rows',async()=>{
  tables.vocabulary_contexts.range.mockResolvedValue({data:Array.from({length:501},(_,i)=>({id:`c${i}`,user_vocabulary:{id:`x${i}`,user_id:'owner'}})),error:null});
  const body=await (await GET(new Request('https://local/api/learning/material-review?ids=91&offset=500'))).json();
  expect(body.nextOffset).toBe(1000);
  expect(tables.vocabulary_contexts.range).toHaveBeenCalledWith(500,1000);
 });
 it('fails instead of reporting an empty scope when either read fails',async()=>{
  tables.vocabulary_contexts.range.mockResolvedValue({data:null,error:{message:'offline'}});
  expect((await GET(new Request('https://local/api/learning/material-review?ids=91'))).status).toBe(503);
 });
 it.each(['','ids=','ids=0','ids=91,91','ids=-1','ids=abc',`ids=${Array.from({length:21},(_,i)=>i+1).join(',')}`,'ids=91&offset=-1'])('rejects %s before the database',async query=>{
  expect((await GET(new Request(`https://local/api/learning/material-review?${query}`))).status).toBe(400);
  expect(tables.user_vocabulary.select).not.toHaveBeenCalled();
 });
 it('rejects anonymous requests before any query',async()=>{
  requireUserForRead.mockResolvedValue({error:'login required',status:401});
  expect((await GET(new Request('https://local/api/learning/material-review?ids=91'))).status).toBe(401);
  expect(tables.user_vocabulary.select).not.toHaveBeenCalled();
 });
});
