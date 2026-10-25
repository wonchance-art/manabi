import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], get: () => undefined, set: () => {} }) }));

import { prefetchReviewRoomFirstScreen, firstScreenSkipped, reviewRoomSession, REVIEW_ROOM_PREFETCH_BUDGET_MS } from '../server/reviewRoomPrefetch';
import { buildReviewRoomFirstScreen, firstScreenSession, ownFirstScreen, plainReviewScope, FIRST_SCREEN_TTL_MS } from '../reviewRoomFirstScreen';
import { readVocabularyLearningSnapshot } from '../server/fsrsVocabulary';
import { readFsrsStatus } from '../server/fsrsLearning';
import { readLearningAdmissionStatus } from '../server/learningAdmission';
import { readLearningCapabilities } from '../server/learningCapabilities';
import { projectVocabularyLearningRows } from '../vocabularyLearningRows';
import { createFsrsReviewController } from '../useFsrsReview';
import { canUseLegacyAdmissionCompatibility, normalizeAdmissionStatus } from '../learningAdmission';
import { learningLanguageCapabilities } from '../learningCapabilities';
import { countReviewScope, createScopeMatcher, defaultReviewLang, reviewLanguageCounts, reviewScopeQuota, scopePracticeWords,
  REVIEW_SCOPE_LANGS } from '../reviewScope';
import { introduceFsrsCard, learningDay, learningDayStart, scheduleFsrsReview } from '../fsrsScheduler';
import { DEFAULT_NEW_PER_DAY } from '../vocabStudy';
import { sliceBetween } from './helpers/sliceBetween';

// VOCAB-FIRST-NUMBERS-001(로그인 감사 F2 · 오너 승인 2026-10-25 KST 「권장대로」) — /vocab 「오늘」 카드 첫 숫자를 서버가 미리 센다.
// 계약: ⑴ 같은 DB 응답이면 서버 숫자 == 브라우저가 목록을 다 받은 뒤 세는 숫자(실제 API 라우트 읽기 함수 → JSON → 실제 FSRS controller ·
// 입장 정규화 → VocabPage countFor와 같은 인자로 countReviewScope) ⑵ 학습일 경계(04:00 KST, #1561) · 유효 시간 · 다른 계정의 숫자는 쓰지 않는다
// ⑶ 손님 · 실패 · 시간 초과 · 호환 모드는 null(지금처럼 골격) ⑷ 로그인 확인은 갱신을 일으키지 않는 requireUserClaims, 페이지는 동적.
const ROOT = path.resolve(__dirname, '../../..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const ACTOR = '10000000-0000-4000-8000-000000000001';
const OTHER = '10000000-0000-4000-8000-000000000002';
const DAY = 86400000;
const AT = Date.parse('2026-10-25T03:00:00.000Z'); // 12:00 KST
const iso = ms => new Date(ms).toISOString();
const id = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** 합성 계정 — 두 엔진(예전 일정 · FSRS) · 새 표현 · 아는 단어 · 제외 · 뜻 없음 · 중국어 · 한국어가 섞여 있다. */
function account({ korean = true, remaining = 2, fsrsEnabled = true, active = true } = {}) {
  let n = 0;
  const rows = [], registry = [], states = [];
  const legacy = (extra = {}, reg = {}) => {
    const row = { id: id(++n), user_id: ACTOR, word_text: `語${n}`, base_form: `語${n}`, meaning: `뜻 ${n}`, language: 'Japanese',
      created_at: iso(AT - (100 - n) * DAY), interval: 3, ease_factor: 2.5, repetitions: 2, last_reviewed_at: iso(AT - 5 * DAY),
      next_review_at: iso(AT - 2 * DAY), source_material_id: null, source_ref: null, ...extra };
    rows.push(row);
    registry.push({ cardId: row.id, userId: ACTOR, enrolled: false, eligible: true, known: false, excluded: false, card: null, attempt: null,
      nextQuestionAt: null, firstQuestionAt: null, ...reg });
    return row;
  };
  const fsrs = (card, { firstQuestionAt = null, extra = {} } = {}) => {
    const row = legacy({ interval: null, ease_factor: null, repetitions: 0, last_reviewed_at: null, next_review_at: null, ...extra });
    const entry = registry[registry.length - 1];
    Object.assign(entry, { enrolled: true, card, nextQuestionAt: card.due, firstQuestionAt });
    states.push({ cardId: row.id, userId: ACTOR, enrolled: true, eligible: true, known: false, excluded: false, card, attempt: null,
      firstQuestionAt, nextQuestionAt: card.due });
  };
  for (let i = 0; i < 6; i++) legacy();                                                    // 예전 일정 · 기한 지난 복습
  for (let i = 0; i < 2; i++) legacy({ next_review_at: iso(AT + 3 * DAY) });               // 아직
  for (let i = 0; i < 4; i++) legacy({ repetitions: 0, interval: 0, last_reviewed_at: null, next_review_at: iso(AT - DAY) }); // 새 표현
  legacy({ meaning: '' });                                                                 // 뜻 없음
  legacy({}, { eligible: false, known: true });                                            // 아는 단어
  legacy({}, { eligible: false, excluded: true });                                         // 제외
  for (let i = 0; i < 3; i++) legacy({ language: 'Chinese', word_text: `词${i}` });         // 중국어
  if (korean) for (let i = 0; i < 2; i++) legacy({ language: 'Korean', word_text: `말${i}` }); // 한국어(능력이 있어야 복습)
  const t0 = AT - 40 * DAY;
  fsrs(scheduleFsrsReview(introduceFsrsCard(t0, { policyVersion: 'anki-v2' }), 4, t0 + 120000).card, { firstQuestionAt: iso(t0 + 60000) }); // FSRS 기한 지남
  const fresh = AT - 3600000;
  fsrs(introduceFsrsCard(fresh, { policyVersion: 'anki-v2' }));                             // FSRS 새 표현(아직 시작 전)
  const recent = AT - DAY;
  fsrs(scheduleFsrsReview(introduceFsrsCard(recent, { policyVersion: 'anki-v2' }), 4, recent + 120000).card, { firstQuestionAt: iso(recent + 60000) }); // 아직
  const admitted = [rows[8].id];
  const limit = 5, used = limit - remaining;
  const status = { version: 1, actorId: ACTOR, installed: true, enabled: active, active, fsrsEnabled, startsAt: active ? '2026-10-01T19:00:00.000Z' : null,
    now: iso(AT), learningDay: '2026-10-25', timeZone: 'Asia/Seoul', rolloverHour: 4, limit, policyRevision: 3, used, remaining,
    fsrsUsed: 0, legacyUsed: used, admittedLegacyCardIds: admitted };
  return { rows, registry, states, status, fsrsEnabled };
}

/** Supabase 흉내 — 서버 읽기 함수(API 라우트와 같은 것)가 부르는 RPC · 표만. */
function clients(world, { koreanContract = true, profile = { learning_language: ['Japanese'] }, delay = 0 } = {}) {
  const wait = () => (delay ? new Promise(r => setTimeout(r, delay)) : Promise.resolve());
  const contract = { version: 1, languages: { Korean: { save: true, review: true, known: true, exclude: true } } };
  const auth = {
    rpc: async name => {
      await wait();
      if (name === 'fsrs_capabilities') return { data: { version: 1, enabled: world.fsrsEnabled, policyVersion: 'anki-v2' }, error: null };
      if (name === 'learning_language_capabilities') return { data: koreanContract ? contract : null, error: null };
      return { data: null, error: { message: `unexpected ${name}` } };
    },
    from: table => {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: table === 'profiles' ? profile : null, error: null }) };
      return q;
    },
  };
  const service = {
    rpc: async (name) => {
      await wait();
      if (name === 'fsrs_vocabulary_snapshot') return { data: JSON.parse(JSON.stringify({ version: 1, actorId: ACTOR, enabled: world.fsrsEnabled,
        registryAvailable: true, complete: true, rows: world.rows, registry: world.registry, now: iso(AT) })), error: null };
      if (name === 'fsrs_list_states') return { data: JSON.parse(JSON.stringify(world.states)), error: null };
      if (name === 'learning_admission_status') return { data: { ...world.status }, error: null };
      return { data: null, error: { message: `unexpected ${name}` } };
    },
  };
  return { auth, service };
}

/** 브라우저 경로 — API 라우트가 돌려줄 본문(같은 서버 읽기 함수 → JSON)을 받아, 복습방이 세는 그대로 센다. */
async function browserCounts(world, { koreanContract = true } = {}) {
  const { auth, service } = clients(world, { koreanContract });
  const json = value => JSON.parse(JSON.stringify(value));
  const vocabularyBody = json(await readVocabularyLearningSnapshot({ serviceClient: service, userId: ACTOR }));
  const fsrsBody = json(await readFsrsStatus({ authClient: auth, serviceClient: service, userId: ACTOR, now: new Date(AT) }));
  const admissionBody = json(await readLearningAdmissionStatus({ authClient: auth, serviceClient: service, userId: ACTOR, now: new Date(AT) }));
  const capabilitiesBody = json(await readLearningCapabilities(auth));
  // useVocabData → fetchVocabularyLearningRows(투영)
  const learning = projectVocabularyLearningRows(vocabularyBody, { actorId: ACTOR });
  // useFsrsReview → 실제 controller(목록 읽기 · 등록 id · canLegacy)
  const controller = createFsrsReviewController({ accountId: ACTOR, eventTarget: null, visibilityTarget: null, now: () => AT,
    setTimer: () => 0, clearTimer: () => {}, client: { load: async () => fsrsBody, pending: async () => [] } });
  expect(await controller.refresh()).toBe(true);
  const fsrs = controller.getSnapshot();
  // useLearningAdmission → { quota, compatibility }
  const quota = normalizeAdmissionStatus(admissionBody, { actorId: ACTOR });
  const admission = { quota, compatibility: canUseLegacyAdmissionCompatibility(quota) };
  const scopeQuota = reviewScopeQuota(admission, { newPerDay: DEFAULT_NEW_PER_DAY, introIds: [], vocabIds: learning.rows.map(v => v.id) });
  const koreanReview = learningLanguageCapabilities('Korean', capabilitiesBody).review;
  const reviewSupported = word => word?.language !== 'Korean' || koreanReview;
  const effectiveNow = Math.max(AT, Date.parse(learning.now) || 0);
  const learningById = new Map(learning.projections.map(row => [row.vocabulary.id, row]));
  const counts = reviewLanguageCounts(learning.rows);
  const out = {};
  for (const lang of REVIEW_SCOPE_LANGS) {
    const scope = { lang, level: null, source: null, state: 'due' };
    // VocabPage countFor와 같은 인자(아래 「호출 지점」 계약이 그 줄을 고정한다).
    const count = countReviewScope({ snapshot: { projections: learning.projections, enabled: true }, scope, now: effectiveNow, levels: null,
      sourceIds: null, reviewSupported, chapters: null, quota: scopeQuota, fsrsEntries: fsrs.cards, fsrsEnabled: fsrs.enabled,
      pendingIds: fsrs.pending.map(entry => entry.cardId), canLegacy: id => !fsrs.enrolledIds.includes(id) && controller.canLegacy(id),
      grammar: [], fragileIds: [] });
    const practice = scopePracticeWords(learning.rows.filter(createScopeMatcher(scope).matches), learningById,
      { reviewSupported, state: 'due', fragileIds: [], now: effectiveNow }).length > 0;
    out[lang] = { total: count.total, due: count.due, newAllowed: count.newAllowed, newLocked: count.newLocked, noMeaning: count.noMeaning,
      stored: count.stored, backlog: count.backlog, practice, byLang: count.byLang };
  }
  controller.dispose?.();
  return { plans: out, languages: [...counts.entries()], defaultLang: defaultReviewLang('Japanese', counts), remainingNew: scopeQuota.remaining, admission };
}

async function serverFirstScreen(world, options = {}) {
  const { auth, service } = clients(world, options);
  return prefetchReviewRoomFirstScreen({ explicit: false }, { auth: async () => ({ supabase: auth, user: { id: ACTOR } }),
    serviceClient: () => service, now: () => AT, ...options.prefetch });
}

afterEach(() => { vi.useRealTimers(); });

describe('⑴ 서버 숫자 == 브라우저 숫자(같은 DB 응답 · 같은 시각)', () => {
  it('언어마다 「오늘」 수 · 복습 · 새 표현(한도 안 · 막힘) · 뜻 없음 · 밀린 복습 · 집중 연습 · 언어 칩이 같다', async () => {
    const world = account();
    const first = await serverFirstScreen(world);
    const browser = await browserCounts(world);
    expect(first).not.toBeNull();
    expect(first.actorId).toBe(ACTOR);
    expect(first.languages).toEqual(browser.languages);
    expect(first.remainingNew).toBe(browser.remainingNew);
    expect(Object.keys(first.plans).sort()).toEqual(['Chinese', 'Japanese', 'Korean']);
    for (const [lang, plan] of Object.entries(first.plans)) {
      const { byLang, ...expected } = browser.plans[lang];
      expect(plan, lang).toEqual(expected);
      expect(first.byLang, lang).toEqual(byLang);
    }
    // 의미 있는 사례인지(모두 0인 비교가 아닌지) — 두 엔진 복습 · 한도 안 새 표현 · 한도에 막힌 새 표현 · 뜻 없음이 모두 있다.
    const ja = first.plans.Japanese;
    expect(ja.due).toBe(7); // 예전 일정 6 + FSRS 1
    expect(ja.newAllowed).toBeGreaterThan(0);
    expect(ja.newLocked).toBeGreaterThan(0);
    expect(ja.noMeaning).toBe(1);
    expect(ja.total).toBe(ja.due + ja.newAllowed);
    expect(first.plans.Korean.total).toBe(2);
    expect(first.byLang).toEqual({ Japanese: ja.total, Chinese: 3, Korean: 2 });
  });
  it('한국어 능력이 없으면 양쪽 모두 한국어 표현을 세지 않는다', async () => {
    const world = account();
    const first = await serverFirstScreen(world, { koreanContract: false });
    const browser = await browserCounts(world, { koreanContract: false });
    expect(first.plans.Korean.total).toBe(0);
    expect(first.plans.Korean).toEqual((({ byLang: _b, ...rest }) => rest)(browser.plans.Korean));
    expect(first.byLang).toEqual(browser.plans.Japanese.byLang);
  });
  it('한도가 0이면 새 표현은 모두 막힘으로 — 양쪽 같다', async () => {
    const world = account({ remaining: 0 });
    const first = await serverFirstScreen(world);
    const browser = await browserCounts(world);
    expect(first.plans.Japanese.newLocked).toBeGreaterThan(0);
    expect(first.plans.Japanese).toEqual((({ byLang: _b, ...rest }) => rest)(browser.plans.Japanese));
  });
  it('한국어 표현이 없으면 능력 RPC(무거운 지문 확인)를 부르지 않는다', async () => {
    const world = account({ korean: false });
    const { auth, service } = clients(world);
    const calls = [];
    const spy = { ...auth, rpc: async (name, args) => { calls.push(name); return auth.rpc(name, args); } };
    const first = await prefetchReviewRoomFirstScreen({ explicit: false }, { auth: async () => ({ supabase: spy, user: { id: ACTOR } }),
      serviceClient: () => service, now: () => AT });
    expect(first.plans.Korean).toBeUndefined();
    expect(calls).not.toContain('learning_language_capabilities');
  });
  it('호출 지점 — 복습방이 세는 인자가 위 브라우저 경로와 같다(바뀌면 서버 첫 화면도 같이 바꿔야 한다)', () => {
    const page = read('src/views/VocabPage.jsx');
    const countFor = sliceBetween(page, 'const countFor = useCallback(target => {', '});');
    expect(countFor).toContain('...scopeArgs, scope: target, levels: target.level ? scopeLevels || zhHskLevels : null,');
    expect(countFor).toContain('sourceIds: sameSource ? scopeSourceIds : null, chapters: sameSource ? scopeChapters : null, quota: scopeQuota,');
    expect(countFor).toContain('fsrsEntries: fsrsReview.cards, fsrsEnabled: fsrsReview.enabled, pendingIds: fsrsReview.pending.map(entry => entry.cardId),');
    expect(countFor).toContain('canLegacy: id => !fsrsReview.enrolledIds.includes(id) && fsrsReview.controller.canLegacy(id), grammar: grammarRows,');
    expect(page).toContain('const scopeArgs = { snapshot: { projections, enabled: learningAvailable }, scope, now: effectiveNow, levels: scopeLevels,');
    expect(page).toContain('const scopeQuota = reviewScopeQuota(admission, { newPerDay, introIds, vocabIds: allVocab.map(v => v.id) });');
    expect(page).toContain("const reviewSupported = useCallback(word => word?.language !== 'Korean' || koreanCapabilities.review, [koreanCapabilities.review]);");
    expect(page).toContain('const effectiveNow = Math.max(Date.now(), Date.parse(learningNow) || 0);');
    // 집중 연습 유무 · 언어 칩 · 기본 언어도 같은 함수다(중복 계산 없음).
    expect(page).toContain('scopePracticeWords(vocab, learningById,');
    expect(page).toContain('reviewLanguageCounts(allVocab)');
    expect(page).toContain('const defaultLang = defaultReviewLang(profileLang, languageCounts);');
    const server = read('src/lib/reviewRoomFirstScreen.js');
    expect(server).toContain('pendingIds: [], canLegacy: id => !cardIds.has(id)');
    expect(server).toContain('scopePracticeWords(');
  });
});

describe('⑵ 경계 — 학습일(04:00 KST) · 유효 시간 · 계정 · 범위', () => {
  it('유효 시각은 다음 학습일 시작(04:00 KST)과 TTL 중 이른 쪽 — 03:59 KST에 센 숫자는 04:00부터 쓰지 않는다', async () => {
    const world = account();
    const learning = projectVocabularyLearningRows({ version: 1, actorId: ACTOR, enabled: true, registryAvailable: true, complete: true,
      rows: world.rows, registry: world.registry, now: iso(AT) }, { actorId: ACTOR });
    const fsrsBody = { actorId: ACTOR, registryAvailable: true, enabled: true, cards: world.states, admission: world.status };
    const noon = buildReviewRoomFirstScreen({ actorId: ACTOR, learning, fsrs: fsrsBody, profileLang: 'Japanese', now: AT });
    expect(Date.parse(noon.validUntil)).toBe(AT + FIRST_SCREEN_TTL_MS);
    const before = Date.parse('2026-10-25T18:59:30.000Z'); // 03:59:30 KST(다음 날)
    const nextDay = learningDayStart(learningDay(before) + 1);
    expect(iso(nextDay)).toBe('2026-10-25T19:00:00.000Z');
    const late = buildReviewRoomFirstScreen({ actorId: ACTOR, learning, fsrs: fsrsBody, profileLang: 'Japanese', now: before });
    expect(Date.parse(late.validUntil)).toBe(nextDay);
    const scope = { lang: 'Japanese', level: null, source: null, state: 'due' };
    expect(firstScreenSession(late, { actorId: ACTOR, scope, now: nextDay - 1 })).not.toBeNull();
    expect(firstScreenSession(late, { actorId: ACTOR, scope, now: nextDay })).toBeNull();
    expect(ownFirstScreen(late, ACTOR, nextDay)).toBeNull();
  });
  it('다른 계정 · 손님 · 좁힌 범위(급수 · 출처 · 상태 · 종류)에는 쓰지 않는다', async () => {
    const first = await serverFirstScreen(account());
    const now = AT + 1000;
    const plain = { lang: 'Japanese', level: null, source: null, state: 'due' };
    const view = firstScreenSession(first, { actorId: ACTOR, scope: plain, now });
    expect(view.session).toMatchObject({ status: 'ready', total: first.plans.Japanese.total, due: first.plans.Japanese.due, byLang: first.byLang });
    expect(view.session.queue.items).toEqual([]); // 시작 줄은 브라우저가 짠다 — 첫 화면으로는 시작하지 않는다
    expect(firstScreenSession(first, { actorId: OTHER, scope: plain, now })).toBeNull();
    expect(firstScreenSession(first, { actorId: null, scope: plain, now })).toBeNull();
    expect(ownFirstScreen(first, OTHER, now)).toBeNull();
    for (const scope of [{ ...plain, lang: 'Chinese', level: 'H2' }, { ...plain, source: { kind: 'study' } }, { ...plain, state: 'fragile' },
      { ...plain, state: 'new' }, { ...plain, type: 'word' }]) {
      expect(plainReviewScope(scope)).toBe(false);
      expect(firstScreenSession(first, { actorId: ACTOR, scope, now })).toBeNull();
    }
    expect(firstScreenSession(first, { actorId: ACTOR, scope: { ...plain, lang: 'French' }, now })).toBeNull(); // 센 적 없는 언어
  });
  it('명시 주소가 좁힌 범위 · 무효면 서버는 읽지도 않는다', async () => {
    expect(firstScreenSkipped({ explicit: false })).toBe(false);
    expect(firstScreenSkipped({ explicit: true, scope: { lang: 'Chinese', level: null, source: null, state: 'due' } })).toBe(false);
    expect(firstScreenSkipped({ explicit: true, scope: { lang: 'Chinese', level: 'H2', source: null, state: 'due' } })).toBe(true);
    expect(firstScreenSkipped({ explicit: true, scope: { lang: 'Japanese', source: { kind: 'book' }, state: 'due' } })).toBe(true);
    expect(firstScreenSkipped({ explicit: true, scope: { lang: 'Japanese', state: 'new' } })).toBe(true);
    expect(firstScreenSkipped({ explicit: true, invalid: true })).toBe(true);
    const auth = vi.fn();
    expect(await prefetchReviewRoomFirstScreen({ explicit: true, scope: { lang: 'Chinese', level: 'H2', state: 'due' } }, { auth })).toBeNull();
    expect(auth).not.toHaveBeenCalled();
  });
});

describe('⑶ 손님 · 실패 · 시간 초과 · 호환 모드 → null(지금처럼 브라우저가 받는다)', () => {
  it('손님(세션 없음)은 null이고 DB를 읽지 않는다', async () => {
    const service = vi.fn();
    expect(await prefetchReviewRoomFirstScreen({ explicit: false }, { auth: async () => ({ error: '로그인이 필요해요.', status: 401 }), serviceClient: service })).toBeNull();
    expect(service).not.toHaveBeenCalled();
  });
  it('읽기 실패 · 서비스 키 없음은 던지지 않고 null', async () => {
    const world = account();
    const { auth, service } = clients(world);
    const broken = { rpc: async name => (name === 'fsrs_vocabulary_snapshot' ? { data: null, error: { message: 'timeout', code: '57014' } } : service.rpc(name)) };
    const session = async () => ({ supabase: auth, user: { id: ACTOR } });
    expect(await prefetchReviewRoomFirstScreen({ explicit: false }, { auth: session, serviceClient: () => broken, now: () => AT })).toBeNull();
    expect(await prefetchReviewRoomFirstScreen({ explicit: false }, { auth: session, serviceClient: () => { throw new Error('fsrs_storage_unavailable'); } })).toBeNull();
  });
  it('예산(800ms)을 넘기면 null — 페이지 응답을 붙잡지 않는다', async () => {
    expect(REVIEW_ROOM_PREFETCH_BUDGET_MS).toBe(800);
    const world = account();
    const started = Date.now();
    const first = await serverFirstScreen(world, { delay: 200, prefetch: { budgetMs: 50 } });
    expect(first).toBeNull();
    expect(Date.now() - started).toBeLessThan(180);
    const slowAuth = await prefetchReviewRoomFirstScreen({ explicit: false }, { budgetMs: 30, auth: () => new Promise(r => setTimeout(() => r({ user: { id: ACTOR } }), 200)) });
    expect(slowAuth).toBeNull();
  });
  it('호환 모드(서버 한도 없음 — 이 기기의 하루 한도로 센다)는 서버가 셀 수 없어 null', async () => {
    const world = account({ fsrsEnabled: false, active: false });
    expect(canUseLegacyAdmissionCompatibility(world.status)).toBe(true);
    expect(await serverFirstScreen(world)).toBeNull();
  });
  it('계정이 다른 정본(행 · 목록)은 null', () => {
    const world = account();
    const learning = projectVocabularyLearningRows({ version: 1, actorId: ACTOR, enabled: true, registryAvailable: true, complete: true,
      rows: world.rows, registry: world.registry, now: iso(AT) }, { actorId: ACTOR });
    const fsrsBody = { actorId: ACTOR, registryAvailable: true, enabled: true, cards: world.states, admission: world.status };
    expect(buildReviewRoomFirstScreen({ actorId: OTHER, learning, fsrs: fsrsBody, now: AT })).toBeNull();
    expect(buildReviewRoomFirstScreen({ actorId: ACTOR, learning, fsrs: { ...fsrsBody, actorId: OTHER }, now: AT })).toBeNull();
    expect(buildReviewRoomFirstScreen({ actorId: ACTOR, learning, fsrs: { ...fsrsBody, registryAvailable: false }, now: AT })).toBeNull();
  });
});

describe('⑷ 로그인 확인 · 캐시 경계 · 화면 배선', () => {
  it('로그인 확인은 한 번 — 넘겨받은 세션이면 다시 확인하지 않고, 손님 · 실패 · 시간 초과는 null', async () => {
    const world = account();
    const { auth, service } = clients(world);
    const check = vi.fn();
    const first = await prefetchReviewRoomFirstScreen({ explicit: false }, { session: { supabase: auth, user: { id: ACTOR } }, auth: check,
      serviceClient: () => service, now: () => AT });
    expect(first?.actorId).toBe(ACTOR);
    expect(check).not.toHaveBeenCalled();
    expect(await reviewRoomSession({ auth: async () => ({ error: '로그인이 필요해요.', status: 401 }) })).toBeNull();
    expect(await reviewRoomSession({ auth: async () => { throw new Error('jwks'); } })).toBeNull();
    expect(await reviewRoomSession({ auth: () => new Promise(r => setTimeout(() => r({ user: { id: ACTOR } }), 200)), budgetMs: 20 })).toBeNull();
    expect((await reviewRoomSession({ auth: async () => ({ supabase: auth, user: { id: ACTOR } }) })).user.id).toBe(ACTOR);
  });
  it('로그인 복원 전 목록 받기 — 서버가 확인한 계정만, useVocabData와 같은 키 · 같은 함수', () => {
    const page = read('src/views/VocabPage.jsx');
    const head = sliceBetween(page, 'export default function VocabPage(', 'if (loading) return');
    expect(head).toContain('usePrefetchVocabLearning(serverUserId, loading);');
    const data = read('src/lib/useVocabData.js');
    const prefetch = sliceBetween(data, 'export function usePrefetchVocabLearning(serverUserId, enabled) {', '\n}');
    expect(prefetch).toContain("queryKey: ['vocab', serverUserId, 'learning'], queryFn: ({ signal }) => fetchVocabLearningData(serverUserId, { signal })");
    expect(prefetch).toContain('if (!enabled ||');
    expect(data).toContain("queryKey: ['vocab', user?.id, 'learning'],");
    expect(data).toContain('queryFn: ({ signal }) => fetchVocabLearningData(user.id, { signal, getActorId: () => actorRef.current }),');
    expect(read('src/app/(app)/vocab/page.jsx')).toContain('serverUserId={session?.user.id ?? null}');
  });
  it('서버 읽기는 갱신을 일으키지 않는 requireUserClaims, API 라우트와 같은 읽기 함수만 쓴다', () => {
    const server = read('src/lib/server/reviewRoomPrefetch.js');
    expect(server).toContain("import { requireUserClaims } from '@/lib/supabaseServer';");
    expect(server).toMatch(/auth = requireUserClaims/);
    expect(server).not.toMatch(/requireUser\(|requireUserForRead\(|getUser\(|getSession\(/);
    for (const fn of ['readVocabularyLearningSnapshot', 'readFsrsStatus', 'readLearningCapabilities']) expect(server).toContain(fn);
    // 같은 읽기 함수를 API 라우트가 쓴다(새 조회 없음).
    expect(read('src/app/api/learning/vocabulary/route.js')).toContain('readVocabularyLearningSnapshot({');
    expect(read('src/app/api/learning/fsrs/route.js')).toContain('readFsrsStatus({');
    expect(read('src/app/api/learning/capabilities/route.js')).toContain('readLearningCapabilities(auth.supabase)');
  });
  it('페이지는 동적(요청마다) · 숫자 약속을 기다리지 않고 넘긴다(본문 · 골격이 먼저 나간다)', () => {
    const page = read('src/app/(app)/vocab/page.jsx');
    expect(page).toContain("export const dynamic = 'force-dynamic';");
    expect(page).toContain('const session = await reviewRoomSession();');
    expect(page).toContain('firstScreen={session ? prefetchReviewRoomFirstScreen(reviewScope, { session }) : null}');
    expect(page).not.toMatch(/await prefetchReviewRoomFirstScreen/);
    expect(page).not.toMatch(/revalidate|unstable_cache|'use cache'/);
  });
  it('첫 화면 숫자 동안 시작 · 집중 연습은 잠기고, 목록 칸은 골격이다(빈 목록 · 0을 그리지 않는다)', () => {
    const page = read('src/views/VocabPage.jsx');
    expect(page).toContain('const first = ownFirstScreen(usePromiseValue(firstScreen), user?.id);');
    expect(page).toContain("? firstScreenSession(first, { actorId: user?.id, scope }) : null;");
    expect(page).toContain("disabled={startingReview || !!firstView || !fsrsReview.registryAvailable || admission.status !== 'ready'}");
    expect(page).toContain("{startingReview || firstView || fsrsReview.status === 'loading' ? '복습 준비 중…'");
    expect(page).toContain('{hasPractice && <Button variant="ghost" disabled={!!firstView}');
    expect(page).toContain('onPractice={hasPractice ? () => { if (!firstView) startPractice(practiceWords); } : null}');
    expect(page).toContain('{firstView ? <div className="review-sec--vocab" aria-busy="true"><CardGridSkeleton count={2} height={120} /></div> : <>');
    // 브라우저가 셀 수 있게 되면(목록 · 한도 · FSRS · 한국어 능력) 첫 화면 값을 놓는다 — 실패(error)면 처음부터 쓰지 않는다.
    expect(page).toContain("const firstView = tab === 'list' && settingsRestored && !vocabError && fsrsReview.status !== 'error' && admission.status !== 'error'");
    expect(page).toContain("&& (isLoading || roomWaiting || roomHeroPending || (koreanCapabilities.isLoading && languageCounts.has('Korean')))");
    expect(read('src/components/vocab/ReviewScopeBar.jsx')).toContain('className="review-scope__add" aria-haspopup="dialog" disabled={pending}');
  });
});
