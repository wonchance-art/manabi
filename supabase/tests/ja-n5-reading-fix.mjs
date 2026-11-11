/** Local, disposable PGlite only — never connects to Supabase (JA-KANJI-A-001 후속 · 2026-11-11 KST).
 * 20261111020000_ja_n5_reading_fix: 공개 N5 시드 읽기 보정 2건(id 61 머리 時 じ · id 62 3個 さんこ) — furigana · meaning만.
 * 픽스처 = 운영 토큰 key · text · 옛 값(11/11 읽기 전용 실측)을 그대로 쓴 두 자료 + 대상 밖 자료 1.
 * 증명: 새 값 · 다른 토큰 그대로 · raw_text · sequence 그대로 · 백업 2행 · 재적용 무변경 · 복원 SQL · 예상 밖 값이면 멈춤 ·
 *   대상 없는 환경 무변경 · 표 없는 환경 42P01 · 지문 그대로.
 *   node supabase/tests/ja-n5-reading-fix.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../migrations/20261111020000_ja_n5_reading_fix.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/ja-reading-fix-20261111-rollback.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const tokens = (sfx, lines) => {
  const sequence = []; const dictionary = {};
  lines.forEach((toks, L) => {
    toks.forEach(([C, text, furigana, meaning, base_form = text]) => {
      const key = `id_${L}_${C}_${sfx}`; sequence.push(key);
      dictionary[key] = { pos: /^[\s()—]+$/.test(text) ? '기호' : '명사', text, furigana, meaning, base_form };
    });
    if (L < lines.length - 1) { const br = `br_${L}_${sfx}`; sequence.push(br); dictionary[br] = { pos: '개행', text: '\n' }; }
  });
  return { sequence, dictionary };
};
const M = {
  61: { raw: '오늘 만나는 한자\n時 (じ) — 시', pj: tokens('1793989842149', [
    [[0, '오늘 만나는 한자', null, '']],
    [[0, '時', 'とき', '때'], [1, ' ', null, ''], [2, '(', null, ''], [3, 'じ', null, '~시', '時'], [4, ')', null, ''], [5, ' ', null, ''], [6, '—', null, ''], [7, ' 시', null, '']],
  ]) },
  62: { raw: 'りんごを 3個 ください', pj: tokens('1793989845047', [[], [], [], [], [], [], [[0, 'りんごを', null, '사과를'], [1, ' ', null, ''], [3, '3個', 'みっつこ', '3개'], [4, ' ', null, ''], [5, 'ください', null, '주세요']]]) },
};
M[62].raw = '\n\n\n\n\n\nりんごを 3個 ください';
for (const m of Object.values(M)) m.pj.metadata = { language: 'Japanese', level: 'N5 기초', updated_at: 'u0', viewerRevision: 'r0' };

async function fixture({ only = null } = {}) {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema fsrs_private; create function fsrs_private.contract_hash_live() returns text language sql as $$ select 'core-fp' $$;
    create table public.reading_materials (id bigint primary key, title text, raw_text text, visibility text, owner_id uuid, processed_json jsonb);`);
  for (const [id, m] of Object.entries(M)) {
    if (only && !only.includes(Number(id))) continue;
    await db.query('insert into public.reading_materials (id, title, raw_text, visibility, processed_json) values ($1,$2,$3,$4,$5)', [Number(id), 't' + id, m.raw, 'public', m.pj]);
  }
  await db.query('insert into public.reading_materials (id, title, raw_text, visibility, processed_json) values ($1,$2,$3,$4,$5)', [900, 'other', 'x', 'public', { metadata: { language: 'Japanese' }, sequence: [], dictionary: {} }]);
  return db;
}
const rows = async (db) => Object.fromEntries((await db.query('select id, raw_text, processed_json from public.reading_materials order by id')).rows.map((r) => [r.id, r]));
const K61 = 'id_1_0_1793989842149'; const K62 = 'id_6_3_1793989845047';
const joined = (r) => r.processed_json.sequence.map((k) => (k.startsWith('br_') ? '\n' : r.processed_json.dictionary[k].text)).join('');

const db = await fixture();
const before = await rows(db);
await check('픽스처 — 토큰 이음 = 원문', async () => { for (const id of [61, 62]) assert.equal(joined(before[id]), before[id].raw_text); });
await db.exec(migration);
const after = await rows(db);
await check('① 61 머리 時: furigana じ · meaning 시', async () => {
  assert.equal(after[61].processed_json.dictionary[K61].furigana, 'じ');
  assert.equal(after[61].processed_json.dictionary[K61].meaning, '시');
  assert.equal(after[61].processed_json.dictionary[K61].text, '時');
});
await check('② 62 3個: furigana さんこ · meaning 그대로', async () => {
  assert.equal(after[62].processed_json.dictionary[K62].furigana, 'さんこ');
  assert.equal(after[62].processed_json.dictionary[K62].meaning, '3개');
});
await check('다른 토큰 · sequence · raw_text 그대로, metadata만 새 revision', async () => {
  for (const id of [61, 62]) {
    const a = after[id].processed_json; const b = before[id].processed_json;
    assert.deepEqual(a.sequence, b.sequence);
    assert.equal(after[id].raw_text, before[id].raw_text);
    for (const k of Object.keys(b.dictionary)) if (k !== K61 && k !== K62) assert.deepEqual(a.dictionary[k], b.dictionary[k]);
    assert.notEqual(a.metadata.viewerRevision, 'r0');
    assert.notEqual(a.metadata.updated_at, 'u0');
    assert.equal(a.metadata.level, 'N5 기초');
  }
  assert.deepEqual(after[900], before[900]);
});
await check('백업 2행 = 보정 전 processed_json', async () => {
  const b = (await db.query('select material_id, processed_json from backup_private.ja_reading_fix_20261111 order by material_id')).rows;
  assert.deepEqual(b.map((r) => Number(r.material_id)), [61, 62]);
  assert.deepEqual(b[0].processed_json, before[61].processed_json);
  assert.deepEqual(b[1].processed_json, before[62].processed_json);
});
await check('재적용 무변경', async () => {
  await db.exec(migration);
  assert.deepEqual(await rows(db), after);
});
await check('복원 SQL — 보정 전과 같다', async () => {
  await db.exec(rollback);
  const r = await rows(db);
  for (const id of [61, 62, 900]) assert.deepEqual(r[id], before[id]);
});
await check('예상 밖 값이면 멈춤(변경 없음)', async () => {
  const d2 = await fixture();
  await d2.query(`update public.reading_materials set processed_json = jsonb_set(processed_json, '{dictionary,${K62},furigana}', '"さんこう"') where id = 62`);
  const pre = await rows(d2);
  await assert.rejects(() => d2.exec(migration), /ja reading fix: 62/);
  assert.deepEqual(await rows(d2), pre);
});
await check('대상 없는 환경 무변경', async () => {
  const d3 = await fixture({ only: [] });
  const pre = await rows(d3);
  await d3.exec(migration);
  assert.deepEqual(await rows(d3), pre);
  assert.equal(Number((await d3.query('select count(*) n from backup_private.ja_reading_fix_20261111')).rows[0].n), 0);
});
await check('표 없는 환경 42P01', async () => {
  const d4 = new PGlite();
  await assert.rejects(() => d4.exec(migration), (e) => e.code === '42P01');
});
await check('학습 계약 지문 그대로', async () => {
  assert.equal((await db.query('select fsrs_private.contract_hash_live() v')).rows[0].v, 'core-fp');
});
console.log(`ja-n5-reading-fix: ${checks} checks passed`);
