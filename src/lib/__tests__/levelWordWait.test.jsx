import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { GradeButtons, WaitChip, waitAmount, waitLabel } from '@/components/levels/word/WordParts';
import { OneWordWait } from '@/components/levels/word/OneWord';
import { WordCard } from '@/components/levels/word/WordCard';
import { WordLangContext } from '@/components/levels/word/wordLang';
import { gradeLevelSession, sessionCurrent, sessionNextAt, sessionOrder, sessionWaiting, startLevelSession } from '../levelWordSession';
import { sliceBetween } from './helpers/sliceBetween';

// 계약: 단어 페이지 — 잠긴 카드 분리 · 대기 화면 · 시간 글자(LEVEL-WAIT-001 · 오너 승인 2026-11-01 KST 시안 「단어 페이지 대기 · 새 단어」).
// 같은 날 오너 결정: 잠긴 카드(아직 채점할 수 없는 기다리는 카드)는 리스트에 아예 그리지 않는다(Anki처럼 — 「대기 N개」 칸도 없다).
// 시간이 되면 위 목록에 「지금」으로 올라오고, 위 목록이 비면 「오늘 할 카드 끝」 · 「다음 카드는 N분 후에 위로 올라와요」만.
// 「미리 학습 20분」(LEARN-AHEAD-001 — 20분 안의 학습 · 재학습 카드를 앞당겨 채점)이 들어온 뒤 이 화면은 20분 넘게 남은 카드만 남을 때의 「드문 경우」다
// (계약 learnAhead.test.jsx). 남은 시간은 그 카드가 위로 올라오는 시각(comesAt — 차례 · 미리 학습 창 중 이른 것)부터 센다.
const L = { hw: 'ja', exReading: 'ja', head: (e) => ({ hw: e.word, sub: e.reading }), tag: (l) => `JLPT ${l}`, Reading: ({ text }) => <span>{text}</span> };
const wrap = (node) => renderToStaticMarkup(<WordLangContext.Provider value={L}>{node}</WordLangContext.Provider>);
const read = (f) => fs.readFileSync(f, 'utf8');
const screen = read('src/components/levels/word/LevelWordScreen.jsx');
const css = read('src/components/levels/word/level-word.css');
// 주석을 걷어낸 코드 — 글자 계약은 화면에 닿는 문자열만 본다.
const code = (src) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const ENTRY = { key: '準備', word: '準備', reading: 'じゅんび', meaning: '준비', ex: null };
const MIN = 60_000;

describe('시간 글자 — 「지금」 · 「N분 후」(「뒤」 · 「아까 본 단어」는 없다)', () => {
  it('남은 시간은 「후」 — 초 · 분(올림) · 시간 · 일', () => {
    expect(waitLabel(30_000)).toBe('30초 후');
    expect(waitLabel(4 * MIN)).toBe('4분 후');
    expect(waitLabel(3.2 * MIN)).toBe('4분 후');
    expect(waitLabel(3 * 3600_000)).toBe('3시간 후');
    expect(waitLabel(2 * 86400_000)).toBe('2일 후');
    expect(waitLabel(0)).toBeNull();
    expect(waitAmount(35 * MIN)).toBe('35분');
    expect(renderToStaticMarkup(<WaitChip at={Date.now() + 4 * MIN} />)).toMatch(/role="timer" aria-label="4분 후 다시">4분 후</);
  });
  it('시간이 된 카드는 「지금」 — 카드 내용(접힌 단어 탭은 표제어만)은 그대로', () => {
    const html = wrap(<WordCard entry={ENTRY} level="N5" view="word" info={{ status: 'today', previews: null }} due />);
    expect(html).toContain('<span class="lw-time">지금</span>');
    expect(html).not.toContain('아까 본 단어');
    expect(html).not.toContain('준비'); // 답(뜻)은 눌러 펼친 뒤에만 — 회상을 시험한다
    expect(html).not.toContain('じゅんび');
  });
  it('네 칸 화면 읽기 · 되돌리기 글 · 「N일 후 복습」 — 단어 페이지 코드에 「N뒤」 글자가 없다', () => {
    const html = renderToStaticMarkup(<GradeButtons previews={{ 1: { label: '1분' }, 2: { label: '10분' }, 3: { label: '2일' }, 4: { label: '오늘' } }} onGrade={() => {}} />);
    expect(html).toContain('aria-label="알맞음, 2일 후"');
    expect(html).toContain('aria-label="다시, 1분 후"');
    expect(html).toContain('aria-label="쉬움, 오늘 다시"');
    expect(screen).toContain('return a ? `${a.n}${a.unit} 후 복습` : null;');
    for (const f of ['src/components/levels/word/LevelWordScreen.jsx', 'src/components/levels/word/WordParts.jsx', 'src/components/levels/word/WordCard.jsx',
      'src/components/levels/word/OneWord.jsx', 'src/lib/levelWordStatus.js']) {
      expect(code(read(f)), f).not.toMatch(/(초|분|시간|일|\}) 뒤/);
      expect(code(read(f)), f).not.toContain('아까 본 단어');
    }
  });
});

describe('리스트 — 위 목록은 지금 채점할 카드만 · 잠긴 카드는 그리지 않는다', () => {
  const T0 = 1_700_000_000_000;
  const entries = ['a', 'b', 'c'].map((key) => ({ key }));
  it('줄 — 채점해 기다리는 카드는 sessionOrder(위 목록)에 없고, 시간이 되면 맨 앞(①)으로', () => {
    let s = startLevelSession(entries, () => 'today', () => 0, T0);
    s = gradeLevelSession(s, 'a', 1, T0 + 35 * MIN);
    expect(sessionOrder(s, T0)).toEqual(['b', 'c']);
    s = gradeLevelSession(gradeLevelSession(s, 'b', 3, null), 'c', 3, null);
    expect(sessionOrder(s, T0)).toEqual([]); // 위 목록 비었음 — 「오늘 할 카드 끝」
    expect(sessionWaiting(s, T0).map((w) => w.key)).toEqual(['a']);
    expect(sessionNextAt(s, T0)).toBe(T0 + 35 * MIN);
    expect(sessionCurrent(s, T0)).toBe('a'); // 한 단어는 앞당겨 보되, 채점할 수 없으면 대기 화면(아래)
    expect(sessionOrder(s, T0 + 35 * MIN)).toEqual(['a']); // 시간이 되면 위 목록에 「지금」으로
  });
  it('화면 — 기다리는 카드는 listCard로 그리지 않는다 · 「대기」 칸 없음 · 기본 채점 대상은 위 목록에서만', () => {
    expect(screen).toContain('const topList = useMemo(() => (listed ? listed.active.slice(0, shown) : []), [listed, shown]);');
    expect(screen).toContain('const focusEntry = wordList ? listOrder.find((e) => e.key === focusKey) || topList[0] || null : null;');
    expect(screen).toMatch(/const listOrder = useMemo\(\(\) => \(listed \? \[\.\.\.topList,\n\s+\.\.\.\(laterOpen\.review/);
    expect(screen).not.toMatch(/listed\.waiting\.map\(\(w\) => listCard|aria-label="기다리는 카드"|lw-later--wait|'대기'/);
    expect(css).not.toContain('lw-later--wait');
    // 위 목록이 비면 네 칸은 접힌 줄에서 카드를 눌렀을 때만 — 지금 채점할 수 없는 카드면 꺼진 채 안내(gradeNote).
    expect(screen).toContain('{focusEntry && <GradeBar previews={focusInfo.previews}');
    // 누른 카드를 채점한 뒤 바로 아래가 채점할 수 없는 카드면 넘기지 않는다.
    expect(screen).toContain('setFocusKey(below && cardInfo(below.key).previews ? below.key : null);');
  });
  it('위 목록을 다 풀고 기다리는 카드만 — 「오늘 할 카드 끝」 · 「다음 카드는 N분 후에 위로 올라와요」(1초마다) · 하루 몫이면 「새 단어 N개 더」', () => {
    const capped = sliceBetween(screen, '{!listed.active.length && listed.waiting.length > 0 && <div className="lw-capped" role="status">', '</div>}');
    expect(capped).toContain("{moreBatch > 0 ? <NewDayTitle started={startedToday} /> : '오늘 할 카드 끝'}");
    expect(capped).toContain('<p className="lw-capped__s" aria-live="off"><WaitText at={comesAt}>'); // 매초 바뀌는 글은 알림 영역에서 읽지 않는다
    expect(capped).toContain('<WaitText at={comesAt}>{(amount) => (amount ? `다음 카드는 ${amount} 후에 위로 올라와요` : \'다음 카드가 곧 위로 올라와요\')}</WaitText>');
    expect(capped).toContain('<MoreNewButton more={moreBatch} onMore={moreNew} />');
    expect(screen).toContain('{done && allEntries.length > 0 && doneScreen()}'); // 아무것도 안 남으면 끝 화면 그대로
  });
  it('「다음 20개 보기」 단추 대신 끝까지 내리면 이어 그린다(IntersectionObserver · page장씩) · 찾아가기(jumpTo)는 그대로', () => {
    expect(screen).not.toContain('다음 {Math.min(prefs.page, listed.active.length - shown)}개 보기');
    expect(screen).toContain("{moreLeft && <div className=\"lw-more-sentinel\" ref={moreRef} aria-hidden=\"true\" />}");
    expect(screen).toMatch(/new IntersectionObserver\(\(hits\) => \{ if \(hits\.some\(\(h\) => h\.isIntersecting\)\) setLimit\(\(n\) => n \+ prefs\.page\); \}, \{ rootMargin: '0px 0px 400px 0px' \}\)/);
    expect(screen).toContain("typeof IntersectionObserver === 'undefined'");
    expect(screen).toContain('return () => io.disconnect();');
    expect(screen).toContain('if (at >= shown) { setLimit(at + prefs.page); return; }');
    // 접힌 두 줄(복습 예정 · 새 단어)은 제 「다음 N개 보기」를 그대로 둔다.
    expect(screen).toContain('setLaterLimit((l) => ({ ...l, [part]: l[part] + prefs.page }))');
  });
});

describe('한 단어 — 기다리는 카드만 남고 아직 채점할 수 없으면 대기 화면', () => {
  it('「다음 카드는 N분 후에 와요」 + [리스트로]만 — 네 칸 · 카드 · 「대기 N개」 없음', () => {
    const html = renderToStaticMarkup(<OneWordWait at={Date.now() + 35 * MIN} onList={() => {}} />);
    expect(html).toContain('다음 카드는 <b>35분</b> 후에 와요');
    expect(html).toContain('<button type="button" class="lw-btn">리스트로</button>');
    expect(html).not.toMatch(/lw-grade|lw-one__card|대기/);
    expect(renderToStaticMarkup(<OneWordWait at={Date.now() - 1} onList={() => {}} />)).toContain('다음 카드가 곧 와요');
  });
  it('화면 — 줄이 비고 가장 빠른 카드도 채점할 수 없을 때만 · 카드 · 네 칸 대신 · 숫자 키도 받지 않는다 · 시간이 되면 카드가 저절로', () => {
    expect(screen).toMatch(/const oneWait = !!session && !!current && !browse && prefs\.mode === 'one' && !sessionOrder\(session, clock\)\.length\n\s+&& !!nextAt && !currentInfo\?\.previews;/);
    expect(screen).toContain("{oneWait && <OneWordWait at={comesAt} onList={() => switchMode('list')} />}");
    expect(screen).toContain('{session && current && !oneWait && <OneWordCard');
    expect(screen).toContain('{session && current && !oneWait && <GradeBar');
    expect(screen).toContain('keyState.current = { current: oneWait ? null : current,');
    expect(screen).toContain('const t = setTimeout(() => setClock(Date.now()), Math.max(0, comesAt - Date.now()) + 50);');
    expect(css).toMatch(/\.lw-wait\{[^}]*place-content:center/);
  });
});

describe('채점할 수 없는 카드를 열 수 있는 자리(찾기 · 단어 카드 창) — 네 칸 꺼짐 + 「N분 후 채점해요」', () => {
  it('카드 안 네 칸(grades)은 미리보기가 없으면 꺼지고 안내를 단다 · 숫자 키도 막는다', () => {
    const html = wrap(<WordCard entry={ENTRY} level="N5" view="all" info={{ status: 'review', previews: null }} grades search onGrade={() => {}}
      note="1일 후 채점해요" />);
    expect(html.match(/<button type="button" class="lw-grade [^"]+" disabled=""/g)).toHaveLength(4);
    expect(html).toContain('<p class="lw-grades__note">1일 후 채점해요</p>');
    expect(screen).toContain('if (!info.previews) return undefined;');
    expect(screen).toContain("return later.endsWith('일 후') ? `${later} 채점해요` : <><WaitChip at={at} /> 채점해요</>;");
  });
});
