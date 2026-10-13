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

function row(id, word_text, language, extra = {}) {
  return { id, user_id: 'actor', word_text, base_form: word_text, meaning: `뜻 ${word_text}`, language, created_at: iso(START - 90 * DAY),
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
  it('R1-A 엔진 규칙: 범위 안 FSRS 카드가 출제 가능하면 그 줄만 세고, 예전 일정 카드는 deferred로 따로 낸다', () => {
    const snap = snapshot();
    const scope = { lang: 'Chinese', level: null, source: null, state: 'due' };
    const fsrsEntries = snap.registry.filter(entry => entry.enrolled);
    const count = countReviewScope({ snapshot: snap, fsrsEntries, quota: quota(), scope, now: NOW });
    expect(count.engine).toBe('fsrs');
    expect(count.total).toBe(1);
    expect(count.queue.legacyIds).toEqual([]);
    expect(count.queue.fsrsIds).toEqual(['c5']);
    expect(count.deferred).toBe(4);
    expect(scopedFsrsCardIds({ snapshot: snap, scope, now: NOW })).toEqual(count.queue.fsrsIds);
    // 일본어 범위에서는 중국어 FSRS 카드가 줄을 잡지 않는다
    const ja = countReviewScope({ snapshot: snap, fsrsEntries, quota: quota(), scope: { ...scope, lang: 'Japanese' }, now: NOW });
    expect(ja.engine).toBe('legacy');
    expect(ja.queue.fsrsIds).toEqual([]);
    for (const id of ja.queue.legacyIds) expect(languageOf(snap, id)).toBe('Japanese');
  });
  it('byLang(언어 칩) = 그 언어만 고른 범위의 total · 문법은 별줄(total에 넣지 않음)', () => {
    const snap = snapshot();
    const grammar = [{ lang: 'Japanese', next_review_at: iso(START) }, { lang: 'Chinese', next_review_at: iso(NOW + DAY) }, { lang: 'japanese', next_review_at: iso(START) }];
    const count = countReviewScope({ snapshot: snap, fsrsEntries: snap.registry.filter(e => e.enrolled), quota: quota(), scope: { lang: 'Japanese', level: null, source: null, state: 'due' }, now: NOW, grammar });
    expect(count.byLang).toEqual({ Japanese: 2, Chinese: 1, French: 1 });
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
    expect(page).toContain('`표현 ${session.total}개 복습 →`');
    expect(bar).not.toContain('countReviewScope(');
    expect(bar).not.toMatch(/isVocabularyReviewDue|vocabularyRetrievability/);
  });
  it('시작하는 줄 = 같은 계산의 queue, FSRS 범위 = 같은 판정(scopedFsrsCardIds)', () => {
    const start = sliceBetween(page, 'const startReview = () =>', ';\n');
    expect(start).toContain('startSession(session.queue.legacyIds.map(');
    expect(start).toContain('{ includeFsrs: true }');
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
