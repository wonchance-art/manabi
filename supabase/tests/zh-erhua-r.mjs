/** Local, disposable PGlite only — never connects to Supabase (ZH-ERHUA 안 A · 2026-11-11 KST).
 * 20261111040000_zh_erhua_r: 중국어 얼화 병음 백필 14토큰 · 9자료 — furigana의 儿 자리만 r(뜻 · text · raw_text 그대로).
 * 픽스처 = 운영 토큰 key · 낱말 · 옛 병음만 쓴 합성 자료(본문은 합성 — 사용자 자료 문장을 옮기지 않는다).
 * 증명: 새 값 · 뜻 · 다른 토큰 · sequence · raw_text 그대로 · 실음절 女儿 무변경 · 백업 · 재적용 무변경 · 복원 SQL(토큰 단위) ·
 *   예상 밖 값 · 손 보정(token_corrections · viewerCorrections) · 자료 없음은 그 행만 건너뜀(멈추지 않음) · 공개 수 NOTICE ·
 *   대상 없는 환경 무변경 · 표 없는 환경 42P01 · 지문 그대로.
 *   node supabase/tests/zh-erhua-r.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../migrations/20261111040000_zh_erhua_r.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/zh-erhua-r-20261111-rollback.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const T = [
  [188, 'id_1_7_1788062733607', '一点儿', 'yì diǎn ér', 'yì diǎn r'],
  [189, 'id_3_9_1788325545037', '一点儿', 'yì diǎn ér', 'yì diǎn r'],
  [189, 'id_7_17_1788325545037', '一点儿', 'yì diǎn ér', 'yì diǎn r'],
  [196, 'id_15_16_1794300050097', '画儿', 'huà ér', 'huà r'],
  [213, 'id_4_0_1788641732330', '大伙儿', 'dà huǒ ér', 'dà huǒ r'],
  [263, 'id_11_3_1791252878405', '心眼儿', 'xīn yǎn ér', 'xīn yǎn r'],
  [263, 'id_6_8_1791252878405', '一点儿', 'yì diǎn ér', 'yì diǎn r'],
  [365, 'id_3_2_1794076432866', '有点儿', 'yǒu diǎn er', 'yǒu diǎn r'],
  [365, 'id_6_5_1794076432866', '早点儿', 'zǎo diǎn ér', 'zǎo diǎn r'],
  [366, 'id_2_0_1794076437817', '那儿', 'nà ér', 'nà r'],
  [366, 'id_2_2_1794076437817', '这儿', 'zhè ér', 'zhè r'],
  [366, 'id_5_1_1794076437817', '哪儿', 'nǎ ér', 'nǎ r'],
  [367, 'id_8_10_1794076443155', '一点儿', 'yì diǎn ér', 'yì diǎn r'],
  [370, 'id_6_3_1794076460988', '一点儿', 'yì diǎn ér', 'yì diǎn r'],
];
const MIDS = [...new Set(T.map((t) => t[0]))];
const PUB = new Set([365, 366, 367, 370]);
/** 자료 하나 = 대상 토큰들 + 사이마다 합성 토큰 「好」 + (263에만) 실음절 女儿 토큰. 263은 토큰 이음 ≠ raw_text(사용자 자료 꼴). */
function material(mid) {
  const sequence = []; const dictionary = {};
  T.filter((t) => t[0] === mid).forEach(([, k, tx, oldF], i) => {
    const fill = `id_99_${i}_${mid}`; sequence.push(fill); dictionary[fill] = { pos: '형용사', text: '好', furigana: 'hǎo', meaning: '좋다', base_form: '好' };
    sequence.push(k); dictionary[k] = { pos: '명사', text: tx, furigana: oldF, meaning: `뜻${i}`, base_form: tx };
  });
  if (mid === 263) { sequence.push('id_98_0_263'); dictionary.id_98_0_263 = { pos: '명사', text: '女儿', furigana: 'nǚ ér', meaning: '딸', base_form: '女儿' }; }
  const raw = sequence.map((k) => dictionary[k].text).join('') + (mid === 263 ? '（原文多一段）' : '');
  return { raw, pj: { sequence, dictionary, metadata: { language: 'Chinese', updated_at: 'u0', viewerRevision: 'r0', viewerCorrections: {} } } };
}
async function fixture({ only = MIDS, extra = '' } = {}) {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema fsrs_private; create function fsrs_private.contract_hash_live() returns text language sql as $$ select 'core-fp' $$;
    create table public.reading_materials (id bigint primary key, title text, raw_text text, visibility text, owner_id uuid, processed_json jsonb);
    create table public.token_corrections (id serial primary key, material_id bigint, token_id text, user_id uuid, before_value jsonb, after_value jsonb, created_at timestamptz default now());
    ${extra}`);
  for (const mid of only) { const m = material(mid); await db.query('insert into public.reading_materials (id, title, raw_text, visibility, processed_json) values ($1,$2,$3,$4,$5)', [mid, 't', m.raw, PUB.has(mid) ? 'public' : 'private', m.pj]); }
  await db.query('insert into public.reading_materials (id, title, raw_text, visibility, processed_json) values ($1,$2,$3,$4,$5)', [900, 'other', '好', 'private', { sequence: [], dictionary: {}, metadata: {} }]);
  return db;
}
const rows = async (db) => Object.fromEntries((await db.query('select id, raw_text, processed_json from public.reading_materials order by id')).rows.map((r) => [Number(r.id), r]));
const furi = (r, mid, k) => r[mid].processed_json.dictionary[k].furigana;

const db = await fixture();
const before = await rows(db);
await db.exec(migration);
const after = await rows(db);
await check('14토큰 새 병음(儿 자리만 r · 一 변조 yì 그대로)', async () => { for (const [mid, k, , , nw] of T) assert.equal(furi(after, mid, k), nw, `${mid} ${k}`); });
await check('음절 수 = 글자 수(새 값)', async () => { for (const [mid, k, tx] of T) assert.equal(furi(after, mid, k).split(' ').length, [...tx].length); });
await check('뜻 · text · 다른 토큰(女儿 포함) · sequence · raw_text 그대로, metadata는 새 revision', async () => {
  for (const mid of MIDS) {
    const a = after[mid].processed_json; const b = before[mid].processed_json;
    assert.deepEqual(a.sequence, b.sequence); assert.equal(after[mid].raw_text, before[mid].raw_text);
    for (const k of Object.keys(b.dictionary)) {
      const { furigana: fa, ...ra } = a.dictionary[k]; const { furigana: fb, ...rb } = b.dictionary[k];
      assert.deepEqual(ra, rb, `${mid} ${k}`);
      if (!T.some((t) => t[1] === k)) assert.equal(fa, fb, `${mid} ${k}`);
    }
    assert.notEqual(a.metadata.viewerRevision, 'r0');
  }
  assert.equal(furi(after, 263, 'id_98_0_263'), 'nǚ ér');
  assert.deepEqual(after[900], before[900]);
});
await check('백업 9행 = 보정 전(raw_text 포함)', async () => {
  const b = (await db.query('select material_id, raw_text, processed_json from backup_private.zh_erhua_r_20261111 order by material_id')).rows;
  assert.deepEqual(b.map((r) => Number(r.material_id)), MIDS);
  for (const r of b) { assert.deepEqual(r.processed_json, before[Number(r.material_id)].processed_json); assert.equal(r.raw_text, before[Number(r.material_id)].raw_text); }
});
await check('재적용 무변경', async () => { await db.exec(migration); assert.deepEqual(await rows(db), after); });
await check('복원 SQL — 토큰 단위로 옛 병음', async () => {
  await db.exec(rollback);
  const r = await rows(db);
  for (const [mid, k, , old] of T) assert.equal(furi(r, mid, k), old);
  for (const mid of MIDS) assert.deepEqual(r[mid].processed_json.sequence, before[mid].processed_json.sequence);
});
await check('예상 밖 값 · 손 보정 · 자료 없음 → 그 행만 건너뛰고 나머지는 적용(멈추지 않음)', async () => {
  const d2 = await fixture({ only: MIDS.filter((m) => m !== 370) }); // 370 없음
  await d2.query(`update public.reading_materials set processed_json = jsonb_set(processed_json, '{dictionary,id_5_1_1794076437817,furigana}', '"nǎ er"') where id = 366`); // 예상 밖
  await d2.query(`insert into public.token_corrections (material_id, token_id) values (189, 'id_3_9_1788325545037')`); // 손 보정
  await d2.query(`update public.reading_materials set processed_json = jsonb_set(processed_json, '{metadata,viewerCorrections}', '{"id_4_0_1788641732330": {}}') where id = 213`); // 뷰어 손 보정
  await d2.exec(migration);
  const r = await rows(d2);
  assert.equal(furi(r, 366, 'id_5_1_1794076437817'), 'nǎ er');
  assert.equal(furi(r, 366, 'id_2_2_1794076437817'), 'zhè r');
  assert.equal(furi(r, 189, 'id_3_9_1788325545037'), 'yì diǎn ér');
  assert.equal(furi(r, 189, 'id_7_17_1788325545037'), 'yì diǎn r');
  assert.equal(furi(r, 213, 'id_4_0_1788641732330'), 'dà huǒ ér');
  const b = (await d2.query('select material_id from backup_private.zh_erhua_r_20261111 order by 1')).rows.map((x) => Number(x.material_id));
  assert.deepEqual(b, [188, 189, 196, 263, 365, 366, 367]);
});
await check('공개 수 NOTICE 문구가 마이그레이션에 있다(공개 7 · 비공개 7)', async () => {
  assert.match(migration, /public % of 7 tokens \(measured 2026-11-11 KST\) · private % of 7/);
  assert.equal(T.filter((t) => PUB.has(t[0])).length, 7);
  assert.equal(T.filter((t) => !PUB.has(t[0])).length, 7);
});
await check('대상 없는 환경 무변경', async () => {
  const d3 = await fixture({ only: [] });
  const pre = await rows(d3); await d3.exec(migration);
  assert.deepEqual(await rows(d3), pre);
});
await check('표 없는 환경 42P01', async () => { await assert.rejects(() => new PGlite().exec(migration), (e) => e.code === '42P01'); });
await check('학습 계약 지문 그대로', async () => { assert.equal((await db.query('select fsrs_private.contract_hash_live() v')).rows[0].v, 'core-fp'); });
console.log(`zh-erhua-r: ${checks} checks passed`);
