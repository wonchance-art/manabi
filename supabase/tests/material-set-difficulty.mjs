/** Local, disposable PGlite only — never connects to Supabase (MATERIAL-DIFFICULTY-002 · 2026-11-08 KST).
 * 20261108040000_material_set_difficulty: 공개 · completed 자료의 metadata.difficulty 한 칸만 쓴다 · updated_at이 다르면 쓰지 않는다 ·
 * service_role만 실행 · 지문 함수 그대로 · 잘못된 요약 거절 · 복원(함수 삭제 + 그 칸만 제거) · 표 없는 환경 42P01.
 *   node supabase/tests/material-set-difficulty.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../migrations/20261108040000_material_set_difficulty.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/material-set-difficulty-20261108-rollback.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const T = '2026-11-07T10:00:00.000Z';
const pj = (meta, extra = {}) => ({ status: 'completed', sequence: ['a'], dictionary: { a: { text: '猫', pos: '명사' } }, metadata: { language: 'Japanese', updated_at: T, ...meta }, ...extra });
const ROWS = [
  [1, 'public', pj({})],
  [2, 'private', pj({})],
  [3, 'public', { ...pj({}), status: 'pending' }],
  [4, 'public', { status: 'completed', metadata: 'broken' }],
  [5, 'public', pj({ composer: { version: '1' }, book: { key: 'k' } })],
];
const SUMMARY = { version: 1, scale: 'JLPT', medianLevel: 5, p90Level: 4, types: 12, listedShare: 0.83 };

const db = new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema fsrs_private;
  create function fsrs_private.contract_hash_live() returns text language sql as $$ select 'core-fp' $$;
  create table public.reading_materials (id bigint primary key, title text default 't', raw_text text default 'r', visibility text, processed_json jsonb);`);
for (const [id, v, p] of ROWS) await db.query('insert into public.reading_materials (id, visibility, processed_json) values ($1,$2,$3)', [id, v, p]);
const all = async () => (await db.query('select id, title, raw_text, visibility, processed_json from public.reading_materials order by id')).rows;
const before = await all();
const call = async (role, id, summary, at) => {
  await db.exec(`set role ${role}`);
  try { return (await db.query('select public.material_set_difficulty($1, $2, $3) ok', [id, summary, at])).rows[0].ok; }
  finally { await db.exec('reset role'); }
};

await db.exec(migration);
await check('적용 — 자료 무변경 · 지문 함수 그대로', async () => {
  assert.deepEqual(await all(), before);
  assert.equal((await db.query('select fsrs_private.contract_hash_live() v')).rows[0].v, 'core-fp');
});
await check('권한 — anon · authenticated 실행 불가, service_role 실행', async () => {
  for (const role of ['anon', 'authenticated']) await assert.rejects(call(role, 1, SUMMARY, T), /permission denied/);
  const priv = (await db.query(`select has_function_privilege('anon','public.material_set_difficulty(bigint,jsonb,text)','EXECUTE') a,
    has_function_privilege('authenticated','public.material_set_difficulty(bigint,jsonb,text)','EXECUTE') b,
    has_function_privilege('service_role','public.material_set_difficulty(bigint,jsonb,text)','EXECUTE') c`)).rows[0];
  assert.deepEqual(priv, { a: false, b: false, c: true });
});
await check('쓰기 — 공개 · completed · updated_at 일치 → true, metadata.difficulty 한 칸만', async () => {
  assert.equal(await call('service_role', 1, SUMMARY, T), true);
  const [row] = (await all()).filter((r) => r.id === 1);
  assert.deepEqual(row.processed_json.metadata.difficulty, SUMMARY);
  const { difficulty, ...rest } = row.processed_json.metadata;
  assert.deepEqual({ ...row, processed_json: { ...row.processed_json, metadata: rest } }, before[0]);
});
await check('덮어쓰기 — 형식이 바뀐 요약(version 2)으로 같은 칸을 바꾼다', async () => {
  assert.equal(await call('service_role', 1, { ...SUMMARY, version: 2 }, T), true);
  assert.equal((await all())[0].processed_json.metadata.difficulty.version, 2);
});
await check('셈하는 사이 재분석 — updated_at이 다르면 false · 무변경', async () => {
  const s = await all();
  assert.equal(await call('service_role', 1, { ...SUMMARY, version: 9 }, '2026-01-01T00:00:00.000Z'), false);
  assert.equal(await call('service_role', 1, { ...SUMMARY, version: 9 }, null), false);
  assert.deepEqual(await all(), s);
});
await check('대상 밖 — 비공개 · 분석 전 · metadata 깨짐 · 없는 id는 false · 무변경', async () => {
  const s = await all();
  for (const id of [2, 3, 4, 999]) assert.equal(await call('service_role', id, SUMMARY, T), false, `id ${id}`);
  assert.deepEqual(await all(), s);
});
await check('작성기 · 책 표식이 있는 공개 자료 — 그 칸들 그대로, difficulty만', async () => {
  assert.equal(await call('service_role', 5, SUMMARY, T), true);
  const row = (await all()).find((r) => r.id === 5);
  assert.deepEqual(row.processed_json.metadata.composer, { version: '1' });
  assert.deepEqual(row.processed_json.metadata.book, { key: 'k' });
});
await check('잘못된 요약 — 객체 아님 · version 없음 · 2000자 초과 · null → 22023 · 무변경', async () => {
  const s = await all();
  for (const bad of [[1, 2], { scale: 'JLPT' }, { version: 1, pad: 'x'.repeat(2100) }, null]) {
    await assert.rejects(call('service_role', 1, bad, T), (e) => e.code === '22023' || /difficulty_invalid/.test(e.message));
  }
  assert.deepEqual(await all(), s);
});
await check('재적용 — 함수만 다시 만든다(자료 무변경)', async () => { const s = await all(); await db.exec(migration); assert.deepEqual(await all(), s); });
await db.exec(rollback);
await check('복원 — 함수 없음 · difficulty 칸만 빠져 처음과 같음', async () => {
  assert.deepEqual(await all(), before);
  assert.equal((await db.query("select to_regprocedure('public.material_set_difficulty(bigint,jsonb,text)') f")).rows[0].f, null);
});
await db.close();
{
  const d = new PGlite();
  await check('표 없는 환경 — 42P01(관측 뒤 마이그레이션 사슬이 건너뛴다)', async () => {
    await assert.rejects(d.exec(migration), (e) => e.code === '42P01');
  });
  await d.close();
}
console.log(`material-set-difficulty: ${checks} checks passed`);
