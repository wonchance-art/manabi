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
    // 시안 ⑪(오너 2026-10-22 KST 검토) — 단추는 한 줄, 대가는 단추 밖 회색 한 줄 · 몫을 채운 날 「리스트로」는 뺀다(모드 칸과 같은 일).
    expect(html).toContain('>새 단어 15개 더</button>');
    expect(html).toContain('<p class="lw-done__note">하루 15개를 넘기면 내일 복습이 그만큼 늘어요</p>');
    expect(html).not.toContain('리스트로');
    expect(html).not.toContain('<small>하루');
    expect(html).toContain('전체 훑어보기');
    expect(html).not.toContain('계속 진행');
  });
  it('레벨을 다 했으면 지금처럼 · 채점 없이 들어온 날은 네 칸 없음 · 하루 0개면 「오늘 복습 끝」', () => {
    const full = wrap(<OneWordDone graded={3} tomorrow={0} counts={counts} onNext={() => {}} nextLabel="HSK 4" onList={() => {}} />);
    expect(full).toContain('오늘 이 레벨 끝');
    // 9판 ⑤ · 오너 2026-10-19 KST — 문구 대신 큰 칸(학습 · 내일), 「매김」은 「학습」, 다음 레벨은 「계속 진행」.
    expect(full).toContain('<small>학습</small>');
    expect(full).toContain('<small>내일</small>');
    expect(full).toContain('>계속 진행</button>');
    expect(full).not.toMatch(/채점했어요|이어서/);
    expect(full).not.toContain('새 단어');
    const empty = wrap(<OneWordDone graded={0} tomorrow={0} counts={counts} onList={() => {}} more={15} perDay={0} started={0} onMore={() => {}} onBrowse={() => {}} />);
    expect(empty).toContain('오늘 복습 끝');
    expect(empty).toContain('지금 복습할 단어가 없어요');
    expect(empty).not.toContain('누른 횟수');
    expect(empty).toContain('새 단어를 더 하면 내일 복습이 그만큼 늘어요');
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

describe('캔버스 시각 값(오너 2026-10-21 KST 「시안대로」 · 보기 탭 밑줄만 ⑥ 승인대로)', () => {
  const card = fs.readFileSync('src/components/levels/word/WordCard.jsx', 'utf8');
  it.each([
    ['진행바 먹색 · % 12.5px 보통', 'background:var(--ink);border-radius:inherit;transform-origin:left;'],
    ['진행바 %', 'font-size:12.5px;font-weight:400;'],
    ['한 단어 카드 종이', '.lw-one__card{flex:1 0 auto;background:var(--sheet);border:1px solid var(--rule);border-radius:3px;box-shadow:0 8px 28px rgba(37,39,33,.04);'],
    ['되돌리기 밝은 카드 · 좌우 꽉', '.lw-undo{position:fixed;left:16px;right:16px;'],
    ['되돌리기 장미색', 'background:none;color:var(--lw-rose);font-size:13px;font-weight:700;padding:0 12px;'],
    ['자주 틀린 단어 알약', 'padding:3px 10px;border-radius:999px;'],
    ['리스트 카드 글자', '.lw-card__mean{margin:0;font-size:17px;font-weight:400;line-height:1.6}'],
    ['예문 2px · 20px', '.lw-ex{margin:0;border-left:2px solid var(--lw-ex-rule);padding:2px 0 2px 14px;'],
    ['누른 예문 단어', '.lw-ex__w[aria-expanded=true]{background:var(--lw-ex-hit);color:var(--lw-today);'],
    ['간격 글자 12px', '.lw-grade__gap{font-size:12px;font-weight:700}'],
    ['시트 18px · 손잡이 4px', 'border-radius:18px 18px 0 0;'],
    ['찾기 지금 단어 줄', '.lw-results li:has(.lw-row[data-current]){background:var(--lw-row-cur)}'],
  ])('%s', (_, rule) => { expect(css).toContain(rule); });
  it('칩은 단어 위 · 「· Space」는 회색', () => {
    expect(card).toContain('{chips}{head}');
    expect(card).toContain('{chips}{solo}');
    expect(fs.readFileSync('src/components/levels/word/OneWord.jsx', 'utf8')).toContain('정답 확인 <span className="lw-one__key">· Space</span>');
  });
});

describe('재검수 손질(2026-10-22 KST) — 키보드 · 되돌리기', () => {
  const parts = fs.readFileSync('src/components/levels/word/WordParts.jsx', 'utf8');
  const areas = fs.readFileSync('src/components/levels/word/WordAreas.jsx', 'utf8');
  const sheets = fs.readFileSync('src/components/levels/word/WordSheets.jsx', 'utf8');
  const one = fs.readFileSync('src/components/levels/word/OneWord.jsx', 'utf8');
  it('눌러 채점한 단추는 초점을 놓는다 — 남으면 다음 카드에서 Space가 그 단추를 눌러 보지 않은 카드를 채점한다', () => {
    expect(parts).toContain('releasePointerFocus(e); onGrade(g.grade);');
    expect(areas.match(/releasePointerFocus\(e\); onAnswer/g)).toHaveLength(2);
  });
  it('정답 확인 단추가 사라지면 초점은 카드로 · 시트는 Tab이 안에서 돈다 · 예문 단어 창은 열리면 창 안, 닫히면 누른 단어로', () => {
    expect(one).toMatch(/onReveal\(\); card\?\.focus/);
    expect(sheets).toContain("event.key !== 'Tab'");
    expect(sheets).toContain("el?.querySelector('button')?.focus");
    expect(screen).toContain('returnTo={card.from}');
  });
  it('Ctrl/⌘+Z는 연습 답도 되돌린다 · 되돌리기 창이 지났으면 말없이 넘기지 않는다 · 알림 단추는 닫고 실행', () => {
    expect(screen).toContain('lastRef.current = { practice: [entry.key, which, row] }');
    expect(screen).toContain('되돌릴 수 있는 시간이 지났어요');
    expect(screen).toContain('onDone(); notice.onAction();');
  });
  it('저장 실패는 그 카드만 되돌린다(revertLevelGrade)', () => {
    expect(screen.match(/revertLevelGrade\(cur, before, moved, entry\.key, rating\)/g)).toHaveLength(2);
    expect(screen).not.toContain('setSession(before)');
  });
});
