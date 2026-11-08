/** Local, disposable PGlite only — never connects to Supabase (EN-SOURCE-001 ⓐ · 2026-11-09 KST).
 * 20261109010000_en_wikinews_more_categories: 영어 Wikinews 분류 3행(Culture and entertainment · Sports · Weather)을 활성으로 더한다 ·
 * 다른 행 그대로 · 재적용해도 늘지 않는다 · 이미 활성 행이 있는 분류는 넣지 않는다 · 수집기 라벨 · 표 없는 환경 42P01.
 *   node supabase/tests/en-wikinews-more-categories.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { topicSlug } from '../../src/lib/content-sources.js';

const migration = await readFile(new URL('../migrations/20261109010000_en_wikinews_more_categories.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const db = new PGlite();
await db.exec(`create table public.content_sources (id serial primary key, language text not null, source_type text not null, name text not null,
  config jsonb not null default '{}', is_active boolean not null default true, created_at timestamptz default now());
  insert into public.content_sources (language, source_type, name, config, is_active) values
    ('English','wikinews','EN · Health','{"category":"Health","level":"B2 상급"}',true),
    ('English','wikinews','EN · Sports (old, off)','{"category":"Sports","level":"B2 상급"}',false),
    ('Japanese','nhk_rss','NHK','{"feed":"cat1"}',true);`);
const rows = async () => (await db.query('select language, source_type, name, config, is_active from public.content_sources order by id')).rows;
const before = await rows();

await db.exec(migration);
const after = await rows();
await check('3행이 활성으로 더해지고 기존 행(꺼진 옛 Sports 포함)은 그대로', async () => {
  assert.deepEqual(after.slice(0, before.length), before);
  const added = after.slice(before.length);
  assert.deepEqual(added.map((r) => [r.config.category, r.is_active, r.config.level]).sort(),
    [['Culture and entertainment', true, 'B2 상급'], ['Sports', true, 'B2 상급'], ['Weather', true, 'B2 상급']]);
});
await check('재적용 — 늘지 않는다', async () => { await db.exec(migration); assert.deepEqual(await rows(), after); });
await check('수집 라벨(wikinews_en_<분류>)', async () => {
  assert.deepEqual(['Culture and entertainment', 'Sports', 'Weather'].map((c) => `wikinews_en_${topicSlug(c)}`),
    ['wikinews_en_culture_and_entertainment', 'wikinews_en_sports', 'wikinews_en_weather']);
});
await db.close();
{
  const d = new PGlite();
  await d.exec(`create table public.content_sources (id serial primary key, language text, source_type text, name text, config jsonb, is_active boolean);
    insert into public.content_sources (language, source_type, name, config, is_active) values ('English','wikinews','mine','{"category":"Weather"}',true);`);
  await check('이미 활성인 분류는 넣지 않는다(Weather 1행 유지)', async () => {
    await d.exec(migration);
    assert.equal((await d.query("select count(*)::int n from public.content_sources where config->>'category' = 'Weather'")).rows[0].n, 1);
    assert.equal((await d.query('select count(*)::int n from public.content_sources')).rows[0].n, 3);
  });
  await d.close();
}
{
  const d = new PGlite();
  await check('표 없는 환경 — 42P01', async () => { await assert.rejects(d.exec(migration), (e) => e.code === '42P01'); });
  await d.close();
}
console.log(`en-wikinews-more-categories: ${checks} checks passed`);
