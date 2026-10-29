import { beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({signedIn:true,filters:[],chapters:null}));
const db=vi.hoisted(()=>({from:vi.fn()}));
vi.mock('@/lib/supabaseServer',()=>({requireUserForRead:async()=>state.signedIn?{user:{id:'current-owner'},supabase:db}:{error:'login required',status:401}}));
vi.mock('@/lib/server/learningContext',()=>({
 reply:(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}}),
 errorReply:error=>Response.json({error:error.message},{status:error.status||500}),
 checkDb:error=>{if(error)throw Object.assign(new Error('unavailable'),{status:503});},
 fail:(status,message)=>{throw Object.assign(new Error(message),{status});},
}));
import { GET } from '@/app/api/learning/book-review/route';
beforeEach(()=>{
 state.signedIn=true;state.filters=[];state.chapters=null;db.from.mockClear();
 const chain={select:()=>chain,eq:(...args)=>{state.filters.push(args);return chain;},in:(field,values)=>{state.chapters={field,values};return chain;},order:()=>chain,range:async()=>({data:[],error:null})};
 db.from.mockReturnValue(chain);
});
const request=query=>new Request('https://local.invalid/api/learning/book-review?scope=1&'+query);
describe('N3 saved expressions remain owned and book scoped through the final lesson',()=>{
 it('filters both context and vocabulary ownership, N3 identity and exact late-unit slugs',async()=>{
  expect((await GET(request('book=japanese-n3&from=43&to=48'))).status).toBe(200);
  expect(state.filters).toEqual([['user_id','current-owner'],['user_vocabulary.user_id','current-owner'],['kind','textbook'],['locator->>bookId','japanese-n3']]);
  expect(state.chapters).toEqual({field:'chapter_slug',values:['n3-book-u43','n3-book-u44','n3-book-u45','n3-book-u46','n3-book-u47','n3-book-u48']});
 });
 it('keeps the full N3 scope including older chapterless records, and N5 default identity',async()=>{
  expect((await GET(request('book=japanese-n3&from=1&to=48'))).status).toBe(200);expect(state.chapters).toBeNull();
  state.filters=[];
  expect((await GET(request(''))).status).toBe(200);expect(state.filters).toContainEqual(['locator->>bookId','japanese-n5']);
 });
 it.each(['book=japanese-n3&from=43&to=49','book=japanese-n4&from=43&to=48','book=japanese-n3&book=japanese-n4','book=japanese-n2'])('fails closed for invalid scope %s',async query=>{
  expect((await GET(request(query))).status).toBe(400);expect(db.from).not.toHaveBeenCalled();
 });
 it('rejects anonymous review without reaching a learner-data table',async()=>{
  state.signedIn=false;expect((await GET(request('book=japanese-n3'))).status).toBe(401);expect(db.from).not.toHaveBeenCalled();
 });
});
