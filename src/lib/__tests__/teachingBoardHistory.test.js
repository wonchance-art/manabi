import {it,expect,vi,beforeEach} from 'vitest';
import {boardHistoryRequest,boardHistoryPage,boardHistoryRange,boardHistoryPeriod,boardHistoryGroups} from '../teachingBoardHistory';
const {auth}=vi.hoisted(()=>({auth:vi.fn()}));vi.mock('@/lib/supabaseServer',()=>({requireUser:auth}));
import {GET} from '../../app/api/classroom/boards/route';
const owner='owner',root={id:1,owner_id:owner,processed_json:{metadata:{team:{key:'fixture',root:true,lang:'Chinese'}}}};
const rows=n=>Array.from({length:n},(_,i)=>({id:String(i),day:new Date(Date.UTC(2026,8,17-i)).toISOString().slice(0,10),manifest:{pages:[{}]},updated_at:'fixture'}));
function database(items,teacher=root){const calls=[];return {calls,from(table){const call={table,filters:[]};calls.push(call);let selected=items;const q={select(v){call.select=v;return q;},eq(k,v){call.filters.push([k,v]);return q;},not(){return q;},order(){return q;},gte(k,v){selected=selected.filter(r=>r[k]>=v);call.from=v;return q;},lte(k,v){selected=selected.filter(r=>r[k]<=v);call.to=v;return q;},lt(k,v){selected=selected.filter(r=>r[k]<v);call.before=v;return q;},limit(n){call.limit=n;selected=selected.slice(0,n);return q;},maybeSingle:async()=>({data:teacher}),then(resolve,reject){return Promise.resolve({data:selected}).then(resolve,reject);}};return q;}};}
const get=options=>GET(new Request(`http://localhost/api/classroom/boards?${new URLSearchParams({rootId:'1',...options})}`));
beforeEach(()=>auth.mockReset());
it.each([0,1,29,30,31,99,100,101,365])('paginates %i boards once each, without manifest or a false more flag',async count=>{
 const db=database(rows(count));auth.mockResolvedValue({user:{id:owner},supabase:db});let cursor='',seen=[];
 do{const response=await get(cursor?{cursor}:{});expect(response.status).toBe(200);const result=await response.json();expect(result.boards.length).toBeLessThanOrEqual(30);expect(result.truncated).toBe(!!result.nextCursor);expect(JSON.stringify(result)).not.toContain('manifest');seen.push(...result.boards.map(b=>b.day));cursor=result.nextCursor;}while(cursor);
 expect(seen).toEqual(rows(count).map(r=>r.day));for(const call of db.calls.filter(c=>c.table==='class_teaching_boards')){expect(call.limit).toBe(31);expect(call.filters).toEqual([['owner_id',owner],['root_id','1']]);}
});
it('filters inclusive date bounds and keyset is stable when a newer class arrives',async()=>{
 const original=rows(101),scope=boardHistoryRequest('1',{from:original.at(-1).day,to:original[0].day});const first=boardHistoryPage(original.slice(0,31),scope),next=boardHistoryRequest('1',{...scope,cursor:first.nextCursor});
 const db=database([{...original[0],day:'2026-09-18'},...original]);auth.mockResolvedValue({user:{id:owner},supabase:db});const result=await (await get({from:scope.from,to:scope.to,cursor:first.nextCursor})).json();expect(result.boards.map(r=>r.day)).toEqual(original.slice(30,60).map(r=>r.day));expect(db.calls[1]).toMatchObject({from:scope.from,to:scope.to,before:next.before});
});
it('checks date validity, paired range, leap day and reversals',()=>{
 expect(boardHistoryRange('2024-02-29','2024-03-01')).toEqual({from:'2024-02-29',to:'2024-03-01'});
 for(const pair of [['2026-02-29','2026-03-01'],['2026-09-01',''],['','2026-09-01'],['2026-09-02','2026-09-01'],['1899-01-01','2026-01-01'],['2026-01-01','2201-01-01']])expect(()=>boardHistoryRange(...pair)).toThrow();
});
it('uses the existing KST day source across year and leap-month boundaries',()=>{
 expect(boardHistoryPeriod('month',Date.parse('2025-12-31T15:00:00Z'))).toEqual({from:'2026-01-01',to:'2026-01-31'});
 expect(boardHistoryPeriod('previous',Date.parse('2026-01-01T00:00:00Z'))).toEqual({from:'2025-12-01',to:'2025-12-31'});
 expect(boardHistoryPeriod('previous',Date.parse('2024-03-01T00:00:00Z'))).toEqual({from:'2024-02-01',to:'2024-02-29'});
 expect(boardHistoryPeriod('all')).toEqual({from:'',to:''});
});
it('rejects malformed, oversized, cross-team and cross-range cursors',()=>{
 const scope=boardHistoryRequest('1'),{nextCursor}=boardHistoryPage(rows(31),scope);
 for(const opts of [{cursor:'bad'},{cursor:'x'.repeat(1001)},{cursor:nextCursor,from:'2026-08-01',to:'2026-09-17'}])expect(()=>boardHistoryRequest('1',opts)).toThrow();
 expect(()=>boardHistoryRequest('2',{cursor:nextCursor})).toThrow();
 const changed=JSON.parse(decodeURIComponent(nextCursor));for(const patch of [{v:2},{day:'2026-02-30'},{day:'1899-01-01'}])expect(()=>boardHistoryRequest('1',{cursor:encodeURIComponent(JSON.stringify({...changed,...patch}))})).toThrow();
});
it('does not treat cursor possession as authorization',async()=>{
 const {nextCursor}=boardHistoryPage(rows(31),boardHistoryRequest('1'));
 auth.mockResolvedValue({error:'로그인 필요',status:401});expect((await get({cursor:nextCursor})).status).toBe(401);
 for(const teacher of [null,{...root,owner_id:'other'},{...root,processed_json:{}}]){const db=database(rows(31),teacher);auth.mockResolvedValue({user:{id:owner},supabase:db});expect((await get({cursor:nextCursor})).status).toBe(403);expect(db.calls).toHaveLength(1);}
});
it('returns 400 for invalid range/cursor before executing list queries',async()=>{
 const db=database(rows(31));auth.mockResolvedValue({user:{id:owner},supabase:db});expect((await get({from:'2026-02-30',to:'2026-03-01'})).status).toBe(400);expect((await get({cursor:'malformed'})).status).toBe(400);expect(db.calls.some(c=>c.limit)).toBe(false);
});
it('groups sorted dates into months without losing entries',()=>{
 const data=rows(100),groups=boardHistoryGroups(data);expect(groups.flatMap(g=>g.rows)).toEqual(data);expect(groups.map(g=>g.month)).toEqual(['2026-09','2026-08','2026-07','2026-06']);
});
