/** Local, disposable PGlite only — never connects to Supabase (CARD-TYPES-001 단계 2).
 * 20261101120000_fsrs_card_kinds: 종류 카드(뜻 → 단어 · 듣기) 서버 길 · 계정별 켜진 종류(기본 = 단어 → 뜻 하나) · 단어 ↔ 카드 잇기 = vocabulary_id + kind.
 * 운영과 같은 사슬(관측 fixture → 191500 뒤 마이그레이션 → anki-v2 → 단계 1까지)에서 시작한다. 증명(실제 SQL 함수 호출 · 합성 학습자):
 *   ① 적용 전에 등록 · 묻기 · 채점을 한 번 돌려 함수가 이 세션에서 컴파일된 상태로(운영 연결 풀처럼) · 날 단위로 넘어간 단어 → 뜻 카드 하나
 *   ② 적용: 행 그대로(vocabulary_id = card_id · recognition) · 단어장 셋 · 입장 상태 · 카드 목록 출력 그대로(덧붙인 칸 제외) · 바꾼 12개 = 검토한 md5 ·
 *      나머지 학습 함수 그대로 · core · manual · admission만 재게시(profile · 한국어 capability 그대로) · 등록 경로가 vocabulary_id를 명시
 *   ③ 설정 꺼짐(기본): 종류 카드 등록 거절 · 아무것도 바뀌지 않음 · 단어 → 뜻 등록 · 채점 · 이벤트 모양 그대로
 *   ④ 복원(docs/sql/fsrs-card-kinds-rollback.sql): 단계 1 모양 · 옛 md5 · 출력 그대로 · manual · profile 그대로 · 단계 1 복원까지 이어서 정확히 처음 핀 ·
 *      재실행 no-op → 다시 적용
 *   ⑤ 설정(learning_configure_admission cardKinds): 검증(단어 → 뜻 늘 포함 · 네 집합) · 판본 · 생략하면 그대로
 *   ⑥ 설정 켜짐: 뜻 → 단어 = 단어 → 뜻이 날 단위(Review)로 넘어가 앞 학습일에 마지막 채점된 단어만 · 단어당 하루 한 장 · 듣기는 다음 학습일 · 예문 주장 ·
 *      단어 id 자리 차지 거절 · 단어장 = 단어당 한 줄 · 하루 몫 = 단어 → 뜻만 · 뜻 → 단어 묻기 · 보이기 · 채점 · 되돌리기 끝까지 · 쉬는 종류 거절 ·
 *      제외 · 삭제 가드 · 옛 경계 · 종류 카드가 있으면 복원이 거절
 *   node supabase/tests/fsrs-card-kinds.mjs
 */
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { read, setup, seedEdgeActor, A, C } from './perf-snapshot-fixture.mjs';
import { introduceFsrsCard } from '../../src/lib/fsrsScheduler.js';
import { beginFsrsAttempt, finishFsrsAttempt, planFsrsUndo, revealFsrsAttempt } from '../../src/lib/fsrsReviewSession.js';

const FILE = '20261101120000_fsrs_card_kinds.sql';
const STAGE1 = '20261101090000_fsrs_cards_kind.sql';
const OUT_OF_FIXTURE = new Set(['42P01', '42883', '42704', '3F000']);
const migration = await read(`../migrations/${FILE}`), restore = await read('../../docs/sql/fsrs-card-kinds-rollback.sql');
const stage1 = await read(`../migrations/${STAGE1}`), stage1Restore = await read('../../docs/sql/fsrs-cards-kind-rollback.sql');
// 바꾸는 12개 · 새 2개 — 마이그레이션의 검토 상수(ck2_old_state · ck2_new_state)에서 읽는다(여기 다시 적지 않는다).
const stateConst = name => JSON.parse(migration.match(new RegExp(`CREATE FUNCTION pg_temp\\.${name}\\(\\)[^\\n]*\\n SELECT '(.*)'::jsonb\\n`))[1].replace(/''/g, "'"));
const OLD = stateConst('ck2_old_state'), NEW = stateConst('ck2_new_state');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const h = await setup();
const { db, one } = h;
// 운영 순서 — profiles privacy가 요구하는 public_profiles view 둘 → 191500 뒤 마이그레이션(이 파일 전) · anki-v2(docs/sql)는 하루 새 단어 앞.
const PROFILES_VIEW = ['20261016165910_public_profiles_view.sql', '20261016170000_public_profiles_view_select_only.sql'];
const chain = (await readdir(new URL('../migrations/', import.meta.url))).filter(f => f.slice(0, 14) > '20261016191500' && f < FILE && f.endsWith('.sql')).sort();
let ankiV2 = false;
for (const f of [...PROFILES_VIEW, ...chain]) {
  if (!ankiV2 && f >= '20261030050000') { await db.exec(h.localize(await read('../../docs/sql/fsrs-anki-v2-policy.sql'))); ankiV2 = true; }
  try { await db.exec(h.localize(await read(`../migrations/${f}`))); }
  catch (e) { await db.exec('ROLLBACK').catch(() => {}); assert.ok(OUT_OF_FIXTURE.has(e.code), `${f}: ${e.message}`); }
}
assert.ok(ankiV2 && chain.includes(STAGE1), 'chain reaches CARD-TYPES stage 1');
await seedEdgeActor(h); // 가장자리 학습자 C — 카드 3장(밀리초 아래 기한 · 중단 시도 · 영수증)

const MIN = 60000, HOUR = 60 * MIN, iso = ms => new Date(ms).toISOString();
const pins = async () => { const { ok, core, manual, admission, profile } = await h.pins(); return { ok, core, manual, admission, profile }; };
const md5s = async () => (await db.query(`SELECT g.s, (SELECT md5(p.prosrc) FROM pg_proc p WHERE p.oid=to_regprocedure(g.s)) m FROM unnest($1::text[]) g(s)`,
  [Object.keys(NEW.functions)])).rows.reduce((o, r) => ({ ...o, [r.s]: r.m }), {});
const others = async () => (await db.query(`SELECT p.oid::regprocedure::text s, md5(p.prosrc) m, p.proacl::text acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE (n.nspname='fsrs_private' OR (n.nspname='public' AND (p.proname LIKE 'fsrs\\_%' OR p.proname LIKE 'learning\\_%')))
    AND NOT (to_regprocedure(p.oid::regprocedure::text) = ANY (SELECT to_regprocedure(x) FROM unnest($1::text[]) x WHERE to_regprocedure(x) IS NOT NULL)) ORDER BY 1`,
  [Object.keys(NEW.functions)])).rows;
const operate = async (operation, actor = A) => (await one('SELECT public.fsrs_apply_operation($1,$2) r', [actor, operation])).r;
const learn = async (operation, actor = A) => (await one('SELECT public.fsrs_apply_learning_operation($1,$2) r', [actor, operation])).r;
const quota = async (actor = A) => (await one('SELECT public.learning_admission_status($1) v', [actor])).v;
const rows = async () => (await db.query('SELECT to_jsonb(f) - ARRAY[\'card\',\'attempt\',\'enrolled_at\'] r FROM public.fsrs_cards f ORDER BY card_id')).rows.map(x => x.r);
const columns = async () => (await db.query(`SELECT attname FROM pg_attribute WHERE attrelid='public.fsrs_cards'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum`)).rows.map(x => x.attname);
const generated = async () => (await one(`SELECT attgenerated g FROM pg_attribute WHERE attrelid='public.fsrs_cards'::regclass AND attname='vocabulary_id'`))?.g ?? null;
const strip = (list, keys = ['vocabularyId', 'kind', 'resting']) => list.map(e => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))));
const outputs = async ({ at } = {}) => {
  const out = {};
  for (const u of [A, C]) {
    const { now, ...snapshot } = (await one('SELECT public.fsrs_vocabulary_snapshot($1) v', [u])).v;
    const { now: _l, ...light } = (await one('SELECT public.fsrs_vocabulary_snapshot_light($1,NULL,true) v', [u])).v;
    const ids = snapshot.rows.slice(0, 50).map(r => r.id);
    const cards = ids.length ? (({ now: _c, ...rest }) => rest)((await one('SELECT public.fsrs_vocabulary_snapshot_cards($1,$2::uuid[]) v', [u, ids])).v) : null;
    const states = (await one('SELECT public.fsrs_list_states($1) v', [u])).v;
    const { cardKinds, ...admission } = (await one('SELECT fsrs_private.admission_status($1,$2::timestamptz) v', [u, at])).v;
    out[u] = { snapshot, light, cards, states: strip(states), admission, extra: { states: states.map(e => [e.vocabularyId ?? null, e.kind ?? null, e.resting ?? null]), cardKinds: cardKinds ?? null } };
  }
  return out;
};
const refused = async (promise, pattern) => {
  await assert.rejects(promise, e => { assert.match(`${e.code} ${e.message}`, pattern); return true; });
  await db.exec('ROLLBACK').catch(() => {});
};
let seq = 0;
async function word(createdAt = Date.now() - 10 * MIN, actor = A) {
  const id = `60000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  await h.as(actor);
  await db.query(`INSERT INTO public.user_vocabulary(id,user_id,word_text,base_form,meaning,language,interval,ease_factor,repetitions,created_at)
    VALUES ($1,$2,$3,$3,'뜻','Chinese',0,0,0,$4)`, [id, actor, `종류이${seq}`, iso(createdAt)]);
  return id;
}
const variantId = () => `6fffffff-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
const enrollOp = (cardId, tag, extra = {}, at = Date.now() - 2 * MIN) => ({ version: 1, id: `enroll-${tag}`, kind: 'enroll', userId: A, cardId, expectedRevision: 0,
  nextCard: introduceFsrsCard(iso(at), { policyVersion: 'anki-v2' }), ...extra });
const enroll = async (...args) => operate(enrollOp(...args));
const variant = (vocabularyId, cardKind, tag, more = {}) => enroll(variantId(), tag, { cardKind, vocabularyId, ...more });
// 날 단위로 넘어간 단어 → 뜻 카드(Review) — lastReview = 마지막 채점 시각. 적용 전에는 vocabulary_id가 생성 열이라 넣지 않는다.
const reviewCard = (lastReview, now = Date.now()) => ({ version: 1, engine: 'v5.3.2 using FSRS-6.0', policyVersion: 'anki-v2', timeZone: 'Asia/Seoul', rolloverHour: 4,
  revision: 3, introducedAt: iso(lastReview - 3 * 24 * HOUR), state: 'Review', step: 0, reps: 3, lapses: 0, stability: 4.2, difficulty: 4.9, elapsedDays: 1,
  due: iso(now + 2 * 24 * HOUR), lastReview: iso(lastReview), scheduledDays: 3 });
async function graduated(lastReview, { explicit = true } = {}) {
  const id = await word(lastReview - 4 * 24 * HOUR);
  await db.query(`INSERT INTO public.fsrs_cards(card_id,user_id,card${explicit ? ',vocabulary_id' : ''}) VALUES ($1,$2,$3${explicit ? ',$1' : ''})`, [id, A, reviewCard(lastReview)]);
  return id;
}
const learningCard = now => ({ version: 1, engine: 'v5.3.2 using FSRS-6.0', policyVersion: 'anki-v2', timeZone: 'Asia/Seoul', rolloverHour: 4, revision: 0,
  introducedAt: iso(now - 5 * MIN), state: 'Learning', step: 0, reps: 1, lapses: 0, stability: 2.3065, difficulty: 2.118, elapsedDays: 0,
  due: iso(now - MIN), lastReview: iso(now - 2 * MIN), scheduledDays: 0 });
/** 묻기 → 보이기 → 채점(fsrs_apply_learning_operation — 서버 JS와 같은 입구). 반환 = { graded, gradeOp } */
async function answer(cardId, card, tag, { rating = 3 } = {}) {
  const q = await quota(), at = Date.now() - 3000;
  const attempt = beginFsrsAttempt(card, { id: `q-${tag}`, userId: A, cardId, at: iso(at) });
  await learn({ version: 1, id: `q-${tag}`, kind: 'question', userId: A, cardId, expectedRevision: card.revision, nextAttempt: attempt,
    dailyNewLimit: q.limit, request: { expectedPolicyRevision: q.policyRevision } });
  const revealed = revealFsrsAttempt(attempt, iso(at + 1000));
  await learn({ version: 1, id: `r-${tag}`, kind: 'reveal', userId: A, cardId, expectedRevision: card.revision, nextAttempt: revealed });
  const gradeOp = finishFsrsAttempt(revealed, rating, { operationId: `g-${tag}`, at: revealed.revealedAt, policyVersion: 'anki-v2' });
  return { graded: await learn(gradeOp), gradeOp };
}
let configSeq = 0;
const configure = async (fields, actor = A) => {
  const q = await quota(actor);
  return (await one('SELECT public.learning_configure_admission($1,$2) r', [actor, { action: 'configure', accountId: actor, operationId: `cfg-${++configSeq}`,
    expectedPolicyRevision: q.policyRevision, dailyNewLimit: q.limit, ...fields }])).r;
};

// ── ① 적용 전
const preWord = await word();
const preEnroll = await enroll(preWord, 'pre');
assert.equal(preEnroll.enrolled, true);
const preCard = (await one('SELECT card FROM public.fsrs_cards WHERE card_id=$1', [preWord])).card;
const preGraded = await answer(preWord, preCard, 'pre');
const preEvent = (await one(`SELECT detail FROM public.review_events WHERE detail->>'fsrs_operation_id'=$1`, ['g-pre'])).detail;
const oldGraduated = await graduated(Date.now() - 30 * HOUR, { explicit: false }); // 단계 1 사슬에서는 vocabulary_id를 쓰지 못한다(생성 열)
const at0 = iso(Date.now());
const before = { pins: await pins(), out: await outputs({ at: at0 }), md5s: await md5s(), others: await others(), rows: await rows(), cap: await h.capability() };
await check('before: stage 1 chain (reviewed md5s · generated vocabulary_id · no stage 2 functions) · cards of the edge learner and A', async () => {
  assert.deepEqual(before.md5s, OLD.functions);
  assert.equal(before.pins.ok, true);
  assert.equal(await generated(), 's');
  assert.ok(before.rows.length >= 5 && before.rows.every(r => r.vocabulary_id === r.card_id && r.kind === 'recognition'));
  assert.equal(before.out[A].extra.cardKinds, null, 'no cardKinds before stage 2');
  assert.equal(preGraded.graded.card.revision, 1);
});

// ── ② 적용
await db.exec(migration);
const applied = await pins();
console.log(`PINS core ${before.pins.core} → ${applied.core} · manual ${before.pins.manual} → ${applied.manual} · admission ${before.pins.admission} → ${applied.admission} · profile ${applied.profile}`);
await check('applied: rows unchanged (vocabulary_id kept as plain values = card_id · recognition) · DROP EXPRESSION', async () => {
  assert.deepEqual(await rows(), before.rows);
  assert.equal(await generated(), '');
  assert.deepEqual(await columns(), ['card_id', 'user_id', 'card', 'attempt', 'enrolled_at', 'vocabulary_id', 'kind']);
  const cons = (await db.query(`SELECT conname FROM pg_constraint WHERE conrelid='public.fsrs_cards'::regclass AND contype<>'n' ORDER BY 1`)).rows.map(r => r.conname);
  assert.ok(!cons.includes('fsrs_cards_kind_stage1_check') && !cons.includes('fsrs_cards_card_id_fkey'));
  assert.ok(['fsrs_cards_recognition_identity_check', 'fsrs_cards_vocabulary_id_fkey', 'fsrs_cards_user_id_vocabulary_id_kind_key', 'fsrs_cards_kind_check'].every(c => cons.includes(c)));
});
await check('applied: learner output unchanged — snapshot · light · cards · admission (cardKinds aside) · card list (three added fields aside)', async () => {
  const after = await outputs({ at: at0 });
  for (const u of [A, C]) {
    const { extra, ...rest } = after[u], { extra: _e, ...was } = before.out[u];
    assert.deepEqual(rest, was, u);
    assert.deepEqual(extra.cardKinds, ['recognition']);
    assert.deepEqual(extra.states, after[u].states.map(e => [e.cardId, 'recognition', false]));
  }
});
await check('applied: the 12 changed functions = reviewed md5s · the 2 new ones exist · every other learning function unchanged', async () => {
  assert.deepEqual(await md5s(), NEW.functions);
  assert.deepEqual(await others(), before.others);
  for (const fn of ['fsrs_private.card_kinds(uuid)', 'fsrs_private.variant_enrollment_open(uuid,uuid,uuid,text,boolean,timestamp with time zone)']) {
    assert.equal((await one('SELECT proacl::text a FROM pg_proc WHERE oid=to_regprocedure($1)', [fn])).a, '{postgres=X/postgres}', fn);
  }
});
await check('applied: core · manual · admission repinned · profile · Korean capability unchanged', async () => {
  assert.equal(applied.ok, true);
  for (const k of ['core', 'manual', 'admission']) assert.notEqual(applied[k], before.pins[k], k);
  assert.equal(applied.profile, before.pins.profile);
  assert.deepEqual(await h.capability(), before.cap);
  assert.equal(await h.koreanReady(), true);
});
await check('insert paths must write vocabulary_id (no generated value · no default)', async () => {
  const id = await word();
  await refused(db.query('INSERT INTO public.fsrs_cards(card_id,user_id,card) VALUES ($1,$2,$3)', [id, A, h.card('2026-10-22T00:00:00Z')]), /^23502 .*vocabulary_id/);
  // 단어 → 뜻 = 단어 id(영구 CHECK)
  await refused(db.query('INSERT INTO public.fsrs_cards(card_id,user_id,card,vocabulary_id) VALUES ($1,$2,$3,$4)', [variantId(), A, h.card('2026-10-22T00:00:00Z'), id]), /^23514 .*recognition_identity/);
});

// ── ③ 설정 꺼짐(기본)
const gradA = await graduated(Date.now() - 30 * HOUR);
await check('setting off (default): admission cardKinds = recognition only · a production / listening enroll is refused and nothing changes', async () => {
  assert.deepEqual((await quota()).cardKinds, ['recognition']);
  const snap = await rows(), out = await outputs({ at: at0 });
  for (const [kind, more] of [['production', {}], ['listening', { hasExample: true }]]) {
    await refused(variant(gradA, kind, `off-${kind}`, more), /fsrs_enrollment_not_available/);
    await refused(variant(oldGraduated, kind, `off-old-${kind}`, more), /fsrs_enrollment_not_available/);
  }
  assert.deepEqual(await rows(), snap);
  assert.deepEqual(await outputs({ at: at0 }), out);
  assert.equal((await one(`SELECT count(*)::int n FROM public.fsrs_operations WHERE id LIKE 'enroll-off-%'`)).n, 0);
});
await check('setting off: recognition enroll · question · reveal · grade as before (reply + vocabularyId · kind · same event detail)', async () => {
  const id = await word();
  const r = await enroll(id, 'post');
  assert.deepEqual(Object.keys(r).sort(), [...Object.keys(preEnroll), 'vocabularyId', 'kind'].sort());
  assert.deepEqual([r.vocabularyId, r.kind, r.cardId], [id, 'recognition', id]);
  assert.deepEqual(await one('SELECT vocabulary_id, kind FROM public.fsrs_cards WHERE card_id=$1', [id]), { vocabulary_id: id, kind: 'recognition' });
  const { graded } = await answer(id, r.card, 'post');
  assert.equal(graded.card.revision, 1);
  const event = (await one(`SELECT detail FROM public.review_events WHERE detail->>'fsrs_operation_id'='g-post'`)).detail;
  assert.deepEqual(Object.keys(event).sort(), Object.keys(preEvent).sort());
  assert.equal(event.word_id, id);
  assert.equal((await one('SELECT count(*)::int n FROM public.fsrs_new_receipts WHERE card_id=$1', [id])).n, 1, 'a new word takes the daily quota');
});

// ── ④ 복원 · 재실행
await check('re-run is a no-op', async () => {
  const snap = await rows();
  await db.exec(migration);
  assert.deepEqual(await pins(), applied);
  assert.deepEqual(await rows(), snap);
  assert.deepEqual(await md5s(), NEW.functions);
});
await check('unreviewed state: a changed function body is refused by the migration and the rollback (and rolled back)', async () => {
  const tamper = `BEGIN; CREATE OR REPLACE FUNCTION fsrs_private.card_kinds(p_actor uuid) RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $f$ SELECT '{recognition,production}'::text[] $f$;
    UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live();`;
  await db.exec(tamper);
  await assert.rejects(db.exec(migration), e => { assert.match(e.message, /card_kinds_stage2: unreviewed state/); return true; });
  await db.exec('ROLLBACK');
  await db.exec(tamper);
  await assert.rejects(db.exec(restore), e => { assert.match(e.message, /card_kinds_stage2_rollback: unreviewed state/); return true; });
  await db.exec('ROLLBACK');
  assert.deepEqual(await pins(), applied);
  assert.deepEqual(await md5s(), NEW.functions);
});
await check('rollback: stage 1 shape · old md5s · output unchanged · manual · profile pins as before stage 2 · enroll still works · then stage 1 rollback · both re-applied', async () => {
  const out = await outputs({ at: at0 });
  await db.exec(restore);
  assert.equal(await generated(), 's');
  assert.deepEqual(await md5s(), OLD.functions);
  assert.deepEqual(await others(), before.others);
  const back = await pins();
  assert.equal(back.ok, true);
  assert.deepEqual([back.manual, back.profile], [before.pins.manual, before.pins.profile]);
  const restored = await outputs({ at: at0 });
  for (const u of [A, C]) {
    assert.deepEqual({ ...restored[u], extra: null }, { ...out[u], extra: null }, u);
    assert.equal(restored[u].extra.cardKinds, null);
  }
  for (const r of await rows()) assert.deepEqual([r.vocabulary_id, r.kind], [r.card_id, 'recognition']);
  assert.equal((await enroll(await word(), 'rolled-back')).enrolled, true);
  await db.exec(restore); // 되돌린 뒤 다시 = no-op
  assert.deepEqual(await pins(), back);
  // 단계 1 복원이 이어서 돈다 — 두 열을 지우면 열 번호도 처음 그대로라 지문이 단계 1 전 값과 같아진다.
  await db.exec(stage1Restore);
  assert.deepEqual(await columns(), ['card_id', 'user_id', 'card', 'attempt', 'enrolled_at']);
  await db.exec(h.localize(stage1));
  await db.exec(migration);
  assert.deepEqual(await md5s(), NEW.functions);
  assert.equal((await pins()).ok, true);
  assert.equal(await h.koreanReady(), true);
});

// ── ⑤ 설정(learning_configure_admission — 하루 새 단어 수와 같은 경로)
await check('configure: cardKinds validated (recognition always on · the four canonical sets) · omitted = unchanged · revision moves', async () => {
  for (const bad of [[], ['production'], ['production', 'recognition'], ['recognition', 'listening', 'production'], ['recognition', 'cloze'], 'recognition', ['recognition', 'recognition']]) {
    await refused(configure({ cardKinds: bad }), /invalid_learning_request/);
  }
  await refused(configure({ cardKinds: ['recognition'], extra: 1 }), /invalid_learning_request/);
  const q0 = await quota();
  const on = await configure({ cardKinds: ['recognition', 'production', 'listening'] });
  assert.deepEqual(on.quota.cardKinds, ['recognition', 'production', 'listening']);
  assert.equal(on.quota.policyRevision, q0.policyRevision + 1);
  const limit = await configure({ dailyNewLimit: 7 });
  assert.deepEqual([limit.quota.limit, limit.quota.cardKinds], [7, ['recognition', 'production', 'listening']], 'omitting cardKinds keeps them');
  assert.deepEqual((await one('SELECT card_kinds FROM fsrs_private.admission_policies WHERE user_id=$1', [A])).card_kinds, ['recognition', 'production', 'listening']);
  assert.deepEqual((await quota(C)).cardKinds, ['recognition'], 'another account keeps the default');
});

// ── ⑥ 설정 켜짐
const gradB = await graduated(Date.now() - 30 * HOUR);
let production;
await check('production enroll: only after recognition graduated (Review) and was last answered on an earlier learning day', async () => {
  const fresh = await word();
  await enroll(fresh, 'fresh');
  await refused(variant(fresh, 'production', 'on-new'), /fsrs_enrollment_not_available/); // 단어 → 뜻이 아직 New
  await refused(variant(await word(), 'production', 'on-nocard'), /fsrs_enrollment_not_available/); // 단어 → 뜻 카드 없음
  const today = await graduated(Date.now() - 2000); // 날 단위지만 오늘 채점 — 형제 규칙과 같은 날 경계
  await refused(variant(today, 'production', 'on-today'), /fsrs_enrollment_not_available/);
  const learning = await word();
  await db.query('INSERT INTO public.fsrs_cards(card_id,user_id,card,vocabulary_id) VALUES ($1,$2,$3,$1)', [learning, A, learningCard(Date.now())]);
  await refused(variant(learning, 'production', 'on-learning'), /fsrs_enrollment_not_available/);
  const id = variantId();
  const op = enrollOp(id, 'on-production', { cardKind: 'production', vocabularyId: gradB });
  production = await operate(op);
  assert.deepEqual([production.cardId, production.vocabularyId, production.kind, production.card.state, production.firstQuestionAt], [id, gradB, 'production', 'New', null]);
  assert.deepEqual(await one('SELECT vocabulary_id, kind FROM public.fsrs_cards WHERE card_id=$1', [id]), { vocabulary_id: gradB, kind: 'production' });
  // 재전송 = 같은 결과(멱등)
  assert.equal((await operate(op)).duplicate, true);
  await refused(operate({ ...op, cardKind: 'listening', hasExample: true }), /fsrs_operation_replay_mismatch/);
});
await check('one new kind per word per learning day · listening the next day (asserted example) · no second card of a kind · no word-id squatting', async () => {
  await refused(variant(gradB, 'listening', 'on-listen-same-day', { hasExample: true }), /fsrs_enrollment_not_available/);
  await refused(variant(gradB, 'production', 'on-production-again'), /fsrs_enrollment_not_available/);
  await refused(enroll(gradA, 'on-squat', { cardKind: 'production', vocabularyId: gradB }), /fsrs_enrollment_not_available/); // 단어 id 자리
  await db.query('UPDATE public.fsrs_cards SET enrolled_at = enrolled_at - interval \'30 hours\' WHERE card_id=$1', [production.cardId]); // 뜻 → 단어가 어제 생긴 것으로
  await refused(variant(gradB, 'listening', 'on-listen-no-example'), /fsrs_enrollment_not_available/);
  await refused(variant(gradB, 'listening', 'on-listen-false', { hasExample: false }), /fsrs_enrollment_not_available/);
  const listening = await variant(gradB, 'listening', 'on-listen', { hasExample: true });
  assert.equal(listening.kind, 'listening');
  await refused(variant(gradB, 'listening', 'on-listen-again', { hasExample: true }), /fsrs_enrollment_not_available/);
  // 듣기는 뜻 → 단어 뒤 — 뜻 → 단어 없이 켜져 있으면 거절
  await refused(variant(gradA, 'listening', 'on-listen-first', { hasExample: true }), /fsrs_enrollment_not_available/);
});
await check('invalid shapes: kind fields only on enroll · the three kinds only · a word id ≠ the card id · hasExample only for listening', async () => {
  const base = { version: 1, kind: 'question', userId: A, cardId: production.cardId, expectedRevision: 0 };
  await refused(operate({ ...base, id: 'bad-1', cardKind: 'production', vocabularyId: gradB }), /invalid_fsrs_operation/);
  await refused(variant(gradB, 'recognition', 'bad-2'), /invalid_fsrs_operation/);
  await refused(variant(gradB, 'cloze', 'bad-3'), /invalid_fsrs_operation/);
  await refused(enroll(gradB, 'bad-4', { cardKind: 'production', vocabularyId: gradB }), /invalid_fsrs_operation/);
  await refused(variant(gradA, 'production', 'bad-5', { hasExample: true }), /invalid_fsrs_operation/);
  await refused(enroll(variantId(), 'bad-6', { cardKind: 'production' }), /invalid_fsrs_operation/);
});
await check('word views stay one row per word (the recognition card) · registry entry = snapshot entry · the card list carries the kinds', async () => {
  const snap = (await one('SELECT public.fsrs_vocabulary_snapshot($1) v', [A])).v;
  assert.equal(snap.registry.length, snap.rows.length);
  assert.equal(new Set(snap.registry.map(e => e.cardId)).size, snap.rows.length);
  const entry = snap.registry.find(e => e.cardId === gradB);
  assert.equal(entry.card.state, 'Review');
  const direct = (await one('SELECT fsrs_private.vocabulary_registry_entry($1,$2) v', [A, gradB])).v;
  assert.deepEqual(direct, entry);
  const light = (await one('SELECT public.fsrs_vocabulary_snapshot_light($1,NULL,true) v', [A])).v;
  assert.equal(light.registry.filter(e => e.cardId === gradB).length, 1);
  const cards = (await one('SELECT public.fsrs_vocabulary_snapshot_cards($1,$2::uuid[]) v', [A, [gradB]])).v;
  assert.deepEqual(cards.registry.map(e => [e.cardId, e.card.state]), [[gradB, 'Review']]);
  const list = (await one('SELECT public.fsrs_list_states($1) v', [A])).v.filter(e => e.vocabularyId === gradB);
  assert.deepEqual(list.map(e => e.kind).sort(), ['listening', 'production', 'recognition']);
  assert.ok(list.every(e => e.resting === false && e.excluded === false && (e.kind === 'recognition') === (e.cardId === gradB)));
  const state = (await one('SELECT public.fsrs_read_state($1,$2) v', [A, production.cardId])).v;
  assert.deepEqual([state.cardId, state.vocabularyId, state.kind, state.resting, state.enrolled], [production.cardId, gradB, 'production', false, true]);
  assert.equal((await one('SELECT public.fsrs_read_state($1,$2) v', [A, gradB])).v.kind, 'recognition');
});
await check('daily quota counts recognition only: with 0 left a new word is refused, the production card is still asked (no receipt)', async () => {
  await configure({ dailyNewLimit: 0 });
  const usedBefore = (await quota()).used;
  const newWord = await word();
  const r = await enroll(newWord, 'quota-new');
  await refused(answer(newWord, r.card, 'quota-new'), /learning_daily_new_limit/);
  const { graded, gradeOp } = await answer(production.cardId, production.card, 'production');
  assert.equal(graded.card.revision, 1);
  assert.equal(graded.kind, 'production');
  assert.equal((await quota()).used, usedBefore, 'quota unchanged');
  assert.equal((await one('SELECT count(*)::int n FROM public.fsrs_new_receipts WHERE card_id=$1', [production.cardId])).n, 0);
  // 채점 이벤트 = 단어 id(옛 경계 · 통계가 단어로 묶는다) + 종류 카드 표시
  const event = (await one(`SELECT item_key, detail FROM public.review_events WHERE detail->>'fsrs_operation_id'='g-production'`));
  assert.deepEqual([event.detail.word_id, event.detail.card_id, event.detail.card_kind], [gradB, production.cardId, 'production']);
  // 되돌리기(같은 종류 카드 · 같은 단어 이벤트)
  const undo = planFsrsUndo(gradeOp, graded.card, { operationId: 'u-production', userId: A, cardId: production.cardId, at: iso(Date.now()) });
  const undone = await learn(undo);
  assert.equal(undone.card.revision, 2);
  const undoEvent = (await one(`SELECT detail FROM public.review_events WHERE detail->>'fsrs_operation_id'='u-production'`)).detail;
  assert.deepEqual([undoEvent.qtype, undoEvent.card_kind, undoEvent.card_id], ['undo', 'production', production.cardId]);
  await configure({ dailyNewLimit: 7 });
});
await check('resting kind: turning production off keeps the card (memory kept) but refuses its question · list marks it resting · listening then follows recognition', async () => {
  const fresh = await graduated(Date.now() - 30 * HOUR);
  const p = await variant(fresh, 'production', 'rest');
  await configure({ cardKinds: ['recognition', 'listening'] });
  const q = await quota();
  const attempt = beginFsrsAttempt(p.card, { id: 'q-rest', userId: A, cardId: p.cardId, at: iso(Date.now() - 3000) });
  await refused(learn({ version: 1, id: 'q-rest', kind: 'question', userId: A, cardId: p.cardId, expectedRevision: 0, nextAttempt: attempt,
    dailyNewLimit: q.limit, request: { expectedPolicyRevision: q.policyRevision } }), /fsrs_card_kind_excluded/);
  const entry = (await one('SELECT public.fsrs_list_states($1) v', [A])).v.find(e => e.cardId === p.cardId);
  assert.deepEqual([entry.kind, entry.resting], ['production', true]);
  await refused(variant(await graduated(Date.now() - 30 * HOUR), 'production', 'rest-new'), /fsrs_enrollment_not_available/);
  // 뜻 → 단어가 꺼져 있고 그 단어에 뜻 → 단어가 없으면 듣기는 단어 → 뜻 바로 뒤(꺼진 종류는 차례에서 건너뛴다)
  assert.equal((await variant(await graduated(Date.now() - 30 * HOUR), 'listening', 'rest-listen', { hasExample: true })).kind, 'listening');
  await configure({ cardKinds: ['recognition', 'production', 'listening'] });
  assert.equal((await one('SELECT public.fsrs_list_states($1) v', [A])).v.find(e => e.cardId === p.cardId).resting, false);
});
await check('word-level guards: an excluded word refuses its variant · a word with cards cannot be deleted · the legacy boundary sees the word', async () => {
  const blocked = await graduated(Date.now() - 30 * HOUR);
  await h.as(A);
  await db.query(`INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,vocabulary_id,retired_vocabulary_ids) VALUES ($1,'Chinese','x-blocked',$2,'{}')`, [A, blocked]);
  await refused(variant(blocked, 'production', 'excluded'), /vocabulary_excluded/);
  await refused(db.query('DELETE FROM public.user_vocabulary WHERE id=$1', [gradB]), /fsrs_enrolled_card_protected/);
  await h.as(A);
  assert.equal((await one('SELECT public.fsrs_legacy_boundary($1) v', [gradB])).v.enrolled, true);
  await refused(db.query(`SELECT public.learning_admit_legacy($1,$2)`, [A, { action: 'admit', accountId: A, operationId: 'legacy-1', cardId: gradB, expectedPolicyRevision: (await quota()).policyRevision }]), /learning_card_enrolled/);
});
await check('snapshot consistency checks still pass with variant cards · rollback refuses while production/listening cards exist', async () => {
  const snap = (await one('SELECT public.fsrs_vocabulary_snapshot($1) v', [A])).v;
  assert.equal(snap.registry.length, snap.rows.length);
  await assert.rejects(db.exec(restore), e => { assert.match(e.message, /card_kinds_stage2_rollback: \d+ production\/listening cards/); return true; });
  await db.exec('ROLLBACK').catch(() => {});
  assert.deepEqual(await md5s(), NEW.functions);
  assert.equal((await pins()).ok, true);
});
await db.close();
console.log(`fsrs-card-kinds: ${checks} checks passed`);
