// 탭별 O · X 표(user_word_facets, LEVEL-FACET-AO-001) PGlite 검수. 일회용 DB만 사용하며 운영 연결/계정 상태를 읽지 않는다.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const { PGlite } = createRequire(import.meta.url)(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const a = '10000000-0000-0000-0000-000000000001', b = '10000000-0000-0000-0000-000000000002';
const rows = async (sql, p = []) => (await db.query(sql, p)).rows;
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
async function as(id) { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']); await db.exec(`set role ${id ? 'authenticated' : 'anon'}`); }
const upsert = (user, word, facet, mark) => db.query(`insert into user_word_facets(user_id,lang,word_text,facet,mark) values($1,'zh',$2,$3,$4)
  on conflict(user_id,lang,word_text,facet) do update set mark=excluded.mark, marked_at=now()`, [user, word, facet, mark]);
try {
  await db.exec(`create role anon;create role authenticated;create schema auth;
  create table auth.users(id uuid primary key);grant usage on schema auth to anon,authenticated;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  insert into auth.users values('${a}'),('${b}');`);
  const sql = await fs.readFile(new URL('../migrations/20261015090000_user_word_facets.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql); // 재실행 안전
  await check('본인 행 쓰기 · 고치기 · 지우기', async () => {
    await as(a);
    await upsert(a, '学习', 'word', 'o');
    await upsert(a, '学习', 'meaning', 'x');
    await upsert(a, '学习', 'meaning', 'o');
    assert.deepEqual(await rows("select facet, mark from user_word_facets order by facet"), [{ facet: 'meaning', mark: 'o' }, { facet: 'word', mark: 'o' }]);
    await db.query("delete from user_word_facets where user_id=$1 and facet='word'", [a]);
    assert.equal((await rows('select * from user_word_facets')).length, 1);
  });
  await check('다른 계정 행은 안 보이고 못 쓴다', async () => {
    await as(b);
    assert.equal((await rows('select * from user_word_facets')).length, 0);
    await assert.rejects(upsert(a, '爸爸', 'audio', 'o'));
    await db.query("delete from user_word_facets where user_id=$1", [a]);
    await as(a);
    assert.equal((await rows('select * from user_word_facets')).length, 1);
  });
  await check('게스트(anon)는 읽기 · 쓰기 모두 차단', async () => {
    await as(null);
    await assert.rejects(rows('select * from user_word_facets'));
  });
  await check('모르는 탭 · 표시는 거부', async () => {
    await as(a);
    await assert.rejects(upsert(a, '学习', 'grade', 'o'));
    await assert.rejects(upsert(a, '学习', 'word', 'maybe'));
  });
  console.log(`${checks} checks passed`);
} finally { await db.close(); }
