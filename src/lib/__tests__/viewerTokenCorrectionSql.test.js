import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';

const owner='00000000-0000-4000-8000-000000000071',other='00000000-0000-4000-8000-000000000072';
const first={text:'图书馆',meaning:'도서관',furigana:'tú shū guǎn',pos:'명사'},second={text:'学生',meaning:'학생',pos:'명사'};
const original={status:'completed',sequence:['one','two'],dictionary:{one:first,two:second},metadata:{source:'unchanged',language:'Chinese'}};
let db;
const state=async()=>(await db.query('select * from reading_materials order by id')).rows;
const save=async(token,before,patch,raw='图书馆 学生',id=1)=>(await db.query('select public.viewer_correct_token($1,$2,$3,$4,$5) result',[id,token,before,patch,raw])).rows[0].result;
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
    CREATE TABLE reading_materials(id bigint primary key,owner_id uuid,raw_text text,title text,visibility text,processed_json jsonb);
    ALTER TABLE reading_materials ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own ON reading_materials TO authenticated USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
    GRANT SELECT,UPDATE ON reading_materials TO authenticated;
    CREATE TABLE update_count(n int);INSERT INTO update_count VALUES(0);GRANT SELECT,UPDATE ON update_count TO authenticated;
    CREATE FUNCTION count_update() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN UPDATE update_count SET n=n+1;RETURN NEW;END;$$;
    CREATE TRIGGER count_update AFTER UPDATE ON reading_materials FOR EACH ROW EXECUTE FUNCTION count_update();
    CREATE TABLE personal_vocabulary(word text,meaning text,srs jsonb);INSERT INTO personal_vocabulary VALUES('图书馆','개인 뜻','{"interval":9}');`);
  await db.exec(fs.readFileSync('supabase/migrations/20260924114728_viewer_token_correction_atomic.sql','utf8'));
},20000);
beforeEach(async()=>{
  await db.exec('reset role;delete from reading_materials;update update_count set n=0');
  await db.query('insert into reading_materials values(1,$1,$2,$3,$4,$5),(2,$1,$2,$3,$4,$5)',[owner,'图书馆 学生','원본 제목','private',original]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.exec('set role authenticated');
});
afterAll(async()=>{await db?.close();});
describe('atomic token patch under disposable PostgreSQL RLS',()=>{
  it('preserves edits from two stale client snapshots to different tokens',async()=>{
    const before=await state();
    // PGlite serializes statements; these are independent stale client requests,
    // not a claim to measure two hosted PostgreSQL connection lock timings.
    await Promise.all([save('one',first,{meaning:'자료실'}),save('two',second,{meaning:'학습자'})]);
    const expected=structuredClone(before);expected[0].processed_json.dictionary.one.meaning='자료실';expected[0].processed_json.dictionary.two.meaning='학습자';
    expect(await state()).toEqual(expected);
    await db.exec('reset role');expect((await db.query('select * from personal_vocabulary')).rows).toEqual([{word:'图书馆',meaning:'개인 뜻',srs:{interval:9}}]);
  });
  it('requires confirmation for the same token and preserves the earlier save',async()=>{
    await save('one',first,{meaning:'자료실'});const saved=await state();
    const conflict=await save('one',first,{meaning:'서고'});
    expect(conflict).toEqual({conflict:'token',current_token:{...first,meaning:'자료실'}});expect(await state()).toEqual(saved);
    expect((await save('one',conflict.current_token,{meaning:'서고'})).material.processed_json.dictionary.one.meaning).toBe('서고');
  });
  it('reconciles a lost response without a second write and rejects an intervening change',async()=>{
    await save('one',first,{meaning:'자료실'});
    expect((await save('one',first,{meaning:'자료실'})).applied).toBe(false);
    expect((await db.query('select n from update_count')).rows[0].n).toBe(1);
    await save('one',{...first,meaning:'자료실'},{meaning:'서고'});
    expect((await save('one',first,{meaning:'자료실'})).conflict).toBe('token');
  });
  it('does not disclose another owner’s current token, missing rows, or signed-out data',async()=>{
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
    await expect(save('one',first,{meaning:'침범'})).rejects.toMatchObject({code:'42501'});
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
    await expect(save('one',first,{meaning:'침범'},'图书馆 学生',99)).rejects.toMatchObject({code:'42501'});
    await db.exec('reset role;set role anon');await expect(save('one',first,{meaning:'침범'})).rejects.toMatchObject({code:'42501'});
  });
  it.each([{text:'변경'},{meaning:null},{meaning:4},{meaning:'x'.repeat(3001)},{},null])('rejects forbidden or invalid fields without altering the material',async patch=>{
    const before=await state();await expect(save('one',first,patch)).rejects.toMatchObject({code:'22023'});expect(await state()).toEqual(before);
  });
  it('rejects changed source, active analysis, token identity changes and missing tokens',async()=>{
    await expect(save('one',first,{meaning:'서고'},'다른 원문')).rejects.toThrow('VIEWER_TOKEN_SOURCE_CHANGED');
    await expect(save('missing',first,{meaning:'서고'})).rejects.toThrow('VIEWER_TOKEN_SOURCE_CHANGED');
    await expect(save('one',{...first,text:'学校'},{meaning:'서고'})).rejects.toThrow('VIEWER_TOKEN_SOURCE_CHANGED');
    await db.query("update reading_materials set processed_json=jsonb_set(processed_json,'{status}','\"analyzing\"') where id=1");
    await expect(save('one',first,{meaning:'서고'})).rejects.toThrow('VIEWER_TOKEN_BUSY');
  });
  it('does not bypass existing passage writes or RLS update permission',async()=>{
    await db.query("update reading_materials set processed_json=jsonb_set(processed_json,'{metadata}','{\"composer\":{\"passage\":{\"parentId\":9}}}') where id=1");
    await expect(save('one',first,{meaning:'서고'})).rejects.toThrow('VIEWER_TOKEN_PASSAGE');
    await db.exec('reset role;revoke update on reading_materials from authenticated;set role authenticated');
    try{await expect(save('one',first,{meaning:'서고'},'图书馆 学生',2)).rejects.toMatchObject({code:'42501'});}
    finally{await db.exec('reset role;grant update on reading_materials to authenticated');}
  });
});
