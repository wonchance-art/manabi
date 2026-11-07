/** Local, disposable PGlite only — never connects to Supabase (JA-PUNCT-002 · 2026-11-08 KST).
 * 20261108010000_punct_pos_private_materials: 비공개 7편의 기호 토큰 104개만 pos 기호(뜻 · furigana · 나머지 그대로).
 * 증명: ① 운영과 같은 분포(178:43 · 185:1 · 356~358:2 · 361 · 362:27, 뜻 있는 항목 포함)에서 적용 → 104개만 pos가 바뀌고
 *       뜻 · 나머지 칸 · sequence · 다른 항목 · 대상 밖(주인 없는 정리 대상 16 · 공개 · 이미 기호) 그대로
 *       ② 재실행 = 무변경 ③ 복원 SQL → 처음과 같음 ④ 대상이 어긋나면(개수 · furigana 있음 · 다른 비공개 자료) RAISE · 무변경
 *   node supabase/tests/punct-pos-private.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../migrations/20261108010000_punct_pos_private_materials.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/punct-pos-private-20261108-rollback.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const COUNTS = { 178: 43, 185: 1, 356: 2, 357: 2, 358: 2, 361: 27, 362: 27 };
const MARKS = [',', '.', ';', '!', '?', '[', ']', '...'];
function material(id, nPunct, { punctPos = '명사', meaning = id === 178 ? '쉼표' : '', furigana = null } = {}) {
  const sequence = []; const dictionary = {};
  const add = (tok) => { const k = `id_0_${sequence.length}_1`; sequence.push(k); dictionary[k] = tok; };
  add({ text: '何', base_form: '何', furigana: 'なに', pos: '대명사', meaning: '무엇' });
  for (let i = 0; i < nPunct; i++) {
    add({ text: MARKS[i % MARKS.length], base_form: MARKS[i % MARKS.length], furigana, pos: punctPos, meaning });
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
  const rows = { ...Object.fromEntries(Object.entries(COUNTS).map(([id, n]) => [id, ['private', material(Number(id), n)]])),
    16: ['private', material(16, 5, { punctPos: '구두점', furigana: '.' })], // 대상 밖 — 주인 없는 정리 대상(백업 md5로 삭제 검사)
    60: ['public', material(60, 4)],                                   // 대상 밖 — 공개(#1747 몫)
    70: ['private', { ...material(70, 3), status: 'idle' }],           // 대상 밖 — 분석 전
    71: ['private', material(71, 3, { punctPos: '기호' })],              // 대상 밖 — 이미 기호
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
await check('적용 — 7편의 기호 토큰 104개만 pos 기호, 뜻 · furigana · 나머지 칸 그대로', async () => {
  let changed = 0;
  for (const [id, n] of Object.entries(COUNTS)) {
    const b = JSON.parse(before.find((r) => r.id == id).pj); const a = await pj(db, Number(id));
    assert.deepEqual(a.sequence, b.sequence);
    assert.deepEqual({ ...a, dictionary: null }, { ...b, dictionary: null });
    let here = 0;
    for (const [k, tok] of Object.entries(b.dictionary)) {
      if (MARKS.includes(tok.text) && tok.pos === '명사') { here++; assert.deepEqual(a.dictionary[k], { ...tok, pos: '기호' }); }
      else assert.deepEqual(a.dictionary[k], tok);
    }
    assert.equal(here, n); changed += here;
  }
  assert.equal(changed, 104);
  assert.equal((await db.query('select count(*)::int n from backup_private.punct_tokens_private_20261108')).rows[0].n, 104);
});
await check('적용 — 대상 밖(주인 없는 정리 대상 · 공개 · 분석 전 · 이미 기호) 자료는 바이트 같음', async () => {
  const after = await snapshot(db);
  for (const id of [16, 60, 70, 71]) assert.equal(after.find((r) => r.id == id).pj, before.find((r) => r.id == id).pj);
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
  assert.equal((await db.query('select count(*)::int n from backup_private.punct_tokens_private_20261108')).rows[0].n, 104);
});
await db.close();

for (const [name, overrides] of [
  ['토큰 103개(자료 356이 1개)', { 356: ['private', material(356, 1)] }],
  ['furigana가 든 기호 토큰', { 357: ['private', material(357, 2, { furigana: 'x' })] }],
  ['다른 비공개 자료에도 대상', { 372: ['private', material(372, 2)] }],
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
console.log(`punct-pos-private: ${checks} checks passed`);
