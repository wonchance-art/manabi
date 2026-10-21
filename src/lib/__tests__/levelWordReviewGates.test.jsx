import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { GradeBar, OneWordDone } from '@/components/levels/word/OneWord';
import { PracticeBar } from '@/components/levels/word/WordAreas';
import { WordLangContext } from '@/components/levels/word/wordLang';

// 계약: 시안 ⑦ 추천(오너 2026-10-21 KST) — ① 하루 새 단어는 복습 설정과 같은 수 + 「더」 단추(시안 ⑧), ③ 소리 탭 자동 읽기.
// ② 「확인 전 채점 막기」는 앞서 정한 「앞면에서도 네 칸」과 어긋나 넣지 않는다(오너 재확인). 기록 · 일정 계산은 그대로다.
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
  it('리스트도 다 끝나면 한 단어와 같은 끝 화면 · 기다리는 카드만 남았으면 더 단추(시안 「단어 페이지 손질」 정리)', () => {
    expect(screen).toContain('{done && allEntries.length > 0 && doneScreen()}');
    expect(screen).toContain("{session && done && doneScreen({ onList: () => switchMode('list') })}");
    expect(screen).not.toContain('오늘 이 레벨은 다 봤어요');
    expect(screen).toMatch(/!listed\.active\.length && listed\.waiting\.length > 0 && moreBatch > 0 && <div className="lw-capped"/);
    expect(screen).toMatch(/lw-capped[\s\S]{0,400}<MoreNewButton[\s\S]{0,200}전체 훑어보기/);
    const inList = wrap(<OneWordDone graded={3} tomorrow={0} counts={counts} onNext={() => {}} nextLabel="HSK 4" />);
    expect(inList).not.toContain('리스트로');
  });
});

describe('② 앞면에서도 채점 — 「확인 전 채점 막기」는 넣지 않는다(오너 결정 재확인 2026-10-21 KST)', () => {
  it('네 칸 · 두 칸은 펼치지 않아도 그대로 누르고, 흐림 표시가 없다', () => {
    expect(wrap(<GradeBar previews={null} onGrade={() => {}} />)).not.toContain('data-locked');
    expect(wrap(<PracticeBar onAnswer={() => {}} />)).not.toContain('data-locked');
    expect(css).not.toContain('data-locked');
    expect(screen).toContain('<GradeBar previews={currentInfo.previews} onGrade={(r) => onGrade(current, r)}');
    expect(screen).toContain('<PracticeBar onAnswer={(ok) => onPractice(practiceEntry, ok)}');
    expect(screen).toContain("if (['1', '2', '3', '4'].includes(event.key)) { event.preventDefault(); h.onGrade(h.current, Number(event.key)); }");
    expect(screen).not.toMatch(/revealed \? onGrade|opened\.has\(/);
  });
});

describe('③ 소리 탭 자동 읽기', () => {
  it('한 단어는 카드가 나올 때, 리스트는 답할 카드가 바뀔 때 한 번', () => {
    expect(screen).toContain("const sayKey = practice === 'audio' && roundOn ? (prefs.mode === 'one' ? practiceEntry?.key : practiceFocus?.key) ?? null : null;");
    expect(screen).toContain('useEffect(() => { if (sayKey && speak) speak(byKey.get(sayKey)?.word || sayKey); }, [sayKey, sayTurn, speak, byKey]);');
  });
});

describe('시안 · 설계 문서 대조 후속(2026-10-21 KST)', () => {
  const card = fs.readFileSync('src/components/levels/word/WordCard.jsx', 'utf8');
  const parts = fs.readFileSync('src/components/levels/word/WordParts.jsx', 'utf8');
  it('로그인 확인이 끝나기 전에는 손님 줄을 세우지 않는다 — 돌아온 표시를 손님 줄이 먹지 않게(문서 「보던 카드로 돌아와요」)', () => {
    expect(screen).toContain('const { user, loading: authLoading, fetchProfile } = useAuth();');
    expect(screen).toContain('const ready = mounted && !authLoading && (!userId || !!index || indexQuery.isError);');
  });
  it('문장 탭 펼친 카드는 예문 단어를 바로 누른다(시안 ⑦) · 접힌 줄은 글자 그대로', () => {
    expect(card).toMatch(/open === true \? soloLine\('lw-card__solo', <ExampleWords /);
    expect(css).toContain('.lw-card__solo .lw-ex__text{font-size:inherit;line-height:inherit}');
  });
  it('끝 화면 칸 차례 — 마지막 칸 늦춤 + 길이가 0.3초 안', () => {
    const dur = Number(css.match(/\.lw-done__n\{animation:settleIn (\.\d+)s/)[1]);
    const delays = [...css.matchAll(/\.lw-done__n:nth-child\(\d\)\{animation-delay:(\.\d+)s\}/g)].map((m) => Number(m[1]));
    expect(Math.max(...delays) + dur).toBeLessThanOrEqual(0.3);
  });
  it('글자 칸 조각이 둘을 넘으면 …', () => {
    expect(parts).toContain("{j === 1 && t.pieces.length > 2 ? ' …' : ''}");
  });
  it('찾기 줄 — 범위를 읽어 주고(시안 ⑨) · 내려 보면 그림자(시안 ⑪)', () => {
    expect(screen).toContain('<span className="sr-only">{cfg.scope}에서 찾기</span>');
    expect(screen).toContain('<header className="lw-top lw-top--search" data-stuck={scrolled || undefined}>');
    expect(css).toContain('.lw-top--search[data-stuck]{box-shadow');
  });
  it('복습실 카드가 앞당겨 나와도 차례 전엔 채점할 수 없으니 남은 시간을 센다', () => {
    expect(screen).toContain('<>복습실 카드 · <WaitChip at={at} /> 채점해요</>');
  });
});
