import {beforeEach,describe,expect,it,vi} from 'vitest';
const {authenticate}=vi.hoisted(()=>({authenticate:vi.fn()}));
vi.mock('@/lib/supabaseServer',()=>({requireUser:authenticate}));
import {GET} from '../vocabulary/route';
const userId='10000000-0000-4000-8000-000000000001',contextId='20000000-0000-4000-8000-000000000001';
let db;
beforeEach(()=>{
  const state={context:{id:contextId,user_id:userId,kind:'reading',material_id:211,quote:'synthetic quote',locator:{surface:'synthetic'}},material:{id:211,owner_id:userId,visibility:'private'},error:null};
  const calls=[];
  const supabase={from:vi.fn(table=>{
    const filters=[],call={table,filters};calls.push(call);
    const q={select:()=>q,eq:(key,value)=>{filters.push([key,value]);return q;},maybeSingle:async()=>{
      const row=table==='vocabulary_contexts'?state.context:state.material;
      return {data:row&&filters.every(([key,value])=>String(row[key])===String(value))?row:null,error:state.error};
    }};return q;
  })};
  db={state,supabase,calls};authenticate.mockResolvedValue({user:{id:userId},supabase});
});
const read=(query=`contextId=${contextId}&materialId=211`)=>GET(new Request(`https://fixture.test/api/learning/vocabulary?${query}`));
describe('a source-context link checks ownership and current source access',()=>{
  it('requires authentication before reading anything',async()=>{
    authenticate.mockResolvedValue({error:'로그인 필요',status:401});expect((await read()).status).toBe(401);expect(db.calls).toHaveLength(0);
  });
  it('returns only the context after both access checks',async()=>{
    const response=await read();expect(response.status).toBe(200);expect((await response.json()).context.quote).toBe('synthetic quote');
    expect(db.calls[0].filters).toContainEqual(['user_id',userId]);expect(db.calls[1].table).toBe('reading_materials');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('does not disclose another account context or a mismatched material',async()=>{
    db.state.context.user_id='another';expect((await read()).status).toBe(404);expect(db.calls).toHaveLength(1);
    db.state.context.user_id=userId;expect((await read(`contextId=${contextId}&materialId=212`)).status).toBe(404);
  });
  it('rejects revoked private sources even when a legacy RLS policy returns them',async()=>{
    db.state.material.owner_id='another';const response=await read();expect(response.status).toBe(404);expect(JSON.stringify(await response.json())).not.toContain('synthetic quote');
    db.state.material.visibility='public';expect((await read()).status).toBe(200);
  });
  it('distinguishes invalid input, missing source, and database failure',async()=>{
    expect((await read('contextId=bad&materialId=211')).status).toBe(400);expect(db.calls).toHaveLength(0);
    db.state.material=null;expect((await read()).status).toBe(404);
    db.state.error={message:'internal details'};const response=await read();expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('internal details');
  });
});
