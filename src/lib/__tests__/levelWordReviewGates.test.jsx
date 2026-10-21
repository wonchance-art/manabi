import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { GradeBar, OneWordDone } from '@/components/levels/word/OneWord';
import { PracticeBar } from '@/components/levels/word/WordAreas';
import { WordLangContext } from '@/components/levels/word/wordLang';

// 계약: 시안 ⑦ 추천 셋(오너 「셋 다」 2026-10-21 KST) — ① 하루 새 단어는 복습 설정과 같은 수 + 「더」 단추(시안 ⑧),
// ② 펼친 뒤에 채점(펼치기 전 누름은 펼침), ③ 소리 탭 자동 읽기. 기록 · 일정 계산은 그대로다.
const L = { guide: '떠올린 만큼 골라요' };
const wrap = (node) => renderToStaticMarkup(<WordLangContext.Provider value={L}>{node}</WordLangContext.Provider>);
const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
const css = fs.readFileSync('src/components/levels/word/level-word.css', 'utf8');
const counts = { 1: 2, 2: 1, 3: 9, 4: 3 };

describe('① 하루 새 단어 — 복습 설정과 같은 수 · 더 단추(시안 ⑧)', () => {
  it('줄은 복습 설정의 하루 새 단어 수에서 오늘 이미 시작한 수를 뺀 만큼', () => {
    expect(screen).toContain("import { DEFAULT_NEW_PER_DAY, loadNewPerDay } from '@/lib/vocabStudy'");
    expect(screen).toMatch(/perDay - newStartedToday\(index, language, Date\.now\(\)\)/);
    expect(screen).toMatch(/startLevelSession\([^\n]*\{ newCap \}\)/);
    expect(screen).toContain('newPerDay || DEFAULT_NEW_PER_DAY');
  });
  it('몫에서 멈춘 끝 화면: 제목 · 더 단추 · 다음 레벨 대신 전체 훑어보기', () => {
    const html = wrap(<OneWordDone graded={15} tomorrow={12} counts={counts} onNext={() => {}} nextLabel="HSK 4" onList={() => {}}
      more={15} perDay={15} started={15} onMore={() => {}} onBrowse={() => {}} />);
    expect(html).toContain('오늘 새 단어 15개 끝');
    expect(html).toContain('새 단어 15개 더<small>하루 15개를 넘어요 · 내일 복습이 그만큼 늘어요</small>');
    expect(html).toContain('전체 훑어보기');
    expect(html).not.toContain('이어서');
  });
  it('레벨을 다 했으면 지금처럼 · 채점 없이 들어온 날은 네 칸 없음 · 하루 0개면 「오늘 복습 끝」', () => {
    const full = wrap(<OneWordDone graded={3} tomorrow={0} counts={counts} onNext={() => {}} nextLabel="HSK 4" onList={() => {}} />);
    expect(full).toContain('오늘 이 레벨 끝');
    expect(full).toContain('HSK 4 이어서');
    expect(full).not.toContain('새 단어');
    const empty = wrap(<OneWordDone graded={0} tomorrow={0} counts={counts} onList={() => {}} more={15} perDay={0} started={0} onMore={() => {}} onBrowse={() => {}} />);
    expect(empty).toContain('오늘 복습 끝');
    expect(empty).toContain('복습할 단어도 오늘은 다 했어요');
    expect(empty).not.toContain('누른 횟수');
    expect(empty).toContain('새 단어 15개 더<small>내일 복습이 그만큼 늘어요</small>');
  });
  it('리스트도 줄이 비면 같은 단추', () => {
    expect(screen).toMatch(/!listed\.active\.length && moreBatch > 0 && <div className="lw-capped"/);
    expect(screen).toMatch(/lw-capped[\s\S]{0,400}<MoreNewButton[\s\S]{0,200}전체 훑어보기/);
  });
});

describe('② 펼친 뒤에 채점', () => {
  it('펼치기 전 칸은 흐리게(data-locked) — 네 칸 · 두 칸 모두', () => {
    expect(wrap(<GradeBar previews={null} onGrade={() => {}} locked />)).toContain('class="lw-gradebar" data-locked="true"');
    expect(wrap(<GradeBar previews={null} onGrade={() => {}} />)).not.toContain('data-locked');
    expect(wrap(<PracticeBar onAnswer={() => {}} locked />)).toContain('data-locked="true"');
    expect(css).toMatch(/\.lw-gradebar\[data-locked\] \.lw-grade:not\(:disabled\),\.lw-gradebar\[data-locked\] \.lw-two__btn:not\(:disabled\)\{opacity:\.45\}/);
  });
  it('누르면 먼저 펼친다 — 한 단어 · 리스트 · 키보드', () => {
    expect(screen).toContain('onGrade={(r) => (revealed ? onGrade(current, r) : keyState.current.reveal())}');
    expect(screen).toContain('onAnswer={(ok) => (revealed ? onPractice(practiceEntry, ok) : keyState.current.reveal())}');
    expect(screen).toContain('onGrade={(r) => (opened.has(focusEntry.key) ? onGrade(focusEntry, r, { next: true }) : openCard(focusEntry.key))}');
    expect(screen).toContain('onAnswer={(ok) => (opened.has(practiceFocus.key) ? onPractice(practiceFocus, ok) : openCard(practiceFocus.key))}');
    expect(screen).toContain('if (h.revealed) h.onGrade(h.current, Number(event.key)); else h.reveal();');
    expect(screen).toContain('if (h.opened.has(h.focus.key)) h.onGrade(h.focus, Number(event.key), { next: true }); else h.openCard(h.focus.key);');
  });
  it('리스트 카드는 화면이 펼칠 수 있다(shown) · 보기를 바꾸면 펼친 기록을 비운다', () => {
    expect(fs.readFileSync('src/components/levels/word/WordCard.jsx', 'utf8')).toContain('useEffect(() => { if (shown) setOpen(true); }, [shown]);');
    expect(screen).toContain('useEffect(() => { setOpened(new Set()); }, [prefs.view, prefs.mode]);');
  });
});

describe('③ 소리 탭 자동 읽기', () => {
  it('한 단어는 카드가 나올 때, 리스트는 답할 카드가 바뀔 때 한 번', () => {
    expect(screen).toContain("const sayKey = practice === 'audio' && roundOn ? (prefs.mode === 'one' ? practiceEntry?.key : practiceFocus?.key) ?? null : null;");
    expect(screen).toContain('useEffect(() => { if (sayKey && speak) speak(byKey.get(sayKey)?.word || sayKey); }, [sayKey, sayTurn, speak, byKey]);');
  });
});
