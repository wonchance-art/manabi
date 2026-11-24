/** Local, disposable PGlite only — never connects to Supabase (LIB-FIX-001 · 2026-11-24 KST).
 * 20261124010000_library_level_sort_rank: 서재 급수순 = 학습 순서(LEVELS · levelRank), 급수 없음은 맨 끝, 다른 정렬 불변.
 * 옛 함수 본문은 원본 마이그레이션(20260930135103)에서 그대로 잘라 세운다. managed_rows는 고정 항목을 돌려주는 대역이다.
 * 증명: ① 순위 함수 = levelRank(LEVELS 전부 · 목록 밖 · 언어 모름) ② 급수순 결과 순서 ③ 없는 급수 끝 ④ 다른 정렬(기본 · 제목 · 최근 연 순)
 *   적용 전후 같음 ⑤ 사전 검사(본문이 바뀌었으면 멈춤) ⑥ 재적용 ⑦ 복원 SQL ⑧ anon 실행권 없음 · authenticated 실행권 그대로 ⑨ 표 없는 환경.
 *   node supabase/tests/library-level-sort-rank.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { LEVELS, levelRank } from '../../src/lib/constants.js';

const migration = await readFile(new URL('../migrations/20261124010000_library_level_sort_rank.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/library-level-sort-rank-20261124-rollback.sql', import.meta.url), 'utf8');
const original = await readFile(new URL('../migrations/20260930135103_personal_library_management.sql', import.meta.url), 'utf8');
const oldPage = original.slice(original.indexOf('create function public.personal_library_page_v2'), original.indexOf('-- The selection is frozen at click time.'));
assert.match(oldPage, /then item->>'level' end,/);
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const ITEMS = [
  ['a', 'Japanese', 'N1 심화', '2026-01-05'], ['b', 'Japanese', 'N5 기초', '2026-01-04'], ['c', 'Japanese', 'N3 중급', '2026-01-03'],
  ['d', 'Chinese', 'H5 고급', '2026-01-06'], ['e', 'Chinese', 'OT 입문', '2026-01-02'], ['f', 'English', 'B1 중급', '2026-01-07'],
  ['g', 'English', 'A1 기초', '2026-01-01'], ['h', 'Japanese', null, '2026-01-08'], ['i', 'Korean', '', '2026-01-09'],
  ['j', 'English', 'Z9 모름', '2026-01-10'], ['k', 'Japanese', 'N5 기초', '2026-01-11'], ['l', 'French', 'A0 입문', '2026-01-12'],
];
async function fixture({ withFn = true } = {}) {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema fsrs_private; create function fsrs_private.contract_hash_live() returns text language sql as $$ select 'core-fp' $$;
    create schema library_private;
    create table library_private.fixture_items (item jsonb not null);
    create function library_private.managed_rows(p_filters jsonb) returns setof jsonb language sql stable as $$ select item from library_private.fixture_items $$;`);
  for (const [id, language, level, created] of ITEMS) {
    await db.query('insert into library_private.fixture_items values ($1)', [{ target_kind: 'material', target_id: id, title: `t-${id}`, language, level, created_at: created, opened_at: id < 'e' ? `2026-02-0${id.charCodeAt(0) - 96}` : null, children: [] }]);
  }
  if (withFn) {
    await db.exec(oldPage);
    await db.exec(`grant usage on schema library_private to authenticated;
      revoke all on function public.personal_library_page_v2(jsonb,integer,integer) from public, anon;
      grant execute on function public.personal_library_page_v2(jsonb,integer,integer) to authenticated;`);
  }
  return db;
}
const page = async (db, sort) => (await db.query("select public.personal_library_page_v2($1::jsonb, 0, 100) v", [sort ? { sort } : {}])).rows[0].v.items.map((i) => i.target_id);

const db = await fixture();
const before = { level: await page(db, 'level'), title: await page(db, 'title'), opened: await page(db, 'opened'), none: await page(db, null) };
await check('적용 전 — 급수순이 글자순(재현): 「N1 심화」가 「N5 기초」 앞', async () => {
  assert.ok(before.level.indexOf('a') < before.level.indexOf('b'));
});
await db.exec(migration);
await check('① 순위 함수 = levelRank — LEVELS 전부 · 목록 밖 · 언어 모름', async () => {
  for (const [language, list] of Object.entries(LEVELS)) {
    for (const level of [...list, '', 'N9', 'H7 x', null]) {
      const got = (await db.query('select library_private.material_level_rank($1, $2) r', [language, level])).rows[0].r;
      assert.equal(got, levelRank(language, level), `${language} ${level}`);
    }
  }
  assert.equal((await db.query("select library_private.material_level_rank('Korean', 'N5 기초') r")).rows[0].r, null);
  assert.equal((await db.query("select library_private.material_level_rank(null, 'N5 기초') r")).rows[0].r, null);
});
await check('② 급수순 = 학습 순서(같은 순위는 만든 날 최신부터) ③ 급수 없음 · 목록 밖은 맨 끝', async () => {
  // 순위: e(OT 0) · g(A1 0) · l(A0 0) · b,k(N5 0) → 만든 날 최신순, 다음 순위 1 …, 끝에 h · i · j(null)
  const got = await page(db, 'level');
  const rank = (id) => { const [, language, level] = ITEMS.find((x) => x[0] === id); return levelRank(language, level); };
  const ranks = got.map(rank);
  const firstNull = ranks.indexOf(null);
  assert.deepEqual(ranks.slice(0, firstNull), [...ranks.slice(0, firstNull)].sort((x, y) => x - y));
  assert.deepEqual(got.slice(firstNull).sort(), ['h', 'i', 'j']);
  assert.ok(ranks.slice(firstNull).every((r) => r === null));
  assert.ok(got.indexOf('b') < got.indexOf('c') && got.indexOf('c') < got.indexOf('a'), 'N5 < N3 < N1');
  assert.ok(got.indexOf('k') < got.indexOf('b'), '같은 순위는 만든 날 최신부터(k 01-11 > b 01-04)');
});
await check('④ 다른 정렬(기본 · 제목 · 최근 연 순) 적용 전후 같음', async () => {
  assert.deepEqual(await page(db, 'title'), before.title);
  assert.deepEqual(await page(db, 'opened'), before.opened);
  assert.deepEqual(await page(db, null), before.none);
});
await check('⑧ 실행권 — authenticated는 페이지 함수 그대로 · anon은 순위 함수 없음', async () => {
  const r = (await db.query(`select has_function_privilege('authenticated', 'public.personal_library_page_v2(jsonb,integer,integer)', 'EXECUTE') a,
    has_function_privilege('anon', 'library_private.material_level_rank(text,text)', 'EXECUTE') b,
    has_function_privilege('authenticated', 'library_private.material_level_rank(text,text)', 'EXECUTE') c`)).rows[0];
  assert.deepEqual([r.a, r.b, r.c], [true, false, true]);
});
await check('⑥ 재적용 — 사전 검사가 이미 바뀐 본문을 보고 멈춘다(덮어쓰지 않음)', async () => {
  await assert.rejects(() => db.exec(migration), /changed since 20260930135103/);
  assert.deepEqual(await page(db, 'level'), await page(db, 'level'));
});
await check('⑦ 복원 SQL — 옛 글자순으로 · 순위 함수 삭제', async () => {
  await db.exec(rollback);
  assert.deepEqual(await page(db, 'level'), before.level);
  assert.equal((await db.query("select to_regprocedure('library_private.material_level_rank(text,text)') r")).rows[0].r, null);
});
await check('⑤ 사전 검사 — 본문이 바뀐 환경은 멈춘다', async () => {
  const d2 = await fixture();
  await d2.exec(`create or replace function public.personal_library_page_v2(p_filters jsonb default '{}',p_offset integer default 0,p_limit integer default 20) returns jsonb language sql stable as $$ select '{}'::jsonb $$;`);
  await assert.rejects(() => d2.exec(migration), /changed since/);
});
await check('⑨ 함수 없는 환경 — 42883', async () => {
  const d3 = await fixture({ withFn: false });
  await assert.rejects(() => d3.exec(migration), (e) => e.code === '42883');
});
await check('학습 계약 지문 그대로', async () => { assert.equal((await db.query('select fsrs_private.contract_hash_live() v')).rows[0].v, 'core-fp'); });
console.log(`library-level-sort-rank: ${checks} checks passed`);
