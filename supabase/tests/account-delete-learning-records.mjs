// Local, disposable PGlite only. This verifier never connects to Supabase.
// ACCOUNT-DELETE-001(STATS-MAP-001, 오너 승인 2026-11-01 KST): 새 일정(FSRS)으로 공부한 계정은 auth.users 삭제가
// RESTRICT 참조 · 보호 장치(fsrs_enrolled_card_protected · fsrs_legacy_event_blocked)에 막혔다.
// 운영과 같은 사슬(관측 fixture → 191500 뒤 마이그레이션 → anki-v2 → … → 20261101120000 카드 종류 2단계)에 20261101125000을 얹고
// ① 함수 없이 지우면 막힌다 ② 함수 → 계정 삭제가 끝까지 간다(남은 행 0) ③ 다른 계정은 그대로 ④ 다시 불러도 안전
// ⑤ service_role만 ⑥ 학습 계약 지문 그대로를 확인한다.   node supabase/tests/account-delete-learning-records.mjs
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { read, setup, seedEdgeActor, A, C } from './perf-snapshot-fixture.mjs';

const FILE = '20261101125000_account_delete_learning_records.sql';
const OUT_OF_FIXTURE = new Set(['42P01', '42883', '42704', '3F000']);
const h = await setup();
const { db, one } = h;
try {
  const PROFILES_VIEW = ['20261016165910_public_profiles_view.sql', '20261016170000_public_profiles_view_select_only.sql'];
  const chain = (await readdir(new URL('../migrations/', import.meta.url))).filter(f => f.slice(0, 14) > '20261016191500' && f < FILE && f.endsWith('.sql')).sort();
  let ankiV2 = false, seeded = false;
  for (const f of [...PROFILES_VIEW, ...chain]) {
    if (!ankiV2 && f >= '20261030050000') { await db.exec(h.localize(await read('../../docs/sql/fsrs-anki-v2-policy.sql'))); ankiV2 = true; }
    // 운영 순서: C의 카드는 카드 종류 2단계(120000) 이전부터 있었다 — 2단계 뒤엔 vocabulary_id가 생성 열이 아니다.
    if (!seeded && f >= '20261101120000') { await seedEdgeActor(h); seeded = true; }
    try { await db.exec(h.localize(await read(`../migrations/${f}`))); }
    catch (e) { await db.exec('ROLLBACK').catch(() => {}); assert.ok(OUT_OF_FIXTURE.has(e.code), `${f}: ${e.message}`); }
  }
  assert.ok(chain.includes('20261101090000_fsrs_cards_kind.sql'), 'chain reaches CARD-TYPES step 1 (production order)');
  if (!seeded) await seedEdgeActor(h); // C — FSRS 카드 3장 · 새 단어 영수증 1 · 아는 단어 · 제외
  assert.ok(chain.includes('20261101120000_fsrs_card_kinds.sql'), 'chain reaches CARD-TYPES stage 2 (production order)');
  const count = async (table, user) => Number((await one(`SELECT count(*)::int n FROM ${table} WHERE user_id=$1`, [user])).n);
  const pins = async () => { const { ok, core, manual, admission, profile } = await h.pins(); return { ok, core, manual, admission, profile }; };
  const before = await pins();
  assert.equal(before.ok, true, 'contracts consistent before');
  const keptA = {};
  for (const t of ['public.fsrs_cards', 'public.user_vocabulary', 'public.review_events']) keptA[t] = await count(t, A);

  await db.exec(h.localize(await read(`../migrations/${FILE}`)));
  assert.deepEqual(await pins(), before, 'learning contract fingerprints unchanged');

  // ① 함수 없이 계정을 지우면 막힌다(운영과 같은 실패).
  await assert.rejects(db.query('DELETE FROM auth.users WHERE id=$1', [C]),
    e => /fsrs_enrolled_card_protected|fsrs_legacy_event_blocked|foreign key constraint "fsrs_/.test(e.message), 'plain delete is blocked by FSRS references');
  await db.exec('ROLLBACK').catch(() => {});
  assert.equal(await count('public.fsrs_cards', C), 3, 'blocked delete left the account intact');

  // ② 함수 → 계정 삭제가 끝까지 간다.
  assert.deepEqual((await one('SELECT public.delete_account_learning_records($1) r', [C])).r, { receipts: 1, operations: 0, cards: 3 });
  await db.query('DELETE FROM auth.users WHERE id=$1', [C]);
  for (const t of ['public.fsrs_cards', 'public.fsrs_new_receipts', 'public.fsrs_operations', 'public.user_vocabulary', 'public.review_events', 'public.user_known_words']) {
    assert.equal(await count(t, C), 0, `${t} cleared for the deleted account`);
  }
  // ③ 다른 계정은 그대로.
  assert.ok(keptA['public.user_vocabulary'] > 0, 'the other account has words to keep');
  for (const [t, n] of Object.entries(keptA)) assert.equal(await count(t, A), n, `${t} kept for the other account`);
  // ④ 다시 불러도 안전.
  assert.deepEqual((await one('SELECT public.delete_account_learning_records($1) r', [C])).r, { receipts: 0, operations: 0, cards: 0 });
  // ⑤ 실행권은 service_role만.
  const priv = await one(`SELECT has_function_privilege('anon','public.delete_account_learning_records(uuid)','EXECUTE') a,
    has_function_privilege('authenticated','public.delete_account_learning_records(uuid)','EXECUTE') b`);
  assert.deepEqual({ a: priv.a, b: priv.b }, { a: false, b: false });
  // ⑥ 지문 그대로(삭제 뒤에도).
  assert.deepEqual(await pins(), before, 'learning contract fingerprints unchanged after delete');
  console.log('PASS: production chain through CARD-TYPES; FSRS account delete blocked without the function; function + delete clears 6 tables; other account intact; idempotent; service_role only; contracts unchanged.');
} catch (error) {
  console.error(error.code ?? 'ERROR', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
