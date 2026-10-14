// Local, disposable PGlite only. This verifier never connects to Supabase.
// REV-SCOPE-R1B-1 §6-1 ⑤: 집중 연습 기록(review_events source 'practice')이 운영 정의(M09 fixture)의 세 BEFORE 트리거
// (fsrs_guard_legacy_event · guard_excluded_review_event · guard_korean_learning_contract)를 스키마 변경 없이 통과하는지,
// 그리고 detail.word_id를 넣으면 새 일정(FSRS) 카드의 기록이 막히는지(= 연습 기록에 word_id를 넣지 않는 이유)를 확인한다.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { buildPracticeEvent } from '../../src/lib/practiceEvents.js';
import { introduceFsrsCard } from '../../src/lib/fsrsScheduler.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const originalTest = await read('./korean-learning-support.mjs');
const marker = 'const modernFixtureSql = ';
const start = originalTest.indexOf(marker) + marker.length;
const end = originalTest.indexOf('\n`;', start);
assert.ok(start >= marker.length && end > start, 'modern fixture source boundary');
const modern = runInNewContext(originalTest.slice(start, end + 2), Object.create(null), { timeout: 1000 });
const fixture = await read('./fixtures/m09-learning-contracts-20261010.sql');

const db = new PGlite();
const actor = '00000000-0000-4000-8000-000000000001'; // Synthetic local actor.
const fsrsCard = '00000000-0000-4000-8000-0000000000f1';
const legacyCard = '00000000-0000-4000-8000-0000000000e1';
const insertEvent = event => db.query(`INSERT INTO public.review_events(user_id,lang,source,item_key,correct,detail) VALUES ($1,$2,$3,$4,$5,$6)`,
  [actor, event.lang, event.source, event.item_key, event.correct, event.detail]);
try {
  await db.exec(modern);
  await db.exec(await read('../../docs/sql/korean-learning-support.sql'));
  await db.exec(fixture);
  await db.query('INSERT INTO auth.users(id) VALUES ($1)', [actor]);
  await db.query('INSERT INTO public.profiles(id) VALUES ($1)', [actor]);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [actor]);
  for (const [id, text] of [[fsrsCard, '早餐'], [legacyCard, '地铁']]) {
    await db.query(`INSERT INTO public.user_vocabulary(id,user_id,word_text,base_form,meaning,language,interval,ease_factor,repetitions)
      VALUES ($1,$2,$3,$3,'뜻','Chinese',0,0,0)`, [id, actor, text]);
  }
  await db.query('INSERT INTO public.fsrs_cards(card_id,user_id,card) VALUES ($1,$2,$3)', [fsrsCard, actor, introduceFsrsCard(new Date().toISOString())]);

  // 연습 기록 — 새 일정 카드 · 예전 일정 카드 모두, 스펙 형식 그대로 들어간다.
  for (const [id, text] of [[fsrsCard, '早餐'], [legacyCard, '地铁']]) {
    for (const [qtype, result] of [['self', 'unknown'], ['self', 'known'], ['typing', 'wrong'], ['listening', 'correct']]) {
      await insertEvent(buildPracticeEvent({ word: { id, word_text: text, language: 'Chinese' }, qtype, scope: '/vocab?lang=Chinese', result }));
    }
  }
  const stored = (await db.query(`SELECT source,item_key,detail FROM public.review_events WHERE source='practice' ORDER BY id`)).rows;
  assert.equal(stored.length, 8);
  assert.ok(stored.every(row => !('word_id' in row.detail) && ['self', 'typing', 'listening'].includes(row.detail.qtype)));

  // 같은 기록에 detail.word_id를 실으면 FSRS 카드는 legacy 이벤트 방벽에 막힌다 — 그래서 단어 id는 item_key에만 둔다.
  const withWordId = { ...buildPracticeEvent({ word: { id: fsrsCard, language: 'Chinese' }, qtype: 'self', scope: 's', result: 'unknown' }) };
  withWordId.detail = { ...withWordId.detail, word_id: fsrsCard };
  await assert.rejects(insertEvent(withWordId), error => error.message === 'fsrs_legacy_event_blocked');
  console.log(`PASS: ${stored.length} practice records accepted for FSRS + legacy cards without schema change; word_id variant blocked (fsrs_legacy_event_blocked).`);
} catch (error) {
  console.error(error.code ?? 'ERROR', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
