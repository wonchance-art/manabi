import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { introduceFsrsCard, scheduleFsrsReview } from '../fsrsScheduler';
import { projectVocabularyLearningRows } from '../vocabularyLearningRows';
import { loadZhHskLevels } from '../zhHskLevel';
import { bookReviewHref } from '../bookReviewNavigation';
import { sliceBetween } from './helpers/sliceBetween';
import {
  countReviewScope, parseReviewScope, serializeReviewScope, scopedFsrsCardIds, createScopeMatcher, scopeHeading,
} from '../reviewScope';

// REV-SCOPE-R1A 계약(설계 §8 R1-A 줄). 각 단언은 대상 코드를 되돌리면 실패한다(보고서의 되돌림 증거 표 참고).
vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: { id: 'actor' }, loading: false }) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }) => createElement('a', props, children) }));

const read = path => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const DAY = 86_400_000;
const START = Date.parse('2026-10-01T00:00:00.000Z');
const NOW = START + 2 * DAY;
const iso = value => new Date(value).toISOString();
const reading = '/books/japanese-n5?edition=8a8c1c1fd452773810abaf8c#u07-start';

// created_at: 기록이 14일에 못 미치는 계정 — 밀린 복습 기준이 기본값 20이라(R1-B-1) 이 범위 계약들이 밀린 복습 규칙과 섞이지 않는다.
// 밀린 복습 규칙 자체는 reviewQueue.test.js · 아래 「밀린 복습」 계약이 따로 잡는다.
function row(id, word_text, language, extra = {}) {
  return { id, user_id: 'actor', word_text, base_form: word_text, meaning: `뜻 ${word_text}`, language, created_at: iso(NOW - 12 * DAY),
    interval: 30, ease_factor: 5, repetitions: 3, last_reviewed_at: iso(START - DAY), next_review_at: iso(START),
    source_material_id: null, source_ref: null, ...extra };
}
// 일본어 · 중국어(HSK 2026: 咖啡 · 地铁 = 2, 你好 = 1, 经济 = 4, 北京 = 표 밖) · 프랑스어, 예전 일정 + FSRS.
function snapshot({ fsrs = true, enabled = true } = {}) {
  const rows = [
    row('c1', '咖啡', 'Chinese', { source_material_id: 91 }),                                   // H2 · 자료 91에서 저장 · 기한 지남
    row('c2', '地铁', 'Chinese', { interval: 0, repetitions: 0, last_reviewed_at: null }),        // H2 · 새 표현 · 자료 91 문맥(서버 조회)
    row('c3', '你好', 'Chinese', { source_material_id: 91, interval: 1, last_reviewed_at: iso(START - 60 * DAY) }), // H1 · 흐릿
    row('c4', '北京', 'Chinese', { source_material_id: 91, source_ref: '중국어 · H3' }),          // 미분류 · 덱
    row('c5', '经济', 'Chinese', { source_material_id: 92 }),                                   // H4 · FSRS 카드
    row('j1', '駅', 'Japanese', { source_material_id: 91 }),                                    // 같은 자료, 다른 언어
    row('j2', '電車', 'Japanese', { source_ref: '오늘 학습', interval: 0, repetitions: 0, last_reviewed_at: null }),
    row('f1', 'bonjour', 'French'),
  ];
  const card = scheduleFsrsReview(introduceFsrsCard(START - 3 * DAY), 3, START - 3 * DAY + 60_000).card;
  const registry = rows.map(r => (fsrs && r.id === 'c5'
    ? { cardId: r.id, userId: 'actor', enrolled: true, eligible: true, known: false, excluded: false, card, nextQuestionAt: card.due, firstQuestionAt: iso(START - 3 * DAY + 60_000) }
    : { cardId: r.id, userId: 'actor', enrolled: false, eligible: true, known: false, excluded: false, card: null, nextQuestionAt: null, firstQuestionAt: null }));
  return projectVocabularyLearningRows({ version: 1, actorId: 'actor', now: iso(NOW), enabled, complete: true, registryAvailable: true, rows, registry }, { actorId: 'actor' });
}
const quota = (remaining = 10) => ({ active: true, remaining, admittedLegacyCardIds: [] });
const languageOf = (snap, id) => snap.rows.find(r => r.id === id)?.language;

describe('범위 ↔ 주소 왕복 — 모든 R1 진입점이 같은 문자열을 만든다', () => {
  const entries = {
    '교재 도구막대(전체 과)': bookReviewHref(reading),
    '교재 과 끝(7과)': bookReviewHref(reading, { from: 7, to: 7 }),
    '자료 뷰어': serializeReviewScope({ lang: 'Chinese', level: null, source: { kind: 'material', ids: ['91'] }, state: 'due' }),
    '배움 칸(AK)': serializeReviewScope({ lang: 'Chinese', level: null, source: null, state: 'due' }),
    '현황 레벨 어휘(AK)': serializeReviewScope({ lang: 'Chinese', level: 'H2', source: null, state: 'due' }),
    '현황 기억 건강(AK)': serializeReviewScope({ lang: 'Japanese', level: null, source: null, state: 'fragile' }),
    '오너 사례': serializeReviewScope({ lang: 'Chinese', level: 'H2', source: { kind: 'material', ids: ['91', '92'] }, state: 'due' }),
    '사전 급수 덱': serializeReviewScope({ lang: 'Chinese', level: null, source: { kind: 'deck', ref: '중국어 · H3' }, state: 'new' }),
    '오늘 학습': serializeReviewScope({ lang: 'Japanese', level: null, source: { kind: 'study' }, state: 'due' }),
    '노트': serializeReviewScope({ lang: 'Japanese', level: null, source: { kind: 'note', ids: ['5'] }, state: 'due' }),
  };
  it.each(Object.entries(entries))('%s', (_name, href) => {
    const parsed = parseReviewScope(new URL(href, 'https://local').searchParams);
    expect(parsed.explicit).toBe(true);
    expect(parsed.invalid).toBeUndefined();
    expect(serializeReviewScope(parsed.scope, { returnTo: parsed.returnTo })).toBe(href);
  });
  it('정본 모양 — 교재 범위 · 돌아갈 곳 · state=due 생략', () => {
    expect(entries['교재 과 끝(7과)']).toBe(`/vocab?lang=Japanese&src=book%3Ajapanese-n5%3A7-7&returnTo=${encodeURIComponent(reading)}`);
    expect(entries['현황 레벨 어휘(AK)']).toBe('/vocab?lang=Chinese&level=H2');
    expect(serializeReviewScope({ lang: 'Chinese', level: null, source: null, state: 'due' })).toBe('/vocab?lang=Chinese');
  });
  it('옛 ?book= 링크는 교재 전체(1–42과) 범위 + 돌아갈 곳 그대로', () => {
    const legacy = parseReviewScope({ book: 'japanese-n5', returnTo: reading });
    expect(legacy).toEqual(parseReviewScope(new URL(entries['교재 도구막대(전체 과)'], 'https://local').searchParams));
    expect(legacy.scope.source).toEqual({ kind: 'book', bookId: 'japanese-n5', from: 1, to: 42 });
    expect(scopeHeading(legacy.scope)).toBe('복습 · 교재 전체');
    expect(scopeHeading(parseReviewScope({ src: 'book:japanese-n5:5-10' }).scope)).toBe('복습 · 교재 5–10과');
  });
  it('주소에 범위 키가 없으면 명시 범위가 아니다(저장 설정을 쓴다)', () => {
    expect(parseReviewScope({})).toEqual({ explicit: false });
    expect(parseReviewScope({ returnTo: reading, utm: 'x' })).toEqual({ explicit: false });
  });
});

describe('무효 범위는 닫힌다 — 「전체」로 새지 않는다', () => {
  it.each([
    [{ lang: 'Spanish' }], [{ lang: 'Japanese', level: 'H2' }], [{ level: 'N5' }], [{ level: 'H8' }],
    [{ src: 'book:japanese-n5:0-3' }], [{ src: 'book:japanese-n5:7-5' }], [{ src: 'book:japanese-n5:1-43' }], [{ src: 'book:japanese-n5:05-10' }],
    [{ src: 'book:chinese-h1:1-2' }], [{ lang: 'Chinese', src: 'book:japanese-n5:1-2' }], [{ level: 'H2', src: 'book:japanese-n5:1-2' }],
    [{ src: 'material:91,91' }], [{ src: 'material:0' }], [{ src: `material:${Array.from({ length: 21 }, (_, i) => i + 1).join(',')}` }],
    [{ src: 'note:1,2' }], [{ src: 'deck:' }], [{ src: 'deck:%E0%A4%A' }], [{ src: 'everything' }], [{ state: 'all' }],
    [{ lang: ['Chinese', 'Japanese'] }], [{ book: 'japanese-n5', src: 'study' }], [{ book: 'unknown' }],
  ])('%j', params => {
    expect(parseReviewScope(params)).toMatchObject({ explicit: true, invalid: true });
  });
  it('조회 결과 · 급수 표가 없으면 개수 · 줄 · FSRS 범위 모두 비어 있다(pending) — 전체를 대신 세지 않는다', () => {
    const snap = snapshot();
    const material = { lang: 'Chinese', level: null, source: { kind: 'material', ids: ['91'] }, state: 'due' };
    const pending = countReviewScope({ snapshot: snap, quota: quota(), scope: material, now: NOW, sourceIds: null });
    expect(pending).toMatchObject({ status: 'pending', total: 0, due: 0, newAllowed: 0, queue: { legacyIds: [], fsrsIds: [] } });
    expect(scopedFsrsCardIds({ snapshot: snap, scope: material, now: NOW, sourceIds: null })).toBeNull();
    const level = countReviewScope({ snapshot: snap, quota: quota(), scope: { lang: 'Chinese', level: 'H2', source: null, state: 'due' }, now: NOW, levels: null });
    expect(level).toMatchObject({ status: 'pending', total: 0 });
    expect(createScopeMatcher({ lang: null }).ready).toBe(false);
  });
});

describe('countReviewScope — 보이는 개수 = 시작하는 줄 길이 · 언어 밖 카드 0', () => {
  it('오너 사례 /vocab?lang=Chinese&level=H2&src=material:91 — 저장 출처 ∪ 문맥 출처, 같은 자료의 일본어는 0장', async () => {
    const snap = snapshot({ fsrs: false });
    const levels = await loadZhHskLevels();
    const scope = parseReviewScope({ lang: 'Chinese', level: 'H2', src: 'material:91' }).scope;
    const count = countReviewScope({ snapshot: snap, quota: quota(), scope, now: NOW, levels, sourceIds: ['c2', 'j1'] });
    expect(count.engine).toBe('legacy');
    expect(count.queue.legacyIds).toEqual(['c1', 'c2']);
    expect(count.total).toBe(count.queue.legacyIds.length);
    expect(count).toMatchObject({ due: 1, newAllowed: 1, newLocked: 0, total: 2 });
    for (const id of [...count.queue.legacyIds, ...count.queue.fsrsIds]) expect(languageOf(snap, id)).toBe('Chinese');
  });
  it('새 표현 한도가 개수와 줄에 같이 걸린다 — 막힌 수는 newLocked', async () => {
    const snap = snapshot({ fsrs: false });
    const scope = { lang: 'Chinese', level: 'H2', source: null, state: 'due' };
    const count = countReviewScope({ snapshot: snap, quota: quota(0), scope, now: NOW, levels: await loadZhHskLevels() });
    expect(count).toMatchObject({ total: 1, newAllowed: 0, newLocked: 1 });
    expect(count.queue.legacyIds).toEqual(['c1']);
  });
  it('R1-B-1: FSRS 카드와 예전 일정 카드가 한 줄에 섞인다(FSRS 독점 없음) — 줄 길이 = total, FSRS 범위 = 같은 판정', () => {
    const snap = snapshot();
    const scope = { lang: 'Chinese', level: null, source: null, state: 'due' };
    const fsrsEntries = snap.registry.filter(entry => entry.enrolled);
    const count = countReviewScope({ snapshot: snap, fsrsEntries, quota: quota(), scope, now: NOW });
    expect(count.engine).toBe('mixed');
    expect(count.deferred).toBe(0);
    expect(count.queue.items.map(item => item.engine).sort()).toEqual(['fsrs', 'legacy', 'legacy', 'legacy', 'legacy']);
    expect(count.queue.ids).toContain('c5');
    expect(count.queue.legacyIds).toEqual(count.queue.items.filter(item => item.engine === 'legacy').map(item => item.id));
    expect(count.total).toBe(count.queue.items.length);
    expect(count).toMatchObject({ due: 4, newAllowed: 1, total: 5 });
    expect(count.queue.fsrsIds).toEqual(['c5']);
    expect(scopedFsrsCardIds({ snapshot: snap, scope, now: NOW })).toEqual(count.queue.fsrsIds);
    // 일본어 범위에서는 중국어 FSRS 카드가 줄에 들어오지 않는다
    const ja = countReviewScope({ snapshot: snap, fsrsEntries, quota: quota(), scope: { ...scope, lang: 'Japanese' }, now: NOW });
    expect(ja.engine).toBe('legacy');
    expect(ja.queue.fsrsIds).toEqual([]);
    for (const id of ja.queue.ids) expect(languageOf(snap, id)).toBe('Japanese');
  });
  it('byLang(언어 칩) = 그 언어만 고른 범위의 total · 문법은 별줄(total에 넣지 않음)', () => {
    const snap = snapshot();
    const grammar = [{ lang: 'Japanese', next_review_at: iso(START) }, { lang: 'Chinese', next_review_at: iso(NOW + DAY) }, { lang: 'japanese', next_review_at: iso(START) }];
    const count = countReviewScope({ snapshot: snap, fsrsEntries: snap.registry.filter(e => e.enrolled), quota: quota(), scope: { lang: 'Japanese', level: null, source: null, state: 'due' }, now: NOW, grammar });
    expect(count.byLang).toEqual({ Japanese: 2, Chinese: 5, French: 1 });
    expect(count.total).toBe(count.byLang.Japanese);
    expect(count.grammarDue).toBe(2);
    expect(count.total).toBe(count.queue.legacyIds.length);
  });
  it('상태 · 출처 축: 새 표현만 · 흐릿 · 위험 · 덱 · 오늘 학습', () => {
    const snap = snapshot({ fsrs: false });
    const base = { lang: 'Chinese', level: null, source: null, state: 'due' };
    expect(countReviewScope({ snapshot: snap, quota: quota(), scope: { ...base, state: 'new' }, now: NOW }).queue.legacyIds).toEqual(['c2']);
    expect(countReviewScope({ snapshot: snap, quota: quota(), scope: { ...base, state: 'fragile' }, now: NOW }).queue.legacyIds).toEqual(['c3']);
    expect(countReviewScope({ snapshot: snap, quota: quota(), scope: { ...base, source: { kind: 'deck', ref: '중국어 · H3' } }, now: NOW }).queue.legacyIds).toEqual(['c4']);
    expect(countReviewScope({ snapshot: snap, quota: quota(), scope: { ...base, lang: 'Japanese', source: { kind: 'study' } }, now: NOW }).queue.legacyIds).toEqual(['j2']);
  });
});

describe('호출 지점 — 개수는 countReviewScope 하나, 시작은 같은 결과의 줄', () => {
  const page = read('src/views/VocabPage.jsx');
  const bar = read('src/components/vocab/ReviewScopeBar.jsx');
  it('복습방 숫자 · 언어 칩 · 시트 숫자가 countReviewScope에서 나온다', () => {
    expect(page.match(/countReviewScope\(/g)).toHaveLength(1);
    expect(page).toContain('const scopeCount = useMemo(() => (admission.quota && learningAvailable ? countFor(scope) : null)');
    expect(page).toContain('byLang={session.byLang} countFor={countFor}');
    expect(page).toContain('<strong className="vocab-hero__num">{session.total}</strong>');
    // 세션 길이 칩(R1-B-1): 버튼 숫자 = 시작하는 줄 길이 = 같은 계산의 queue를 앞에서 자른 길이.
    expect(page).toContain('const sessionCards = sliceSession(session.queue.items, activeLength);');
    expect(page).toContain('`표현 ${sessionCards.length}개 복습 →`');
    expect(bar).not.toContain('countReviewScope(');
    expect(bar).not.toMatch(/isVocabularyReviewDue|vocabularyRetrievability/);
  });
  it('시작하는 줄 = 같은 계산의 queue, FSRS 범위 = 같은 판정(scopedFsrsCardIds)', () => {
    const start = sliceBetween(page, 'const startReview = () =>', '\n  };');
    expect(start).toContain('startSession(null, { items: sessionCards })');
    expect(page).not.toContain('includeFsrs');
    expect(page).toContain('scopedFsrsCardIds(scopeArgs)');
    expect(page).toMatch(/useFsrsReview\(\{ accountId: user\?\.id, words: allVocab, scopeIds: fsrsScopeIds,/);
  });
  it('조회 실패 · 판정 전에는 시작하지 않고, 닫힘 문구에는 시작 버튼이 없다', () => {
    expect(page).toContain('if (queue.length === 0 || startingRef.current || scopePending || scopeFailed || (explicitScope && vocabError)) return;');
    const closed = sliceBetween(page, "scopeFailed ? (", ') : vocabError');
    expect(closed).toContain('<h2>범위를 불러오지 못했어요.</h2><p>전체로 바꾸지 않았어요.');
    expect(closed).toContain('>다시 시도</button>');
    expect(closed).toContain('>범위 풀기</button>');
    expect(closed).not.toContain('startReview');
  });
  it('명시 범위 · 무효 범위는 저장 설정을 덮지 않는다', () => {
    const save = sliceBetween(page, 'useEffect(() => {\n    if (!settingsRestored || explicitScope', '}, [scopeDraft, settingsRestored, explicitScope]);');
    expect(save).toContain('localStorage.setItem(SAVED_SCOPE_KEY');
    expect(page).not.toMatch(/localStorage\.setItem\('vocab_(langFilter|levelFilter|seriesFilter)'/);
    expect(read('src/views/VocabList.jsx')).not.toContain("localStorage.setItem('vocab_langFilter'");
  });
  it('명시 주소에서 범위를 바꾸면 주소도 같은 범위가 된다 — 새로고침해도 급수가 남는다(M09 6152793665)', () => {
    const sync = sliceBetween(page, 'const entryUrlRef = useRef(null);', '}, [scopeDraft, explicitScope]);');
    expect(sync).toContain('if (!explicitScope || !scopeDraft');
    expect(sync).toContain('serializeReviewScope(scopeDraft, { returnTo: explicitScope.returnTo })');
    expect(sync).toContain('window.history.replaceState(window.history.state, \'\', target)');
    // 주소 → 범위 → 주소 왕복: 시트에서 HSK 3을 적용한 범위는 새로고침 때 같은 범위로 다시 읽힌다.
    const applied = { lang: 'Chinese', level: 'H3', source: null, state: 'due' };
    const href = serializeReviewScope(applied);
    expect(href).toBe('/vocab?lang=Chinese&level=H3');
    const reread = parseReviewScope(Object.fromEntries(new URL(href, 'http://x').searchParams));
    expect(reread.explicit).toBe(true);
    expect(reread.scope.level).toBe('H3');
    expect(serializeReviewScope(reread.scope)).toBe(href);
  });
  it('무효 주소는 닫힘 화면 — 시작 버튼 · 목록 없이 범위 풀기만', async () => {
    const { default: VocabPage } = await import('../../views/VocabPage');
    const html = renderToStaticMarkup(createElement(VocabPage, { reviewScope: parseReviewScope({ lang: 'Japanese', level: 'H2' }) }));
    expect(html).toContain('범위 주소를 읽지 못했어요.');
    expect(html).toContain('전체로 바꾸지 않았어요.');
    expect(html).toContain('href="/vocab"');
    expect(html).not.toContain('review-room-start');
  });
});

describe('진입점 배선', () => {
  it('교재 도구막대 「담은 표현」은 채점 복습방(교재 범위)으로, 과 끝은 그 과 범위로 간다', () => {
    const reader = read('src/components/books/BookReader.jsx');
    expect(reader).toContain('href={bookReviewHref(bookHref(book.edition, reference ? progress.page : active || pageId))}>담은 표현</Link>');
    expect(reader).not.toContain('`/books/japanese-n5/review?edition=${book.edition}&returnTo=');
    expect(reader).toContain('{ from: lesson.number, to: lesson.number })}>이 과 표현 복습 →</Link>');
  });
  it('자료 뷰어 「이 자료 표현 복습」은 자료 범위 주소로 간다', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain("serializeReviewScope({ lang: materialLang, level: null, source: { kind: 'material', ids: [String(material.id)] }, state: 'due' })");
    expect(viewer).toContain('<Link href={materialReviewHref} prefetch={false} className="viewer-stats__vocab">');
  });
  it('설정 서랍의 덱 선택은 지우고 「출처 · 사전 급수 덱」으로 흡수했다', () => {
    const page = read('src/views/VocabPage.jsx');
    expect(page).not.toContain('id="deck-filter"');
    expect(page).not.toContain('seriesFilter');
    expect(read('src/components/vocab/ReviewScopeBar.jsx')).toContain("'사전 급수 덱'");
  });
});

// ── REV-SCOPE-R1B-1 계약(설계 §6-1 ③ · §8): 두 엔진 한 줄 · 순서 · 끼우기 · 띄우기 · 밀린 복습 · 뜻 없는 표현 · 종류 ──
// 줄과 개수를 함께 바꿨다 — 어느 규칙에서든 「보이는 개수(total) = 시작하는 줄 길이(queue.items)」.
describe('R1-B-1 줄 규칙 — countReviewScope가 줄과 개수를 함께 낸다', () => {
  const T0 = NOW - 13 * DAY; // 기록이 14일에 못 미치는 계정(밀린 복습 기준 = 기본값 20)
  const legacyRow = (id, extra = {}) => row(id, `表${id}`, 'Chinese', { created_at: iso(T0), ...extra });
  function mixed({ rows, fsrs = {} } = {}) {
    const registry = rows.map(r => (fsrs[r.id]
      ? { cardId: r.id, userId: 'actor', enrolled: true, eligible: true, known: false, excluded: false, card: fsrs[r.id], nextQuestionAt: fsrs[r.id].due, firstQuestionAt: fsrs[r.id].state === 'New' ? null : fsrs[r.id].lastReview }
      : { cardId: r.id, userId: 'actor', enrolled: false, eligible: true, known: false, excluded: false, card: null, nextQuestionAt: null, firstQuestionAt: null }));
    return projectVocabularyLearningRows({ version: 1, actorId: 'actor', now: iso(NOW), enabled: true, complete: true, registryAvailable: true, rows, registry }, { actorId: 'actor' });
  }
  const zh = { lang: 'Chinese', level: null, source: null, state: 'due' };
  const reviewedFsrs = (daysAgo, rating = 3) => scheduleFsrsReview(introduceFsrsCard(NOW - daysAgo * DAY), rating, NOW - daysAgo * DAY + 60_000).card;

  it('두 엔진이 한 줄 — 기억 확률이 낮은 순, 새 표현은 복습 3장마다, 엔진마다 원래 저장 경로(engine 표시)', () => {
    const rows = [
      legacyRow('L1', { interval: 2, last_reviewed_at: iso(NOW - 40 * DAY) }),   // 아주 흐림
      legacyRow('L2', { interval: 50, last_reviewed_at: iso(NOW - 3 * DAY) }),   // 선명
      legacyRow('F1'), legacyRow('F2'),
      legacyRow('N1', { interval: 0, repetitions: 0, last_reviewed_at: null }),
      legacyRow('N2', { interval: 0, repetitions: 0, last_reviewed_at: null, created_at: iso(T0 + 1000) }),
    ];
    const snap = mixed({ rows, fsrs: { F1: reviewedFsrs(12), F2: reviewedFsrs(12, 4) } });
    const count = countReviewScope({ snapshot: snap, quota: quota(), scope: zh, now: NOW });
    const items = count.queue.items;
    expect(count.total).toBe(items.length);
    expect(count).toMatchObject({ due: 4, newAllowed: 2, engine: 'mixed' });
    expect(items.slice(0, 3).every(item => !item.isNew)).toBe(true);
    expect(items[3]).toMatchObject({ id: 'N1', engine: 'legacy', isNew: true, introduced: false });
    // F1은 첫 답 「알맞음」으로 학습 단계(10분)에 남은 카드 — 짧은 단계가 밀리지 않게 맨 앞, 그다음 기억 확률이 낮은 순.
    expect(items[0]).toMatchObject({ id: 'F1', engine: 'fsrs' });
    expect(items[1].id).toBe('L1');
    expect(items.findIndex(item => item.id === 'L2')).toBeGreaterThan(items.findIndex(item => item.id === 'F2'));
    expect(items.filter(item => item.engine === 'fsrs').map(item => item.id).sort()).toEqual(['F1', 'F2']);
  });

  it('같은 과(chapter_slug)의 새 표현끼리는 4장 이상 띄운다 — 교재 범위 조회의 과로', () => {
    const rows = ['A1', 'A2', 'B1', 'C1', 'D1'].map((id, i) => legacyRow(id, { interval: 0, repetitions: 0, last_reviewed_at: null, created_at: iso(T0 + i) }));
    const snap = mixed({ rows });
    const chapters = { A1: 'n5-book-u05', A2: 'n5-book-u05', B1: 'n5-book-u06', C1: 'n5-book-u07', D1: 'n5-book-u08' };
    const ids = countReviewScope({ snapshot: snap, quota: quota(), scope: zh, now: NOW, chapters }).queue.ids;
    expect(ids.indexOf('A2') - ids.indexOf('A1')).toBeGreaterThanOrEqual(4);
  });

  it('밀린 복습: 그 언어의 기한 지난 복습 > 하루 평균 × 2면 새 표현 0 · 문구 재료(backlog) · 줄 = 복습만(잊기 쉬운 순)', () => {
    const old = NOW - 60 * DAY;
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => legacyRow(`R${i}`, { created_at: iso(old), last_reviewed_at: iso(NOW - (20 + i) * DAY), interval: 3 + i })),
      legacyRow('recent', { created_at: iso(old), last_reviewed_at: iso(NOW - 2 * DAY), next_review_at: iso(NOW + 5 * DAY) }),
      legacyRow('N1', { created_at: iso(old), interval: 0, repetitions: 0, last_reviewed_at: null }),
    ];
    const snap = mixed({ rows });
    const count = countReviewScope({ snapshot: snap, quota: quota(), scope: zh, now: NOW });
    expect(count.backlog).toMatchObject({ overdue: 5, active: true });
    expect(count.backlog.baseline).toBeCloseTo(1 / 14);
    expect(count).toMatchObject({ newAllowed: 0, newLocked: 1, due: 5, total: 5 });
    expect(count.queue.items.every(item => !item.isNew)).toBe(true);
    expect(count.byLang.Chinese).toBe(5);
    // 좁힌 범위도 그 언어의 밀린 복습 규칙을 따른다(새 표현만 범위 = 0)
    expect(countReviewScope({ snapshot: snap, quota: quota(), scope: { ...zh, state: 'new' }, now: NOW })).toMatchObject({ total: 0, newLocked: 1 });
    // 계정 한도는 차감하지 않는다(입력 quota 그대로) — 배움 칸(snapshot만) · 복습방(controller 입력)이 같은 수
    expect(countReviewScope({ snapshot: snap, quota: quota(), scope: zh, now: NOW, fsrsEntries: [] }).total).toBe(5);
  });

  it('뜻 없는 표현은 줄 · 개수에서 빠지고 noMeaning으로 따로 센다(목록 「뜻 채우기」)', () => {
    const snap = mixed({ rows: [legacyRow('ok'), legacyRow('blank', { meaning: '  ' })] });
    const count = countReviewScope({ snapshot: snap, quota: quota(), scope: zh, now: NOW });
    expect(count.queue.ids).toEqual(['ok']);
    expect(count).toMatchObject({ total: 1, noMeaning: 1, stored: 2 });
    expect(scopedFsrsCardIds({ snapshot: snap, scope: zh, now: NOW })).toEqual([]);
  });

  it('종류 축(type): 문장 = 예문 담기 · 문장 끝 부호, 단어 = 나머지 — 주소 왕복 포함', () => {
    const snap = mixed({ rows: [legacyRow('w'), row('s', '我每天七点吃早餐。', 'Chinese', { created_at: iso(T0) })] });
    expect(countReviewScope({ snapshot: snap, quota: quota(), scope: { ...zh, type: 'sentence' }, now: NOW }).queue.ids).toEqual(['s']);
    expect(countReviewScope({ snapshot: snap, quota: quota(), scope: { ...zh, type: 'word' }, now: NOW }).queue.ids).toEqual(['w']);
    const href = serializeReviewScope({ ...zh, type: 'sentence' });
    expect(href).toBe('/vocab?lang=Chinese&type=sentence');
    expect(parseReviewScope(new URL(href, 'https://local').searchParams).scope).toEqual({ ...zh, type: 'sentence' });
    expect(parseReviewScope({ lang: 'Chinese', type: 'pattern' })).toMatchObject({ invalid: true });
    // 종류를 고르지 않으면 범위 모양은 R1-A 그대로(type 키 없음)
    expect(parseReviewScope({ lang: 'Chinese' }).scope).toEqual(zh);
  });

  it('흐릿 범위 = 기억 확률 < 0.7 + 지난 14일 집중 연습의 「몰랐어요」(기한이 된 것만 — 기한 전 채점은 집중 연습 몫)', () => {
    const rows = [legacyRow('sharp', { interval: 80, last_reviewed_at: iso(NOW - 2 * DAY) }), legacyRow('notdue', { interval: 80, last_reviewed_at: iso(NOW - 2 * DAY), next_review_at: iso(NOW + 9 * DAY) })];
    const snap = mixed({ rows });
    const fragile = { ...zh, state: 'fragile' };
    expect(countReviewScope({ snapshot: snap, quota: quota(), scope: fragile, now: NOW }).queue.ids).toEqual([]);
    expect(countReviewScope({ snapshot: snap, quota: quota(), scope: fragile, now: NOW, fragileIds: ['sharp', 'notdue'] }).queue.ids).toEqual(['sharp']);
  });
});
