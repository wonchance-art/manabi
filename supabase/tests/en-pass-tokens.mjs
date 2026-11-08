/** Local, disposable PGlite only — never connects to Supabase (EN-LEMMA-SS ⑵ · 2026-11-09 KST).
 * 20261109000000_en_pass_tokens: 공개 영어 3토큰(pass → pas)만 base_form pass · 동사 · 원고 뜻 · curated로 · 다른 칸 · 다른 토큰 · 다른 자료 그대로 ·
 * 재적용 무변경 · 예상 상태가 아니면 멈춤 · 복원 SQL · 대상 없는 환경 무변경 · 표 없는 환경 42P01 · 지문 함수 그대로.
 *   node supabase/tests/en-pass-tokens.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../migrations/20261109000000_en_pass_tokens.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/en-pass-tokens-20261109-rollback.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const TARGETS = [[127, 'id_3_0_1793990006177', 'Pass', '건네주다'], [132, 'id_5_0_1793990031966', 'Pass', '건네주다'], [150, 'id_1_7_1794076307660', 'pass', '통과하다']];
const oldTok = (text) => ({ pos: '명사', text, meaning: '(발레) 걸음, 스텝', furigana: '/pɑːs/', base_form: 'pas' });
function material(id, key, text) {
  const other = { pos: '명사', text: 'salt', meaning: '소금', furigana: '/sɔːlt/', base_form: 'salt' };
  return { status: 'completed', sequence: [key, `id_9_9_${id}`, `br_9_${id}`],
    dictionary: { [key]: oldTok(text), [`id_9_9_${id}`]: other, [`br_9_${id}`]: { pos: '개행', text: '\n' } },
    metadata: { language: 'English', level: 'A1', updated_at: 'u', viewerRevision: `r${id}` } };
}
async function fixture(mutate = (x) => x) {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema fsrs_private; create function fsrs_private.contract_hash_live() returns text language sql as $$ select 'core-fp' $$;
    create table public.reading_materials (id bigint primary key, raw_text text default 'r', visibility text, processed_json jsonb);`);
  for (const [id, key, text] of TARGETS) await db.query('insert into public.reading_materials (id, visibility, processed_json) values ($1, $2, $3)', [id, 'public', mutate(material(id, key, text), id)]);
  await db.query('insert into public.reading_materials (id, visibility, processed_json) values ($1, $2, $3)', [900, 'public', material(900, 'id_0_0_900', 'Pass')]);
  return db;
}
const rows = async (db) => Object.fromEntries((await db.query('select id, raw_text, visibility, processed_json from public.reading_materials order by id')).rows.map((r) => [r.id, r]));

const db = await fixture();
const before = await rows(db);
await db.exec(migration);
const after = await rows(db);
await check('3토큰 — base_form pass · 동사 · 원고 뜻 · curated, text · furigana 그대로', async () => {
  for (const [id, key, text, meaning] of TARGETS) {
    assert.deepEqual(after[id].processed_json.dictionary[key], { ...oldTok(text), base_form: 'pass', pos: '동사', meaning, meaning_src: 'curated' });
  }
});
await check('다른 토큰 · sequence · metadata · 원문 · 대상 밖 자료(같은 옛 값이어도) 그대로', async () => {
  for (const [id] of TARGETS) {
    const a = after[id].processed_json, b = before[id].processed_json;
    assert.deepEqual(a.sequence, b.sequence); assert.deepEqual(a.metadata, b.metadata);
    assert.deepEqual(a.dictionary[`id_9_9_${id}`], b.dictionary[`id_9_9_${id}`]);
  }
  assert.deepEqual(after[900], before[900]);
});
await check('백업 3행 · 재적용 무변경 · 지문 함수 그대로', async () => {
  assert.equal((await db.query('select count(*)::int n from backup_private.en_pass_tokens_20261109')).rows[0].n, 3);
  await db.exec(migration);
  assert.deepEqual(await rows(db), after);
  assert.equal((await db.query('select fsrs_private.contract_hash_live() v')).rows[0].v, 'core-fp');
});
await check('복원 SQL — 처음 모양', async () => { await db.exec(rollback); assert.deepEqual(await rows(db), before); });
await db.close();
{
  const d = await fixture((m, id) => (id === 150 ? { ...m, dictionary: { ...m.dictionary, id_1_7_1794076307660: { ...m.dictionary.id_1_7_1794076307660, meaning: '통과' } } } : m));
  await check('예상 상태가 아니면 멈춤(무변경)', async () => {
    const s = await rows(d);
    await assert.rejects(d.exec(migration), /not in expected state \(150:id_1_7_1794076307660\)/);
    assert.deepEqual(await rows(d), s);
  });
  await d.close();
}
{
  const d = new PGlite();
  await d.exec('create role anon nologin; create role authenticated nologin; create table public.reading_materials (id bigint primary key, visibility text, processed_json jsonb)');
  await check('대상 자료가 없는 환경 — 무변경', async () => { await d.exec(migration); assert.equal((await d.query('select count(*)::int n from public.reading_materials')).rows[0].n, 0); });
  await d.close();
}
{
  const d = new PGlite();
  await check('표 없는 환경 — 42P01', async () => { await assert.rejects(d.exec(migration), (e) => e.code === '42P01'); });
  await d.close();
}
console.log(`en-pass-tokens: ${checks} checks passed`);
