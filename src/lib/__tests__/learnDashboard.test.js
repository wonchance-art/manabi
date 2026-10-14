import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { goalTrackView, learnLanguages, learnLangLabel, materialInLang, paragraphState, shortDateLabel, streakView, STREAK_HINT, todayGoalPct } from '../learnDashboard.js';
import { serializeReviewScope } from '../reviewScopeUrl.js';
import { buildPlan } from '../studyPlan.js';
import { goalCatalog } from '../goalCatalog.js';
import { buildContinueManifest } from '../../content/refManifest.js';
import { reviewScopeQuota } from '../reviewScope.js';

/**
 * 계약: 배움 · 현황 대시보드 (LEARN-HOME-AK-001 — 오너 확정 목업 2026-10-09 · 정정 2026-10-11 · D-X6 2026-10-12).
 * 메뉴 셋과 소속은 webNavigation.test.js가, 예보 탭 이음새는 continueDeck.test.js가 지킨다.
 */
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const home = read('src/views/HomePage.jsx');
const stats = read('src/views/ProfileStats.jsx');
const tiles = read('src/components/learn/LearnTiles.jsx');
const css = read('src/components/learn/learn.css');

describe('배움 단어 복습 칸 — 숫자 출처는 countReviewScope 하나(정정 §2-4)', () => {
  it('배움 화면이 개수를 직접 세지 않는다 — countReviewScope 호출 지점 1곳, 그 total만 쓴다', () => {
    const code = codeOf(home);
    expect(code.match(/countReviewScope\(/g)).toHaveLength(1);
    const fn = sliceBetween(code, 'export function learnReviewCount(', '\n}');
    expect(fn).toContain("countReviewScope({ snapshot, quota, scope: { lang, level: null, source: null, state: 'due' }, now })");
    expect(fn).toContain("return result.status === 'ready' ? result.total : null;");
    // 문법 복습은 칸 숫자에 넣지 않는다(grammarDue는 복습방의 별줄) — grammar를 넘기지도, grammarDue를 더하지도 않는다.
    expect(fn).not.toContain('grammar');
    expect(code).toContain('count={reviewCount}');
    // 옛 홈의 독자 개수(isVocabularyReviewDue로 센 dueCount)가 되살아나지 않는다
    expect(code).not.toContain('dueCount');
  });

  it('칸은 숫자를 받아서 그리기만 한다 — 「N개 대기」는 그 total, 0이면 숫자 없이 최근 담은 표현만', () => {
    const tile = codeOf(sliceBetween(tiles, 'export function ReviewTile(', '\n}\n'));
    expect(tile).not.toContain('countReviewScope');
    expect(tile).toContain("const waiting = Number.isFinite(count) && count > 0 ? `${count}개 대기` : null;");
    // 0개일 때 돌리는 「최근 담은 표현」(isVocabularyReviewAvailable)은 숫자에 들어가지 않는다 — pool은 숫자를 만들지 않는다.
    expect(tile).not.toMatch(/pool\.length\}개/);
  });

  it('새 표현 한도 입력은 복습방과 같은 함수(reviewScopeQuota) — 두 화면 숫자가 같은 한도를 쓴다', () => {
    expect(home).toContain('reviewScopeQuota(admission, {');
    expect(read('src/views/VocabPage.jsx')).toContain('reviewScopeQuota(admission, {');
    expect(reviewScopeQuota(null)).toBe(null);
    const quota = { active: true, remaining: 3, admittedLegacyCardIds: ['a'] };
    expect(reviewScopeQuota({ quota, compatibility: false })).toEqual({ active: true, remaining: 3, admittedLegacyCardIds: ['a'] });
    expect(reviewScopeQuota({ quota: { ...quota, active: false }, compatibility: false }).remaining).toBe(0);
    expect(reviewScopeQuota({ quota, compatibility: true }, { newPerDay: 10, introIds: ['x', 'gone'], vocabIds: ['x'] }).remaining).toBe(9);
  });
});

describe('진입 링크는 범위 주소 정본(serializeReviewScope)으로 만든다(정정 §2-4 · §3)', () => {
  it('배움 칸 = /vocab?lang=<칩 언어>', () => {
    expect(home).toContain('const reviewHref = serializeReviewScope({ lang });');
    expect(home).toContain('href={reviewHref}');
    expect(serializeReviewScope({ lang: 'Chinese' })).toBe('/vocab?lang=Chinese');
  });

  it('현황 레벨 어휘 줄 = level 범위, 기억 건강 흐릿 · 위험 = state=fragile 범위', () => {
    expect(read('src/components/learn/LevelVocabCard.jsx')).toContain('serializeReviewScope({ lang, level: row.level })');
    expect(read('src/components/learn/MemoryHealthCard.jsx')).toContain("serializeReviewScope({ lang, state: 'fragile' })");
    expect(serializeReviewScope({ lang: 'Chinese', level: 'H2' })).toBe('/vocab?lang=Chinese&level=H2');
    expect(serializeReviewScope({ lang: 'Japanese', state: 'fragile' })).toBe('/vocab?lang=Japanese&state=fragile');
  });

  it('배움 · 현황 화면 코드에 손으로 조립한 /vocab? 주소가 없다', () => {
    for (const f of ['src/views/HomePage.jsx', 'src/views/ProfileStats.jsx', ...fs.readdirSync('src/components/learn').map(n => `src/components/learn/${n}`)]) {
      expect(codeOf(read(f)), f).not.toMatch(/['"`]\/vocab\?/);
    }
  });
});

describe('휴대폰 순서는 클래스 order로 — nth-child 순서 버그를 되풀이하지 않는다', () => {
  const phone = sliceBetween(css, '@container manabi-shell (max-width:640px){', '\n}\n');
  it('배움: 상태 묶음(진행바 · 오늘 목표 · 연속)이 맨 아래', () => {
    expect(phone).toContain('.learn-order-status{order:3}');
    expect(home).toContain('className="learn-quad learn-order-status"');
  });
  it('현황: 진행바 1 · 오늘 목표 2 · 연속 3 · 이번 주 4 · 아는 단어 5 · 히트맵 6 · 레벨 어휘 7 · 기억 건강 8', () => {
    for (let n = 1; n <= 8; n++) expect(phone).toContain(`.learn-stats .learn-order-${n}{order:${n}}`);
    const order = ['GoalTrackTile className="learn-order-1"', 'learn-order-2', 'learn-order-3', 'learn-order-6', 'learn-order-4', 'learn-order-5', 'learn-order-7', 'learn-order-8'];
    let at = 0;
    for (const token of order) { const next = stats.indexOf(token, at); expect(next, token).toBeGreaterThan(-1); at = next; }
  });
  it('어디에도 nth-child로 순서를 정하지 않는다', () => {
    expect(codeOf(css)).not.toContain('nth-child');
    expect(codeOf(read('src/index.css'))).not.toMatch(/\.bento > :nth-child/);
  });
});

describe('언어는 글자로 — 배움 · 현황 화면에 국기 0(D-X6)', () => {
  const FLAG = /[\u{1F1E6}-\u{1F1FF}]{2}/u;
  const files = ['src/views/HomePage.jsx', 'src/views/ProfileStats.jsx', 'src/components/Layout.jsx', 'src/lib/webNavigation.js',
    'src/lib/learnDashboard.js', 'src/lib/goalCatalog.js', ...fs.readdirSync('src/components/learn').map(n => `src/components/learn/${n}`)];
  it.each(files)('%s', (f) => {
    expect(read(f)).not.toMatch(FLAG);
  });
  it('칩 글자는 정본 이름 사전(LANG_NAME_KO) — 새 이름 사전 없음', () => {
    expect(learnLangLabel('Japanese')).toBe('일본어');
    expect(learnLangLabel('Chinese')).toBe('중국어');
    expect(read('src/components/learn/LangChips.jsx')).not.toContain('aria-label={learnLangLabel');
    expect(codeOf(read('src/lib/learnDashboard.js'))).not.toMatch(/Japanese: '일본어'/);
  });
  it('목표 과정 목록 응답에 국기 필드가 없다', () => {
    const catalog = goalCatalog(buildContinueManifest());
    expect(JSON.stringify(catalog)).not.toContain('"flag"');
  });
});

describe('이어 읽기 — 기존 목적지 선택 정본 보존', () => {
  const code = codeOf(home);
  it('계정 · 판별 교재 기록, 실제 시각 비교, 첫 렌더 뒤 목적지 고정', () => {
    expect(code).toContain('useReadingProgress(book?.edition)');
    expect(code).toContain('bookResume(book, local.progress, local.hasProgress)');
    expect(code).toContain('chooseResume(bookForLang, local.updatedAt, material)');
    expect(code).toContain("const choiceKey = `${user?.id || 'guest'}:${book?.edition || ''}:${lang}`;");
    expect(code).toContain('if (!pending && !choice.current) choice.current =');
    expect(code).toContain('bookHref(book.edition, resume.page)');
    expect(code).toContain('`/viewer/${m.id}`');
  });
  it('원어 제목이 비면 한국어 제목이 주 제목(대체 동작) — 원어 제목은 판 원고의 title_ja가 있을 때만', () => {
    expect(read('src/lib/server/bookReading.js')).toContain('title_ja: titleJa');
    expect(code).toContain("title: titleJa || lesson.title, titleLang: titleJa ? 'ja' : 'ko', sub: titleJa ? lesson.title : lesson.subtitle,");
  });
  it('[진도 숫자][막대][버튼] — DOM 순서도 이대로', () => {
    const tile = read('src/components/learn/ResumeTile.jsx');
    const a = tile.indexOf('learn-resume__count'), b = tile.indexOf('learn-resume__bar'), c = tile.indexOf('learn-resume__pill');
    expect(a).toBeGreaterThan(-1);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });
  it('서재 자료는 칩 언어로 거르고, 언어를 모르는 자료는 잃지 않는다', () => {
    const row = lang => ({ reading_materials: { id: 1, title: 't', language: lang } });
    expect(materialInLang(row('Chinese'), 'Chinese')).toBe(true);
    expect(materialInLang(row('Chinese'), 'Japanese')).toBe(false);
    expect(materialInLang(row(null), 'Japanese')).toBe(true);
  });
});

describe('표시 재료 — 순수 계산', () => {
  it('언어 칩은 프로필 학습 언어(이름이 있는 것), 없으면 일본어', () => {
    expect(learnLanguages({ learning_language: ['Japanese', 'Chinese'] })).toEqual(['Japanese', 'Chinese']);
    expect(learnLanguages({ learning_language: 'French' })).toEqual(['French']);
    expect(learnLanguages({ learning_language: ['Korean'] })).toEqual(['Japanese']);
    expect(learnLanguages(null)).toEqual(['Japanese']);
  });

  it('연속 — 「12일 / 연속 · 쉼 2」, 기록 없음 「– / 연속」, 설명은 title · aria에 같은 문구, 방패 기호 없음', () => {
    expect(streakView({ streak_count: 12, streak_freeze_count: 2 })).toMatchObject({ value: '12일', label: '연속 · 쉼 2', title: STREAK_HINT });
    expect(streakView({ streak_count: 12, streak_freeze_count: 2 }).aria).toBe(`12일 연속 · 쉼 2 — ${STREAK_HINT}`);
    expect(streakView({ streak_count: 3, streak_freeze_count: 0 })).toMatchObject({ value: '3일', label: '연속' });
    expect(streakView({})).toMatchObject({ value: '–', label: '연속' });
    expect(STREAK_HINT).toBe('쉼: 7일 연속할 때마다 1개(최대 2개). 하루 빠지면 자동으로 써서 연속이 이어져요');
    for (const f of ['src/components/learn/LearnTiles.jsx', 'src/views/ProfileStats.jsx', 'src/lib/learnDashboard.js', 'src/views/CourseMapPage.jsx']) {
      expect(read(f), f).not.toContain('🛡');
      expect(codeOf(read(f)), f).not.toContain('스트릭');
    }
  });

  it('오늘 목표 달성률은 예전 산식 그대로(복습 · 수집 목표 평균)', () => {
    const now = Date.parse('2026-10-13T03:00:00Z');
    const today = '2026-10-13T01:00:00Z';
    expect(todayGoalPct({ vocab: [{ created_at: today }], projections: [{ memory: { lastReview: today } }], profile: { goal_review: 2, goal_words: 2 }, now })).toBe(50);
  });

  it('진행바 — 청: 여유(예상 완주 ≤ 목표일), 적: 「N일 늦음」, 「완주 예상」은 aria에만', () => {
    const marked = { done: 6, total: 42 };
    const go = goalTrackView({ marked, p: { daysLeft: 58, actualPerDay: 0.7, needPerDay: 0.6, etaDate: '2026-11-29', gapDays: -7, done: false }, goalName: 'JLPT N4', goalDate: '2026-12-06' });
    expect(go).toMatchObject({ head: '12/6(일) JLPT N4', dLabel: 'D-58', eta: '11/29', signal: 'go', caption: '하루 0.7과 · 7일 여유' });
    expect(go.aria).toBe('JLPT N4 12/6(일)까지 58일, 6/42과, 하루 0.7과면 11/29 완주 예상, 7일 여유');
    expect(go.caption).not.toContain('완주 예상');
    const late = goalTrackView({ marked, p: { daysLeft: 20, actualPerDay: 0.3, needPerDay: 1.8, etaDate: '2027-01-01', gapDays: 14, done: false }, goalName: 'JLPT N4', goalDate: '2026-12-06' });
    expect(late).toMatchObject({ signal: 'stop', caption: '하루 0.3과 · 14일 늦음' });
    const unknown = goalTrackView({ marked, p: { daysLeft: 20, actualPerDay: 0, needPerDay: 1.8, etaDate: null, gapDays: null, done: false }, goalName: 'N4', goalDate: '2026-12-06' });
    expect(unknown).toMatchObject({ signal: null, eta: null, caption: '하루 1.8과 필요' });
    expect(shortDateLabel('2026-12-06')).toBe('12/6(일)');
  });

  it('진행바 B 간격(정수 px) — 넓은 화면 15/13/20/21, 휴대폰 15/12/20/20', () => {
    expect(css).toContain('.learn-goal{height:146px;padding:15px 18px 0;');
    expect(css).toContain('.learn-goal__big{font:700 24px/24px var(--font-serif-kr),serif;letter-spacing:-.5px;grid-row:2;margin-top:13px}');
    expect(css).toContain('.learn-goal__barcell{grid-column:1/-1;grid-row:3;margin-top:20px}');
    expect(css).toContain('margin-top:21px;display:flex');
    const phone = sliceBetween(css, '@container manabi-shell (max-width:640px){', '\n}\n');
    expect(phone).toContain('.learn-goal__big{font-size:26px;line-height:26px;margin-top:12px}');
    expect(phone).toContain('.learn-goal__cap{margin-top:20px}');
    expect(css).not.toMatch(/margin-top:\d+\.\d+px/);
  });

  it('오늘 문단 — 준비된 첫 문장 → 넣을 복습 표현(예보 상위 3) → 신규 안내', () => {
    expect(paragraphState({ sentence: ' 駅前の… ', forecastWords: ['a'] })).toEqual({ kind: 'ready', sentence: '駅前の…' });
    expect(paragraphState({ sentence: null, forecastWords: ['a', 'b', 'c', 'd'] })).toEqual({ kind: 'forecast', words: ['a', 'b', 'c'] });
    expect(paragraphState({ sentence: '', forecastWords: false })).toEqual({ kind: 'empty' });
    expect(home).toContain(".eq('status', 'prefetched').gt('created_at', cutoff)");
    expect(home).toContain('href={`/study?lang=${lang}`}');
  });
});

describe('목표 과정 목록 — 같은 정본의 투영이라 계획이 갈리지 않는다', () => {
  it.each([['Chinese', 'H5'], ['French', 'B1'], ['Japanese', undefined]])('%s %s', (lang, upto) => {
    const full = buildPlan({ languages: buildContinueManifest() }, lang, { upto });
    const slim = buildPlan({ languages: goalCatalog(buildContinueManifest()) }, lang, { upto });
    expect(slim.totalChapters).toBe(full.totalChapters);
    expect(slim.levels.flatMap(lv => lv.chapters.map(c => c.slug))).toEqual(full.levels.flatMap(lv => lv.chapters.map(c => c.slug)));
    expect(slim.levels.map(lv => lv.label)).toEqual(full.levels.map(lv => lv.label));
  });
  it('홈 페이지는 정본 투영을 싣지 않는다 — 목표가 있을 때만 정적 응답을 받는다(P4)', () => {
    expect(read('src/app/(app)/home/page.jsx')).not.toContain('buildContinueManifest');
    expect(read('src/app/api/goal-catalog/route.js')).toContain("export const dynamic = 'force-static';");
    expect(read('src/components/learn/GoalTrackTile.jsx')).toContain('const catalog = useGoalCatalog(hasGoal);');
  });
});
