/** Local, disposable PGlite only — never connects to Supabase (ZH-SEED-QA-001 · 2026-11-08 KST).
 * 20261108020000_zh_seed_token_fixes: 시드 364 全家 뜻 · 368 吃 품사 · 370 美英 품사 · 뜻 — 세 사전 항목만.
 * 증명: ① 운영과 같은 모양(키 · 글자 · 병음 · 고치기 전 값)에서 적용 → 세 항목만 pos · meaning이 바뀌고 같은 자료의 다른 吃 · 나머지 · sequence 그대로
 *       ② 재실행 = 무변경 ③ 복원 SQL → 처음과 같음 ④ 값이 어긋나면 RAISE · 무변경 ⑤ 시드가 없는 환경 = 무변경 통과
 *   node supabase/tests/zh-seed-token-fixes.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../migrations/20261108020000_zh_seed_token_fixes.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/zh-seed-token-fixes-20261108-rollback.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const tok = (text, furigana, pos, meaning) => ({ text, base_form: text, furigana, pos, meaning });
const pj = (entries) => ({ status: 'completed', sequence: Object.keys(entries), dictionary: entries, metadata: { language: 'Chinese' } });
const BASE = {
  364: pj({ id_0_8_1794076427610: tok('叫', 'jiào', '동사', '부르다'), id_0_9_1794076427610: tok('全家', 'quán jiā', '고유명사', '온 가족') }),
  368: pj({ id_1_10_1794076449029: tok('吃', 'chī', '동사', '먹다'), id_5_7_1794076449029: tok('吃', 'chī', '고유명사', '먹다') }),
  370: pj({ id_0_4_1794076460988: tok('金', 'jīn', '인명', '김(성씨)'), id_0_5_1794076460988: tok('美英', 'měi yīng', '고유명사', '미국과 영국') }),
};
async function fresh(rows = BASE) {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create table public.reading_materials (id bigint primary key, visibility text, processed_json jsonb);`);
  for (const [id, v] of Object.entries(rows)) await db.query('insert into public.reading_materials values ($1, $2, $3)', [Number(id), 'public', v]);
  return db;
}
const snapshot = async (db) => (await db.query('select id, processed_json from public.reading_materials order by id')).rows;
const entry = async (db, id, k) => (await db.query(`select processed_json->'dictionary'->$2 v from public.reading_materials where id=$1`, [id, k])).rows[0].v;

const db = await fresh();
const before = await snapshot(db);
await db.exec(migration);
await check('적용 — 세 항목만 pos · meaning, 글자 · 병음 · 다른 항목 · sequence 그대로', async () => {
  assert.deepEqual(await entry(db, 364, 'id_0_9_1794076427610'), tok('全家', 'quán jiā', '고유명사', "패밀리마트(편의점 상호 · 본뜻 '온 가족')"));
  assert.deepEqual(await entry(db, 368, 'id_5_7_1794076449029'), tok('吃', 'chī', '동사', '먹다'));
  assert.deepEqual(await entry(db, 370, 'id_0_5_1794076460988'), tok('美英', 'měi yīng', '인명', '미영(이름 — 金美英의 이름 부분)'));
  const after = await snapshot(db);
  for (const b of before) {
    const a = after.find((r) => r.id === b.id).processed_json;
    assert.deepEqual(a.sequence, b.processed_json.sequence);
    for (const [k, v] of Object.entries(b.processed_json.dictionary)) if (!['id_0_9_1794076427610', 'id_5_7_1794076449029', 'id_0_5_1794076460988'].includes(k)) assert.deepEqual(a.dictionary[k], v);
  }
  assert.equal((await db.query('select count(*)::int n from backup_private.zh_seed_tokens_20261108')).rows[0].n, 3);
});
await check('재실행 — 무변경', async () => { const s = await snapshot(db); await db.exec(migration); assert.deepEqual(await snapshot(db), s); });
await db.exec(rollback);
await check('복원 — 처음과 같음', async () => assert.deepEqual(await snapshot(db), before));
await db.close();

const drift = structuredClone(BASE); drift[370].dictionary.id_0_5_1794076460988.meaning = '다른 뜻';
for (const [name, rows] of [['고치기 전 값이 다름', drift], ['자료 하나만 있음', { 364: BASE[364] }]]) {
  const d = await fresh(rows); const s = await snapshot(d);
  await check(`사전 검사 — ${name} → RAISE · 무변경`, async () => {
    await assert.rejects(d.exec(migration), /unexpected state/);
    await d.exec('rollback').catch(() => {});
    assert.deepEqual(await snapshot(d), s);
  });
  await d.close();
}
{
  const d = await fresh({});
  await check('시드가 없는 환경 — 무변경 통과 · 백업 0', async () => {
    await d.exec(migration);
    assert.equal((await d.query('select count(*)::int n from backup_private.zh_seed_tokens_20261108')).rows[0].n, 0);
  });
  await d.close();
}
console.log(`zh-seed-token-fixes: ${checks} checks passed`);
