// VOCAB-FLOW-001 (2026-10-17 KST) — /vocab 흐름 점검(합성 회원 픽스처 · 390 · 1440 · CPU 4배 · 응답 지연 150ms)에서 고친 둘.
// ① 복습 시작: 입장 한도 → FSRS 목록을 차례로 읽어 첫 카드까지 왕복이 하나 더 들었다(입장 57–212 → FSRS 235–388 → 첫 질문 424–606ms).
//    둘은 서로의 결과를 쓰지 않는 읽기다 — 함께 보낸다. 실패하면 지금처럼 시작하지 않는다.
// ② 오늘 카드 제목: 준비 중엔 session.total이 0이라 「잠시, 읽기로 돌아가요.」(오늘 끝)가 0.1~1초 보였다가 「오늘 다시 볼 표현」으로
//    바뀌었다(거짓 끝 상태). 준비 중엔 제목도 골격(LOADING-SKELETON-001) — 안내 줄 「복습 준비 중…」과 같은 판정.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const code = fs.readFileSync(path.join(ROOT, 'src/views/VocabPage.jsx'), 'utf8')
  .split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
const between = (from, to) => { const a = code.indexOf(from); expect(a, from).toBeGreaterThanOrEqual(0); const b = code.indexOf(to, a + from.length); return code.slice(a, b < 0 ? undefined : b); };

describe('VOCAB-FLOW-001 ① 복습 시작 — 입장 한도 · FSRS 목록을 함께 읽는다', () => {
  const start = between('const startSession = async', 'const planned =');
  it('두 refresh를 Promise.all로 함께 보내고, 둘 다 성공해야 시작한다', () => {
    expect(start).toContain('await Promise.all([admission.controller.refresh(), fsrsReview.controller.refresh()])');
    expect(start).toContain('if (!admissionOk || !fsrsOk || !workspaceAlive.current) return;');
  });
  it('차례로 기다리는 꼴이 되살아나지 않는다', () => {
    expect(start).not.toMatch(/await admission\.controller\.refresh\(\)\)\s*\|\|\s*!\(await fsrsReview/);
    expect(start.match(/\.refresh\(\)/g)).toHaveLength(2);
  });
});

describe('VOCAB-FLOW-001 ② 오늘 카드 — 준비 중엔 제목도 골격(거짓 「오늘 끝」 없음)', () => {
  it('준비 판정 하나(heroPending)를 제목 · 안내 줄이 같이 쓴다', () => {
    // FSRS 목록을 받는 중에도 준비 중이다 — 그동안 예전 일정 카드가 0으로 세어져 「준비됨 · 0개」가 된다(빌드 실측).
    expect(code).toContain("const roomHeroPending = admission.status !== 'ready' || roomSession.status !== 'ready' || fsrsReview.status === 'loading';");
    // 서버가 센 첫 화면 숫자(VOCAB-FIRST-NUMBERS-001)를 그리는 동안만 준비 중이 아니다 — 그 숫자는 다 받은 뒤의 값과 같은 계산이다.
    expect(code).toContain('const heroPending = !firstView && roomHeroPending;');
    expect(code).toContain('{heroPending ? <p aria-busy="true" className="review-room-note">복습 준비 중…</p>');
  });
  it('제목은 준비 중 분기(골격 + 화면 읽기 이름)가 먼저이고, 끝 · 첫 표현 문구는 그 뒤에만 온다', () => {
    const heading = between('<h2 id="review-today-title">', '</h2>');
    const pending = heading.indexOf('heroPending'), skeleton = heading.indexOf('<SkeletonLine'), done = heading.indexOf('잠시, 읽기로 돌아가요.');
    expect(pending).toBeGreaterThanOrEqual(0);
    expect(skeleton).toBeGreaterThan(pending);
    expect(done).toBeGreaterThan(skeleton);
    expect(heading).toContain('<span className="sr-only">오늘 복습</span>');
    expect(heading).toContain("session.total ? '오늘 다시 볼 표현' : hasAnyWords ? '잠시, 읽기로 돌아가요.' : '첫 표현을 담아 보세요.'");
  });
  it('FSRS 목록을 못 받으면(error) 제목은 중립 「오늘 복습」 — 거짓 「오늘 끝」 없음, 실패는 아래 알림이 말한다(a3ba 리뷰 ③)', () => {
    const heading = between('<h2 id="review-today-title">', '</h2>');
    const error = heading.indexOf("fsrsReview.status === 'error' ? '오늘 복습'"), done = heading.indexOf('잠시, 읽기로 돌아가요.');
    expect(error).toBeGreaterThan(heading.indexOf('<SkeletonLine'));
    expect(done).toBeGreaterThan(error);
    expect(code).toContain("{fsrsReview.status === 'error' && <p role=\"alert\">복습 일정을 불러오지 못했어요.");
  });
  it('FSRS error면 본문 빈 상태(「지금 다시 볼 표현은 없어요」 · 「오늘로 →」)도 그리지 않는다 — 오류 알림 하나만', () => {
    const branch = between("</> : fsrsReview.status === 'error' ? null : <>", '</>}');
    expect(branch).toContain('<ReviewScopeNotice empty');
    expect(branch).toContain('지금 다시 볼 표현은 없어요.');
    expect(branch).toContain("'오늘로 →'");
    // 빈 상태 문구는 이 분기 안에만 있다 — error 판정 밖으로 새지 않는다.
    expect(code.split('지금 다시 볼 표현은 없어요.').length - 1).toBe(1);
  });
});

// ── 오너 「권장대로」(2026-10-17 KST) 목업 A · B · C ──
const file = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const strip = src => src.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');

describe('VOCAB-FLOW-001 A 끝 화면 — 세션 머리줄 유지, 복습방 머리는 「목록으로」 뒤에만', () => {
  it('끝 화면 판정과 세션 머리줄 판정(sessionChrome)', () => {
    expect(code).toContain("const onEndScreen = tab === 'review' && reviewFinished || tab === 'practice' && !!practice && practice.finished;");
    expect(code).toContain('const sessionChrome = inSession || onEndScreen;');
  });
  it('복습방 머리 · 교재 범위 안내는 세션 · 끝 화면에 없고, 상단바는 둘 다에 있다(되돌리기는 끝 화면에서도 쓸 수 있다 — 되돌릴 것이 없을 때만 잠금)', () => {
    expect(code).toContain('{!sessionChrome && (\n        <header className="review-room-heading">');
    expect(code).toContain('{isBookScope && !sessionChrome && <section className="review-room-scope review-room-book-scope"');
    expect(code).toContain('{sessionChrome && (() => {');
    expect(code).toContain("{tab === 'review' && <button type=\"button\" className=\"review-topbar__undo\"");
    // 끝 화면 Ctrl/⌘+Z(onFinishedUndo)가 실제로 되돌린다(reviewFinishedUndoKeyboard) — 단추도 같은 조건(canUndo)으로만 잠근다(a3ba 리뷰 ①).
    expect(code).toContain('disabled={!reviewKeysRef.current.canUndo} onClick={() => reviewKeysRef.current.undo?.()}>↶</button>}');
    expect(code).not.toContain('disabled={onEndScreen ||');
  });
  it('위 여백 8px도 끝 화면까지 — 하단 내비만 세션 중에 숨긴다', () => {
    expect(code).toContain("document.body.classList.toggle('is-review-chrome', sessionChrome);");
    expect(code).toContain("document.body.classList.toggle('is-review-session', inSession);");
    const index = file('src/index.css');
    expect(index).toContain('body.is-review-chrome .page-container { padding-top: 8px; }');
    expect(index).not.toMatch(/body\.is-review-session \.page-container/);
    expect(index).toContain('body.is-review-session .mobile-nav { display: none; }');
  });
});

describe('VOCAB-FLOW-001 A+ 끝 화면 제목으로 초점 — 마지막 채점 뒤 body로 떨어지지 않게(/study 「세션 완료」 선례)', () => {
  const review = strip(file('src/views/VocabReview.jsx'));
  it('떨어진 초점만 줍는 훅이 복습 끝 · 집중 연습 끝 제목 둘 다에 붙는다 — 범위 없이(초점이 body일 때만, 상단바 🔈 초점은 그대로)', () => {
    // 범위(.page-container)를 주면 상단바(🔈 · ← 나가기)에 둔 초점까지 뺏었다(a3ba 리뷰 ②) — focusIfFree(el) = canTakeFocus(undefined) = focusIsLost.
    expect(review).toContain('useEffect(() => { if (!focusIfFree(title.current)) onNotFocused?.(); }, []);');
    expect(review).not.toMatch(/focusIfFree\([^)]*closest\(/);
    expect(review).toContain('const title = useEndTitleFocus(finish.onTitleNotFocused);');
    expect(review.match(/const title = useEndTitleFocus\(/g)).toHaveLength(2);
    expect(review.match(/<h2 ref=\{title\} tabIndex=\{-1\} className="review-done__title">/g)).toHaveLength(2);
  });
  it('제목은 읽는 자리라 초점 고리를 그리지 않는다', () => {
    expect(file('src/components/web/review-room.css')).toContain('.review-done__title[tabindex="-1"]:focus { outline:none; }');
  });
});

describe('VOCAB-FLOW-001 B 끝 알림 — 토스트 없음, 화면 읽기 공지는 늘 깔린 영역이', () => {
  it('끝에서 토스트를 띄우지 않는다', () => {
    expect(code).not.toContain("toast('이번 표현 복습을 마쳤어요'");
  });
  it('공지 영역은 조건 없이 그려 두고 내용만 끝에 넣는다(role=status · sr-only)', () => {
    expect(code).toContain("<p className=\"sr-only review-finish-announce\" role=\"status\">{tab === 'review' && reviewFinished && finishNotice ? '이번 표현 복습을 마쳤어요' : ''}</p>");
    const at = code.indexOf('<p className="sr-only review-finish-announce"');
    expect(code.slice(at - 40, at)).not.toMatch(/&&\s*$/); // 영역 자체가 조건부면 내용과 함께 생겨 화면 읽기가 놓칠 수 있다
  });
  it('공지는 끝 제목이 초점을 못 받았을 때만 — 초점이 간 제목과 같은 말을 두 번 읽지 않는다(a3ba 리뷰 ②)', () => {
    expect(code).toContain('onTitleNotFocused: () => setFinishNotice(true),');
    expect(code).toContain('useEffect(() => { if (!reviewFinished) setFinishNotice(false); }, [reviewFinished]);');
    expect(code).toContain('const [finishNotice, setFinishNotice] = useState(false);');
  });
});

describe('VOCAB-FLOW-001 C 채점 막대 — 앞면에서도 둘째 줄 자리를 둔다(높이 고정)', () => {
  const review = strip(file('src/views/VocabReview.jsx')), fsrs = strip(file('src/components/vocab/FsrsReviewSession.jsx'));
  it('예전 일정 막대: 안내 줄을 늘 그리고, 잠김이면 자리만(숨김 · 화면 읽기 제외)', () => {
    expect(review).toContain("<p className={`review-score-guide review-grade-guide${locked ? ' review-grade-guide--reserve' : ''}`} aria-hidden={locked || undefined}>");
    expect(review).not.toContain('{!locked && <p className="review-score-guide');
  });
  it('새 일정 막대: 안내 줄 · 간격 글 둘 다 자리를 둔다', () => {
    expect(fsrs).toContain("<p className={`review-score-guide review-grade-guide${revealed ? '' : ' review-grade-guide--reserve'}`} aria-hidden={!revealed || undefined}>");
    // 자리 맡는 간격 글은 실제 한 줄이어야 한다 — 보이지 않는 공백(줄 첫머리 일반 공백은 접힌다)만으로는 높이 0(a3ba 리뷰 ④).
    // 소스에 「눈에 안 보이는 nbsp 글자」 대신 이스케이프 '\u00a0'로 적어 읽는 사람이 헷갈리지 않게 한다.
    expect(fsrs).toContain(`<small className="review-grade-guide--reserve" aria-hidden="true">{'\\u00a0'}</small>`);
    expect(fsrs).not.toContain('\u00a0');
    expect(fsrs).not.toContain('{revealed && <p className="review-score-guide');
  });
  it('자리 맡기는 visibility:hidden(높이 유지) — display:none이면 다시 자란다', () => {
    const room = file('src/components/web/review-room.css');
    expect(room).toContain('.review-grade-guide--reserve { visibility:hidden; }');
    expect(room).not.toMatch(/\.review-grade-guide--reserve\s*\{[^}]*display:\s*none/);
  });
});
