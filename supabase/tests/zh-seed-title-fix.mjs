/** Local, disposable PGlite only — never connects to Supabase (ZH-SEED-TITLE-001 · 2026-11-08 KST).
 * 20261108030000_zh_seed_title_fix: 366 「[H3 여행 #2] 问路」 → 「#1」. 다른 칸 · 다른 자료 그대로 · 재실행 무변경 · 복원 · 어긋난 상태 RAISE · 자료 없음 통과.
 *   node supabase/tests/zh-seed-title-fix.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../migrations/20261108030000_zh_seed_title_fix.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/zh-seed-title-fix-20261108-rollback.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };
async function fresh(rows) {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create table public.reading_materials (id bigint primary key, title text, raw_text text, visibility text);`);
  for (const [id, title] of rows) await db.query('insert into public.reading_materials values ($1,$2,$3,$4)', [id, title, 'x', 'public']);
  return db;
}
const all = async (db) => (await db.query('select id, title, raw_text, visibility from public.reading_materials order by id')).rows;
const BASE = [[365, '[H3 생활 #2] 周末打算 (주말 계획)'], [366, '[H3 여행 #2] 问路 (길 묻기)'], [367, '[H2 여행 #1] 去上海旅游 (상하이 여행)']];

const db = await fresh(BASE);
const before = await all(db);
await db.exec(migration);
await check('적용 — 366 제목만 #1, 다른 칸 · 다른 자료 그대로', async () => {
  const after = await all(db);
  assert.deepEqual(after.map((r) => r.title), ['[H3 생활 #2] 周末打算 (주말 계획)', '[H3 여행 #1] 问路 (길 묻기)', '[H2 여행 #1] 去上海旅游 (상하이 여행)']);
  after.forEach((r, i) => { assert.equal(r.raw_text, before[i].raw_text); assert.equal(r.visibility, before[i].visibility); });
});
await check('재실행 — 무변경', async () => { const s = await all(db); await db.exec(migration); assert.deepEqual(await all(db), s); });
await db.exec(rollback);
await check('복원 — 처음과 같음', async () => assert.deepEqual(await all(db), before));
await db.close();
for (const [name, rows] of [['제목이 다름', [[366, '[H3 여행 #2] 问路']]], ['이미 #1이 다른 자료에', [...BASE, [400, '[H3 여행 #1] 다른 글']]]]) {
  const d = await fresh(rows); const s = await all(d);
  await check(`사전 검사 — ${name} → RAISE · 무변경`, async () => {
    await assert.rejects(d.exec(migration), /unexpected state/);
    await d.exec('rollback').catch(() => {});
    assert.deepEqual(await all(d), s);
  });
  await d.close();
}
{ const d = await fresh([]); await check('자료 없음 — 무변경 통과', async () => { await d.exec(migration); assert.deepEqual(await all(d), []); }); await d.close(); }
console.log(`zh-seed-title-fix: ${checks} checks passed`);
