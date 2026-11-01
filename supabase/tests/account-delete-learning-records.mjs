// Local, disposable PGlite only. This verifier never connects to Supabase.
// ACCOUNT-DELETE-001(STATS-MAP-001, 오너 승인 2026-11-01 KST): 새 일정(FSRS)으로 공부한 계정은 auth.users 삭제가
// RESTRICT 참조 · 보호 장치(fsrs_enrolled_card_protected · fsrs_legacy_event_blocked)에 막혔다. 운영 정의(M09 fixture) 위에
// 20261101090000 마이그레이션을 얹고 ① 함수 없이 지우면 막힌다 ② 함수 → 계정 삭제가 끝까지 간다(남은 행 0)
// ③ 다른 계정은 그대로 ④ 다시 불러도 안전 ⑤ 학습 계약 지문 그대로를 확인한다.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { introduceFsrsCard } from '../../src/lib/fsrsScheduler.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const originalTest = await read('./korean-learning-support.mjs');
const marker = 'const modernFixtureSql = ';
const start = originalTest.indexOf(marker) + marker.length;
const end = originalTest.indexOf('\n`;', start);
assert.ok(start >= marker.length && end > start, 'modern fixture source boundary');
const modern = runInNewContext(originalTest.slice(start, end + 2), Object.create(null), { timeout: 1000 });
const fixture = await read('./fixtures/m09-learning-contracts-20261010.sql');
const migration = await read('../migrations/20261101090000_account_delete_learning_records.sql');

const db = new PGlite();
const leaving = '00000000-0000-4000-8000-0000000000a1'; // Synthetic local actors.
const staying = '00000000-0000-4000-8000-0000000000b2';
const cardOf = { [leaving]: '00000000-0000-4000-8000-0000000000c1', [staying]: '00000000-0000-4000-8000-0000000000c2' };
const count = async (table, user) => Number((await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE user_id=$1`, [user])).rows[0].n);
const hashes = async () => (await db.query(`SELECT fsrs_private.contract_hash() a, fsrs_private.manual_contract_hash() b,
  fsrs_private.admission_contract_hash() c, fsrs_private.activity_profile_hash() d`)).rows[0];
try {
  await db.exec(modern);
  await db.exec(await read('../../docs/sql/korean-learning-support.sql'));
  await db.exec(fixture);
  for (const user of [leaving, staying]) {
    await db.query('INSERT INTO auth.users(id) VALUES ($1)', [user]);
    await db.query('INSERT INTO public.profiles(id) VALUES ($1)', [user]);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.query(`INSERT INTO public.user_vocabulary(id,user_id,word_text,base_form,meaning,language,interval,ease_factor,repetitions)
      VALUES ($1,$2,'早餐','早餐','아침','Chinese',0,0,0)`, [cardOf[user], user]);
    // 카드보다 먼저 남긴 예전 일정 기록 — 카드가 생기면 이 기록을 지우는 것도 보호 장치가 막는다.
    await db.query(`INSERT INTO public.review_events(user_id,lang,source,item_key,correct,detail) VALUES ($1,'Chinese','vocab','早餐',true,$2)`,
      [user, { word_id: cardOf[user], rating: 3 }]);
    // 입학 허가 장치는 이 시험의 대상이 아니다 — FSRS 행만 장치를 끄고 심은 뒤(perf-snapshot-fixture 선례) 바로 되돌린다.
    await db.exec('SET session_replication_role = replica');
    await db.query('INSERT INTO public.fsrs_cards(card_id,user_id,card) VALUES ($1,$2,$3)', [cardOf[user], user, introduceFsrsCard(new Date().toISOString())]);
    await db.query(`INSERT INTO public.fsrs_new_receipts(card_id,user_id,operation_id,learning_day,question_at) VALUES ($1,$2,'op-1',current_date,now())`, [cardOf[user], user]);
    await db.query(`INSERT INTO public.fsrs_operations(user_id,id,card_id,kind,operation,result) VALUES ($1,'op-1',$2,'grade','{}','{}')`, [user, cardOf[user]]);
    await db.exec('RESET session_replication_role');
  }
  const before = await hashes();
  await db.exec(migration);
  assert.deepEqual(await hashes(), before, 'learning contract fingerprints unchanged');

  // ① 함수 없이 계정을 지우면 막힌다(운영과 같은 실패).
  await assert.rejects(db.query('DELETE FROM auth.users WHERE id=$1', [leaving]),
    error => /fsrs_enrolled_card_protected|fsrs_legacy_event_blocked|foreign key constraint "fsrs_/.test(error.message), 'plain delete is blocked by FSRS references');

  // ② 함수 → 계정 삭제가 끝까지 간다.
  const removed = (await db.query('SELECT public.delete_account_learning_records($1) AS r', [leaving])).rows[0].r;
  assert.deepEqual(removed, { receipts: 1, operations: 1, cards: 1 });
  await db.query('DELETE FROM auth.users WHERE id=$1', [leaving]);
  for (const table of ['public.fsrs_cards', 'public.fsrs_new_receipts', 'public.fsrs_operations', 'public.user_vocabulary', 'public.review_events']) {
    assert.equal(await count(table, leaving), 0, `${table} cleared for the deleted account`);
  }
  // ③ 다른 계정은 그대로.
  for (const table of ['public.fsrs_cards', 'public.fsrs_new_receipts', 'public.fsrs_operations', 'public.user_vocabulary', 'public.review_events']) {
    assert.equal(await count(table, staying), 1, `${table} kept for the other account`);
  }
  // ④ 다시 불러도 안전(지울 것이 없으면 0).
  assert.deepEqual((await db.query('SELECT public.delete_account_learning_records($1) AS r', [leaving])).rows[0].r, { receipts: 0, operations: 0, cards: 0 });
  // ⑤ 실행권은 service_role만.
  const privileges = (await db.query(`SELECT has_function_privilege('anon','public.delete_account_learning_records(uuid)','EXECUTE') a,
    has_function_privilege('authenticated','public.delete_account_learning_records(uuid)','EXECUTE') b`)).rows[0];
  assert.deepEqual(privileges, { a: false, b: false });
  console.log('PASS: FSRS account delete blocked without the function; function + delete clears 5 tables; other account intact; idempotent; service_role only; contracts unchanged.');
} catch (error) {
  console.error(error.code ?? 'ERROR', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
