// VOCAB-SCOPE-PERF-001 — 복습방(/vocab) 오늘 개수 계산을 덜어도 결과는 바이트 그대로다.
// 바꾼 것: ① 언어별 개수 셈 하나를 밀린 복습(due)과 언어 칩(total)이 나눠 쓴다(예전엔 언어마다 두 번) ② 밀린 복습 기준의 시각 독립 부분을
// projections마다 한 번만 푼다(이분 탐색) ③ FSRS 항목의 묻는 시각 풀이를 항목 · 문자열로 기억 ④ 예전 일정 가드(canLegacy)의 등록 id를 묶음으로
// ⑤ FSRS 줄의 「보이는 단어」를 id 묶음으로. 기준 구현 = helpers/reviewScopeBefore.js(바꾸기 전 글자 그대로).
// 계약: 합성 snapshot 수백 개(종류 카드 · 쉬는 카드 · 아는 단어 · 제외 · 학습 단계 · 대기 연산 · 한도 · 밀린 복습 · 범위 축 · 시각 경계)에서
// countReviewScope 결과 전체가 기준과 toStrictEqual, 같은 snapshot을 시각만 바꿔 다시 세도(캐시) 같다, 호출 수 상한(언어마다 한 번 · 단어 목록 한 번).
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { introduceFsrsCard, scheduleFsrsReview } from '../fsrsScheduler';
import { projectVocabularyLearningRows } from '../vocabularyLearningRows';
import { countReviewScope } from '../reviewScope';
import { backlogBaseline } from '../reviewQueue';
import { createFsrsReviewController } from '../useFsrsReview';
import { countReviewScopeBefore, backlogBaselineBefore } from './helpers/reviewScopeBefore';

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const iso = ms => new Date(ms).toISOString();
const ACTOR = '00000000-0000-4000-8000-000000000301';
const uuid = (p, n) => `00000000-0000-4000-8000-${p}${String(n).padStart(12 - p.length, '0')}`;
// 결정적 의사 난수(mulberry32).
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const LANGS = ['Japanese', 'Japanese', 'Japanese', 'Chinese', 'Chinese', 'English', 'French', 'Korean'];
const ZH = ['咖啡', '地铁', '你好', '经济', '北京', '学习'];
const LEVELS = { 咖啡: 2, 地铁: 2, 你好: 1, 经济: 4, 学习: 1 };

// 학습 단계 · 날 단위 카드를 실제 스케줄러로 만든다(채점 시각은 늘 기한 뒤 — 실제 기록과 같은 모양).
function fsrsCard(r, now) {
  const intro = now - Math.floor(r() * 40 * DAY) - HOUR;
  let card = introduceFsrsCard(iso(intro)), at = intro + MIN;
  const steps = Math.floor(r() * 6);
  for (let i = 0; i < steps; i++) {
    const rating = r() < 0.15 ? 1 : r() < 0.2 ? 2 : r() < 0.9 ? 3 : 4;
    const next = scheduleFsrsReview(card, rating, iso(at)).card;
    const gap = Math.floor(Math.max(MIN, (Date.parse(next.due) - at) * (1 + r() * 0.8) + 1000));
    if (at + gap > now - MIN) break;
    card = next; at += gap;
  }
  return card;
}

function account(seed, { words = 40 + Math.floor(rng(seed)() * 220), young = false } = {}) {
  const r = rng(seed * 7919 + 13);
  const now = Date.parse('2026-11-01T03:00:00Z') + Math.floor(r() * 3 * DAY);
  const fsrsShare = r(), variantShare = r(), overdueShare = 0.05 + r() * 0.6;
  const rows = [], registry = [], cards = [];
  for (let i = 0; i < words; i++) {
    const language = r() < 0.03 ? null : LANGS[Math.floor(r() * LANGS.length)];
    const reviewed = r() < 0.8;
    const created = now - Math.floor(r() * (young ? 10 : 120) * DAY) - MIN;
    const stability = reviewed ? Math.round((0.3 + r() * 40) * 100) / 100 : 0;
    const due = !reviewed ? created : r() < overdueShare ? now - Math.floor(r() * 20 * DAY) : now + Math.floor((r() - 0.05) * 30 * DAY);
    const text = language === 'Chinese' ? (r() < 0.6 ? ZH[i % ZH.length] : `${ZH[i % ZH.length]}${i}`) : language === 'Japanese' ? `単語${i}` : `word${i}`;
    const material = r() < 0.35 ? 91 + Math.floor(r() * 4) : null;
    const sentence = r() < 0.05;
    rows.push({ id: uuid('1', i + 1), user_id: ACTOR, word_text: sentence ? `${text}です。` : text, base_form: text,
      meaning: r() < 0.05 ? (r() < 0.5 ? '' : '  ') : `뜻 ${i}`, language, created_at: iso(created), interval: stability,
      ease_factor: reviewed ? Math.round((2 + r() * 7) * 100) / 100 : 0, repetitions: reviewed ? Math.floor(r() * 4) : 0,
      last_reviewed_at: reviewed ? iso(Math.min(now - HOUR, due - stability * DAY)) : null, next_review_at: iso(due),
      source_material_id: material, source_ref: material ? null : (r() < 0.3 ? (r() < 0.5 ? '오늘 학습' : '중국어 · H3') : null),
      source_sentence: r() < 0.3 ? `${text}を使った文。` : null, is_excluded: r() < 0.02, is_known: r() < 0.02 });
    const known = r() < 0.03, excluded = !known && r() < 0.03, eligible = !known && !excluded && r() > 0.02;
    if (r() < fsrsShare) {
      const card = fsrsCard(r, now);
      // 다음 질문 시각이 기한보다 늦은 카드(되돌리기 · 중단 대기) · 첫 질문 영수증 있음/없음.
      const nextQuestionAt = r() < 0.15 ? iso(Math.max(Date.parse(card.due), now + Math.floor((r() - 0.4) * 30 * MIN))) : card.due;
      const firstQuestionAt = card.state !== 'New' ? iso(Date.parse(card.introducedAt) + MIN)
        : (r() < 0.4 ? iso(Math.min(now - 1000, Date.parse(card.introducedAt) + 2 * MIN)) : null);
      registry.push({ cardId: rows[i].id, userId: ACTOR, enrolled: true, eligible, known, excluded, card, nextQuestionAt, firstQuestionAt });
      cards.push({ cardId: rows[i].id, card, attempt: null, enrolled: true, eligible: eligible && !known && !excluded, known, excluded, firstQuestionAt, nextQuestionAt });
    } else {
      registry.push({ cardId: rows[i].id, userId: ACTOR, enrolled: false, eligible, known, excluded, card: null, nextQuestionAt: null, firstQuestionAt: null });
    }
  }
  // 종류 카드(뜻 → 단어 · 듣기) — 쉬는 카드 · 오늘(학습일) 채점한 카드(형제 규칙) · 막 붙은 New.
  const base = cards.slice();
  for (let k = 0; k < Math.floor(base.length * variantShare * 1.2); k++) {
    const of = base[Math.floor(r() * base.length)];
    const kind = r() < 0.6 ? 'production' : 'listening';
    if (cards.some(c => c.vocabularyId === of.cardId && c.kind === kind)) continue;
    let card = fsrsCard(r, now);
    if (r() < 0.3 && card.state !== 'New') {
      const at = now - Math.floor(r() * 4 * HOUR);
      try { if (Date.parse(card.lastReview) < at) card = scheduleFsrsReview(card, r() < 0.5 ? 1 : 3, iso(at)).card; } catch { /* 아직 차례가 아니면 그대로 */ }
    }
    cards.push({ cardId: uuid('7', k + 1), card, attempt: null, enrolled: true, eligible: r() > 0.03, known: false, excluded: false,
      firstQuestionAt: null, nextQuestionAt: card.due, kind, vocabularyId: of.cardId, resting: r() < 0.15 });
  }
  const snapshot = projectVocabularyLearningRows({ version: 1, actorId: ACTOR, now: iso(now), enabled: r() > 0.1, complete: true, registryAvailable: true, rows, registry },
    { actorId: ACTOR });
  return { r, now, snapshot, cards, rows };
}

// 범위 축 · 한도 · 엔진 가드 조합 하나 — VocabPage countFor와 같은 인자 모양.
function argsFor(a, k) {
  const { r, rows, cards, snapshot } = a;
  const lang = [...LANGS, 'Chinese', null][Math.floor(r() * (LANGS.length + 2))];
  const state = ['due', 'due', 'new', 'fragile'][Math.floor(r() * 4)];
  const level = lang === 'Chinese' && r() < 0.3 ? ['H1', 'H2', 'H4', 'NONE'][Math.floor(r() * 4)] : null;
  const pick = n => rows.filter(() => r() < n).map(v => v.id);
  const sourceKinds = [null, null, null, { kind: 'material', ids: ['91', '93'] }, { kind: 'deck', ref: '중국어 · H3' }, { kind: 'study' },
    { kind: 'book', bookId: 'japanese-n5', from: 1, to: 42 }, { kind: 'note', ids: ['92'] }];
  const source = sourceKinds[Math.floor(r() * sourceKinds.length)];
  const lookup = source && ['book', 'material', 'note'].includes(source.kind);
  const sourceIds = lookup ? (r() < 0.1 ? null : pick(0.3)) : null;
  const chapters = source?.kind === 'book' ? Object.fromEntries((sourceIds || []).map((id, i) => [id, `u0${i % 3}`])) : null;
  const enrolled = cards.map(c => c.cardId).concat(r() < 0.3 ? pick(0.05) : []);
  const pendingIds = cards.filter(() => r() < 0.03).map(c => c.cardId);
  const registryAvailable = r() > 0.05;
  // 화면의 가드 그대로(배열 includes — 결과는 묶음과 같다): 등록 id · 대기 연산이면 예전 일정 줄에서 뺀다.
  const canLegacy = id => registryAvailable && !enrolled.includes(id) && !pendingIds.includes(id);
  const quota = r() < 0.1 ? null : { active: r() > 0.2, remaining: Math.floor(r() * 30) * (r() < 0.15 ? 0 : 1), admittedLegacyCardIds: pick(0.1) };
  const reviewKorean = r() < 0.5;
  return { snapshot: { projections: snapshot.projections, enabled: r() > 0.1 }, scope: { lang, level, source, state, ...(r() < 0.15 ? { type: r() < 0.5 ? 'word' : 'sentence' } : {}) },
    now: a.now + [0, 1, -1, 37 * MIN, 5 * HOUR, 17 * HOUR, DAY + 7][k % 7], levels: level ? LEVELS : null, sourceIds, chapters, quota,
    fsrsEntries: r() < 0.15 ? undefined : cards, fsrsEnabled: r() < 0.15 ? undefined : r() > 0.1, pendingIds, canLegacy,
    reviewSupported: word => word?.language !== 'Korean' || reviewKorean, grammar: r() < 0.5 ? [{ lang: 'japanese', next_review_at: iso(a.now - DAY) }, { lang: 'zh', next_review_at: iso(a.now + DAY) }] : null,
    fragileIds: r() < 0.5 ? pick(0.05).map(String) : null };
}

describe('countReviewScope — 바꾸기 전 구현과 결과 전체가 같다', () => {
  it('합성 snapshot 160개 × 범위 조합 4개(시각 경계 · 한도 · 밀린 복습 · 종류 카드 포함)', () => {
    let compared = 0, backlogActive = 0, variants = 0, pausedNew = 0;
    for (let seed = 1; seed <= 160; seed++) {
      const a = account(seed, { young: seed % 9 === 0 });
      variants += a.cards.filter(c => c.kind).length;
      for (let k = 0; k < 4; k++) {
        const args = argsFor(a, seed + k);
        const before = countReviewScopeBefore(args);
        const after = countReviewScope(args);
        expect(after, `seed ${seed} · ${k}`).toStrictEqual(before);
        expect(JSON.stringify(after)).toBe(JSON.stringify(before));
        compared++;
        if (after.backlog?.active) { backlogActive++; if (after.newLocked > 0) pausedNew++; }
      }
    }
    // 생성기가 실제로 그 경우들을 덮었다(빈 비교가 아니다).
    expect(compared).toBe(640);
    expect(backlogActive).toBeGreaterThan(20);
    expect(pausedNew).toBeGreaterThan(5);
    expect(variants).toBeGreaterThan(500);
  });

  it('운영 규모(단어 1,700 · FSRS 단어 약 330 + 종류 카드) — 같은 snapshot을 시각만 바꿔 다시 세도(캐시) 같다', () => {
    const a = account(4242, { words: 1700 });
    const base = argsFor(a, 0);
    for (const offset of [0, 1, 999, 30 * MIN, 3 * HOUR, 20 * HOUR, 15 * DAY]) {
      for (const scope of [{ lang: 'Japanese', level: null, source: null, state: 'due' }, { lang: 'Chinese', level: 'H2', source: null, state: 'fragile' },
        { lang: 'Japanese', level: null, source: { kind: 'study' }, state: 'new' }]) {
        const args = { ...base, scope, levels: LEVELS, now: a.now + offset, fsrsEntries: a.cards, quota: { active: true, remaining: 15, admittedLegacyCardIds: [] } };
        expect(countReviewScope(args)).toStrictEqual(countReviewScopeBefore(args));
      }
    }
  });

  it('같은 항목 객체의 시각 문자열이 바뀌면 묻는 시각도 다시 푼다(기억은 객체 · 문자열 둘 다 같을 때만)', () => {
    const a = account(77, { words: 120 });
    const args = { ...argsFor(a, 0), scope: { lang: 'Japanese', level: null, source: null, state: 'due' }, fsrsEntries: a.cards, fsrsEnabled: true,
      canLegacy: () => true, pendingIds: [], quota: { active: true, remaining: 15, admittedLegacyCardIds: [] } };
    const first = countReviewScope(args);
    expect(first).toStrictEqual(countReviewScopeBefore(args));
    expect(first.queue.items.some(item => item.engine === 'fsrs')).toBe(true);
    for (const entry of a.cards) entry.nextQuestionAt = iso(a.now + 5 * MIN); // 제자리 변경(화면은 하지 않지만 캐시가 문자열을 확인한다)
    const moved = countReviewScope(args);
    expect(moved).toStrictEqual(countReviewScopeBefore(args));
    expect(moved.queue.items.some(item => item.engine === 'fsrs')).toBe(false);
  });

  it('밀린 복습 기준 — 이분 탐색 판이 예전 훑기와 같다(경계 시각 · 기록 14일 미만 · 빈 목록 · 못 푸는 시각)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { snapshot, now, r } = account(seed, { young: seed % 4 === 0 });
      const projections = snapshot.projections;
      const lasts = projections.map(p => Date.parse(p.memory.lastReview)).filter(Number.isFinite);
      const probes = [now, now + 1, now - 1, NaN, Infinity, ...lasts.slice(0, 6).flatMap(t => [t, t - 1, t + 14 * DAY, t + 14 * DAY + 1])];
      for (const at of probes) expect(backlogBaseline(projections, { now: at }), `seed ${seed} at ${at}`).toBe(backlogBaselineBefore(projections, { now: at }));
      expect(backlogBaseline([], { now })).toBe(backlogBaselineBefore([], { now }));
      expect(backlogBaseline(null, { now: now + Math.floor(r() * DAY) })).toBe(backlogBaselineBefore(null, { now }));
    }
  });
});

const admissionAt = T => ({ version: 1, actorId: ACTOR, installed: true, enabled: true, active: true, fsrsEnabled: true, startsAt: '2026-10-02T19:00:00.000Z', now: iso(T),
  learningDay: '2026-11-03', timeZone: 'Asia/Seoul', rolloverHour: 4, limit: 15, policyRevision: 1, used: 0, remaining: 15, fsrsUsed: 0, legacyUsed: 0, admittedLegacyCardIds: [] });

describe('호출 수 · 복잡도 상한', () => {
  it('언어별 개수 셈은 언어마다 한 번 — 예전 일정 가드(canLegacy)는 범위 줄 + 언어 셈 한 번씩만 묻는다', () => {
    const a = account(5, { words: 600 });
    const args = { ...argsFor(a, 0), scope: { lang: 'Japanese', level: null, source: null, state: 'due' }, fsrsEntries: a.cards };
    let calls = 0;
    const counted = { ...args, canLegacy: id => { calls++; return args.canLegacy(id); } };
    countReviewScope(counted);
    const after = calls; calls = 0;
    countReviewScopeBefore(counted);
    const before = calls;
    // 예전: 범위 줄 1 + 언어마다 2(밀린 복습 · 언어 칩). 지금: 범위 줄 1 + 언어마다 1.
    const langs = new Set(a.snapshot.projections.map(p => p.vocabulary.language).filter(Boolean)).size;
    expect(langs).toBeGreaterThan(2);
    expect(after).toBeLessThan(before);
    expect(after).toBeLessThanOrEqual(a.snapshot.projections.length * 2);
  });

  it('같은 projections를 다른 시각으로 다시 세면 밀린 복습 기준을 위해 다시 훑지 않는다(Date.parse ≪ 단어 수)', () => {
    const a = account(6, { words: 800 });
    const args = { ...argsFor(a, 0), scope: { lang: 'Japanese', level: null, source: null, state: 'due' }, fsrsEntries: a.cards };
    countReviewScope(args);
    const spy = vi.spyOn(Date, 'parse');
    try {
      countReviewScope({ ...args, now: args.now + 1234 });
      // 예전에는 언어마다 단어 × 2(담은 시각 · 마지막 채점)를 다시 풀었다. 남은 풀이는 예전 일정 기한 · 줄 항목 몇 개뿐이다.
      expect(spy.mock.calls.length).toBeLessThan(a.snapshot.projections.length);
    } finally { spy.mockRestore(); }
  });

  it('FSRS 줄의 「보이는 단어」 — 단어 목록은 setWords마다 한 번만 훑는다(카드 수 × 단어 수가 아니다) · 고른 단어는 예전 find와 같다', async () => {
    const r = rng(99), T = Date.parse('2026-11-03T03:00:00Z');
    const words = [], cards = [];
    for (let i = 0; i < 300; i++) {
      const id = uuid('1', 1 + Math.floor(i * 0.8)); // 같은 id 중복(앞의 것이 제외 · 아는 단어일 수 있다)
      words.push({ id, word_text: `w${i}`, meaning: `m${i}`, language: 'Japanese', is_excluded: r() < 0.1, is_known: r() < 0.1 });
    }
    const ids = [...new Set(words.map(w => w.id))];
    for (const id of ids.concat([uuid('1', 9999)])) {
      const intro = introduceFsrsCard(iso(T - 3 * DAY));
      const card = { ...scheduleFsrsReview(intro, 3, iso(T - 3 * DAY + MIN)).card, state: 'Review', step: 0, scheduledDays: 2, lastReview: iso(T - 2 * DAY), due: iso(T - HOUR) };
      cards.push({ cardId: id, card, attempt: null, enrolled: true, eligible: true, known: false, excluded: false, firstQuestionAt: iso(T - 2 * DAY), nextQuestionAt: card.due });
    }
    const admission = admissionAt(T);
    const client = { start() {}, dispose() {}, subscribe: () => () => {}, pending: async () => [],
      load: async () => ({ version: 1, enabled: true, registryAvailable: true, cards: structuredClone(cards), now: iso(T), firstQuestionsToday: 0, admission }),
      question: async payload => ({ cardId: payload.cardId, card: cards.find(c => c.cardId === payload.cardId).card, admission,
        attempt: { id: payload.attemptId, phase: 'question', userId: ACTOR, cardId: payload.cardId, card: cards.find(c => c.cardId === payload.cardId).card, eligible: true, questionAt: iso(T) } }) };
    const controller = createFsrsReviewController({ accountId: ACTOR, client, now: () => T, makeId: () => `op-${Math.random()}`,
      eventTarget: null, visibilityTarget: null, setTimer: () => 1, clearTimer: () => {} });
    controller.start();
    await controller.refresh();
    const oracle = (list, scopeIds) => id => list.find(word => word.id === id && !word.is_excluded && !word.is_known && (!scopeIds || scopeIds.has(id)));
    for (const scope of [null, ids.filter(() => r() < 0.5)]) {
      let reads = 0;
      const counted = new Proxy(words.slice(), { get(target, key, receiver) { if (typeof key === 'string' && /^\d+$/.test(key)) reads++; return Reflect.get(target, key, receiver); } });
      controller.setWords(counted, scope);
      const ready = controller.getSnapshot().ready.map(e => e.cardId);
      const visible = oracle(words, scope ? new Set(scope) : null);
      expect(ready.sort()).toEqual(cards.map(c => c.cardId).filter(id => visible(id)).sort());
      // 줄 짜기 · 붙이기 판정을 거쳐도 단어 목록은 한 번(길이만큼)만 읽힌다 — 예전 find는 카드마다 목록을 훑었다(수만 번).
      expect(reads).toBeLessThanOrEqual(words.length);
      const target = ready.find(id => words.filter(w => w.id === id).length > 1) || ready[0];
      expect(await controller.question(target)).toBe(true);
      expect(controller.getSnapshot().current.word).toBe(visible(target));
      controller.leave?.();
    }
  });

  it('controller.canLegacy — 등록 id 묶음은 목록이 바뀌면 다시 만든다(예전 includes · some과 같은 답)', async () => {
    const T = Date.parse('2026-11-03T03:00:00Z');
    const intro = introduceFsrsCard(iso(T - DAY));
    let rows = [{ cardId: uuid('1', 1), card: intro, attempt: null, enrolled: true, eligible: true, known: false, excluded: false, firstQuestionAt: null, nextQuestionAt: intro.due }];
    const client = { start() {}, dispose() {}, subscribe: () => () => {}, pending: async () => [],
      load: async () => ({ version: 1, enabled: true, registryAvailable: true, cards: structuredClone(rows), now: iso(T), firstQuestionsToday: 0, admission: admissionAt(T) }) };
    const controller = createFsrsReviewController({ accountId: ACTOR, client, now: () => T, makeId: () => 'op', eventTarget: null, visibilityTarget: null, setTimer: () => 1, clearTimer: () => {} });
    const oracle = id => { const s = controller.getSnapshot(); return s.registryAvailable && !s.enrolledIds.includes(id) && !s.pending.some(e => e.cardId === id); };
    const probe = [uuid('1', 1), uuid('1', 2), uuid('1', 3), 'x'];
    for (const id of probe) expect(controller.canLegacy(id)).toBe(oracle(id));
    controller.start();
    await controller.refresh();
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', registryAvailable: true });
    expect(controller.canLegacy(uuid('1', 2))).toBe(true);
    for (const id of probe) expect(controller.canLegacy(id)).toBe(oracle(id));
    rows = [...rows, { ...rows[0], cardId: uuid('1', 2) }];
    await controller.refresh();
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', registryAvailable: true });
    expect(controller.canLegacy(uuid('1', 2))).toBe(false);
    for (const id of probe) expect(controller.canLegacy(id)).toBe(oracle(id));
  });

  it('화면 · 줄 짜기에 배열 훑기 가드가 돌아오지 않는다', () => {
    const page = readFileSync(new URL('../../views/VocabPage.jsx', import.meta.url), 'utf8');
    const hook = readFileSync(new URL('../useFsrsReview.js', import.meta.url), 'utf8');
    expect(page).not.toContain('enrolledIds.includes(');
    expect(hook).not.toContain('enrolledIds.includes(');
    expect(hook).not.toContain('words.find(');
  });
});
