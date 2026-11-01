// CARD-TYPES-001 단계 2 — 카드 종류의 서버 길 · 공유 줄 규칙(오너 방향 승인 2026-11-01 KST · 설계 docs/design/card-types.md §2 · §3 · §4.3).
// 계약: 켜진 종류의 기본값이 단어 → 뜻 하나인 동안 사용자가 받는 것은 그대로다 — 줄 · 하루 몫 · 응답 모양 · 입장 요청.
// 실제 SQL(등록 조건 · 몫 · 출력 동일 · 복원)은 PGlite(supabase/tests/fsrs-card-kinds.mjs)가 본다 — 여기서는 순수 규칙 · JS 이음새 · 마이그레이션 문장 모양.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { CARD_KINDS, RECOGNITION_ONLY, admissionCardKinds, answeredOnDay, cardKindOf, cardVocabularyId, fsrsTakesNewQuota,
  nextVariantKind, normalizeCardKinds, pickSiblings } from '../fsrsCardKinds';
import { introduceFsrsCard, learningDay, scheduleFsrsReview } from '../fsrsScheduler';
import { createFsrsReviewController } from '../useFsrsReview';
import { applyFsrsRequest, parseFsrsRequest, resetFsrsCapabilityCache } from '../server/fsrsLearning.js';
import { normalizeAdmissionRequest, normalizeAdmissionStatus, validateAdmissionReceipt } from '../learningAdmission';
import { normalizeFsrsRequest } from '../fsrsOperationOutbox';
import { sliceBetween } from './helpers/sliceBetween';

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const iso = (ms) => new Date(ms).toISOString();
const T = Date.parse('2026-11-02T03:00:00Z'); // 12:00 KST — 학습일 경계(04시)와 멀다
const ACTOR = '10000000-0000-4000-8000-000000000001';
const W = ['20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003'];
const P = '2fffffff-0000-4000-8000-000000000001', L = '2fffffff-0000-4000-8000-000000000002';
// anki-v2 카드: 새 카드 · 학습 단계(마지막 채점 = lastAt) · 날 단위 복습(마지막 채점 = lastAt, 기한 = dueAt)
const newCard = (at = T - 10 * MIN) => introduceFsrsCard(iso(at), { policyVersion: 'anki-v2' });
function learningCard(lastAt, dueAt) {
  const intro = newCard(lastAt - 2 * MIN);
  const card = scheduleFsrsReview(intro, 3, iso(lastAt), { policyVersion: 'anki-v2' }).card;
  return { ...card, lastReview: iso(lastAt), due: iso(dueAt) };
}
const reviewCard = (lastAt, dueAt) => ({ ...learningCard(lastAt, dueAt), state: 'Review', step: 0, scheduledDays: 2 });
const admission = { version: 1, actorId: ACTOR, installed: true, enabled: true, active: true, fsrsEnabled: true, startsAt: '2026-10-02T19:00:00.000Z',
  now: iso(T), learningDay: '2026-11-02', timeZone: 'Asia/Seoul', rolloverHour: 4, limit: 15, policyRevision: 1, used: 0, remaining: 15, fsrsUsed: 0,
  legacyUsed: 0, admittedLegacyCardIds: [] };
const entry = (cardId, card, extra = {}) => ({ cardId, card, attempt: null, eligible: true, known: false, excluded: false,
  nextQuestionAt: card.due, firstQuestionAt: card.state === 'New' ? null : iso(T - 3 * DAY), ...extra });

describe('켜진 종류 — 네 집합 · 단어 → 뜻 늘 포함(서버 CHECK와 같다)', () => {
  it('정해진 순서로 바꾼다 · 단어 → 뜻이 없거나 모르는 종류 · 겹침은 거절', () => {
    expect(CARD_KINDS).toEqual(['recognition', 'production', 'listening']);
    expect(normalizeCardKinds(['listening', 'recognition'])).toEqual(['recognition', 'listening']);
    expect(normalizeCardKinds(['production', 'listening', 'recognition'])).toEqual(CARD_KINDS);
    for (const bad of [[], ['production'], ['recognition', 'recognition'], ['recognition', 'cloze'], 'recognition', null]) {
      expect(() => normalizeCardKinds(bad), JSON.stringify(bad)).toThrow('invalid_card_kinds');
    }
  });
  it('입장 상태에 칸이 없으면(단계 2 전 서버 · 옛 상태) 단어 → 뜻 하나 — 스위치가 아니라 「모르면 지금처럼」', () => {
    expect(admissionCardKinds({})).toBe(RECOGNITION_ONLY);
    expect(admissionCardKinds({ cardKinds: ['bogus'] })).toBe(RECOGNITION_ONLY);
    expect(admissionCardKinds({ cardKinds: ['recognition', 'production'] })).toEqual(['recognition', 'production']);
  });
  it('항목에 칸이 없으면 단어 → 뜻 · 카드 id = 단어 id', () => {
    expect(cardKindOf({ cardId: W[0] })).toBe('recognition');
    expect(cardVocabularyId({ cardId: W[0] })).toBe(W[0]);
    expect([cardKindOf({ cardId: P, kind: 'production', vocabularyId: W[0] }), cardVocabularyId({ cardId: P, kind: 'production', vocabularyId: W[0] })]).toEqual(['production', W[0]]);
  });
});

describe('하루 새 단어 몫 — 단어 → 뜻 첫 질문만', () => {
  it('단어 → 뜻 항목에서는 지금 식(state New · 첫 질문 없음)과 같다', () => {
    const cases = [entry(W[0], newCard()), entry(W[0], newCard(), { firstQuestionAt: iso(T - MIN) }), entry(W[0], learningCard(T - 5 * MIN, T - MIN)),
      entry(W[0], reviewCard(T - 2 * DAY, T - HOUR))];
    for (const e of cases) expect(fsrsTakesNewQuota(e)).toBe(e.card.state === 'New' && !e.firstQuestionAt);
  });
  it('종류 카드의 첫 질문은 몫을 쓰지 않는다', () => {
    expect(fsrsTakesNewQuota(entry(P, newCard(), { kind: 'production', vocabularyId: W[0] }))).toBe(false);
  });
});

describe('형제 규칙 — 같은 단어의 카드는 학습일에 한 장(pickSiblings)', () => {
  const today = learningDay(T);
  it('단어마다 카드가 한 장이면 줄 그대로(같은 배열 · 같은 순서) — 설정이 꺼진 지금', () => {
    const list = [entry(W[0], learningCard(T - 5 * MIN, T - MIN)), entry(W[1], reviewCard(T - 2 * DAY, T - HOUR)), entry(W[2], newCard())];
    for (const order of [list, [...list].reverse()]) expect(pickSiblings(order, { at: T })).toEqual(order);
    expect(pickSiblings([], { at: T })).toEqual([]);
  });
  it('오늘 채점한 카드(학습 단계)는 이어 풀고 · 그 단어의 다른 카드는 다음 학습일로(기한은 그대로)', () => {
    const rec = entry(W[0], learningCard(T - 5 * MIN, T - MIN)), prod = entry(P, reviewCard(T - 2 * DAY, T - 2 * HOUR), { kind: 'production', vocabularyId: W[0] });
    expect(answeredOnDay(rec.card, today)).toBe(true);
    expect(pickSiblings([prod, rec], { at: T })).toEqual([rec]);
    // 후보 밖 형제(오늘 채점해 아직 차례가 아닌 카드)도 센다
    const doneToday = entry(W[0], reviewCard(T - 30 * MIN, T + 2 * DAY));
    expect(pickSiblings([prod], { cards: [doneToday, prod], at: T })).toEqual([]);
    expect(prod.card.due).toBe(iso(T - 2 * HOUR));
  });
  it('아무것도 채점하지 않았으면 한 장 — 더 오래 밀린 것, 같으면 단어 → 뜻 · 뜻 → 단어 · 듣기', () => {
    const rec = entry(W[0], reviewCard(T - 3 * DAY, T - HOUR)), prod = entry(P, reviewCard(T - 3 * DAY, T - 5 * HOUR), { kind: 'production', vocabularyId: W[0] });
    const listen = entry(L, reviewCard(T - 3 * DAY, T - HOUR), { kind: 'listening', vocabularyId: W[0] });
    const other = entry(W[1], reviewCard(T - 3 * DAY, T - HOUR));
    expect(pickSiblings([other, rec, prod, listen], { at: T })).toEqual([other, prod]);
    expect(pickSiblings([listen, rec, other], { at: T })).toEqual([rec, other]);
    expect(pickSiblings([listen], { cards: [listen, entry(W[0], reviewCard(T - 3 * DAY, T + DAY))], at: T })).toEqual([listen]);
  });
});

describe('차례로 붙이기 — 서버 등록 조건의 거울(nextVariantKind)', () => {
  const ALL = ['recognition', 'production', 'listening'];
  const rec = (lastAt, state = 'Review') => entry(W[0], state === 'Review' ? reviewCard(lastAt, T + DAY) : learningCard(lastAt, T + MIN));
  const variantAt = (cardId, kind, at) => entry(cardId, newCard(at), { kind, vocabularyId: W[0] });
  it('기본값(단어 → 뜻 하나)이면 아무것도 붙지 않는다', () => {
    expect(nextVariantKind({ cards: [rec(T - 30 * HOUR)], at: T })).toBe(null);
  });
  it('뜻 → 단어 = 단어 → 뜻이 날 단위로 넘어가 앞 학습일에 마지막 채점 · 오늘 채점했거나 학습 단계면 아직', () => {
    expect(nextVariantKind({ cards: [rec(T - 30 * HOUR)], cardKinds: ALL, at: T })).toBe('production');
    expect(nextVariantKind({ cards: [rec(T - 10 * MIN)], cardKinds: ALL, at: T })).toBe(null);
    expect(nextVariantKind({ cards: [rec(T - 30 * HOUR, 'Learning')], cardKinds: ALL, at: T })).toBe(null);
    expect(nextVariantKind({ cards: [], cardKinds: ALL, at: T })).toBe(null);
  });
  it('듣기 = 뜻 → 단어가 앞 학습일에 생긴 뒤 · 예문이 있을 때만 · 단어당 하루 한 장 · 뜻 → 단어가 꺼져 있으면 단어 → 뜻 바로 뒤', () => {
    const yesterday = variantAt(P, 'production', T - 30 * HOUR), todayP = variantAt(P, 'production', T - HOUR);
    expect(nextVariantKind({ cards: [rec(T - 30 * HOUR), yesterday], cardKinds: ALL, hasExample: true, at: T })).toBe('listening');
    expect(nextVariantKind({ cards: [rec(T - 30 * HOUR), yesterday], cardKinds: ALL, hasExample: false, at: T })).toBe(null);
    expect(nextVariantKind({ cards: [rec(T - 30 * HOUR), todayP], cardKinds: ALL, hasExample: true, at: T })).toBe(null);
    expect(nextVariantKind({ cards: [rec(T - 30 * HOUR)], cardKinds: ['recognition', 'listening'], hasExample: true, at: T })).toBe('listening');
    expect(nextVariantKind({ cards: [rec(T - 30 * HOUR), yesterday, variantAt(L, 'listening', T - 30 * HOUR)], cardKinds: ALL, hasExample: true, at: T })).toBe(null);
  });
});

describe('복습실 줄(createFsrsReviewController) — 종류 규칙을 거친 줄이 지금과 같다', () => {
  async function ready(rows, { remaining = 15 } = {}) {
    const client = { start: vi.fn(), dispose: vi.fn(), subscribe: vi.fn(() => () => {}), pending: vi.fn(async () => []),
      load: vi.fn(async () => ({ version: 1, enabled: true, registryAvailable: true, cards: structuredClone(rows), now: iso(T), firstQuestionsToday: 15 - remaining,
        admission: { ...admission, used: 15 - remaining, fsrsUsed: 15 - remaining, remaining } })) };
    const controller = createFsrsReviewController({ accountId: ACTOR, client, now: () => T, makeId: () => `op-${Math.random()}`,
      eventTarget: null, visibilityTarget: null, setTimer: () => 1, clearTimer: vi.fn() });
    controller.start();
    controller.setWords(W.map((id) => ({ id, word_text: id, meaning: '뜻' })));
    await controller.refresh();
    return controller.getSnapshot().ready.map((e) => e.cardId);
  }
  const rows = [entry(W[0], learningCard(T - 5 * MIN, T - MIN)), entry(W[1], reviewCard(T - 2 * DAY, T - HOUR)), entry(W[2], newCard())];
  it('단어 → 뜻 카드만(지금 · 설정 꺼짐): 차례가 된 카드 전부 · 몫이 0이면 새 단어만 빠진다', async () => {
    expect((await ready(rows)).sort()).toEqual([...W].sort());
    expect((await ready(rows, { remaining: 0 })).sort()).toEqual([W[0], W[1]].sort());
  });
  it('종류 카드도 그 단어가 보이면 선다(4단계) — 단어마다 한 장(형제 규칙) · 몫을 쓰지 않는 새 종류 카드 · 오늘 채점한 형제가 있으면 단어 → 뜻이 다음 학습일로', async () => {
    const prodNew = entry(P, newCard(), { kind: 'production', vocabularyId: W[1] });
    expect((await ready([...rows, prodNew])).sort()).toEqual([...W].sort()); // 단어 → 뜻 기한이 더 이르다 — 그 한 장
    expect((await ready([...rows, prodNew], { remaining: 0 })).sort()).toEqual([W[0], W[1]].sort());
    const prodOlder = entry(P, newCard(T - 2 * DAY), { kind: 'production', vocabularyId: W[1] });
    expect((await ready([...rows, prodOlder])).sort()).toEqual([W[0], W[2], P].sort()); // 더 오래 밀린 뜻 → 단어가 그 단어의 한 장
    expect((await ready([...rows, { ...prodOlder, resting: true }])).sort()).toEqual([...W].sort()); // 쉬는 카드(꺼진 종류)는 서지 않는다
    const prodDoneToday = entry(P, learningCard(T - 3 * MIN, T + 9 * MIN), { kind: 'production', vocabularyId: W[1] });
    expect((await ready([...rows, prodDoneToday])).sort()).toEqual([W[0], W[2]].sort());
  });
});

describe('서버 JS — 등록의 종류 칸 · 응답 모양 · 입장 설정', () => {
  const base = { action: 'enroll', accountId: ACTOR, cardId: P, operationId: 'enroll-p', expectedRevision: 0 };
  it('parseFsrsRequest — 종류 칸은 등록에만 · 두 종류 · 단어 id ≠ 카드 id · 예문 주장은 듣기만', () => {
    expect(parseFsrsRequest({ ...base, cardKind: 'production', vocabularyId: W[0] }, ACTOR)).toMatchObject({ cardKind: 'production', vocabularyId: W[0] });
    expect(parseFsrsRequest({ ...base, cardKind: 'listening', vocabularyId: W[0], hasExample: true }, ACTOR).hasExample).toBe(true);
    expect(parseFsrsRequest({ ...base, cardId: W[0] }, ACTOR)).toEqual({ ...base, cardId: W[0] }); // 단어 → 뜻 등록은 지금 모양 그대로
    for (const bad of [{ cardKind: 'production' }, { vocabularyId: W[0] }, { cardKind: 'recognition', vocabularyId: W[0] }, { cardKind: 'production', vocabularyId: P },
      { cardKind: 'production', vocabularyId: W[0], hasExample: true }, { cardKind: 'listening', vocabularyId: W[0], hasExample: 'yes' }]) {
      expect(() => parseFsrsRequest({ ...base, ...bad }, ACTOR), JSON.stringify(bad)).toThrow('fsrs_invalid_request');
    }
    expect(() => parseFsrsRequest({ action: 'question', accountId: ACTOR, cardId: P, operationId: 'q', expectedRevision: 0, cardKind: 'production' }, ACTOR)).toThrow('fsrs_invalid_request');
    expect(normalizeFsrsRequest({ ...base, cardKind: 'production', vocabularyId: W[0] }, ACTOR)).toMatchObject({ cardKind: 'production', vocabularyId: W[0] });
    expect(() => normalizeFsrsRequest({ ...base, cardKind: 'production', vocabularyId: P }, ACTOR)).toThrow('fsrs_invalid_request');
    expect(() => normalizeFsrsRequest({ ...base, action: 'question', cardKind: 'production', vocabularyId: W[0] }, ACTOR)).toThrow('fsrs_invalid_request');
  });
  describe('applyFsrsRequest — 종류 카드 등록(아직 없는 카드 id) · 응답에 종류 칸', () => {
    let applied;
    const status = { ...admission, now: iso(Date.now()), learningDay: new Date(learningDay(Date.now()) * DAY).toISOString().slice(0, 10) };
    const client = { rpc: vi.fn(async (name, args) => {
      if (name === 'fsrs_capabilities') return { data: { version: 1, enabled: true, policyVersion: 'anki-v2' } };
      if (name === 'learning_admission_status') return { data: status };
      if (name === 'fsrs_read_operation') return { data: null };
      if (name === 'fsrs_read_state') return { error: { code: 'P0001', message: 'word_not_available' } };
      if (name === 'fsrs_apply_learning_operation') {
        applied = args.p_operation;
        return { data: { cardId: applied.cardId, userId: ACTOR, card: applied.nextCard, attempt: null, operationId: applied.id, duplicate: false, enrolled: true,
          nextQuestionAt: applied.nextCard.due, excluded: false, firstQuestionAt: null, vocabularyId: applied.vocabularyId ?? applied.cardId,
          kind: applied.cardKind ?? 'recognition', quota: { ...status, cardKinds: ['recognition', 'production', 'listening'] } } };
      }
      throw new Error(`unexpected ${name}`);
    }) };
    beforeEach(() => { resetFsrsCapabilityCache(); applied = null; });
    it('종류 카드 등록 → 연산에 cardKind · vocabularyId · 응답에 kind · vocabularyId · resting', async () => {
      const response = await applyFsrsRequest({ authClient: client, serviceClient: client, userId: ACTOR, body: { ...base, cardKind: 'production', vocabularyId: W[0] } });
      expect(applied).toMatchObject({ kind: 'enroll', cardId: P, cardKind: 'production', vocabularyId: W[0] });
      expect(response).toMatchObject({ ok: true, cardId: P, kind: 'production', vocabularyId: W[0], resting: false, enrolled: true });
    });
    it('단어 id의 상태 읽기가 「단어 없음」이면 그대로 거절(종류 등록만 없는 카드로 본다)', async () => {
      await expect(applyFsrsRequest({ authClient: client, serviceClient: client, userId: ACTOR, body: { ...base, cardId: W[0] } })).rejects.toMatchObject({ code: 'fsrs_card_not_found' });
      expect(applied).toBe(null);
    });
  });
  it('입장 설정 — configure의 cardKinds(선택 · 정해진 순서로) · 상태 · 영수증 검증', () => {
    const req = { action: 'configure', accountId: ACTOR, operationId: 'cfg-1', expectedPolicyRevision: 1, dailyNewLimit: 15 };
    expect(normalizeAdmissionRequest(req, ACTOR)).toEqual(req);
    expect(normalizeAdmissionRequest({ ...req, cardKinds: ['listening', 'recognition'] }, ACTOR)).toEqual({ ...req, cardKinds: ['recognition', 'listening'] });
    expect(() => normalizeAdmissionRequest({ ...req, cardKinds: ['production'] }, ACTOR)).toThrow('fsrs_invalid_request');
    expect(() => normalizeAdmissionRequest({ action: 'admit', accountId: ACTOR, operationId: 'a', expectedPolicyRevision: 1, cardId: W[0], cardKinds: ['recognition'] }, ACTOR)).toThrow('fsrs_invalid_request');
    expect(normalizeAdmissionStatus(admission, { actorId: ACTOR })).not.toHaveProperty('cardKinds'); // 칸이 없는 상태는 그대로
    expect(normalizeAdmissionStatus({ ...admission, cardKinds: ['recognition'] }, { actorId: ACTOR }).cardKinds).toEqual(['recognition']);
    expect(() => normalizeAdmissionStatus({ ...admission, cardKinds: ['listening', 'recognition'] }, { actorId: ACTOR })).toThrow();
    const receipt = (cardKinds) => ({ version: 1, actorId: ACTOR, operationId: 'cfg-1', duplicate: false, quota: { ...admission, policyRevision: 2, cardKinds } });
    expect(validateAdmissionReceipt(receipt(['recognition', 'listening']), { request: { ...req, cardKinds: ['recognition', 'listening'] } }).quota.cardKinds).toEqual(['recognition', 'listening']);
    expect(() => validateAdmissionReceipt(receipt(['recognition']), { request: { ...req, cardKinds: ['recognition', 'listening'] } })).toThrow();
  });
});

describe('마이그레이션 · 복원 문장 — 동작 무변경 · 3단계 스위치 · 재게시', () => {
  const read = (f) => fs.readFileSync(f, 'utf8');
  const migration = read('supabase/migrations/20261101120000_fsrs_card_kinds.sql'), rollback = read('docs/sql/fsrs-card-kinds-rollback.sql');
  const code = (sql) => sql.replace(/--[^\n]*/g, '');
  const state = (sql, name) => {
    const head = `CREATE FUNCTION pg_temp.${name}() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $q$`;
    return sliceBetween(sql, head, '$q$;').slice(head.length);
  };
  it('fsrs_cards: 생성식 걷기 · 단계 1 CHECK · 옛 card_id FK만 지운다(재작성 · UPDATE 없음)', () => {
    const body = code(migration);
    expect(body).toContain('ALTER COLUMN vocabulary_id DROP EXPRESSION');
    expect(body).toContain('DROP CONSTRAINT fsrs_cards_kind_stage1_check');
    expect(body).toContain('DROP CONSTRAINT fsrs_cards_card_id_fkey');
    expect(body).not.toMatch(/DROP\s+CONSTRAINT\s+fsrs_cards_(recognition_identity_check|vocabulary_id_fkey|user_id_vocabulary_id_kind_key|kind_check)\b/);
    // 표 변경 블록(함수 본문 밖)에는 행을 고치는 문장이 없다
    expect(sliceBetween(body, 'DO $tables$', 'END $tables$;')).not.toMatch(/\bUPDATE\b|\bDELETE\b|\bINSERT\b/i);
  });
  it('3단계 스위치는 하나 — admission_settings.default_card_kinds 기본값 단어 → 뜻 하나 · 계정 값은 NULL(= 기본값)', () => {
    const body = code(migration);
    expect(body).toContain("ADD COLUMN default_card_kinds text[] NOT NULL DEFAULT '{recognition}'");
    expect(body).toContain('ADD COLUMN card_kinds text[],');
    expect(body.match(/default_card_kinds/g).length).toBeGreaterThan(1);
    expect(body).toMatch(/coalesce\(\(SELECT p\.card_kinds FROM fsrs_private\.admission_policies p WHERE p\.user_id=p_actor\),\s*\(SELECT s\.default_card_kinds FROM fsrs_private\.admission_settings s\)\)/);
  });
  it('단어 줄 = 그 단어의 단어 → 뜻 카드(스냅샷 셋) · 하루 몫 = 단어 → 뜻만 · 종류 카드 등록은 검사 함수 뒤', () => {
    const body = code(migration);
    expect(body.match(/LEFT JOIN public\.fsrs_cards f ON f\.vocabulary_id=v\.id AND f\.kind='recognition' AND f\.user_id=p_actor/g)).toHaveLength(3);
    expect(body).toContain("IF ck='recognition' AND f.card->>'state'='New' AND NOT EXISTS(SELECT 1 FROM public.fsrs_new_receipts WHERE card_id=cid) THEN");
    expect(body).toContain("(SELECT card->>'state'='New' AND kind='recognition' FROM public.fsrs_cards WHERE user_id=p_actor AND card_id=cid)");
    expect(body).toContain("NOT fsrs_private.variant_enrollment_open(p_actor,v.id,cid,ck,");
    expect(body).toContain('INSERT INTO public.fsrs_cards(card_id,user_id,card,vocabulary_id,kind) VALUES(cid,p_actor,c,v.id,ck)');
  });
  it('옛 경계 트리거 둘 · 한국어 capability는 손대지 않는다(트리거 함수가 capability 지문 안 — #1504 선례)', () => {
    const body = code(migration);
    expect(body).not.toMatch(/FUNCTION\s+fsrs_private\.guard_legacy_(event|vocabulary)\b/);
    expect(body).not.toMatch(/learning_language_capabilities/);
  });
  it('재게시 core · manual · admission(_live) · profile 그대로 · 출력 동일 검사 · 캐시', () => {
    const body = code(migration);
    for (const table of ['settings', 'manual_save_settings', 'admission_settings']) expect(body).toContain(`UPDATE fsrs_private.${table} SET contract_hash = fsrs_private.`);
    expect(body).not.toMatch(/UPDATE\s+fsrs_private\.activity_settings/i);
    expect(body).toContain("RAISE EXCEPTION 'card_kinds_stage2: vocabulary snapshot output changed'");
    expect(body).toContain("RAISE EXCEPTION 'card_kinds_stage2: card list output changed'");
    expect(body).toContain("RAISE EXCEPTION 'card_kinds_stage2: admission status changed'");
    expect(body).toContain('SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;');
  });
  it('복원은 같은 두 상태 상수 · 종류 카드 · 고른 종류가 있으면 거절 · 단계 1 모양으로', () => {
    expect(state(rollback, 'ck2r_old_state')).toBe(state(migration, 'ck2_old_state'));
    expect(state(rollback, 'ck2r_new_state')).toBe(state(migration, 'ck2_new_state'));
    const body = code(rollback);
    expect(body).toContain("production/listening cards (% rows with vocabulary_id <> card_id) — refusing to drop data");
    expect(body).toContain('card kinds were chosen (account or default) — refusing to drop them');
    expect(body).toContain('ADD COLUMN vocabulary_id uuid NOT NULL GENERATED ALWAYS AS (card_id) STORED');
    expect(body).toContain('ADD CONSTRAINT fsrs_cards_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.user_vocabulary (id) ON DELETE RESTRICT');
    expect(body).toContain("ADD CONSTRAINT fsrs_cards_kind_stage1_check CHECK (kind = 'recognition')");
  });
  it('CI가 동작 검사를 돌린다 · 설계 문서에 단계 2 결정과 스위치가 있다', () => {
    expect(read('.github/workflows/ci.yml')).toContain('node supabase/tests/fsrs-card-kinds.mjs');
    const design = read('docs/design/card-types.md');
    expect(design).toContain('### 4.3 단계 2 결정');
    expect(design).toContain('default_card_kinds');
  });
});
