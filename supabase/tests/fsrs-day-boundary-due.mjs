// Local, disposable PGlite only. This verifier never connects to Supabase.
// 날 경계 복습 기한(오너 「Anki와 동일하게」 2026-10-25 KST): 복습 단계 기한 = 채점한 학습일 + N일이 시작하는 04:00 KST.
// 운영 정의(M09 fixture + anki-v2) 위에서 SQL을 한 줄도 바꾸지 않고 ① 새 기한 채점을 받는다(valid_card · fsrs_apply_operation)
// ② 기한 전 채점은 그대로 막는다(fsrs_card_not_due) ③ 새 기한 채점 · 바꾸기 전(채점 시각 + N×24시간) 채점 모두 되돌릴 수 있다.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { introduceFsrsCard, learningDay, learningDayStart, scheduleFsrsReview } from '../../src/lib/fsrsScheduler.js';
import { beginFsrsAttempt, finishFsrsAttempt, planFsrsUndo, revealFsrsAttempt } from '../../src/lib/fsrsReviewSession.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const originalTest = await read('./korean-learning-support.mjs');
const marker = 'const modernFixtureSql = ';
const start = originalTest.indexOf(marker) + marker.length;
const end = originalTest.indexOf('\n`;', start);
assert.ok(start >= marker.length && end > start, 'modern fixture source boundary');
const modern = runInNewContext(originalTest.slice(start, end + 2), Object.create(null), { timeout: 1000 });
const fixture = await read('./fixtures/m09-learning-contracts-20261010.sql');
const ankiV2 = await read('../../docs/sql/fsrs-anki-v2-policy.sql');

const actor = '00000000-0000-4000-8000-000000000001'; // Synthetic local actor.
const ids = { day: '00000000-0000-4000-8000-0000000000c1', old: '00000000-0000-4000-8000-0000000000c2' };
const iso = ms => new Date(ms).toISOString();
const DAY = 86400000;

async function install() {
  const db = new PGlite();
  await db.exec(modern);
  await db.exec(await read('../../docs/sql/korean-learning-support.sql'));
  await db.exec(fixture);
  await db.exec(ankiV2); // 운영 정책(anki-v2)
  await db.query('INSERT INTO auth.users(id) VALUES ($1)', [actor]);
  await db.query('INSERT INTO public.profiles(id) VALUES ($1)', [actor]);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [actor]);
  return db;
}
const one = async (db, sql, args) => (await db.query(sql, args)).rows[0];
const valid = async (db, card) => (await one(db, 'SELECT fsrs_private.valid_card($1) ok', [card])).ok;
const operate = async (db, operation) => (await one(db, 'SELECT public.fsrs_apply_operation($1,$2) result', [actor, operation])).result;

// 열흘 전에 소개해 학습 단계를 마친 복습 단계 카드 — 기한은 이미 지났다.
async function seedReview(db, cardId, word) {
  const intro = Date.now() - 10 * DAY;
  const fresh = introduceFsrsCard(iso(intro), { policyVersion: 'anki-v2' });
  const learning = scheduleFsrsReview(fresh, 3, fresh.due).card;
  const review = scheduleFsrsReview(learning, 3, learning.due).card;
  assert.equal(review.state, 'Review');
  assert.ok(Date.parse(review.due) < Date.now() - 60000, 'seed review is due');
  await db.query(`INSERT INTO public.user_vocabulary(id,user_id,word_text,base_form,meaning,language,interval,ease_factor,repetitions,created_at)
    VALUES ($1,$2,$3,$3,'뜻','Chinese',0,0,0,$4)`, [cardId, actor, word, iso(intro)]);
  await db.query('INSERT INTO public.fsrs_cards(card_id,user_id,card) VALUES ($1,$2,$3)', [cardId, actor, review]);
  return review;
}

// 서버와 같은 길(질문 → 정답 보기 → 채점). dayDue = false는 바꾸기 전 계산으로 저장된 채점을 흉내 낸다.
async function grade(db, card, cardId, tag, rating, options = {}) {
  const at = Date.now() - 20000;
  const base = { version: 1, userId: actor, cardId };
  const attempt = beginFsrsAttempt(card, { id: `q-${tag}`, userId: actor, cardId, at: iso(at) });
  await operate(db, { ...base, id: attempt.id, kind: 'question', expectedRevision: card.revision, nextAttempt: attempt });
  const revealed = revealFsrsAttempt(attempt, iso(at + 2000));
  await operate(db, { ...base, id: `r-${tag}`, kind: 'reveal', expectedRevision: card.revision, nextAttempt: revealed });
  const operation = finishFsrsAttempt(revealed, rating, { operationId: `g-${tag}`, at: revealed.revealedAt, policyVersion: 'anki-v2', ...options });
  return { operation, result: await operate(db, operation) };
}
const undo = (db, operation, tag) => operate(db, planFsrsUndo(operation, operation.nextCard,
  { operationId: `u-${tag}`, userId: actor, cardId: operation.cardId, at: iso(Date.now()) }));

let db;
try {
  db = await install();

  // ① 새 기한: 다음 학습일 + N이 시작하는 04:00 KST. DB가 받고 그대로 저장한다.
  const dayCard = await seedReview(db, ids.day, '今天');
  const { operation: dayGrade, result: dayResult } = await grade(db, dayCard, ids.day, 'day', 3);
  const due = Date.parse(dayResult.card.due);
  assert.equal(dayResult.card.state, 'Review');
  assert.equal(due, learningDayStart(learningDay(dayGrade.log.reviewedAt) + dayResult.card.scheduledDays), 'due = learning-day start');
  assert.equal(new Date(due + 9 * 3600000).getUTCHours(), 4, '04:00 KST');
  assert.equal(dayResult.card.due, dayGrade.nextCard.due);
  assert.equal(await valid(db, dayResult.card), true);
  assert.equal(Date.parse(dayResult.nextQuestionAt), due, 'next question = the new due');

  // ② 기한 전 채점은 그대로 막힌다(04:00 전).
  await db.exec('BEGIN');
  await assert.rejects(grade(db, dayResult.card, ids.day, 'early', 3), error => error.message === 'fsrs_card_not_due');
  await db.exec('ROLLBACK');

  // ③-1 새 기한 채점 되돌리기
  const undone = await undo(db, dayGrade, 'day');
  assert.deepEqual({ ...undone.card, revision: dayCard.revision }, dayCard, 'undo restores the review card');

  // ③-2 바꾸기 전(채점 시각 + N×24시간)으로 저장된 채점도 되돌린다.
  const oldCard = await seedReview(db, ids.old, '昨天');
  const { operation: oldGrade, result: oldResult } = await grade(db, oldCard, ids.old, 'old', 3, { dayDue: false });
  assert.equal(Date.parse(oldResult.card.due) - Date.parse(oldResult.card.lastReview), oldResult.card.scheduledDays * DAY);
  const restored = await undo(db, oldGrade, 'old');
  assert.deepEqual({ ...restored.card, revision: oldCard.revision }, oldCard);

  console.log(`PASS: day-boundary due accepted unchanged (${dayResult.card.due}) / not-due before it / undo of new and pre-change grades.`);
} catch (error) {
  console.error(error.code ?? 'ERROR', error.message);
  process.exitCode = 1;
} finally {
  await db?.close();
}
