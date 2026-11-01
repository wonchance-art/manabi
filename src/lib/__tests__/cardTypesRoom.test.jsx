// CARD-TYPES-001 4단계 — 복습실(/vocab)의 카드 세 종류(오너 결정 2026-11-01 KST · 설계 docs/design/card-types.md §2 · §3 · §5).
// 계약:
//   ① 문제 면은 단어 페이지와 같은 부품(CardFaces) — 뜻 → 단어 = 뜻(표제어 자리), 듣기 = 소리 단추만, 단어 → 뜻 = 지금 그대로. 종류 글씨 없음 · 답을 흘리지 않음.
//   ② 줄 — 종류 카드도 그 단어가 보이면 선다 · 형제 규칙(pickSiblings)은 단어 페이지와 같은 공유 규칙 · 쉬는 카드는 빠진다 · 막 붙은 종류 카드는 몫 밖.
//   ③ 차례로 붙이기 — 켜진 종류가 있을 때만 nextVariantKind로 바로 보내기(보낼함 아님) · 듣기는 저장한 원문 문장이 있는 단어만.
//   ④ 기본값(단어 → 뜻 하나) — 종류 카드가 없으면 줄 · 화면 그대로, 붙이기 요청 0.
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FsrsReviewSession, { FsrsQuestionFace } from '@/components/vocab/FsrsReviewSession';
import { createFsrsReviewController } from '../useFsrsReview';
import { introduceFsrsCard, scheduleFsrsReview } from '../fsrsScheduler';
import { projectVocabularyLearningRows } from '../vocabularyLearningRows';
import { countReviewScope } from '../reviewScope';

vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: { id: 'actor' }, loading: false }) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }) => createElement('a', props, children) }));
// 답 면의 원문(VocabularyContexts)은 질의를 쓴다 — 여기서는 면만 본다.
vi.mock('@/components/learning/VocabularyContexts', () => ({ default: () => null }));

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const iso = (ms) => new Date(ms).toISOString();
const T = Date.parse('2026-11-03T03:00:00Z'); // 12:00 KST
const ACTOR = '10000000-0000-4000-8000-000000000001';
const W1 = '20000000-0000-4000-8000-000000000001', W2 = '20000000-0000-4000-8000-000000000002';
const P1 = '2fffffff-0000-4000-8000-000000000001';
const WORD = { id: W1, user_id: ACTOR, word_text: '約束', furigana: 'やくそく', meaning: '약속', language: 'Japanese', source_sentence: '友達と約束があります。' };
const KIND_LABELS = ['단어 → 뜻', '뜻 → 단어', '듣기 카드', 'production', 'listening'];
const textOf = (html) => html.replace(/<[^>]+>/g, ' ');
const speak = vi.fn();

describe('① 문제 면 — 단어 페이지와 같은 부품', () => {
  const face = (kind, revealed = false, extra = {}) => renderToStaticMarkup(<FsrsQuestionFace kind={kind} word={WORD} revealed={revealed} id="h" speak={speak} ttsSupported {...extra} />);
  it('단어 → 뜻 = 표제어(지금 그대로) · 뜻 → 단어 = 뜻(표제어 칸 · 크기 칸 수) · 듣기 = 소리 단추만', () => {
    expect(face('recognition')).toBe('<h2 id="h" class="review-card__word" lang="ja">約束</h2>');
    expect(face('production')).toBe('<h2 id="h" class="review-card__word cf-meaning" lang="ko" style="--n:2">약속</h2>');
    const listen = face('listening');
    expect(listen).toMatch(/^<div class="review-card__play" id="h"><button type="button" class="lw-listen cf-play cf-play--one" aria-label="문장 듣기"/);
    expect(listen).not.toMatch(/約束|약속|やくそく|友達/);
    for (const kind of ['recognition', 'production', 'listening']) {
      const html = face(kind);
      expect(html).not.toContain('<ruby>');
      for (const label of KIND_LABELS) expect(textOf(html), label).not.toContain(label);
    }
  });
  it('답 면 — 뜻 → 단어는 표제어(루비) · 듣기는 단추가 그 자리(다시 듣기) + 표제어(루비)', () => {
    const prod = face('production', true);
    expect(prod).toContain('<ruby>約束<rt>やくそく</rt></ruby>');
    // 묻는 뜻은 답 면에서도 위에 그대로(오너 2026-11-01 KST) — 뜻 → 표제어 순서.
    expect(prod.indexOf('>약속</h2>')).toBeGreaterThan(-1);
    expect(prod.indexOf('>약속</h2>')).toBeLessThan(prod.indexOf('<ruby>約束'));
    const listen = face('listening', true);
    expect(listen).toContain('cf-play--one');
    expect(listen).toContain('<ruby>約束<rt>やくそく</rt></ruby>');
  });
  it('듣기는 저장한 원문 문장을 읽는다(없으면 그 단어) · 소리를 못 내는 기기는 단추 자리만', () => {
    expect(face('listening', false, { ttsSupported: false })).toContain('cf-play--off');
  });
  it('세션 화면 — 지금 카드의 kind로 고른다 · 정답 확인 단추는 문제 면을 함께 읽는다', () => {
    const review = { current: { cardId: P1, kind: 'production', vocabularyId: W1, word: WORD, phase: 'question', attempt: { id: 'a' }, card: {} },
      busy: false, error: null, ready: [], nextWakeAt: null, lastGrade: null, registryAvailable: true, enabled: true, completed: 0,
      controller: { question: vi.fn(), reveal: vi.fn(), grade: vi.fn(), undo: vi.fn(), leave: vi.fn(), refresh: vi.fn(), getSnapshot: () => ({}) } };
    const html = renderToStaticMarkup(<FsrsReviewSession review={review} embedded cardId={P1} stepKey="s" onExit={() => {}} speak={speak} ttsSupported />);
    expect(html).toMatch(/<h2 id="([^"]+)" class="review-card__word cf-meaning" lang="ko" style="--n:2">약속<\/h2>/);
    const id = html.match(/<h2 id="([^"]+)" class="review-card__word cf-meaning"/)[1];
    expect(html).toContain(`aria-describedby="${id}"`);
    expect(html).not.toContain('約束');
    for (const label of KIND_LABELS) expect(textOf(html), label).not.toContain(label);
  });
});

// ── 컨트롤러 ──
const card = (lastAt, dueAt) => {
  const intro = introduceFsrsCard(iso(lastAt - 2 * MIN), { policyVersion: 'anki-v2' });
  return { ...scheduleFsrsReview(intro, 3, iso(lastAt), { policyVersion: 'anki-v2' }).card, state: 'Review', step: 0, scheduledDays: 2, lastReview: iso(lastAt), due: iso(dueAt) };
};
const item = (cardId, c, extra = {}) => ({ cardId, card: c, attempt: null, enrolled: true, eligible: true, known: false, excluded: false,
  firstQuestionAt: c.state === 'New' ? null : iso(T - 5 * DAY), nextQuestionAt: c.due, ...extra });
const variant = (kind, at, extra = {}) => item(P1, introduceFsrsCard(iso(at), { policyVersion: 'anki-v2' }), { kind, vocabularyId: W1, resting: false, ...extra });
const admission = (cardKinds) => ({ version: 1, actorId: ACTOR, installed: true, enabled: true, active: true, fsrsEnabled: true, startsAt: '2026-10-02T19:00:00.000Z',
  now: iso(T), learningDay: '2026-11-03', timeZone: 'Asia/Seoul', rolloverHour: 4, limit: 15, policyRevision: 1, used: 0, remaining: 15, fsrsUsed: 0,
  legacyUsed: 0, admittedLegacyCardIds: [], ...(cardKinds ? { cardKinds } : {}) });
async function controllerWith(rows, { cardKinds = null, words = [WORD, { ...WORD, id: W2, word_text: '天気', meaning: '날씨', source_sentence: null }] } = {}) {
  const enrolls = [];
  const client = { start: vi.fn(), dispose: vi.fn(), subscribe: vi.fn(() => () => {}), pending: vi.fn(async () => []),
    load: vi.fn(async () => ({ version: 1, enabled: true, registryAvailable: true, cards: structuredClone(rows), now: iso(T), firstQuestionsToday: 0, admission: admission(cardKinds) })),
    enrollVariant: vi.fn(async (payload) => { enrolls.push(payload); return { ok: true }; }),
    question: vi.fn(async (payload) => {
      const entry = rows.find((r) => r.cardId === payload.cardId);
      return { cardId: payload.cardId, card: entry.card, attempt: { id: payload.attemptId, phase: 'question', userId: ACTOR, cardId: payload.cardId, card: entry.card, eligible: true, questionAt: iso(T) },
        admission: admission(cardKinds) };
    }) };
  const controller = createFsrsReviewController({ accountId: ACTOR, client, now: () => T, makeId: () => `op-${Math.random()}`,
    eventTarget: null, visibilityTarget: null, setTimer: () => 1, clearTimer: vi.fn() });
  controller.start();
  controller.setWords(words);
  await controller.refresh();
  return { controller, client, enrolls };
}

describe('② 줄 — 종류 카드가 선다 · 형제 규칙 · 쉬는 카드 빠짐', () => {
  it('더 오래 밀린 뜻 → 단어가 그 단어의 오늘 한 장 · 지금 카드는 종류 · 단어를 안다', async () => {
    const rows = [item(W1, card(T - 3 * DAY, T - HOUR)), variant('production', T - 2 * DAY)];
    const { controller } = await controllerWith(rows, { cardKinds: ['recognition', 'production'] });
    expect(controller.getSnapshot().ready.map((e) => e.cardId)).toEqual([P1]);
    expect(await controller.question(P1)).toBe(true);
    const current = controller.getSnapshot().current;
    expect(current).toMatchObject({ cardId: P1, kind: 'production', vocabularyId: W1 });
    expect(current.word.id).toBe(W1);
  });
  it('쉬는 카드(꺼진 종류)는 서지 않는다 · 단어가 범위 밖이면 그 종류 카드도 서지 않는다', async () => {
    const rows = [item(W1, card(T - 3 * DAY, T - HOUR)), variant('production', T - 2 * DAY, { resting: true })];
    expect((await controllerWith(rows)).controller.getSnapshot().ready.map((e) => e.cardId)).toEqual([W1]);
    const hidden = await controllerWith([variant('production', T - 2 * DAY)], { words: [] });
    expect(hidden.controller.getSnapshot().ready).toEqual([]);
  });
  it('복습실 계획(countReviewScope) — 종류 카드는 단어 범위로 보고, 막 붙은 종류 카드(New)는 몫 밖 복습 줄 · 형제는 한 장', () => {
    const rowOf = (id, word_text) => ({ id, user_id: 'actor', word_text, base_form: word_text, meaning: `뜻 ${word_text}`, language: 'Chinese', created_at: iso(T - 30 * DAY),
      interval: 0, ease_factor: 0, repetitions: 0, last_reviewed_at: null, next_review_at: null, source_material_id: null, source_ref: null });
    const rc = card(T - 3 * DAY, T + DAY); // 단어 → 뜻은 내일 차례
    const rows = [rowOf('w1', '经验')];
    const snap = projectVocabularyLearningRows({ version: 1, actorId: 'actor', now: iso(T), enabled: true, complete: true, registryAvailable: true, rows,
      registry: [{ cardId: 'w1', userId: 'actor', enrolled: true, eligible: true, known: false, excluded: false, card: rc, nextQuestionAt: rc.due, firstQuestionAt: iso(T - 3 * DAY) }] }, { actorId: 'actor' });
    const scope = { lang: 'Chinese', level: null, source: null, state: 'due' };
    const prod = { cardId: 'p1', kind: 'production', vocabularyId: 'w1', resting: false, eligible: true, known: false, excluded: false,
      card: introduceFsrsCard(iso(T - DAY), { policyVersion: 'anki-v2' }), nextQuestionAt: iso(T - DAY), firstQuestionAt: null };
    const recognition = { cardId: 'w1', card: rc, eligible: true, known: false, excluded: false, nextQuestionAt: rc.due, firstQuestionAt: iso(T - 5 * DAY) };
    const quota0 = { active: true, remaining: 0, admittedLegacyCardIds: [] };
    const plan = countReviewScope({ snapshot: snap, fsrsEntries: [recognition, prod], quota: quota0, scope, now: T });
    expect(plan.queue.ids).toEqual(['p1']); // 몫 0이어도 선다(새 단어 몫은 단어 → 뜻 첫 질문만)
    expect(plan.due).toBe(1);
    expect(countReviewScope({ snapshot: snap, fsrsEntries: [recognition, { ...prod, resting: true }], quota: quota0, scope, now: T }).queue.ids).toEqual([]);
    // 같은 날 둘 다 차례면 한 장(더 오래 밀린 것)
    const dueNow = { ...recognition, card: { ...rc, due: iso(T - 2 * DAY) }, nextQuestionAt: iso(T - 2 * DAY) };
    expect(countReviewScope({ snapshot: snap, fsrsEntries: [dueNow, prod], quota: quota0, scope, now: T }).queue.ids).toEqual(['w1']);
  });
  it('세션 화면 · 단계 판정은 카드 id → 그 단어로 찾는다(VocabPage)', () => {
    const page = fs.readFileSync('src/views/VocabPage.jsx', 'utf8');
    expect(page).toContain('const fsrsWordIdOf = useCallback(id => cardVocabularyId(fsrsReview.cards.find(entry => entry.cardId === id) || { cardId: id }), [fsrsReview.cards]);');
    expect(page).toContain('vocab.find(v => v.id === fsrsWordIdOf(currentStep.id))');
    const session = fs.readFileSync('src/components/vocab/FsrsReviewSession.jsx', 'utf8');
    expect(session).toContain('<FsrsQuestionFace kind={current.kind} word={word} revealed={revealed} id={headwordId} speak={speak} ttsSupported={ttsSupported} />');
    expect(session).toContain("import { ListenFace, MeaningFace } from '../cards/CardFaces';");
  });
});

describe('③ 차례로 붙이기 — 켜진 종류 · 날 단위 졸업 다음 학습일 · 바로 보내기', () => {
  it('뜻 → 단어가 켜졌으면 붙이고(그 단어 · 새 카드 id), 듣기는 원문 문장이 있는 단어만 · 붙인 뒤 다시 읽는다', async () => {
    const rows = [item(W1, card(T - 2 * DAY, T + DAY)), item(W2, card(T - 2 * DAY, T + DAY))];
    const { enrolls, client } = await controllerWith(rows, { cardKinds: ['recognition', 'listening'] });
    await vi.waitFor(() => expect(client.load).toHaveBeenCalledTimes(2));
    expect(enrolls).toHaveLength(1); // W2는 원문 문장이 없다
    expect(enrolls[0]).toMatchObject({ accountId: ACTOR, expectedRevision: 0, cardKind: 'listening', vocabularyId: W1, hasExample: true });
    expect(enrolls[0].cardId).not.toBe(W1);
    const prod = await controllerWith(rows, { cardKinds: ['recognition', 'production'] });
    await vi.waitFor(() => expect(prod.enrolls).toHaveLength(2));
    expect(prod.enrolls.map((e) => [e.cardKind, e.vocabularyId])).toEqual([['production', W1], ['production', W2]]);
    expect(prod.enrolls.every((e) => !('hasExample' in e))).toBe(true);
  });
  it('오늘 채점한 단어 → 뜻은 다음 학습일에(nextVariantKind 거울) · 같은 학습일에 같은 단어 · 종류는 한 번만 시도', async () => {
    const today = [item(W1, card(T - 30 * MIN, T + DAY))];
    expect((await controllerWith(today, { cardKinds: ['recognition', 'production'] })).enrolls).toEqual([]);
    const rows = [item(W1, card(T - 2 * DAY, T + DAY))];
    const { controller, enrolls } = await controllerWith(rows, { cardKinds: ['recognition', 'production'] });
    await vi.waitFor(() => expect(enrolls).toHaveLength(1));
    await controller.refresh();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(enrolls).toHaveLength(1);
  });
  it('보낼함에 넣지 않는다 — 거절이 막힌 연산으로 남아 「복습을 저장하지 못했어요」가 되지 않게', () => {
    const src = fs.readFileSync('src/lib/useFsrsReview.js', 'utf8');
    expect(src).toContain('const response = await client.enrollVariant({ accountId, cardId: makeId(), expectedRevision: 0, operationId: makeId(),');
    expect(src).not.toMatch(/client\.enroll\(\{[^}]*cardKind/);
  });
});

describe('④ 기본값(단어 → 뜻 하나) — 지금 줄 · 요청 그대로', () => {
  it('켜진 종류가 없으면(입장 상태에 칸 없음 · 단어 → 뜻 하나) 붙이기 요청 0 · 줄은 단어 → 뜻 그대로', async () => {
    const rows = [item(W1, card(T - 2 * DAY, T - HOUR)), item(W2, card(T - 2 * DAY, T + DAY))];
    for (const cardKinds of [null, ['recognition']]) {
      const { controller, enrolls } = await controllerWith(rows, { cardKinds });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(enrolls).toEqual([]);
      expect(controller.getSnapshot().ready.map((e) => e.cardId)).toEqual([W1]);
    }
  });
});
