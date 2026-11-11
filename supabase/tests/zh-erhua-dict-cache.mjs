/** Local, disposable PGlite only — never connects to Supabase (ZH-ERHUA 안 A 후속 · 2026-11-12 KST).
 * 20261112010000_zh_erhua_dict_cache: 공유 사전 중국어 얼화 읽기 9행 「… ér」 → 「… r」(reading만).
 * 증명: 새 값 · reading 밖 열 그대로 · 실음절 女儿 · 다른 행 무변경 · 백업 · 재적용 무변경 · 복원 SQL(행 단위) ·
 *   예상 밖 값 · 표제어 다름 · 행 없음은 그 행만 건너뜀 · 대상 없는 환경 무변경 · 표 없는 환경 42P01 · 지문 그대로.
 *   node supabase/tests/zh-erhua-dict-cache.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../migrations/20261112010000_zh_erhua_dict_cache.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/zh-erhua-dict-20261112-rollback.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const T = [
  [3127, '一点儿', 'yì diǎn ér', 'yì diǎn r'], [7088, '哪儿', 'nǎ ér', 'nǎ r'], [3524, '大伙儿', 'dà huǒ ér', 'dà huǒ r'],
  [4432, '心眼儿', 'xīn yǎn ér', 'xīn yǎn r'], [7069, '早点儿', 'zǎo diǎn ér', 'zǎo diǎn r'], [7084, '有点儿', 'yǒu diǎn er', 'yǒu diǎn r'],
  [7285, '画儿', 'huà ér', 'huà r'], [7109, '这儿', 'zhè ér', 'zhè r'], [7107, '那儿', 'nà ér', 'nà r'],
];
async function fixture({ only = T.map((t) => t[0]) } = {}) {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema fsrs_private; create function fsrs_private.contract_hash_live() returns text language sql as $$ select 'core-fp' $$;
    create table public.morpheme_dictionary (id bigserial primary key, base_form text not null, language text not null, pos text, reading text,
      meanings jsonb not null, source text not null default 'gemini', usage_count int not null default 0,
      created_at timestamptz not null default now(), last_used_at timestamptz not null default now(), detail_text text, unique (base_form, language));`);
  for (const [id, bf, old] of T.filter((t) => only.includes(t[0]))) {
    await db.query('insert into public.morpheme_dictionary (id, base_form, language, pos, reading, meanings, usage_count) values ($1,$2,$3,$4,$5,$6,$7)',
      [id, bf, 'Chinese', '명사', old, JSON.stringify([{ meaning: `뜻${id}` }]), id % 7]);
  }
  await db.query("insert into public.morpheme_dictionary (id, base_form, language, pos, reading, meanings) values (4525, '女儿', 'Chinese', '명사', 'nǚ ér', '[{\"meaning\":\"딸\"}]'), (9001, 'party', 'English', '명사', '/ˈpɑːr.ti/', '[]')");
  return db;
}
const rows = async (db) => Object.fromEntries((await db.query('select * from public.morpheme_dictionary order by id')).rows.map((r) => [Number(r.id), r]));

const db = await fixture();
const before = await rows(db);
await db.exec(migration);
const after = await rows(db);
await check('9행 새 읽기(儿 자리만 r)', async () => { for (const [id, , , nw] of T) assert.equal(after[id].reading, nw, String(id)); });
await check('reading 밖 열 그대로 · 女儿 · 다른 언어 행 무변경', async () => {
  for (const [id] of T) { const { reading: a, ...ra } = after[id]; const { reading: b, ...rb } = before[id]; assert.deepEqual(ra, rb); }
  assert.deepEqual(after[4525], before[4525]); assert.deepEqual(after[9001], before[9001]);
});
await check('백업 9행 = 옛 읽기 · 옛 행 통째', async () => {
  const b = (await db.query('select id, reading, row_before from backup_private.zh_erhua_dict_20261112 order by id')).rows;
  assert.deepEqual(b.map((r) => Number(r.id)), T.map((t) => t[0]).sort((x, y) => x - y));
  for (const r of b) { assert.equal(r.reading, before[Number(r.id)].reading); assert.equal(r.row_before.reading, before[Number(r.id)].reading); }
});
await check('재적용 무변경', async () => { await db.exec(migration); assert.deepEqual(await rows(db), after); });
await check('복원 SQL — 행 단위로 옛 읽기', async () => {
  await db.exec(rollback);
  const r = await rows(db);
  for (const [id, , old] of T) assert.equal(r[id].reading, old);
  assert.deepEqual(r[4525], before[4525]);
});
await check('예상 밖 값 · 표제어 다름 · 행 없음 → 그 행만 건너뜀(멈추지 않음)', async () => {
  const d2 = await fixture({ only: T.map((t) => t[0]).filter((id) => id !== 7107) }); // 那儿 행 없음
  await d2.query("update public.morpheme_dictionary set reading = 'nǎ er' where id = 7088"); // 예상 밖
  await d2.query("update public.morpheme_dictionary set base_form = '这儿们' where id = 7109"); // 표제어 다름
  await d2.exec(migration);
  const r = await rows(d2);
  assert.equal(r[7088].reading, 'nǎ er'); assert.equal(r[7109].reading, 'zhè ér'); assert.equal(r[3127].reading, 'yì diǎn r');
  const b = (await d2.query('select id from backup_private.zh_erhua_dict_20261112 order by id')).rows.map((x) => Number(x.id));
  assert.deepEqual(b, [3127, 3524, 4432, 7069, 7084, 7285]);
});
await check('대상 없는 환경 무변경', async () => {
  const d3 = await fixture({ only: [] }); const pre = await rows(d3); await d3.exec(migration); assert.deepEqual(await rows(d3), pre);
});
await check('표 없는 환경 42P01', async () => { await assert.rejects(() => new PGlite().exec(migration), (e) => e.code === '42P01'); });
await check('학습 계약 지문 그대로', async () => { assert.equal((await db.query('select fsrs_private.contract_hash_live() v')).rows[0].v, 'core-fp'); });
console.log(`zh-erhua-dict-cache: ${checks} checks passed`);
