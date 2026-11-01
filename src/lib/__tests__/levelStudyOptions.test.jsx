import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  arrangeLevelSession, gradeLevelSession, sessionHas, sessionOrder, startLevelSession,
} from '../levelWordSession';
import { intersperseNew } from '../reviewQueue';
import { LEVEL_WORD_PREFS, levelStudyOptions, normalizeLevelWordPrefs } from '../levelWordPrefs';
import { OneWordCard, OneWordDone } from '@/components/levels/word/OneWord';
import { WordCard } from '@/components/levels/word/WordCard';
import { WordLangContext } from '@/components/levels/word/wordLang';
import { sliceBetween } from './helpers/sliceBetween';

// 계약: 단어 페이지 학습 옵션(LEVEL-STUDY-OPTIONS-001 — 오너 승인 2026-10-31 KST 시안 4차 · 같은 날 단순화).
// 순서(혼합 · 새 단어 먼저 · 복습 먼저 — id mix · new-first · review-first). 거르지 않는다 — 오늘 줄에는 늘 모두 선다.
// 「분량」(10개 · 20개 · 전체 · 「이어서 N개」)은 뺐고 그 자리는 「하루」(하루 새 단어 수 — LEVEL-WAIT-001 · 오너 승인 2026-11-01 KST).
// 정렬(기한순 · 취약순 · 임의순)과 「새 단어 임의 출제」는 단순화에서 뺐다 — 복습은 지금 차례, 새 단어는 목록 순.

const T0 = 1_700_000_000_000;
// 목록: r1..r4 오늘 복습 · n1..n3 새 단어 · s1 담음 · L1 학습 단계(차례 됨) · w1 기다리는 카드(아직 시각 전) · g1 졸업
const ENTRIES = ['r1', 'n1', 'L1', 'r2', 'n2', 'w1', 'r3', 's1', 'g1', 'n3', 'r4'].map((key) => ({ key }));
const STATUS = { r1: 'today', r2: 'today', r3: 'today', r4: 'today', L1: 'today', w1: 'today', n1: 'new', n2: 'new', n3: 'new', s1: 'saved', g1: 'grad' };
const DUE = { L1: T0 - 60_000, w1: T0 + 600_000 };
const start = (opts = {}) => startLevelSession(ENTRIES, (k) => STATUS[k], (k) => DUE[k] || 0, T0, { learningOf: (k) => k === 'L1', ...opts });
const REVIEWS = ['r1', 'r2', 'r3', 'r4'];
const FRESH = ['n1', 'n2', 's1', 'n3'];
const all = (s) => [...s.queue, ...s.waiting.map((w) => w.key)];

describe('순서 — 새 단어를 어디에 세울지만 정한다(거르지 않는다)', () => {
  it('혼합(기본 · mix) = 예전 줄 그대로 — 학습 단계 맨 앞, 복습 사이에 새 단어(intersperseNew)', () => {
    const s = start();
    expect(s.queue).toEqual(['L1', ...intersperseNew(REVIEWS, FRESH)]);
    expect(s.queue).toEqual(['L1', 'r1', 'n1', 'r2', 'n2', 'r3', 's1', 'r4', 'n3']);
    expect(start({ order: 'mix' }).queue).toEqual(s.queue);
    expect(s).not.toHaveProperty('rest'); // 분량 칸은 없앴다
    expect(s.waiting).toEqual([{ key: 'w1', at: DUE.w1 }]);
  });
  it('새 단어 먼저(new-first) = [학습 단계, 새 단어…, 복습…] · 복습 먼저(review-first) = [학습 단계, 복습…, 새 단어…]', () => {
    expect(start({ order: 'new-first' }).queue).toEqual(['L1', ...FRESH, ...REVIEWS]);
    expect(start({ order: 'review-first' }).queue).toEqual(['L1', ...REVIEWS, ...FRESH]);
  });
  it('어느 순서든 같은 단어가 모두 선다 — 학습 단계(①) · 기다리는 카드(③) 포함, 졸업 단어는 줄 밖 · 옛 저장값 amount는 줄을 자르지 않는다', () => {
    const base = all(start()).sort();
    for (const order of ['mix', 'new-first', 'review-first']) {
      for (const amount of [10, 3, undefined]) {
        const s = start({ order, amount });
        expect(all(s).sort()).toEqual(base);
        expect(s.queue[0]).toBe('L1');
        expect(s.waiting).toEqual([{ key: 'w1', at: DUE.w1 }]);
      }
    }
    expect(base).not.toContain('g1');
  });
  it('하루 새 단어 몫(newCap)은 그대로 — 몫 뒤 새 단어는 held(「새 단어 N개 더」), 순서와 상관없이', () => {
    const s = start({ order: 'new-first', newCap: 2 });
    expect(s.queue).toEqual(['L1', 'n1', 'n2', ...REVIEWS]);
    expect(s.held).toEqual(['s1', 'n3']);
  });
});

describe('하루 새 단어 수를 바꾸면 — 아직 채점하지 않은 줄의 새 단어와 held만 새 몫으로 다시 나눈다(LEVEL-WAIT-001)', () => {
  it('늘리면 held에서 처음 차례대로 줄로 · 줄이면 줄의 새 단어가 held로 — 채점 수 · 누른 횟수 · 기다리는 카드 · 복습은 그대로', () => {
    let s = start({ newCap: 2 });
    s = gradeLevelSession(s, 'r1', 3, null);
    const up = arrangeLevelSession(s, { order: 'mix' }, { newCap: 4 });
    expect(up.queue.filter((k) => FRESH.includes(k))).toEqual(['n1', 'n2', 's1', 'n3']);
    expect(up.held).toEqual([]);
    expect(up.total).toBe(s.total + 2);
    expect(up.graded).toBe(1);
    expect(up.counts).toEqual(s.counts);
    expect(up.waiting).toBe(s.waiting);
    expect(up.history).toBe(s.history);
    expect(up.queue.filter((k) => REVIEWS.includes(k))).toEqual(['r2', 'r3', 'r4']);
    const down = arrangeLevelSession(up, { order: 'mix' }, { newCap: 1 });
    expect(down.queue.filter((k) => FRESH.includes(k))).toEqual(['n1']);
    expect(down.held).toEqual(['n2', 's1', 'n3']);
    expect(down.total).toBe(up.total - 3);
    const none = arrangeLevelSession(up, { order: 'mix' }, { newCap: 0 }); // 0 = 복습만
    expect(none.queue).toEqual(['L1', 'r2', 'r3', 'r4']);
  });
  it('제한 없음(Infinity) — held 전부 줄로 · 다른 곳에서 채점한 held 단어는 건너뛴다(keepNew)', () => {
    const s = start({ newCap: 1 });
    const all4 = arrangeLevelSession(s, { order: 'new-first' }, { newCap: Infinity, keepNew: (k) => k !== 's1' });
    expect(all4.queue).toEqual(['L1', 'n1', 'n2', 'n3', ...REVIEWS]);
    expect(all4.held).toEqual([]);
  });
  it('보던 새 단어(pin)는 몫 한 장으로 세고 남긴다 — 줄여도 사라지지 않는다', () => {
    const s = start();
    const down = arrangeLevelSession(s, { order: 'mix' }, { newCap: 1, pin: 'n3' });
    expect(down.queue).toEqual(['L1', 'n3', ...REVIEWS]);
    expect(down.held).toEqual(['n1', 'n2', 's1']);
  });
  it('몫을 안 넘기면(순서만 바꿈) held는 그대로 · 같은 순서면 같은 객체', () => {
    const s = start({ newCap: 2 });
    expect(arrangeLevelSession(s, { order: 'mix' })).toBe(s);
    expect(arrangeLevelSession(s, { order: 'review-first' }).held).toBe(s.held);
  });
  it('화면 배선 — 「하루」 줄은 단어장 설정과 같은 길(levelSetNewPerDay — import()) · 다시 나누기 · 실패면 앞 값으로', () => {
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    expect(screen).toContain("import('@/lib/levelDailyLoad').then((m) => m.levelSetNewPerDay(userId, limit))");
    expect(screen).toContain('setSession((cur) => arrangeLevelSession(cur, studyOpts, { pin: head, newCap: capFor(limit), keepNew: stillNew }));');
    expect(screen).toMatch(/if \(!res\.ok\) \{\n\s+setNewPerDay\(before\);/);
    expect(screen).toContain("queryClient.invalidateQueries({ queryKey: ['level-new-slots', userId] });");
    expect(screen).toContain('perDay={userId ? newPerDay : null} onPerDay={changePerDay}');
    const load = fs.readFileSync('src/lib/levelDailyLoad.js', 'utf8');
    // 입장 모드 = 서버 입장 한도(controller.configure — 단어장 VocabPage와 같은 controller) · 호환 모드 = 기기 설정만.
    expect(load).toContain('createLearningAdmissionController({ accountId, client: createLearningAdmissionClient({ accountId }) })');
    expect(load).toContain('if (!canUseLegacyAdmissionCompatibility(quota) && !(await controller.configure(limit))) return { ok: false };');
    expect(load).toContain("localStorage.setItem('vocab_new_per_day', String(limit))");
    expect(load).toContain('finally { controller.dispose(); }');
  });
});

describe('옵션을 바꾸면 아직 채점하지 않은 몫만 다시 짠다 — 채점 · 누른 횟수 · history · 기다리는 카드는 그대로', () => {
  it('바꾼 뒤에도 기록은 그대로, 남은 줄만 새 옵션으로', () => {
    let s = start();
    s = gradeLevelSession(s, 'L1', 1, T0 + 60_000); // 학습 단계 → 기다리는 카드
    s = gradeLevelSession(s, 'r1', 3, null);
    const arranged = arrangeLevelSession(s, { order: 'new-first' });
    expect(arranged.graded).toBe(2);
    expect(arranged.counts).toEqual(s.counts);
    expect(arranged.history).toBe(s.history);
    expect(arranged.waiting).toBe(s.waiting);
    expect(arranged.held).toBe(s.held);
    expect(arranged.queue).toEqual(['n1', 'n2', 's1', 'n3', 'r2', 'r3', 'r4']);
    expect(all(arranged).sort()).toEqual(all(s).sort());
  });
  it('되돌려 바꾸면 같은 줄 — 복습 · 새 단어는 각자 처음 차례로 돌아간다', () => {
    const s = start();
    const back = arrangeLevelSession(arrangeLevelSession(s, { order: 'review-first' }), { order: 'mix' });
    expect(back.queue).toEqual(s.queue);
  });
  it('같은 옵션이면 그대로(같은 객체) — 되돌리기 · 실패 복구 뒤 화면이 부를 때 줄을 흔들지 않는다', () => {
    const s = start({ order: 'new-first' });
    expect(arrangeLevelSession(s, { order: 'new-first' })).toBe(s);
    expect(arrangeLevelSession(s, levelStudyOptions({ order: 'new-first', amount: 10 }))).toBe(s); // 옛 저장값 amount는 무시
  });
  it('기다리던 학습 단계 카드가 다시 줄(맨 앞)로 돌아와 있으면 그 자리 그대로', () => {
    const s = start();
    const arranged = arrangeLevelSession(s, { order: 'review-first' });
    expect(arranged.queue).toEqual(['L1', ...REVIEWS, ...FRESH]);
  });
  it('보던 카드(pin)는 ② 맨 앞에 남는다', () => {
    const s = start();
    const arranged = arrangeLevelSession(s, { order: 'review-first' }, { pin: 'n3' });
    expect(arranged.queue).toEqual(['L1', 'n3', ...REVIEWS, 'n1', 'n2', 's1']);
  });
  it('되돌리기가 옛 옵션으로 짠 줄(sessionBefore)을 돌려놓아도 지금 옵션으로 다시 짜고, 되돌린 카드가 지금 카드로 남는다', () => {
    const before = start(); // 혼합으로 짠 줄에서 r1을 채점
    const moved = gradeLevelSession(before, 'r1', 3, null);
    const changed = arrangeLevelSession(moved, { order: 'new-first' }); // 채점 뒤 옵션 변경
    expect(changed.graded).toBe(1);
    // 되돌리기 = setSession(sessionBefore) → 화면의 useLayoutEffect가 지금 옵션 + pin(되돌린 카드)으로 다시 짠다
    const undone = arrangeLevelSession(before, { order: 'new-first' }, { pin: 'r1' });
    expect(undone.graded).toBe(0);
    expect(undone.queue).toEqual(['L1', 'r1', 'n1', 'n2', 's1', 'n3', 'r2', 'r3', 'r4']);
    expect(all(undone).sort()).toEqual(all(before).sort());
  });
  it('화면 배선 — 시작 · 다시 짜기 · 분량 길(rest · 이어서)은 없다', () => {
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    // 줄 카드 = 단어 → 뜻(단어 열쇠) + 켜진 종류 카드(CARD-TYPES-001) — 표시 값은 cardTable 하나(종류가 꺼져 있으면 table 그대로).
    expect(screen).toMatch(/startLevelSession\(lineEntries, lineStatus, [^;]*\{ newCap, learningOf: \(k\) => inLearningStep\(cardTable\(k\) \|\| \{\}\), \.\.\.studyOpts \}/);
    expect(screen).toContain('const next = arrangeLevelSession(session, studyOpts, { pin: head });');
    expect(screen).toMatch(/useLayoutEffect\(\(\) => \{\n\s+if \(!session\) return;\n\s+const next = arrangeLevelSession/);
    expect(screen).not.toMatch(/continueLevelSession|contBatch|ContinueButton|session\.rest|이번 분량 끝|prefs\.amount/);
    // 되돌리기는 옛 줄을 그대로 돌려놓는다(다시 짜기는 위 효과 몫) — 채점 기록 되돌리기 길은 그대로.
    expect(screen).toContain('if (last.sessionBefore) { setSession(last.sessionBefore); setHeadKey(last.headBefore);');
    const session = fs.readFileSync('src/lib/levelWordSession.js', 'utf8');
    expect(session).not.toMatch(/continueLevelSession|session\.rest|rest: |amount/);
    expect(fs.readFileSync('src/components/levels/word/OneWord.jsx', 'utf8')).not.toMatch(/ContinueButton|이어서|이번 분량 끝|cont = 0/);
  });
  it('sessionHas — 줄 · 기다리는 카드만(분량 칸 없음)', () => {
    const s = start({ newCap: 1 });
    expect(sessionHas(s, 'n1')).toBe(true);
    expect(sessionHas(s, 'n2')).toBe(false); // held는 줄 밖
    expect(sessionOrder(s, T0)).toEqual(s.queue);
  });
});

describe('끝 화면 — 분량 끝 · 「이어서」는 없다', () => {
  const counts = { 1: 1, 2: 0, 3: 9, 4: 0 };
  const wrap = (node) => renderToStaticMarkup(<WordLangContext.Provider value={{}}>{node}</WordLangContext.Provider>);
  it('예전 그대로 — 오늘 이 레벨 끝 · 하루 몫에서 멈춤이면 새 단어 더', () => {
    const html = wrap(<OneWordDone graded={3} tomorrow={0} counts={counts} onNext={() => {}} nextLabel="HSK 2" onList={() => {}} cont={10} onContinue={() => {}} />);
    expect(html).toContain('오늘 이 레벨 끝');
    expect(html).not.toMatch(/이어서|이번 분량 끝/);
    const capped = wrap(<OneWordDone graded={10} tomorrow={3} counts={counts} onList={() => {}} more={15} perDay={15} started={5} onMore={() => {}} onBrowse={() => {}} />);
    expect(capped).toContain('새 단어 15개 더');
  });
});

describe('진행 줄 칩은 없다 — 학습 옵션은 제목 ▾ 시트에서만(오너 결정 2026-11-01 KST)', () => {
  it('요약 칩 함수 · 진행 줄 칩 · CSS가 없다 — 진행 줄은 막대 · %만', async () => {
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    const css = fs.readFileSync('src/components/levels/word/level-word.css', 'utf8');
    const prefs = await import('../levelWordPrefs');
    expect(prefs).not.toHaveProperty('levelStudyChip');
    expect(screen).not.toMatch(/optChip|levelStudyChip|lw-optchip/);
    expect(css).not.toContain('lw-optchip');
    const prog = sliceBetween(screen, 'className="lw-prog"', '</div>}');
    expect(prog.indexOf('lw-bar')).toBeLessThan(prog.indexOf('lw-pct'));
  });
});

describe('설정 값 — 보기 줄은 고정 기본값(tone 켬 · page 20), 학습 옵션(순서)은 언어마다 저장', () => {
  it('저장값과 상관없이 tone = true · page = 20', () => {
    expect(normalizeLevelWordPrefs({ tone: false, page: 50 })).toMatchObject({ tone: true, page: 20 });
    expect(normalizeLevelWordPrefs({ tone: false, page: 10, v: 2 })).toMatchObject({ tone: true, page: 20 });
    expect(normalizeLevelWordPrefs(null)).toEqual(LEVEL_WORD_PREFS);
  });
  it('기본값 = 혼합 · 모르는 값은 기본으로 · 2단 평가 · 분량 저장값은 버린다', () => {
    expect(LEVEL_WORD_PREFS).toMatchObject({ order: 'mix' });
    expect(LEVEL_WORD_PREFS).not.toHaveProperty('two');
    expect(LEVEL_WORD_PREFS).not.toHaveProperty('amount');
    expect(normalizeLevelWordPrefs({ order: 'weak', amount: 50 })).toMatchObject({ order: 'mix' });
    // 보기(view)는 저장하지 않는다 — 보기 탭을 없앴다(CARD-TYPES-001 A안). 옛 저장값 view는 버린다.
    expect(normalizeLevelWordPrefs({ order: 'review-first', amount: 10, two: true, mode: 'list', view: 'sound', v: 2 }))
      .toEqual({ mode: 'list', tone: true, page: 20, order: 'review-first', v: 2 });
    expect(LEVEL_WORD_PREFS).not.toHaveProperty('view');
  });
  it('세션 옵션 — 순서만', () => {
    expect(levelStudyOptions({ order: 'new-first', amount: 'all' })).toEqual({ order: 'new-first' });
    expect(levelStudyOptions({ order: 'mix', amount: 20 })).toEqual({ order: 'mix' });
  });
  it('언어마다 따로 저장(cfg.prefsKey) · 정렬 · 임의 출제는 없다', () => {
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    expect(screen).toContain('writeJson(localStorage, cfg.prefsKey, next)');
    expect(screen).toContain('normalizeLevelWordPrefs(readJson(localStorage, cfg.prefsKey))');
    const prefs = fs.readFileSync('src/lib/levelWordPrefs.js', 'utf8');
    expect(prefs).not.toMatch(/shuffle|retrievab|sort:|two:|LEVEL_STUDY_AMOUNTS/);
    const parts = fs.readFileSync('src/components/levels/word/WordParts.jsx', 'utf8');
    expect(parts).not.toMatch(/TWO_GRADE|lw-grades--two/); // 2단 평가는 뺐다(오너 2026-10-31 KST)
  });
});

// 후리가나 규칙(오너 2026-10-31 KST): 문제 면에는 넣지 않고(맨 글자), 답 면에는 늘 넣는다. tone이 고정(켬)이라 성립한다.
const L = {
  hw: 'ja', exReading: 'ja', head: (e) => ({ hw: e.word, sub: e.reading }), tag: (l) => `JLPT ${l}`,
  Reading: ({ text }) => <span className="lw-py">{text}</span>,
};
const ENTRY = { key: '経験', word: '経験', reading: 'けいけん', meaning: '경험', ex: { text: '経験がある。', furi: '0,2,けいけん', ko: '경험이 있다.' } };
describe('후리가나 — 문제 면 없음 · 답 면 있음', () => {
  const wrap = (node) => renderToStaticMarkup(<WordLangContext.Provider value={L}>{node}</WordLangContext.Provider>);
  const info = { status: 'today', previews: null };
  // 카드 세 종류(CARD-TYPES-001 — 문장 탭은 없앴다)의 문제 면 · 답 면 전부는 cardTypesFaces.test.jsx가 본다. 여기는 후리가나 규칙만.
  it('한 단어 — 문제 면(단어 · 뜻 · 소리)은 루비 없음, 답 면 예문은 루비', () => {
    for (const kind of ['recognition', 'production', 'listening']) {
      const front = wrap(<OneWordCard entry={ENTRY} kind={kind} info={info} tone revealed={false} onReveal={() => {}} speak={() => {}} />);
      expect(front, kind).not.toContain('<ruby>');
      const back = wrap(<OneWordCard entry={ENTRY} kind={kind} info={info} tone revealed onReveal={() => {}} speak={() => {}} />);
      expect(back, kind).toContain('<ruby>経験<rt>けいけん</rt></ruby>');
    }
  });
  it('리스트 — 접힌 줄(문제 면)은 루비 없음, 펼친 카드 · 전체 카드(답 면)는 루비', () => {
    for (const kind of ['recognition', 'production', 'listening']) {
      const closed = wrap(<WordCard entry={ENTRY} level="N3" kind={kind} info={info} tone speak={() => {}} />);
      expect(closed, kind).not.toContain('<ruby>');
    }
    const open = wrap(<WordCard entry={ENTRY} level="N3" view="all" info={info} tone />);
    expect(open).toContain('<ruby>経験<rt>けいけん</rt></ruby>');
  });
  it('화면은 tone을 고정값으로만 넘긴다(끄는 길 없음)', () => {
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    expect(screen).not.toMatch(/setPrefs\(\{ tone/);
    expect(normalizeLevelWordPrefs({ tone: false }).tone).toBe(true);
  });
});
