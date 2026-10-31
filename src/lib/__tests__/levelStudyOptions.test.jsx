import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  arrangeLevelSession, continueLevelSession, gradeLevelSession, moreLevelSession, revertLevelGrade, sessionDone, sessionHas, sessionOrder,
  skipLevelSession, startLevelSession,
} from '../levelWordSession';
import { intersperseNew } from '../reviewQueue';
import { LEVEL_WORD_PREFS, levelStudyChip, levelStudyOptions, normalizeLevelWordPrefs } from '../levelWordPrefs';
import { GradeBar, OneWordCard, OneWordDone } from '@/components/levels/word/OneWord';
import { WordCard } from '@/components/levels/word/WordCard';
import { WordLangContext } from '@/components/levels/word/wordLang';
import { sliceBetween } from './helpers/sliceBetween';

// 계약: 단어 페이지 학습 옵션(LEVEL-STUDY-OPTIONS-001 — 오너 승인 2026-10-31 KST 시안 4차 · 같은 날 단순화).
// 순서(혼합 · 새 단어 먼저 · 복습 먼저) · 분량(10개 · 20개 · 전체) · 2단 평가. 거르지 않는다 — 오늘 줄에는 늘 모두 선다.
// 정렬(기한순 · 취약순 · 임의순)과 「새 단어 임의 출제」는 단순화에서 뺐다 — 복습은 지금 차례, 새 단어는 목록 순.

const T0 = 1_700_000_000_000;
// 목록: r1..r4 오늘 복습 · n1..n3 새 단어 · s1 담음 · L1 학습 단계(차례 됨) · w1 기다리는 카드(아직 시각 전) · g1 졸업
const ENTRIES = ['r1', 'n1', 'L1', 'r2', 'n2', 'w1', 'r3', 's1', 'g1', 'n3', 'r4'].map((key) => ({ key }));
const STATUS = { r1: 'today', r2: 'today', r3: 'today', r4: 'today', L1: 'today', w1: 'today', n1: 'new', n2: 'new', n3: 'new', s1: 'saved', g1: 'grad' };
const DUE = { L1: T0 - 60_000, w1: T0 + 600_000 };
const start = (opts = {}) => startLevelSession(ENTRIES, (k) => STATUS[k], (k) => DUE[k] || 0, T0, { learningOf: (k) => k === 'L1', ...opts });
const REVIEWS = ['r1', 'r2', 'r3', 'r4'];
const FRESH = ['n1', 'n2', 's1', 'n3'];
const all = (s) => [...s.queue, ...(s.rest || []), ...s.waiting.map((w) => w.key)];

describe('순서 — 새 단어를 어디에 세울지만 정한다(거르지 않는다)', () => {
  it('혼합(기본) = 예전 줄 그대로 — 학습 단계 맨 앞, 복습 사이에 새 단어(intersperseNew)', () => {
    const s = start();
    expect(s.queue).toEqual(['L1', ...intersperseNew(REVIEWS, FRESH)]);
    expect(s.queue).toEqual(['L1', 'r1', 'n1', 'r2', 'n2', 'r3', 's1', 'r4', 'n3']);
    expect(start({ order: 'mix', amount: Infinity }).queue).toEqual(s.queue);
    expect(s.rest).toEqual([]);
    expect(s.waiting).toEqual([{ key: 'w1', at: DUE.w1 }]);
  });
  it('새 단어 먼저 = [학습 단계, 새 단어…, 복습…] · 복습 먼저 = [학습 단계, 복습…, 새 단어…]', () => {
    expect(start({ order: 'new-first' }).queue).toEqual(['L1', ...FRESH, ...REVIEWS]);
    expect(start({ order: 'review-first' }).queue).toEqual(['L1', ...REVIEWS, ...FRESH]);
  });
  it('어느 순서든 같은 단어가 모두 선다 — 학습 단계(①) · 기다리는 카드(③) 포함, 졸업 단어는 줄 밖', () => {
    const base = all(start()).sort();
    for (const order of ['mix', 'new-first', 'review-first']) {
      for (const amount of [10, 20, Infinity, 3]) {
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

describe('분량 — 짠 ② 줄의 앞 N장, 나머지는 rest(버리지 않는다) · 끝 화면 「이어서 N개」', () => {
  it('학습 단계는 분량에 세지 않고 맨 앞 · 순서를 먼저 정하고 자른다', () => {
    const s = start({ order: 'review-first', amount: 3 });
    expect(s.queue).toEqual(['L1', 'r1', 'r2', 'r3']);
    expect(s.rest).toEqual(['r4', ...FRESH]);
    expect(s.held).toEqual([]);
  });
  it('줄이 비면 끝(기다리는 카드도 비었을 때) — rest가 남았어도 끝 화면이 이어서를 낸다', () => {
    let s = start({ amount: 3 });
    for (const k of [...s.queue]) s = gradeLevelSession(s, k, 3, null);
    s = { ...s, waiting: [] };
    expect(sessionDone(s)).toBe(true);
    expect(s.rest.length).toBeGreaterThan(0);
    const next = continueLevelSession(s, 3);
    expect(next.queue).toEqual(s.rest.slice(0, 3));
    expect(next.rest).toEqual(s.rest.slice(3));
    expect(next.graded).toBe(s.graded);
    expect(sessionDone(next)).toBe(false);
  });
  it('이어서는 그사이 다른 곳에서 채점한 단어를 건너뛴다 · 다 걸러지면 rest를 비운다', () => {
    const s = start({ order: 'review-first', amount: 3 });
    expect(continueLevelSession(s, 2, (k) => k !== 'r4').queue.slice(-2)).toEqual(['n1', 'n2']);
    expect(continueLevelSession(s, 2, () => false).rest).toEqual([]);
  });
  it('rest와 held(하루 몫 뒤 새 단어)는 다른 칸 — 「새 단어 N개 더」는 held만, 이어서는 rest만', () => {
    const s = start({ amount: 3, newCap: 2 });
    expect(s.held).toEqual(['s1', 'n3']);
    expect(s.rest).not.toContain('s1');
    const more = moreLevelSession(s, 2);
    expect(more.rest).toEqual(s.rest);
    expect(more.queue.slice(-2)).toEqual(['s1', 'n3']);
    const cont = continueLevelSession(s, 2);
    expect(cont.held).toEqual(s.held);
  });
  it('rest의 단어도 오늘 줄이다 — 다른 곳(단어 카드 창)에서 채점하면 rest에서 빠지고, 저장 실패면 rest로 돌아온다', () => {
    const s = start({ order: 'review-first', amount: 3 });
    expect(sessionHas(s, 'n3')).toBe(true);
    const moved = gradeLevelSession(s, 'n3', 3, null);
    expect(moved.rest).not.toContain('n3');
    expect(moved.graded).toBe(1);
    expect(skipLevelSession(s, 'n3').rest).not.toContain('n3');
    const other = gradeLevelSession(moved, 'r1', 3, null); // 그사이 다른 카드 채점
    const back = revertLevelGrade(other, s, moved, 'n3', 3);
    expect(back.rest).toContain('n3');
    expect(back.queue).not.toContain('n3');
  });
});

describe('옵션을 바꾸면 아직 채점하지 않은 몫만 다시 짠다 — 채점 · 누른 횟수 · history · 기다리는 카드는 그대로', () => {
  it('바꾼 뒤에도 기록은 그대로, 남은 줄 + rest만 새 옵션으로', () => {
    let s = start();
    s = gradeLevelSession(s, 'L1', 1, T0 + 60_000); // 학습 단계 → 기다리는 카드
    s = gradeLevelSession(s, 'r1', 3, null);
    const arranged = arrangeLevelSession(s, { order: 'new-first', amount: 3 });
    expect(arranged.graded).toBe(2);
    expect(arranged.counts).toEqual(s.counts);
    expect(arranged.history).toBe(s.history);
    expect(arranged.waiting).toBe(s.waiting);
    expect(arranged.held).toBe(s.held);
    expect(arranged.queue).toEqual(['n1', 'n2', 's1']);
    expect(arranged.rest).toEqual(['n3', 'r2', 'r3', 'r4']);
    expect(all(arranged).sort()).toEqual(all(s).sort());
  });
  it('되돌려 바꾸면 같은 줄 — 복습 · 새 단어는 각자 처음 차례로 돌아간다', () => {
    const s = start();
    const back = arrangeLevelSession(arrangeLevelSession(s, { order: 'review-first', amount: 2 }), { order: 'mix', amount: Infinity });
    expect(back.queue).toEqual(s.queue);
    expect(back.rest).toEqual([]);
  });
  it('같은 옵션이면 그대로(같은 객체) — 되돌리기 · 실패 복구 뒤 화면이 부를 때 줄을 흔들지 않는다', () => {
    const s = start({ order: 'new-first', amount: 10 });
    expect(arrangeLevelSession(s, { order: 'new-first', amount: 10 })).toBe(s);
    expect(arrangeLevelSession(s, levelStudyOptions({ order: 'new-first', amount: 10 }))).toBe(s);
  });
  it('기다리던 학습 단계 카드가 다시 줄(맨 앞)로 돌아와 있으면 그 자리 그대로', () => {
    const s = start();
    const arranged = arrangeLevelSession(s, { order: 'review-first', amount: 2 });
    expect(arranged.queue[0]).toBe('L1');
    expect(arranged.queue).toEqual(['L1', 'r1', 'r2']);
  });
  it('보던 카드(pin)는 ② 맨 앞에 남는다 — 분량으로 잘려도 사라지지 않게', () => {
    const s = start();
    const arranged = arrangeLevelSession(s, { order: 'review-first', amount: 2 }, { pin: 'n3' });
    expect(arranged.queue).toEqual(['L1', 'n3', 'r1']);
    expect(arranged.rest).not.toContain('n3');
  });
  it('되돌리기가 옛 옵션으로 짠 줄(sessionBefore)을 돌려놓아도 지금 옵션으로 다시 짜고, 되돌린 카드가 지금 카드로 남는다', () => {
    const before = start(); // 혼합으로 짠 줄에서 r1을 채점
    const moved = gradeLevelSession(before, 'r1', 3, null);
    const changed = arrangeLevelSession(moved, { order: 'new-first', amount: 3 }); // 채점 뒤 옵션 변경
    expect(changed.graded).toBe(1);
    // 되돌리기 = setSession(sessionBefore) → 화면의 useLayoutEffect가 지금 옵션 + pin(되돌린 카드)으로 다시 짠다
    const undone = arrangeLevelSession(before, { order: 'new-first', amount: 3 }, { pin: 'r1' });
    expect(undone.graded).toBe(0);
    expect(undone.queue).toEqual(['L1', 'r1', 'n1', 'n2']);
    expect(all(undone).sort()).toEqual(all(before).sort());
  });
  it('화면 배선 — 시작 · 다시 짜기 · 이어서 · 접힌 두 줄에서 rest 빼기', () => {
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    expect(screen).toMatch(/startLevelSession\([^;]*\{ newCap, learningOf: \(k\) => inLearningStep\(table\.get\(k\) \|\| \{\}\), \.\.\.studyOpts \}/);
    expect(screen).toContain('const next = arrangeLevelSession(session, studyOpts, { pin: head });');
    expect(screen).toMatch(/useLayoutEffect\(\(\) => \{\n\s+if \(!session\) return;\n\s+const next = arrangeLevelSession/);
    expect(screen).toContain('continueLevelSession(cur, contBatch, stillToday)');
    expect(screen).toContain("...(session.rest || [])]);");
    expect(screen).toContain('cont={contBatch} onContinue={continueRest}');
    // 되돌리기는 옛 줄을 그대로 돌려놓는다(다시 짜기는 위 효과 몫) — 채점 기록 되돌리기 길은 그대로.
    expect(screen).toContain('if (last.sessionBefore) { setSession(last.sessionBefore); setHeadKey(last.headBefore);');
  });
});

describe('끝 화면 — 분량에서 멈춤은 「이번 분량 끝」 + 「이어서 N개」', () => {
  const counts = { 1: 1, 2: 0, 3: 9, 4: 0 };
  const wrap = (node) => renderToStaticMarkup(<WordLangContext.Provider value={{}}>{node}</WordLangContext.Provider>);
  it('rest가 있으면 이어서 단추(기본 단추 모양) · 다음 레벨 · 새 단어 더는 그 뒤', () => {
    const html = wrap(<OneWordDone graded={10} tomorrow={3} counts={counts} onNext={() => {}} nextLabel="HSK 2" onList={() => {}}
      more={15} perDay={15} started={5} onMore={() => {}} onBrowse={() => {}} cont={10} onContinue={() => {}} />);
    expect(html).toContain('>이번 분량 끝</h2>');
    expect(html).toContain('<button type="button" class="lw-btn lw-btn--primary">이어서 10개</button>');
    expect(html).toContain('리스트로');
    expect(html).not.toMatch(/새 단어 15개 더|계속 진행|하루 15개를 넘기면/);
  });
  it('rest가 없으면 예전 그대로(이어서 없음)', () => {
    const html = wrap(<OneWordDone graded={3} tomorrow={0} counts={counts} onNext={() => {}} nextLabel="HSK 2" onList={() => {}} />);
    expect(html).toContain('오늘 이 레벨 끝');
    expect(html).not.toContain('이어서');
  });
  it('리스트에서 기다리는 카드만 남았을 때도 이어서가 먼저(새 단어 더와 겹치지 않는다)', () => {
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    expect(screen).toMatch(/listed\.waiting\.length > 0 && contBatch > 0 && <div className="lw-capped"[\s\S]{0,300}이번 분량 끝[\s\S]{0,300}<ContinueButton/);
  });
});

describe('진행 줄 칩 — 기본이 아닌 것만, 차례 고정(순서 · 분량)', () => {
  it('문구', () => {
    expect(levelStudyChip(LEVEL_WORD_PREFS)).toBeNull();
    expect(levelStudyChip({ order: 'new-first', amount: 10 })).toBe('새 단어 먼저 · 10개');
    expect(levelStudyChip({ order: 'review-first', amount: 'all' })).toBe('복습 먼저');
    expect(levelStudyChip({ order: 'mix', amount: 20 })).toBe('20개');
    expect(levelStudyChip({ order: 'mix', amount: 'all', two: true })).toBeNull(); // 2단 평가는 뺐다(옛 저장값 무시)
  });
  it('% 앞 흐린 한 줄(넘기지 않는다) · 칩이 있을 때만', () => {
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    const css = fs.readFileSync('src/components/levels/word/level-word.css', 'utf8');
    const prog = sliceBetween(screen, 'className="lw-prog"', '</div>}');
    expect(prog.indexOf('lw-optchip')).toBeGreaterThan(prog.indexOf('lw-bar'));
    expect(prog.indexOf('lw-optchip')).toBeLessThan(prog.indexOf('lw-pct'));
    expect(prog).toContain('{optChip && <span className="lw-optchip"');
    expect(css).toContain('.lw-optchip{flex:none;font-size:12px;color:var(--muted);white-space:nowrap;font-variant-numeric:tabular-nums}');
    expect(css).toMatch(/\.lw-bar\{flex:1 1 auto/); // 좁으면 막대가 줄어든다(칩은 넘기지 않는다)
  });
});

describe('설정 값 — 보기 줄은 고정 기본값(tone 켬 · page 20), 학습 옵션은 언어마다 저장', () => {
  it('저장값과 상관없이 tone = true · page = 20', () => {
    expect(normalizeLevelWordPrefs({ tone: false, page: 50 })).toMatchObject({ tone: true, page: 20 });
    expect(normalizeLevelWordPrefs({ tone: false, page: 10, v: 2 })).toMatchObject({ tone: true, page: 20 });
    expect(normalizeLevelWordPrefs(null)).toEqual(LEVEL_WORD_PREFS);
  });
  it('기본값 = 예전 동작(혼합 · 전체) · 모르는 값은 기본으로 · 2단 평가 저장값은 버린다', () => {
    expect(LEVEL_WORD_PREFS).toMatchObject({ order: 'mix', amount: 'all' });
    expect(LEVEL_WORD_PREFS).not.toHaveProperty('two');
    expect(normalizeLevelWordPrefs({ order: 'weak', amount: 50 })).toMatchObject({ order: 'mix', amount: 'all' });
    expect(normalizeLevelWordPrefs({ order: 'review-first', amount: 10, two: true, mode: 'list', view: 'sound', v: 2 }))
      .toEqual({ mode: 'list', view: 'sound', tone: true, page: 20, order: 'review-first', amount: 10, v: 2 });
  });
  it('세션 옵션 — 전체 = 끝없음', () => {
    expect(levelStudyOptions({ order: 'new-first', amount: 'all' })).toEqual({ order: 'new-first', amount: Infinity });
    expect(levelStudyOptions({ order: 'mix', amount: 20 })).toEqual({ order: 'mix', amount: 20 });
  });
  it('언어마다 따로 저장(cfg.prefsKey) · 정렬 · 임의 출제는 없다', () => {
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    expect(screen).toContain('writeJson(localStorage, cfg.prefsKey, next)');
    expect(screen).toContain('normalizeLevelWordPrefs(readJson(localStorage, cfg.prefsKey))');
    const prefs = fs.readFileSync('src/lib/levelWordPrefs.js', 'utf8');
    expect(prefs).not.toMatch(/shuffle|retrievab|sort:|two:/);
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
  it('한 단어 — 앞면(문장 탭)은 맨 글자, 뒷면 예문은 루비', () => {
    const front = wrap(<OneWordCard entry={ENTRY} view="sentence" info={info} tone revealed={false} onReveal={() => {}} />);
    expect(front).toContain('経験がある。');
    expect(front).not.toContain('<ruby>');
    const back = wrap(<OneWordCard entry={ENTRY} view="sentence" info={info} tone revealed onReveal={() => {}} />);
    expect(back).toContain('<ruby>経験<rt>けいけん</rt></ruby>');
  });
  it('리스트 — 접힌 문장(문제 면)은 맨 글자, 펼친 카드 · 전체 카드(답 면)는 루비', () => {
    const closed = wrap(<WordCard entry={ENTRY} level="N3" view="sentence" info={info} tone />);
    expect(closed).toContain('経験がある。');
    expect(closed).not.toContain('<ruby>');
    const open = wrap(<WordCard entry={ENTRY} level="N3" view="all" info={info} tone />);
    expect(open).toContain('<ruby>経験<rt>けいけん</rt></ruby>');
  });
  it('화면은 tone을 고정값으로만 넘긴다(끄는 길 없음)', () => {
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    expect(screen).not.toMatch(/setPrefs\(\{ tone/);
    expect(normalizeLevelWordPrefs({ tone: false }).tone).toBe(true);
  });
});

it('sessionOrder는 rest를 넣지 않는다 — 분량 밖 단어는 지금 차례가 아니다', () => {
  const s = start({ order: 'review-first', amount: 2 });
  expect(sessionOrder(s, T0)).toEqual(['L1', 'r1', 'r2']);
});


describe('끝 화면 — 분량에서 멈춤이면 「이어서」가 주 단추(소리 확인이 있어도)', () => {
  it('이어서 = 맨 위 주 단추 · 소리 확인은 아래 줄 보조', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { OneWordDone } = await import('@/components/levels/word/OneWord');
    const html = renderToStaticMarkup(<OneWordDone graded={10} tomorrow={6} counts={{ 1: 2, 2: 1, 3: 6, 4: 1 }} onList={() => {}}
      cont={10} onContinue={() => {}} soundCount={3} onSound={() => {}} />);
    expect(html).toContain('class="lw-btn lw-btn--primary">이어서 10개</button>');
    expect(html).toContain('class="lw-btn">소리 확인 3개</button>');
    expect(html.indexOf('이어서 10개')).toBeLessThan(html.indexOf('lw-done__row'));
    expect(html).not.toContain('lw-btn--primary">소리로 확인할 단어');
  });
});
