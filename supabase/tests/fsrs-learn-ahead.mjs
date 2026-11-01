/** Local, disposable PGlite only — never connects to Supabase (LEARN-AHEAD-001).
 * 20261101060000_fsrs_learn_ahead: 미리 학습(Anki 「learn ahead limit」 20분 — 오너 승인 2026-11-01 KST). fsrs_apply_operation 본문 한 군데(묻기 시각
 * 검사 둘)만 바꾸고 core만 재게시한다. 운영과 같은 사슬(관측 fixture → 191500 뒤 마이그레이션 → anki-v2 → 하루 새 단어 두 파일)로 본문 md5가
 * 운영(eaa4c9c3…)과 같은 데서 시작한다.
 * 증명(실제 SQL 함수 호출 — 시각은 서버 시계 기준 과거만 쓴다: 반영 함수는 미래 5초 넘는 시각만 거절한다):
 *   ① 적용 전: 기한 5분 전 학습 카드 묻기 = fsrs_card_not_due(지금 규칙)
 *   ② 적용 뒤: 학습 카드 기한 5분 전 · 20분 안 경계 받음 → 보이기 · 채점까지(간격은 답한 시각부터) / 20분 넘게 남은 학습 카드 · 1시간 남은 복습 카드 ·
 *      New 카드는 거절 / 되돌린 뒤 30초 · 중단 뒤 30초는 학습 카드에서도 그대로 거절(대기가 끝나면 받음)
 *   ③ 재실행 no-op · 검토하지 않은 본문 위에는 적용하지 않음 · 복원(docs/sql/fsrs-learn-ahead-rollback.sql) 뒤 본문 정확 복귀 · ①의 규칙으로 돌아감
 *   node supabase/tests/fsrs-learn-ahead.mjs
 */
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { read, setup, A } from './perf-snapshot-fixture.mjs';
import { beginFsrsAttempt, finishFsrsAttempt, planFsrsUndo, revealFsrsAttempt } from '../../src/lib/fsrsReviewSession.js';

const FILE = '20261101060000_fsrs_learn_ahead.sql';
const APPLY = 'public.fsrs_apply_operation(uuid,jsonb)';
const OLD = 'eaa4c9c3bb6c40970bf1ca9ed6560ea4', NEW = '9bf0c8612988174843d69731a953390c';
const OUT_OF_FIXTURE = new Set(['42P01', '42883', '42704', '3F000']);
const migration = await read(`../migrations/${FILE}`), restore = await read('../../docs/sql/fsrs-learn-ahead-rollback.sql');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const h = await setup();
const { db, one } = h;
// 운영 순서 — 191500 뒤 마이그레이션(이 파일 전) · anki-v2 학습 단계 정책(docs/sql, 운영 SQL 편집기 적용)은 하루 새 단어 제한 없음(20261030050000) 앞.
// profiles privacy(20261026010000)가 먼저 요구하는 public_profiles view 둘(191500 전 · setup 밖)을 앞에 둔다(daily-new-limit-unlimited.mjs와 같은 사슬).
const PROFILES_VIEW = ['20261016165910_public_profiles_view.sql', '20261016170000_public_profiles_view_select_only.sql'];
const chain = (await readdir(new URL('../migrations/', import.meta.url))).filter(f => f.slice(0, 14) > '20261016191500' && f < FILE && f.endsWith('.sql')).sort();
let ankiV2 = false;
for (const f of [...PROFILES_VIEW, ...chain]) {
  if (!ankiV2 && f >= '20261030050000') { await db.exec(h.localize(await read('../../docs/sql/fsrs-anki-v2-policy.sql'))); ankiV2 = true; }
  try { await db.exec(h.localize(await read(`../migrations/${f}`))); }
  catch (e) { await db.exec('ROLLBACK').catch(() => {}); assert.ok(OUT_OF_FIXTURE.has(e.code), `${f}: ${e.message}`); }
}
assert.ok(ankiV2, 'anki-v2 applied before the daily-new-limit files');

const iso = ms => new Date(ms).toISOString();
const MIN = 60000;
const pins = async () => { const { ok, core, manual, admission, profile } = await h.pins(); return { ok, core, manual, admission, profile }; };
const operate = async operation => (await one('SELECT public.fsrs_apply_operation($1,$2) r', [A, operation])).r;
const refused = async (promise, message) => {
  await assert.rejects(promise, e => { assert.equal(e.message, message); return true; });
  await db.exec('ROLLBACK').catch(() => {});
};
// 카드 — anki-v2 학습 · 복습 단계(값 검사 valid_card를 통과하는 모양). 단어장 행과 함께 심는다(합성 · 로컬 전용).
let seq = 0;
async function seed(card) {
  const id = `40000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  await db.query(`INSERT INTO public.user_vocabulary(id,user_id,word_text,base_form,meaning,language,interval,ease_factor,repetitions,created_at)
    VALUES ($1,$2,$3,$3,'뜻','Chinese',0,0,0,$4)`, [id, A, `미리${seq}`, card.introducedAt]);
  await db.query('INSERT INTO public.fsrs_cards(card_id,user_id,card) VALUES ($1,$2,$3)', [id, A, card]);
  return { id, card };
}
const shape = { version: 1, engine: 'v5.3.2 using FSRS-6.0', policyVersion: 'anki-v2', timeZone: 'Asia/Seoul', rolloverHour: 4, revision: 0,
  reps: 1, lapses: 0, stability: 2.3065, difficulty: 2.118, elapsedDays: 0 };
const learning = (dueMs, lastMs, step = 1) => ({ ...shape, introducedAt: iso(lastMs - MIN), state: 'Learning', step, due: iso(dueMs), lastReview: iso(lastMs), scheduledDays: 0 });
const relearning = (dueMs, lastMs) => ({ ...shape, introducedAt: iso(lastMs - 9 * 86400000), reps: 4, lapses: 1, state: 'Relearning', step: 0, due: iso(dueMs), lastReview: iso(lastMs), scheduledDays: 0 });
const review = (dueMs, lastMs) => ({ ...shape, introducedAt: iso(lastMs - 9 * 86400000), reps: 3, state: 'Review', step: 0, due: iso(dueMs), lastReview: iso(lastMs), scheduledDays: 2 });
const fresh = dueMs => ({ ...shape, introducedAt: iso(dueMs - MIN), reps: 0, stability: 0, difficulty: 0, state: 'New', step: 0, due: iso(dueMs), lastReview: null, scheduledDays: 0 });
// 묻기 연산 — 서버 전이와 같은 모양. 시도는 JS 정본(beginFsrsAttempt)이 만들지 않는 경우(JS가 먼저 거절하는 시각)도 DB가 막는지 보려고 직접 짓는다.
const attemptOf = ({ id, card }, tag, at) => ({ id: `q-${tag}`, userId: A, cardId: id, card, phase: 'question', eligible: true,
  questionAt: iso(at), revealedAt: null, hintedAt: null });
const question = (seeded, tag, at, attempt = attemptOf(seeded, tag, at)) => operate({ version: 1, id: `q-${tag}`, kind: 'question', userId: A,
  cardId: seeded.id, expectedRevision: seeded.card.revision, nextAttempt: attempt });

const now = Date.now();
const before = { apply: await h.fnmd5(APPLY), pins: await pins() };
await check('fixture chain body = production (eaa4c9c3) — the migration takes the production branch', async () => {
  assert.equal(before.apply, OLD);
  assert.equal(before.pins.ok, true);
});
await check('before: a learning card 5 minutes before due is not asked (fsrs_card_not_due)', async () => {
  const card = await seed(learning(now + 5 * MIN, now - 5 * MIN));
  await refused(question(card, 'pre-1', now), 'fsrs_card_not_due');
});

await db.exec(migration);
await check('applied: body 9bf0c861, only core repinned (manual · admission · profile unchanged)', async () => {
  assert.equal(await h.fnmd5(APPLY), NEW);
  const after = await pins();
  assert.equal(after.ok, true);
  assert.notEqual(after.core, before.pins.core, 'core repinned (fsrs_apply_operation is in core)');
  assert.deepEqual([after.manual, after.admission, after.profile], [before.pins.manual, before.pins.admission, before.pins.profile]);
});
await check('learning card 5 minutes before due: asked, revealed and graded now — the next step is measured from the answer time', async () => {
  const seeded = await seed(learning(now + 5 * MIN, now - 5 * MIN, 0));
  const at = now - 2000;
  const attempt = beginFsrsAttempt(seeded.card, { id: 'q-early', userId: A, cardId: seeded.id, at: iso(at) }); // JS 정본도 받는다
  const asked = await question(seeded, 'early', at, attempt);
  assert.equal(asked.attempt.phase, 'question');
  assert.equal(Date.parse(asked.nextQuestionAt), Date.parse(seeded.card.due), 'next_question_at (the screen chip) still reads the real due');
  const revealed = revealFsrsAttempt(attempt, iso(at + 1000));
  await operate({ version: 1, id: 'r-early', kind: 'reveal', userId: A, cardId: seeded.id, expectedRevision: 0, nextAttempt: revealed });
  const grade = finishFsrsAttempt(revealed, 1, { operationId: 'g-early', at: revealed.revealedAt, policyVersion: 'anki-v2' });
  const graded = await operate(grade);
  assert.equal(graded.card.lastReview, revealed.revealedAt);
  assert.equal(Date.parse(graded.card.due), at + 1000 + MIN, '다시 = 1 minute from the answer, not from the old due');
});
await check('relearning card 20 minutes minus 2 s before due is asked; 20 minutes plus 2 s is not (the 20-minute bound)', async () => {
  const inside = await seed(relearning(now + 20 * MIN - 2000, now - 2 * MIN));
  assert.equal((await question(inside, 'edge-in', now)).attempt.phase, 'question');
  const outside = await seed(learning(now + 20 * MIN + 2000, now - 2 * MIN));
  await refused(question(outside, 'edge-out', now), 'fsrs_card_not_due');
});
await check('learning card 25 minutes before due: refused', async () => {
  await refused(question(await seed(learning(now + 25 * MIN, now - MIN)), 'l25', now), 'fsrs_card_not_due');
});
await check('review card 1 hour before due: refused (day-scale reviews are never asked early)', async () => {
  await refused(question(await seed(review(now + 60 * MIN, now - 2 * 86400000)), 'r60', now), 'fsrs_card_not_due');
});
await check('new card 30 s before its first due: refused (New keeps the exact due)', async () => {
  await refused(question(await seed(fresh(now + 30000)), 'new30', now), 'fsrs_card_not_due');
});
await check('undo +30 s still enforced on an early learning card; asked once the wait is over', async () => {
  const seeded = await seed(learning(now + 10 * MIN, now - 2 * MIN, 0));
  const tq = now - 60000;
  const attempt = beginFsrsAttempt(seeded.card, { id: 'q-u', userId: A, cardId: seeded.id, at: iso(tq) });
  await question(seeded, 'u', tq, attempt);
  const revealed = revealFsrsAttempt(attempt, iso(tq + 1000));
  await operate({ version: 1, id: 'r-u', kind: 'reveal', userId: A, cardId: seeded.id, expectedRevision: 0, nextAttempt: revealed });
  const grade = finishFsrsAttempt(revealed, 3, { operationId: 'g-u', at: revealed.revealedAt, policyVersion: 'anki-v2' });
  const graded = await operate(grade);
  const undo = planFsrsUndo(grade, graded.card, { operationId: 'u-u', userId: A, cardId: seeded.id, at: iso(now - 50000) });
  const undone = await operate(undo);
  assert.equal(undone.card.due, seeded.card.due, 'undo restores the early-asked learning card');
  assert.equal(Date.parse(undone.nextQuestionAt), Date.parse(seeded.card.due), 'undo reply: the later of due and undo + 30 s');
  const restored = { id: seeded.id, card: undone.card };
  await refused(question(restored, 'u-early', now - 30000), 'fsrs_card_not_due'); // 기한 20분 창 안이어도 되돌린 뒤 30초 안
  assert.equal((await question(restored, 'u-after', now - 19000)).attempt.phase, 'question');
});
await check('abandon +30 s still enforced on an early learning card; asked once the wait is over', async () => {
  const seeded = await seed(learning(now + 10 * MIN, now - 2 * MIN));
  const attempt = attemptOf(seeded, 'a', now - 60000);
  await question(seeded, 'a', now - 60000, attempt);
  const revealed = { ...attempt, phase: 'revealed', eligible: false, revealedAt: iso(now - 59000), hintedAt: iso(now - 59000) };
  await operate({ version: 1, id: 'r-a', kind: 'reveal', userId: A, cardId: seeded.id, expectedRevision: 0, nextAttempt: revealed });
  await operate({ version: 1, id: 'x-a', kind: 'abandon', userId: A, cardId: seeded.id, expectedRevision: 0,
    nextAttempt: { ...revealed, phase: 'abandoned', abandonedAt: iso(now - 58000) } });
  await refused(question(seeded, 'a-early', now - 40000), 'fsrs_card_not_due');
  assert.equal((await question(seeded, 'a-after', now - 28000)).attempt.phase, 'question');
});
await check('re-run is a no-op', async () => {
  const pinned = await pins();
  await db.exec(migration);
  assert.equal(await h.fnmd5(APPLY), NEW);
  assert.deepEqual(await pins(), pinned);
});
await check('rollback returns the body exactly (eaa4c9c3) with pins consistent; learning cards wait for the due again', async () => {
  await db.exec(restore);
  assert.equal(await h.fnmd5(APPLY), OLD);
  const restored = await pins();
  assert.equal(restored.ok, true);
  assert.deepEqual([restored.core, restored.manual, restored.admission, restored.profile],
    [before.pins.core, before.pins.manual, before.pins.admission, before.pins.profile], 'the same pins as before the migration');
  await refused(question(await seed(learning(now + 5 * MIN, now - 5 * MIN)), 'post-rollback', now), 'fsrs_card_not_due');
  await db.exec(restore); // 되돌린 뒤 다시 실행 = no-op
  assert.equal(await h.fnmd5(APPLY), OLD);
});
await check('unreviewed body: the migration refuses (and rolls back)', async () => {
  const tampered = migration.replace(`IF app = '${OLD}' THEN`, "IF app = 'ffffffffffffffffffffffffffffffff' THEN");
  assert.notEqual(tampered, migration);
  await h.expectFail(tampered, /unreviewed state/);
  assert.equal(await h.fnmd5(APPLY), OLD, 'nothing applied');
});
await check('apply again after rollback lands on the same body', async () => {
  await db.exec(migration);
  assert.equal(await h.fnmd5(APPLY), NEW);
  assert.equal((await pins()).ok, true);
});
await db.close();
console.log(`fsrs-learn-ahead: ${checks} checks passed`);
