/** Local, disposable PGlite only — never connects to Supabase (SEED-QA-002 A · C · 2026-11-08 KST).
 * 20261108060000_en_meaning_fill: 공개 · completed · 영어 · sequence 안 · pos null · 뜻 빈칸 토큰만, 공유 사전에 pos · 첫 뜻이 있을 때
 * pos · meaning · meaning_src('dictionary')를 채운다 · 다른 칸 · 다른 토큰 · 다른 자료 그대로 · 백업 · 재적용 무변경 · 함수(service_role만) ·
 * 크론이 나중에 생긴 사전 행으로 채움 · 복원 SQL · 실측 대상이 줄면 멈춤 · 표 없는 환경 42P01 · 지문 함수 그대로.
 *   node supabase/tests/en-meaning-fill.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../migrations/20261108060000_en_meaning_fill.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/en-meaning-fill-20261108-rollback.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

// 운영 실측과 같은 자료별 채울 토큰 수(마이그레이션 사전 검사가 이 수를 요구한다).
const EXPECTED = { 114: 1, 115: 1, 116: 1, 118: 1, 122: 1, 124: 1, 128: 4, 133: 3, 135: 3, 138: 1, 139: 1, 147: 3, 148: 1, 154: 2, 174: 1 };
const DICT = [['dont', '조동사', '~하지 않다'], ['hot', '형용사·부사', '뜨거운'], ['two', '수사·명사', '둘']];
const token = (text, base, extra = {}) => ({ pos: null, text, meaning: '', furigana: '', base_form: base, ...extra });

/** 자료 하나: 채울 토큰 n개(사전 있음) + 정상 토큰 + 사전 없는 빈 토큰 + sequence 밖 빈 토큰 + 개행. */
function material(id, n, { language = 'English', unfillable = true } = {}) {
  const dictionary = {}, sequence = [];
  dictionary[`id_0_0_${id}`] = { pos: '명사', text: 'cat', meaning: '고양이', furigana: '', base_form: 'cat' };
  sequence.push(`id_0_0_${id}`);
  for (let i = 0; i < n; i++) {
    const [base] = DICT[i % DICT.length];
    const key = `id_0_${i + 1}_${id}`;
    dictionary[key] = token(base, base, i === 0 ? { lemma_candidates: { 기본: base } } : {});
    sequence.push(key);
  }
  if (unfillable) { dictionary[`id_0_90_${id}`] = token('party', 'party'); sequence.push(`id_0_90_${id}`); }
  dictionary[`id_0_91_${id}`] = token('two', 'two'); // sequence 밖 — 건드리지 않는다
  dictionary[`br_0_${id}`] = { pos: '개행', text: '\n' };
  sequence.push(`br_0_${id}`);
  return { status: 'completed', sequence, dictionary, failed_indices: [], last_idx: 0, metadata: { language, level: 'A1', updated_at: '2026-11-07T00:00:00Z', viewerRevision: `rev-${id}` } };
}

async function fixture(expected = EXPECTED) {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema fsrs_private;
    create function fsrs_private.contract_hash_live() returns text language sql as $$ select 'core-fp' $$;
    create function fsrs_private.activity_profile_hash_live() returns text language sql as $$ select 'act-fp' $$;
    create table public.reading_materials (id bigint primary key, title text default 't', raw_text text default 'r', visibility text, processed_json jsonb);
    create table public.morpheme_dictionary (id bigserial primary key, base_form text not null, language text not null, pos text, reading text,
      meanings jsonb, source text, unique (base_form, language));`);
  for (const [b, pos, m] of DICT) await db.query('insert into public.morpheme_dictionary (base_form, language, pos, meanings, source) values ($1, $2, $3, $4, $5)', [b, 'English', pos, JSON.stringify([{ meaning: m }]), 'gemini']);
  await db.query(`insert into public.morpheme_dictionary (base_form, language, pos, meanings, source) values ('cat', 'English', '명사', '[{"meaning":""}]', 'gemini')`);
  for (const [id, n] of Object.entries(expected)) await db.query('insert into public.reading_materials (id, visibility, processed_json) values ($1, $2, $3)', [Number(id), 'public', material(id, n)]);
  // 대상 밖: 비공개 영어 · 공개 일본어 · 공개 분석 중 — 같은 빈 토큰이 있어도 그대로.
  await db.query('insert into public.reading_materials (id, visibility, processed_json) values ($1, $2, $3)', [900, 'private', material(900, 2)]);
  await db.query('insert into public.reading_materials (id, visibility, processed_json) values ($1, $2, $3)', [901, 'public', material(901, 2, { language: 'Japanese' })]);
  await db.query('insert into public.reading_materials (id, visibility, processed_json) values ($1, $2, $3)', [902, 'public', { ...material(902, 2), status: 'analyzing' }]);
  return db;
}
const rows = async (db) => Object.fromEntries((await db.query('select id, title, raw_text, visibility, processed_json from public.reading_materials order by id')).rows.map((r) => [r.id, r]));
const rpc = async (db, role, limit = 50) => {
  await db.exec(`set role ${role}`);
  try { return (await db.query('select public.material_fill_empty_meanings($1) r', [limit])).rows[0].r; } finally { await db.exec('reset role'); }
};

const db = await fixture();
const before = await rows(db);
await db.exec(migration);
const after = await rows(db);

await check('A 채움 — 대상 토큰만 pos · 첫 뜻 · meaning_src, 나머지 칸 그대로', async () => {
  let filled = 0;
  for (const [id, n] of Object.entries(EXPECTED)) {
    const b = before[id].processed_json, a = after[id].processed_json;
    for (let i = 0; i < n; i++) {
      const key = `id_0_${i + 1}_${id}`;
      const [, pos, meaning] = DICT[i % DICT.length];
      assert.deepEqual(a.dictionary[key], { ...b.dictionary[key], pos, meaning, meaning_src: 'dictionary' }, key);
      filled++;
    }
    assert.deepEqual(a.sequence, b.sequence);
    assert.deepEqual(a.metadata, b.metadata);
    const untouched = (j) => Object.fromEntries(Object.entries(j.dictionary).filter(([k]) => !/^id_0_([1-9]|[1-8]\d)_/.test(k)));
    assert.deepEqual(untouched(a), untouched(b), `rest ${id}`);
    assert.equal(after[id].raw_text, before[id].raw_text);
  }
  assert.equal(filled, 25);
});
await check('대상 밖 — 사전 없는 빈 토큰 · sequence 밖 · 뜻 빈 사전 행 · 비공개 · 일본어 · 분석 중 자료 그대로', async () => {
  for (const id of ['900', '901', '902']) assert.deepEqual(after[id], before[id]);
  const a = after['128'].processed_json.dictionary;
  assert.deepEqual(a.id_0_90_128, token('party', 'party'));
  assert.deepEqual(a.id_0_91_128, token('two', 'two'));
  assert.deepEqual(a.id_0_0_128.meaning, '고양이');
});
await check('백업 — 채운 25개의 고치기 전 토큰', async () => {
  const b = (await db.query('select material_id, token_key, token from backup_private.en_meaning_fill_20261108 order by 1, 2')).rows;
  assert.equal(b.length, 25);
  for (const r of b) assert.deepEqual(r.token, before[r.material_id].processed_json.dictionary[r.token_key]);
});
await check('지문 함수 그대로 · 권한 — anon · authenticated 실행 불가, service_role 실행', async () => {
  assert.equal((await db.query('select fsrs_private.contract_hash_live() v')).rows[0].v, 'core-fp');
  for (const role of ['anon', 'authenticated']) await assert.rejects(rpc(db, role), /permission denied/);
  assert.deepEqual(await rpc(db, 'service_role'), { materials: 0, tokens: 0, ids: [], remaining: 0, unfillable: 15, more: false });
});
await check('재적용 — 무변경(채울 대상 0 · 백업 그대로)', async () => {
  await db.exec(migration);
  assert.deepEqual(await rows(db), after);
  assert.equal((await db.query('select count(*)::int n from backup_private.en_meaning_fill_20261108')).rows[0].n, 25);
});
await check('C 크론 — 나중에 사전에 들어온 뜻으로 채움 · 상한(p_limit) · 멱등', async () => {
  await db.query(`insert into public.morpheme_dictionary (base_form, language, pos, meanings, source) values ('party', 'English', '명사', '[{"meaning":"파티"}]', 'gemini')`);
  const first = await rpc(db, 'service_role', 5);
  assert.equal(first.materials, 5); assert.equal(first.tokens, 5); assert.equal(first.remaining, 10); assert.equal(first.more, true);
  const rest = await rpc(db, 'service_role', 50);
  assert.equal(rest.materials, 10); assert.equal(rest.remaining, 0); assert.equal(rest.unfillable, 0); assert.equal(rest.more, false);
  assert.deepEqual((await rows(db))['128'].processed_json.dictionary.id_0_90_128, { ...token('party', 'party'), pos: '명사', meaning: '파티', meaning_src: 'dictionary' });
  assert.deepEqual((await rpc(db, 'service_role', 50)).tokens, 0);
  for (const id of ['900', '901', '902']) assert.deepEqual((await rows(db))[id], before[id]);
});
await check('복원 SQL — 마이그레이션 · 크론이 채운 토큰 모두 처음 모양 · 함수 삭제', async () => {
  await db.exec(rollback);
  assert.deepEqual(await rows(db), before);
  assert.equal((await db.query("select to_regprocedure('public.material_fill_empty_meanings(integer)') f")).rows[0].f, null);
});
await db.close();

{
  const d = await fixture({ ...EXPECTED, 128: 3 });
  await check('실측 대상이 줄어든 환경 — 멈춤(무변경)', async () => {
    const s = await rows(d);
    await assert.rejects(d.exec(migration), /material 128 has 3 targets, expected at least 4/);
    assert.deepEqual(await rows(d), s);
  });
  await d.close();
}
{
  const d = new PGlite();
  await d.exec('create table public.reading_materials (id bigint primary key, visibility text, processed_json jsonb)');
  await d.exec("insert into public.reading_materials values (1, 'public', '{}')");
  await check('사전 표 없는 환경 — 42P01(관측 뒤 마이그레이션 사슬이 건너뛴다)', async () => {
    await assert.rejects(d.exec(migration), (e) => e.code === '42P01');
  });
  await d.close();
}
{
  const d = await fixture({});
  await check('고칠 것이 없는 환경(공개 영어 대상 0) — 무변경 · 함수는 생김', async () => {
    const s = await rows(d);
    await d.exec(migration);
    assert.deepEqual(await rows(d), s);
    assert.notEqual((await d.query("select to_regprocedure('public.material_fill_empty_meanings(integer)') f")).rows[0].f, null);
  });
  await d.close();
}
console.log(`en-meaning-fill: ${checks} checks passed`);
