// Local, disposable PGlite only. This verifier never connects to Supabase.
// 옛 기한 04:00 맞춤(docs/sql/vocab-due-day-boundary-realign.sql — 운영 적용 2026-10-26 KST, 오너 「맞추고」 · 「허용」 2026-10-26 KST): 운영 정의(M09 fixture + anki-v2) 위에서
// ① 옛 방식 단어의 미래 기한(간격 ≥ 0.5일)만 그 학습일 04:00 KST로 앞당긴다 ② 학습 단계 · 지난 기한 · 이미 04:00 · FSRS 등록 카드 · 제외 단어는 그대로
// ③ 바꾸기 전 값이 백업 표에 남고 API 역할은 읽지 못한다 ④ FSRS 지문 넷 그대로 ⑤ 복원 SQL이 다시 채점하지 않은 행만 되돌린다.
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { introduceFsrsCard, learningDay, learningDayStart, scheduleFsrsReview } from '../../src/lib/fsrsScheduler.js';
import { read, setup, seedEdgeActor } from './perf-snapshot-fixture.mjs';

const migration = await read('../../docs/sql/vocab-due-day-boundary-realign.sql');
const rollback = await read('../../docs/sql/vocab-due-day-boundary-realign-rollback.sql');
const OUT_OF_FIXTURE = new Set(['42P01', '42883', '42704', '3F000']);

const actor = '00000000-0000-4000-8000-000000000001'; // Synthetic local actor.
const HOUR = 3600000, DAY = 24 * HOUR;
const iso = ms => new Date(ms).toISOString();
const at04 = ms => learningDayStart(learningDay(new Date(ms)));
const now = Date.now();
const later = at04(now + 3 * DAY) + 10 * HOUR + 42 * 60000; // 3학습일 뒤 14:42 KST

const h = await setup();
await seedEdgeActor(h);
const { db } = h;
// 운영 순서대로 관측 뒤 마이그레이션(191500 이후 · 이 SQL을 짠 10-26 전 — 학습 계약 구조)을 올린다 — fixture 범위 밖(대화방 등)은 건너뛴다.
for (const f of (await readdir(new URL('../migrations/', import.meta.url))).filter(f => f.slice(0, 14) > '20261016191500' && f.slice(0, 14) < '20261026000000' && f.endsWith('.sql')).sort()) {
  try { await db.exec(h.localize(await read(`../migrations/${f}`))); }
  catch (e) { await db.exec('ROLLBACK').catch(() => {}); assert.ok(OUT_OF_FIXTURE.has(e.code), `${f}: ${e.message}`); }
}
await db.exec(await read('../../docs/sql/fsrs-anki-v2-policy.sql')); // 운영 정책(anki-v2) — fsrs-day-boundary-due.mjs와 같게
await db.query('INSERT INTO auth.users(id) VALUES ($1)', [actor]);
await db.query('INSERT INTO public.profiles(id) VALUES ($1)', [actor]);

const rows = {
  move: { id: '00000000-0000-4000-8000-0000000000d1', interval: 3, due: later, last: later - 3 * DAY },
  // 오늘 학습일 안의 옛 기한(오후) — 04:00은 이미 지났으니 맞추면 바로 열린다.
  today: { id: '00000000-0000-4000-8000-0000000000d2', interval: 1, due: at04(now) + 23 * HOUR + 30 * 60000, last: at04(now) - 2 * HOUR },
  step: { id: '00000000-0000-4000-8000-0000000000d3', interval: 0.007, due: now + 10 * 60000, last: now - 60000 },
  past: { id: '00000000-0000-4000-8000-0000000000d4', interval: 2, due: now - HOUR, last: now - 2 * DAY },
  aligned: { id: '00000000-0000-4000-8000-0000000000d5', interval: 2, due: at04(now + 2 * DAY), last: now - DAY },
  enrolled: { id: '00000000-0000-4000-8000-0000000000d6', interval: 3, due: later + HOUR, last: later - 3 * DAY },
  // 제외한 단어 — 복습에 안 나오고 guard_excluded_vocabulary가 일정 쓰기를 막는다(운영 첫 시도에서 1행이 전체를 되돌렸다).
  excluded: { id: '00000000-0000-4000-8000-0000000000d7', interval: 3, due: later + 2 * HOUR, last: later - 3 * DAY },
};
// today 행은 지금이 그 학습일 23:30 KST 이후면 미래가 아니다 — 그때는 다음 날로.
if (rows.today.due <= now) rows.today.due += DAY;
for (const [word, r] of Object.entries(rows)) {
  await db.query(`INSERT INTO public.user_vocabulary(id,user_id,word_text,base_form,meaning,language,interval,ease_factor,repetitions,
      next_review_at,last_reviewed_at,created_at) VALUES ($1,$2,$3,$3,'뜻','Chinese',$4,2.5,3,$5,$6,$7)`,
    [r.id, actor, word, r.interval, iso(r.due), iso(r.last), iso(r.last - DAY)]);
}
await db.query("INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,vocabulary_id) VALUES ($1,'Chinese','excluded',$2)", [actor, rows.excluded.id]);
{ // 등록 카드(FSRS 정본) — 옛 일정 행은 fsrs_guard_legacy_vocabulary가 지킨다. fsrs-day-boundary-due.mjs와 같은 복습 단계 카드.
  const fresh = introduceFsrsCard(iso(now - 10 * DAY), { policyVersion: 'anki-v2' });
  const review = scheduleFsrsReview(scheduleFsrsReview(fresh, 3, fresh.due).card, 3, scheduleFsrsReview(fresh, 3, fresh.due).card.due).card;
  await db.query('INSERT INTO public.fsrs_cards(card_id,user_id,card) VALUES ($1,$2,$3)', [rows.enrolled.id, actor, review]);
}

const pins = async () => (await db.query(`SELECT fsrs_private.contract_hash_live() a, fsrs_private.manual_contract_hash_live() b,
  fsrs_private.admission_contract_hash_live() c, fsrs_private.activity_profile_hash_live() d`)).rows[0];
const due = async id => new Date((await db.query('SELECT next_review_at t FROM public.user_vocabulary WHERE id=$1', [id])).rows[0].t).getTime();
const before = await pins();

await db.exec(`BEGIN;\n${migration}\nCOMMIT;`);

assert.equal(await due(rows.move.id), at04(rows.move.due), 'future legacy due → 04:00 of its learning day');
assert.equal(new Date(await due(rows.move.id)).toLocaleString('sv', { timeZone: 'Asia/Seoul' }).slice(11), '04:00:00');
assert.equal(await due(rows.today.id), at04(rows.today.due), 'same-day due opens at 04:00');
for (const k of ['step', 'past', 'aligned', 'enrolled', 'excluded']) assert.equal(await due(rows[k].id), rows[k].due, `${k} untouched`);
const backup = (await db.query('SELECT id, old_next_review_at o, new_next_review_at n FROM maintenance_backup.vocab_due_realign_20261026 ORDER BY id')).rows;
assert.deepEqual(backup.map(r => [r.id, new Date(r.o).getTime(), new Date(r.n).getTime()]), [
  [rows.move.id, rows.move.due, at04(rows.move.due)], [rows.today.id, rows.today.due, at04(rows.today.due)]]);
assert.deepEqual(await pins(), before, 'FSRS contract fingerprints unchanged');
for (const role of ['anon', 'authenticated']) {
  const { rows: [g] } = await db.query(`SELECT has_schema_privilege($1,'maintenance_backup','USAGE') s,
    has_table_privilege($1,'maintenance_backup.vocab_due_realign_20261026','SELECT') t`, [role]);
  assert.deepEqual(g, { s: false, t: false }, `${role} cannot read the backup`);
}

// 맞춘 뒤 다시 채점한 행은 복원하지 않는다.
const regraded = later + 5 * DAY;
await db.query('UPDATE public.user_vocabulary SET next_review_at=$2 WHERE id=$1', [rows.today.id, iso(regraded)]);
await db.exec(rollback);
assert.equal(await due(rows.move.id), rows.move.due, 'rollback restores the old due');
assert.equal(await due(rows.today.id), regraded, 'rollback keeps a newer grade');
console.log('PASS: 옛 기한 04:00 맞춤 · 제외 다섯 그대로 · 백업 비공개 · 지문 넷 그대로 · 복원');
