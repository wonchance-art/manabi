/** Local, disposable PGlite only — never connects to Supabase (SEED-QA-002 B · 2026-11-08 KST).
 * 20261108060000(A · C) 다음 20261108070000_en_dictionary_reviewed: 검수 원고 22행을 user_verified로 넣고(있던 행은 그대로) ·
 * it's 첫 뜻만 고치고 · 문맥 보정 토큰 5개(curated) · #135 it's 토큰 3개 · 남은 빈 뜻 22개를 채운다 → 공개 영어 빈 뜻 0 ·
 * 다른 칸 · 다른 자료 그대로 · 재적용 무변경 · 복원 SQL · A 미적용이면 멈춤 · 표 없는 환경 42P01.
 *   node supabase/tests/en-dictionary-reviewed.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const A = await readFile(new URL('../migrations/20261108060000_en_meaning_fill.sql', import.meta.url), 'utf8');
const B = await readFile(new URL('../migrations/20261108070000_en_dictionary_reviewed.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/en-dictionary-reviewed-20261108-rollback.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const tok = (text, base, extra = {}) => ({ pos: null, text, meaning: '', furigana: null, base_form: base, ...extra });
const B_WORDS = ['party', 'party', 'party', 'adele', 'bright', 'during', 'everest', 'fire', 'floor', 'half', 'i\'ve', 'kid', 'max', 'okay',
  'outside', 'pass', 'subject', 'we\'re', 'we\'ve', 'what\'s', 'why', 'you\'ll']; // 22개(st · light · forward는 직접 보정)
const CURATED = { 125: ['id_5_5_1793989994688', 'st', 'st'], 137: ['id_3_5_1794076235487', 'light', 'light'], 164: ['id_7_6_1794076348725', 'forward', 'forward'],
  138: ['id_3_2_1794076243550', 'hotter', 'hot'], 139: ['id_3_3_1794076249454', 'hottest', 'hot'] };
const TH_KEY = 'id_8_6_1794076225321';
// A의 사전 검사가 요구하는 자료별 채울 수(사전에 있는 표제어): 114 · 115 … 174.
const A_FILL = { 114: 1, 115: 1, 116: 1, 118: 1, 122: 1, 124: 1, 128: 4, 133: 3, 135: 3, 138: 1, 139: 1, 147: 3, 148: 1, 154: 2, 174: 1 };

function material(id) {
  const dictionary = { [`id_0_0_${id}`]: { pos: '명사', text: 'cat', meaning: '고양이', furigana: null, base_form: 'cat' } }, sequence = [`id_0_0_${id}`];
  const add = (key, t) => { dictionary[key] = t; sequence.push(key); };
  const n = A_FILL[id] || 0;
  for (let i = 0; i < n; i++) {
    if (id === 135) add(`id_${i + 1}_0_${id}`, tok('It\'s', 'it\'s'));
    else if (CURATED[id] && i === 0) add(CURATED[id][0], tok(CURATED[id][1], CURATED[id][2]));
    else add(`id_1_${i}_${id}`, tok('two', 'two'));
  }
  if ([125, 137, 164].includes(id)) add(CURATED[id][0], tok(CURATED[id][1], CURATED[id][2]));
  if (id === 135) add(TH_KEY, { pos: '명사', text: 'th', meaning: 'th(문자)', furigana: '/θ/', base_form: 'th' }); // 옛 분석 — 이미 뜻이 있는 서수 접미
  if (id === 200) B_WORDS.forEach((w, i) => add(`id_2_${i}_${id}`, tok(w === 'pass' ? 'passed' : w, w)));
  dictionary[`br_0_${id}`] = { pos: '개행', text: '\n' }; sequence.push(`br_0_${id}`);
  return { status: 'completed', sequence, dictionary, failed_indices: [], last_idx: 0, metadata: { language: 'English', level: 'A1', updated_at: 'u', viewerRevision: `r${id}` } };
}

async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema fsrs_private;
    create function fsrs_private.contract_hash_live() returns text language sql as $$ select 'core-fp' $$;
    create table public.reading_materials (id bigint primary key, title text default 't', raw_text text default 'r', visibility text, processed_json jsonb);
    create table public.morpheme_dictionary (id bigserial primary key, base_form text not null, language text not null, pos text, reading text,
      meanings jsonb, source text, last_used_at timestamptz, unique (base_form, language));`);
  const dict = [['two', '수사·명사', '둘'], ['hot', '형용사·부사', '뜨거운'],
    ['it\'s', '대명사·조동사', null]];
  for (const [b, pos, m] of dict) {
    const meanings = m ? [{ pos: pos.split('·')[0], meaning: m, priority: 1 }]
      : [{ pos: '대명사', verify: 'ok', meaning: '그것은', en_pos_v: 1, priority: 1 }, { pos: '조동사', meaning: '~이다', priority: 2 }];
    await db.query('insert into public.morpheme_dictionary (base_form, language, pos, reading, meanings, source) values ($1, $2, $3, $4, $5, $6)', [b, 'English', pos, '/x/', JSON.stringify(meanings), 'gemini']);
  }
  for (const id of [...Object.keys(A_FILL).map(Number), 125, 137, 164, 200]) {
    await db.query('insert into public.reading_materials (id, visibility, processed_json) values ($1, $2, $3)', [id, 'public', material(id)]);
  }
  await db.query('insert into public.reading_materials (id, visibility, processed_json) values ($1, $2, $3)', [900, 'private', material(200)]);
  return db;
}
const rows = async (db) => Object.fromEntries((await db.query('select id, raw_text, visibility, processed_json from public.reading_materials order by id')).rows.map((r) => [r.id, r]));
const dictRows = async (db) => Object.fromEntries((await db.query("select base_form, pos, reading, meanings, source from public.morpheme_dictionary where language = 'English' order by base_form")).rows.map((r) => [r.base_form, r]));
const emptyCount = async (db) => (await db.query(`select count(*)::int n from public.reading_materials m, jsonb_each(m.processed_json->'dictionary') d
  where m.visibility = 'public' and (m.processed_json->'sequence') ? d.key and d.value->>'pos' is null and coalesce(d.value->>'meaning', '') = '' and d.value->>'text' ~ '[[:alpha:]]'`)).rows[0].n;

{
  const d = await fixture();
  await check('A 미적용이면 멈춤(무변경)', async () => {
    const s = await rows(d);
    await assert.rejects(d.exec(B), /must be applied first/);
    assert.deepEqual(await rows(d), s);
  });
  await d.close();
}

const db = await fixture();
await db.exec(A);
await check('A 뒤 — 빈 뜻 25개(채울 22 + 직접 보정 3) · it\'s 토큰은 「그것은」', async () => {
  assert.equal(await emptyCount(db), 25);
  assert.equal((await rows(db))[135].processed_json.dictionary.id_1_0_135.meaning, '그것은');
});
const afterA = await rows(db), dictA = await dictRows(db);
await db.exec(B);
const afterB = await rows(db), dictB = await dictRows(db);

await check('① 사전 새 행 22개 — 원고 그대로 · user_verified · 뜻 항목 하나 · reading null · st는 넣지 않음', async () => {
  const added = Object.keys(dictB).filter((k) => !dictA[k]);
  assert.equal(added.length, 22);
  assert.equal(dictB.st, undefined);
  assert.deepEqual(dictB['i\'ve'], { base_form: 'i\'ve', pos: '대명사·조동사', reading: null, source: 'user_verified',
    meanings: [{ pos: '대명사', verify: 'ok', meaning: '나는 ~해 왔다, ~했다', en_pos_v: 1, priority: 1 }] });
  assert.equal(dictB.max.meanings[0].meaning, '맥스(이름)');
  assert.equal(dictB.pass.meanings[0].meaning, '통과하다, 지나가다');
  for (const k of added) assert.equal(dictB[k].source, 'user_verified');
});
await check('② it\'s 행은 첫 뜻만 · #135 토큰 3개도 같은 뜻 · 다른 사전 행 그대로', async () => {
  assert.deepEqual(dictB['it\'s'], { ...dictA['it\'s'], meanings: [{ ...dictA['it\'s'].meanings[0], meaning: '그것은 ~이다' }, dictA['it\'s'].meanings[1]] });
  for (const k of ['id_1_0_135', 'id_2_0_135', 'id_3_0_135']) {
    assert.deepEqual(afterB[135].processed_json.dictionary[k], { ...afterA[135].processed_json.dictionary[k], meaning: '그것은 ~이다' });
  }
  assert.deepEqual(dictB.two, dictA.two); assert.deepEqual(dictB.hot, dictA.hot);
});
await check('③ 문맥 보정 6개(th는 후리가나도 비움) — pos · 뜻 · curated, 나머지 칸 그대로', async () => {
  const want = { 125: ['접미사', '~번째(1st의 st)'], 137: ['명사', '신호등(traffic light)'], 164: ['부사', '(look forward to) 기대하다'],
    138: ['형용사', '더 더운(hot의 비교급)'], 139: ['형용사', '가장 더운(hot의 최상급)'] };
  for (const [id, [pos, meaning]] of Object.entries(want)) {
    const key = CURATED[id][0];
    assert.deepEqual(afterB[id].processed_json.dictionary[key], { ...afterA[id].processed_json.dictionary[key], pos, meaning, meaning_src: 'curated' });
  }
  assert.deepEqual(afterB[135].processed_json.dictionary[TH_KEY],
    { pos: '접미사', text: 'th', meaning: '~번째(…th의 th)', furigana: null, base_form: 'th', meaning_src: 'curated' });
});
await check('④ 남은 빈 뜻 22개를 새 행으로 채움 → 공개 영어 빈 뜻 0 · 비공개 자료 그대로', async () => {
  assert.equal(await emptyCount(db), 0);
  const t = afterB[200].processed_json.dictionary;
  assert.deepEqual(t.id_2_0_200, { ...tok('party', 'party'), pos: '명사', meaning: '파티, 모임', meaning_src: 'dictionary' });
  assert.deepEqual(t.id_2_15_200, { ...tok('passed', 'pass'), pos: '동사', meaning: '통과하다, 지나가다', meaning_src: 'dictionary' });
  assert.deepEqual(afterB[900], afterA[900]);
  for (const id of Object.keys(afterB)) {
    assert.deepEqual(afterB[id].processed_json.sequence, afterA[id].processed_json.sequence);
    assert.deepEqual(afterB[id].processed_json.metadata, afterA[id].processed_json.metadata);
    assert.equal(afterB[id].raw_text, afterA[id].raw_text);
  }
  assert.equal((await db.query('select count(*)::int n from backup_private.en_dictionary_reviewed_20261108_tokens')).rows[0].n, 31);
});
await check('재적용 — 무변경 · 지문 함수 그대로', async () => {
  await db.exec(B);
  assert.deepEqual(await rows(db), afterB);
  assert.deepEqual(await dictRows(db), dictB);
  assert.equal((await db.query('select fsrs_private.contract_hash_live() v')).rows[0].v, 'core-fp');
});
await check('복원 SQL — 토큰 · it\'s 행 · 새 행 모두 A 뒤 상태로', async () => {
  await db.exec(rollback);
  assert.deepEqual(await rows(db), afterA);
  assert.deepEqual(await dictRows(db), dictA);
});
await db.close();

{
  const d = await fixture();
  await d.exec(A);
  await d.query(`insert into public.morpheme_dictionary (base_form, language, pos, meanings, source) values ('kid', 'English', '명사', '[{"meaning":"새끼 염소"}]', 'gemini')`);
  await check('이미 있던 사전 행 — 건드리지 않고 kept로 남김(그 뜻으로 채움)', async () => {
    await d.exec(B);
    const k = (await dictRows(d)).kid;
    assert.equal(k.meanings[0].meaning, '새끼 염소'); assert.equal(k.source, 'gemini');
    assert.equal((await d.query("select action from backup_private.en_dictionary_reviewed_20261108_dict where base_form = 'kid'")).rows[0].action, 'kept');
    assert.equal(await emptyCount(d), 0);
  });
  await d.close();
}
{
  const d = new PGlite();
  await d.exec("create role anon nologin; create role authenticated nologin; create table public.reading_materials (id bigint primary key, visibility text, processed_json jsonb); create table public.morpheme_dictionary (id bigserial primary key, base_form text, language text, pos text, reading text, meanings jsonb, source text)");
  await check('공개 영어 자료가 없는 환경 — 무변경', async () => { await d.exec(B); assert.equal((await d.query('select count(*)::int n from public.morpheme_dictionary')).rows[0].n, 0); });
  await d.close();
}
{
  const d = new PGlite();
  await d.exec('create table public.reading_materials (id bigint primary key, visibility text, processed_json jsonb)');
  await check('사전 표 없는 환경 — 42P01', async () => { await assert.rejects(d.exec(B), (e) => e.code === '42P01'); });
  await d.close();
}
console.log(`en-dictionary-reviewed: ${checks} checks passed`);
