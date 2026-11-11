/** Local, disposable PGlite only — never connects to Supabase (ZH-PINYIN-CHECK 2차 · 2026-11-11 KST).
 * 20261111030000_zh_pinyin_user_fix: 사용자 자료 중국어 병음 보정 7토큰 · 4자료 — furigana, 372 为 두 토큰은 뜻도.
 * 픽스처 = 운영 토큰 key · 낱말 · 옛 병음만 쓴 합성 자료(본문은 합성 — 사용자 자료 문장을 옮기지 않는다).
 * 증명: 새 값 · 다른 토큰 · sequence · raw_text 그대로 · 백업 · 재적용 무변경 · 복원 SQL(토큰 단위) ·
 *   예상 밖 값 · 손 보정(token_corrections · viewerCorrections) · 자료 없음은 그 행만 건너뜀(멈추지 않음) ·
 *   대상 없는 환경 무변경 · 표 없는 환경 42P01 · 지문 그대로.
 *   node supabase/tests/zh-pinyin-user-fix.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../migrations/20261111030000_zh_pinyin_user_fix.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/zh-pinyin-fix-20261111-rollback.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const MN = { id_5_46_1794377282275: ['~를 위하여', '~(으)로'], id_21_18_1794377282275: ['~를 위하여', '~(이)라고'] };
const T = [
  [261, 'id_6_3_1790833758210', '数着', 'shù zhuó', 'shǔ zhe'],
  [263, 'id_6_5_1791252878405', '打着', 'dǎ zhuó', 'dǎ zhe'],
  [263, 'id_16_9_1791252878405', '泽地', 'zé de', 'zé dì'],
  [284, 'id_3_215_1791836771641', '力量', 'lì liáng', 'lì liàng'],
  [372, 'id_5_46_1794377282275', '为', 'wèi', 'wéi'],
  [372, 'id_21_18_1794377282275', '为', 'wèi', 'wéi'],
  [372, 'id_21_27_1794377282275', '认为', 'rèn wèi', 'rèn wéi'],
];
/** 자료 하나 = 대상 토큰들 + 사이마다 합성 토큰 「好」 한 개. raw_text = 토큰 이음. */
function material(mid) {
  const rows = T.filter((t) => t[0] === mid);
  const sequence = []; const dictionary = {};
  rows.forEach(([, k, tx, oldF], i) => {
    const fill = `id_99_${i}_${mid}`; sequence.push(fill); dictionary[fill] = { pos: '형용사', text: '好', furigana: 'hǎo', meaning: '좋다', base_form: '好' };
    sequence.push(k); dictionary[k] = { pos: '동사', text: tx, furigana: oldF, meaning: MN[k]?.[0] ?? 'm', base_form: tx };
  });
  // 284는 운영처럼 「토큰 이음 ≠ raw_text」(사용자 자료는 원래 다를 수 있다 — 2026-11-11 KST 운영 실측). 사후 검사가 이것으로 막히면 안 된다.
  const raw = sequence.map((k) => dictionary[k].text).join('') + (mid === 284 ? '（原文多一段）' : '');
  return { raw, pj: { sequence, dictionary, metadata: { language: 'Chinese', updated_at: 'u0', viewerRevision: 'r0', viewerCorrections: {} } } };
}
async function fixture({ only = [261, 263, 284, 372], extra = '' } = {}) {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema fsrs_private; create function fsrs_private.contract_hash_live() returns text language sql as $$ select 'core-fp' $$;
    create table public.reading_materials (id bigint primary key, title text, raw_text text, visibility text, owner_id uuid, processed_json jsonb);
    create table public.token_corrections (id serial primary key, material_id bigint, token_id text, user_id uuid, before_value jsonb, after_value jsonb, created_at timestamptz default now());
    ${extra}`);
  for (const mid of only) { const m = material(mid); await db.query('insert into public.reading_materials (id, title, raw_text, visibility, processed_json) values ($1,$2,$3,$4,$5)', [mid, 't', m.raw, 'private', m.pj]); }
  await db.query('insert into public.reading_materials (id, title, raw_text, visibility, processed_json) values ($1,$2,$3,$4,$5)', [900, 'other', '好', 'private', { sequence: [], dictionary: {}, metadata: {} }]);
  return db;
}
const rows = async (db) => Object.fromEntries((await db.query('select id, raw_text, processed_json from public.reading_materials order by id')).rows.map((r) => [Number(r.id), r]));
const furi = (r, mid, k) => r[mid].processed_json.dictionary[k].furigana;
const mean = (r, mid, k) => r[mid].processed_json.dictionary[k].meaning;

const db = await fixture();
const before = await rows(db);
await db.exec(migration);
const after = await rows(db);
await check('픽스처 — 284는 토큰 이음 ≠ raw_text(운영과 같은 조건)', async () => {
  const j = (r) => r.processed_json.sequence.map((k) => r.processed_json.dictionary[k].text).join('');
  assert.notEqual(j(before[284]), before[284].raw_text);
  assert.equal(j(before[261]), before[261].raw_text);
});
await check('7토큰 새 병음', async () => { for (const [mid, k, , , nw] of T) assert.equal(furi(after, mid, k), nw, `${mid} ${k}`); });
await check('372 为 두 토큰은 뜻도 새 뜻, 나머지 5토큰 뜻은 그대로', async () => {
  for (const [mid, k] of T) assert.equal(mean(after, mid, k), MN[k] ? MN[k][1] : 'm', `${mid} ${k}`);
});
await check('다른 토큰 · sequence · raw_text 그대로, metadata는 새 revision', async () => {
  for (const mid of [261, 263, 284, 372]) {
    const a = after[mid].processed_json; const b = before[mid].processed_json;
    assert.deepEqual(a.sequence, b.sequence); assert.equal(after[mid].raw_text, before[mid].raw_text);
    for (const k of Object.keys(b.dictionary)) if (!T.some((t) => t[1] === k)) assert.deepEqual(a.dictionary[k], b.dictionary[k]);
    for (const k of Object.keys(b.dictionary)) { assert.equal(a.dictionary[k].text, b.dictionary[k].text); if (!MN[k]) assert.equal(a.dictionary[k].meaning, b.dictionary[k].meaning); }
    assert.notEqual(a.metadata.viewerRevision, 'r0');
  }
  assert.deepEqual(after[900], before[900]);
});
await check('백업 4행 = 보정 전', async () => {
  const b = (await db.query('select material_id, processed_json from backup_private.zh_pinyin_fix_20261111 order by material_id')).rows;
  assert.deepEqual(b.map((r) => Number(r.material_id)), [261, 263, 284, 372]);
  for (const r of b) assert.deepEqual(r.processed_json, before[Number(r.material_id)].processed_json);
});
await check('재적용 무변경', async () => { await db.exec(migration); assert.deepEqual(await rows(db), after); });
await check('복원 SQL — 토큰 단위로 옛 병음 · 옛 뜻', async () => {
  await db.exec(rollback);
  const r = await rows(db);
  for (const [mid, k, , old] of T) { assert.equal(furi(r, mid, k), old); assert.equal(mean(r, mid, k), MN[k] ? MN[k][0] : 'm'); }
  for (const mid of [261, 263, 284, 372]) assert.deepEqual(r[mid].processed_json.sequence, before[mid].processed_json.sequence);
});
await check('예상 밖 값 · 손 보정 · 자료 없음 → 그 행만 건너뛰고 나머지는 적용(멈추지 않음)', async () => {
  const d2 = await fixture({ only: [261, 263, 284] }); // 372 없음
  await d2.query(`update public.reading_materials set processed_json = jsonb_set(processed_json, '{dictionary,id_6_3_1790833758210,furigana}', '"shǔ zhuó"') where id = 261`); // 예상 밖
  await d2.query(`insert into public.token_corrections (material_id, token_id) values (263, 'id_6_5_1791252878405')`); // 손 보정
  await d2.query(`update public.reading_materials set processed_json = jsonb_set(processed_json, '{metadata,viewerCorrections}', '{"id_3_215_1791836771641": {}}') where id = 284`); // 뷰어 손 보정
  await d2.exec(migration);
  const r = await rows(d2);
  assert.equal(furi(r, 261, 'id_6_3_1790833758210'), 'shǔ zhuó');
  assert.equal(furi(r, 263, 'id_6_5_1791252878405'), 'dǎ zhuó');
  assert.equal(furi(r, 263, 'id_16_9_1791252878405'), 'zé dì');
  assert.equal(furi(r, 284, 'id_3_215_1791836771641'), 'lì liáng');
  const b = (await d2.query('select material_id from backup_private.zh_pinyin_fix_20261111 order by 1')).rows.map((x) => Number(x.material_id));
  assert.deepEqual(b, [263]);
});
await check('뜻이 이미 다르면(손 보정 등) 병음만 고치고 뜻은 그대로', async () => {
  const d4 = await fixture({ only: [372] });
  await d4.query(`update public.reading_materials set processed_json = jsonb_set(processed_json, '{dictionary,id_5_46_1794377282275,meaning}', '"~로서"') where id = 372`);
  await d4.exec(migration);
  const r = await rows(d4);
  assert.equal(furi(r, 372, 'id_5_46_1794377282275'), 'wéi');
  assert.equal(mean(r, 372, 'id_5_46_1794377282275'), '~로서');
  assert.equal(mean(r, 372, 'id_21_18_1794377282275'), '~(이)라고');
});
await check('대상 없는 환경 무변경', async () => {
  const d3 = await fixture({ only: [] });
  const pre = await rows(d3); await d3.exec(migration);
  assert.deepEqual(await rows(d3), pre);
});
await check('표 없는 환경 42P01', async () => { await assert.rejects(() => new PGlite().exec(migration), (e) => e.code === '42P01'); });
await check('학습 계약 지문 그대로', async () => { assert.equal((await db.query('select fsrs_private.contract_hash_live() v')).rows[0].v, 'core-fp'); });
console.log(`zh-pinyin-user-fix: ${checks} checks passed`);
