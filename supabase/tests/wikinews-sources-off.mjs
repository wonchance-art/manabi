/** Local, disposable PGlite only — never connects to Supabase (2026-11-12 KST).
 * 20261112020000_wikinews_sources_off: 영어 Wikinews 6행 끔 · 프랑스어는 기본값과 같은 5행을 넣고 wikinews_fr 3개만 끔.
 * 증명: 영어 6행 꺼짐(이미 꺼진 옛 3행 · 다른 영어 원천 그대로) · 프랑스어 이번 실행 편성 = 기본값에서 wikinews_fr만 뺀 것(resolveActiveSources) ·
 *   재적용 무변경 · 프랑스어 행이 이미 있으면 넣지 않음 · 복원 SQL(영어 다시 켬 · 프랑스어 기본값 복귀) · 표 없는 환경 42P01.
 *   node supabase/tests/wikinews-sources-off.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { DEFAULT_SOURCES, resolveActiveSources } from '../../src/lib/suggestionSources.js';

const migration = await readFile(new URL('../migrations/20261112020000_wikinews_sources_off.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/wikinews-sources-off-20261112-rollback.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const EN_ON = [
  ['ae0516b0-9e37-4149-a19d-9022edbbcae2', 'Culture and entertainment'], ['852be6ac-6a85-441d-a14a-826eff3bf926', 'Environment'],
  ['9845fc32-367e-4a87-b72a-7e2f4241961b', 'Health'], ['5f1f0bb1-a3a1-456d-8f81-9355849cb9a6', 'Science and technology'],
  ['55874ea2-c256-4758-926c-7b0263869438', 'Sports'], ['8e82889f-2e5b-4218-b4e9-cae61b830dc4', 'Weather'],
];
async function fixture({ french = false } = {}) {
  const db = new PGlite();
  await db.exec(`create table public.content_sources (id uuid default gen_random_uuid() primary key, language text not null, source_type text not null,
    name text not null, config jsonb not null default '{}', is_active boolean not null default true, created_at timestamptz default now());`);
  for (const [id, cat] of EN_ON) await db.query('insert into public.content_sources (id, language, source_type, name, config, is_active) values ($1,$2,$3,$4,$5,true)', [id, 'English', 'wikinews', `English Wikinews · ${cat}`, { category: cat, level: 'B2 상급' }]);
  await db.query("insert into public.content_sources (language, source_type, name, config, is_active) values ('English', 'wikinews', 'English Wikinews · Health', '{\"category\":\"Health\"}', false), ('English', 'youtube_channel', 'YouTube · VOA Learning English', '{\"handle\":\"@VOALearningEnglish\"}', true), ('Japanese', 'nhk_rss', 'NHK', '{}', true)");
  if (french) await db.query("insert into public.content_sources (language, source_type, name, config, is_active) values ('French', 'youtube_cc', 'mine', '{\"query\":\"x\"}', true)");
  return db;
}
const all = async (db) => (await db.query('select id, language, source_type, name, config, is_active from public.content_sources order by language, source_type, name')).rows;
const key = (s) => `${s.language}|${s.source_type}|${JSON.stringify(Object.fromEntries(Object.entries(s.config).sort()))}`;

const db = await fixture();
const before = await all(db);
await db.exec(migration);
const after = await all(db);
await check('영어 Wikinews 6행 꺼짐 · 옛 꺼진 행 · 영어 영상 · 일본어 그대로', async () => {
  for (const [id] of EN_ON) assert.equal(after.find((r) => r.id === id).is_active, false);
  const others = (rows) => rows.filter((r) => !EN_ON.some(([id]) => id === r.id) && r.language !== 'French');
  assert.deepEqual(others(after), others(before));
});
await check('프랑스어 이번 실행 편성 = 기본값 − wikinews_fr(설정 그대로), 영어에 Wikinews 없음', async () => {
  const active = resolveActiveSources(after);
  const fr = active.filter((s) => s.language === 'French').map(key).sort();
  const want = DEFAULT_SOURCES.filter((s) => s.language === 'French' && s.source_type !== 'wikinews_fr').map(key).sort();
  assert.deepEqual(fr, want);
  assert.equal(after.filter((r) => r.language === 'French').length, 5);
  // 넣은 wikinews_fr 3행의 설정도 기본값과 같다(복원 · 재활성 때 같은 원천)
  const frWiki = after.filter((r) => r.language === 'French' && r.source_type === 'wikinews_fr').map(key).sort();
  assert.deepEqual(frWiki, DEFAULT_SOURCES.filter((s) => s.language === 'French' && s.source_type === 'wikinews_fr').map(key).sort());
  assert.equal(active.some((s) => /^wikinews/.test(s.source_type)), false);
});
await check('재적용 무변경', async () => {
  await db.exec(migration);
  assert.deepEqual((await all(db)).map(({ id, ...r }) => r), after.map(({ id, ...r }) => r));
});
await check('복원 SQL — 영어 6행 다시 켬 · 프랑스어 5행 지움(기본값 복귀)', async () => {
  await db.exec(rollback);
  const r = await all(db);
  for (const [id] of EN_ON) assert.equal(r.find((x) => x.id === id).is_active, true);
  assert.equal(r.filter((x) => x.language === 'French').length, 0);
  const fr = resolveActiveSources(r).filter((s) => s.language === 'French').map(key).sort();
  assert.deepEqual(fr, DEFAULT_SOURCES.filter((s) => s.language === 'French').map(key).sort());
});
await check('프랑스어 행이 이미 있으면 넣지 않는다(의도된 설정을 덮지 않음)', async () => {
  const d2 = await fixture({ french: true });
  await d2.exec(migration);
  const fr = (await all(d2)).filter((r) => r.language === 'French');
  assert.equal(fr.length, 1); assert.equal(fr[0].name, 'mine');
});
await check('표 없는 환경 42P01', async () => { await assert.rejects(() => new PGlite().exec(migration), (e) => e.code === '42P01'); });
console.log(`wikinews-sources-off: ${checks} checks passed`);
