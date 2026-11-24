/** Local, disposable PGlite only — never connects to Supabase (LIB-FIX-001 ⓑ · 2026-11-24 KST).
 * 20261124020000_library_hide_conversations_chain: 손으로 적용된 docs/sql/library-hide-conversations.sql 본문을 사슬에 싣는다.
 * 옛 본문은 원본 마이그레이션(20260930135103)에서 그대로 잘라 세운다(본문 검사는 끔 — 참조 표 없이 md5 갈래만 본다).
 * 증명: ① 옛 본문(16963a52…) → 운영 본문(18a33cfe…)으로 · 실행권 · search_path 그대로 ② 이미 적용(운영) → 무변경
 *   ③ 모르는 본문 → 멈춤(덮어쓰지 않음) ④ 복원 SQL → 옛 본문 ⑤ 함수 없는 환경 42883 ⑥ 지문 그대로.
 *   node supabase/tests/library-hide-conversations-chain.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../migrations/20261124020000_library_hide_conversations_chain.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/library-hide-conversations-rollback.sql', import.meta.url), 'utf8');
const original = await readFile(new URL('../migrations/20260930135103_personal_library_management.sql', import.meta.url), 'utf8');
const start = original.indexOf('create function library_private.managed_rows');
assert.ok(start > 0, 'managed_rows in original migration');
const oldFn = original.slice(start, original.indexOf('$$;', start) + 3);
const BASE = '16963a52f504e3bd9f9b19bc39af73f1'; const APPLIED = '18a33cfe6899cc081875af66238f4362';
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

async function fixture({ body = oldFn } = {}) {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema fsrs_private; create function fsrs_private.contract_hash_live() returns text language sql as $$ select 'core-fp' $$;
    create schema library_private; set check_function_bodies = off;`);
  if (body) await db.exec(body);
  if (body) await db.exec(`revoke all on function library_private.managed_rows(jsonb) from public, anon; grant execute on function library_private.managed_rows(jsonb) to authenticated;`);
  return db;
}
const md5 = async (db) => (await db.query("select md5(prosrc) m from pg_proc where oid = 'library_private.managed_rows(jsonb)'::regprocedure")).rows[0]?.m;

const db = await fixture();
await check('사슬 옛 본문 = 16963a52…(문서의 적용 전 기준과 같음)', async () => { assert.equal(await md5(db), BASE); });
await db.exec(migration);
await check('① 옛 본문 → 운영 본문 18a33cfe… · 실행권 · search_path 그대로', async () => {
  assert.equal(await md5(db), APPLIED);
  const r = (await db.query(`select proconfig, has_function_privilege('authenticated','library_private.managed_rows(jsonb)','EXECUTE') a,
    has_function_privilege('anon','library_private.managed_rows(jsonb)','EXECUTE') b from pg_proc where oid='library_private.managed_rows(jsonb)'::regprocedure`)).rows[0];
  assert.deepEqual(r.proconfig, ['search_path=""']); assert.equal(r.a, true); assert.equal(r.b, false);
});
await check('② 이미 적용된 환경(운영) — 재적용 무변경', async () => { await db.exec(migration); assert.equal(await md5(db), APPLIED); });
await check('④ 복원 SQL → 옛 본문', async () => { await db.exec(rollback); assert.equal(await md5(db), BASE); });
await check('③ 모르는 본문 — 멈춘다(덮어쓰지 않음)', async () => {
  const d2 = await fixture({ body: `create function library_private.managed_rows(p_filters jsonb default '{}') returns setof jsonb language sql stable set search_path='' as $$ select '{}'::jsonb $$;` });
  const before = await md5(d2);
  await assert.rejects(() => d2.exec(migration), /neither the base nor the applied body/);
  assert.equal(await md5(d2), before);
});
await check('⑤ 함수 없는 환경 — 42883', async () => {
  const d3 = await fixture({ body: null });
  await assert.rejects(() => d3.exec(migration), (e) => e.code === '42883');
});
await check('⑥ 학습 계약 지문 그대로', async () => { assert.equal((await db.query('select fsrs_private.contract_hash_live() v')).rows[0].v, 'core-fp'); });
console.log(`library-hide-conversations-chain: ${checks} checks passed`);
