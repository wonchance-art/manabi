/** Local, disposable PGlite only — never connects to Supabase (JA-PUNCT-001 · 2026-11-08 KST).
 * 20261108000000_ja_punct_pos_public_seeds: 공개 시드 60~67의 기호 토큰 60개만 pos 기호 · furigana null.
 * 증명: ① 운영과 같은 분포(자료별 4 · 9 · 14 · 3 · 9 · 9 · 6 · 6)에서 적용 → 60개만 바뀌고 나머지 칸 · sequence · 다른 항목 · 대상 밖 자료 그대로
 *       ② 재실행 = 무변경 ③ 복원 SQL → 처음과 바이트 같음 ④ 대상이 어긋나면(59개 · 뜻 있음 · 다른 자료) RAISE · 무변경
 *   node supabase/tests/ja-punct-pos.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../migrations/20261108000000_ja_punct_pos_public_seeds.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/ja-punct-pos-20261108-rollback.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const COUNTS = { 60: 4, 61: 9, 62: 14, 63: 3, 64: 9, 65: 9, 66: 6, 67: 6 };
const MARKS = ['(', ')', '—', '/', ')/'];
function material(id, nPunct, { punctPos = '명사', meaning = '' } = {}) {
  const sequence = []; const dictionary = {};
  const add = (tok) => { const k = `id_0_${sequence.length}_1`; sequence.push(k); dictionary[k] = tok; };
  add({ text: '何', base_form: '何', furigana: 'なに', pos: '대명사', meaning: '무엇' });
  for (let i = 0; i < nPunct; i++) {
    add({ text: MARKS[i % MARKS.length], base_form: MARKS[i % MARKS.length], furigana: null, pos: punctPos, meaning });
    add({ text: 'です', base_form: 'です', furigana: null, pos: '조동사', meaning: '이다' });
  }
  add({ text: '。', base_form: '。', furigana: null, pos: '기호', meaning: '' });
  add({ text: '（', base_form: '（', furigana: null, pos: '기호', meaning: '' });
  return { status: 'completed', sequence, dictionary, metadata: { language: 'Japanese' } };
}

async function fresh(overrides = {}) {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create table public.reading_materials (id bigint primary key, visibility text, owner_id uuid, raw_text text, processed_json jsonb);`);
  const rows = { ...Object.fromEntries(Object.entries(COUNTS).map(([id, n]) => [id, ['public', material(Number(id), n)]])),
    13: ['private', material(13, 5)],                                  // 대상 밖 — 비공개(옛 영어 자료 같은 자리)
    70: ['public', { ...material(70, 3), status: 'idle' }],            // 대상 밖 — 분석 전
    71: ['public', material(71, 3, { punctPos: '기호' })],               // 대상 밖 — 이미 기호
    ...overrides };
  for (const [id, [vis, pj]] of Object.entries(rows)) {
    await db.query('insert into public.reading_materials(id, visibility, raw_text, processed_json) values ($1,$2,$3,$4)', [Number(id), vis, 'x', pj]);
  }
  return db;
}
const snapshot = async (db) => (await db.query('select id, processed_json::text pj from public.reading_materials order by id')).rows;
const pj = async (db, id) => (await db.query('select processed_json from public.reading_materials where id=$1', [id])).rows[0].processed_json;

const db = await fresh();
const before = await snapshot(db);
await db.exec(migration);
await check('적용 — 60~67의 기호 토큰 60개만 pos 기호 · furigana null, 나머지 칸 그대로', async () => {
  let changed = 0;
  for (const [id, n] of Object.entries(COUNTS)) {
    const b = JSON.parse(before.find((r) => r.id == id).pj); const a = await pj(db, Number(id));
    assert.deepEqual(a.sequence, b.sequence);
    assert.deepEqual({ ...a, dictionary: null }, { ...b, dictionary: null });
    let here = 0;
    for (const [k, tok] of Object.entries(b.dictionary)) {
      if (MARKS.includes(tok.text) && tok.pos === '명사') { here++; assert.deepEqual(a.dictionary[k], { ...tok, pos: '기호', furigana: null }); }
      else assert.deepEqual(a.dictionary[k], tok);
    }
    assert.equal(here, n); changed += here;
  }
  assert.equal(changed, 60);
  assert.equal((await db.query('select count(*)::int n from backup_private.ja_punct_tokens_20261108')).rows[0].n, 60);
});
await check('적용 — 대상 밖(비공개 · 분석 전 · 이미 기호) 자료는 바이트 같음', async () => {
  const after = await snapshot(db);
  for (const id of [13, 70, 71]) assert.equal(after.find((r) => r.id == id).pj, before.find((r) => r.id == id).pj);
});
await check('재실행 — 무변경', async () => {
  const snap = await snapshot(db);
  await db.exec(migration);
  assert.deepEqual(await snapshot(db), snap);
});
await db.exec(rollback);
await check('복원 — 처음과 같음(백업은 남는다)', async () => {
  const after = await snapshot(db);
  for (const r of before) assert.deepEqual(JSON.parse(after.find((x) => x.id === r.id).pj), JSON.parse(r.pj));
  assert.equal((await db.query('select count(*)::int n from backup_private.ja_punct_tokens_20261108')).rows[0].n, 60);
});
await db.close();

for (const [name, overrides] of [
  ['토큰 59개(자료 60이 3개)', { 60: ['public', material(60, 3)] }],
  ['뜻이 든 기호 토큰', { 63: ['public', material(63, 3, { meaning: '괄호' })] }],
  ['다른 공개 자료에도 대상', { 72: ['public', material(72, 2)] }],
]) {
  const d = await fresh(overrides);
  const snap = await snapshot(d);
  await check(`사전 검사 — ${name} → RAISE · 무변경`, async () => {
    await assert.rejects(d.exec(migration), /unexpected target/);
    await d.exec('rollback').catch(() => {});
    assert.deepEqual(await snapshot(d), snap);
  });
  await d.close();
}
console.log(`ja-punct-pos: ${checks} checks passed`);
