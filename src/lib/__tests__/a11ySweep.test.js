// 비시각 접근성 점검(A11Y-SWEEP-001, 2026-10-17 KST) — 화면 모양은 그대로, 화면 낭독 · 키보드 동작만.
// ① 결과 알림 영역은 늘 그려 두고 내용만 넣는다(내용과 함께 생기는 role=status는 화면 낭독기가 놓칠 수 있다 — 1eaed980 선례).
// ② 글자 없는 아이콘 버튼에는 이름이 있다. ③ 가벼운 팝업(div role=dialog)은 열면 안으로 · Esc · 닫으면 연 자리로.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const full = path.join(dir, d.name);
  if (d.isDirectory()) return d.name === '__tests__' || d.name === 'node_modules' ? [] : walk(full);
  return /\.jsx$/.test(d.name) ? [full] : [];
});

describe('① 결과 알림 영역 — 늘 있고 내용만 바뀐다 · 보이는 줄은 한 번만 읽힌다', () => {
  it('문맥 담기 결과(SaveContextButton)', () => {
    const src = read('src/components/learning/SaveContextButton.jsx');
    expect(src).toContain('<span className="sr-only" role="status">{message}</span>');
    expect(src).toContain('{message && <p className="learning-context-save__message" aria-hidden="true">{message}</p>}');
    expect(src).not.toMatch(/message && <p role="status"/);
  });
  it('뷰어 읽기 위치 저장 실패 — 「다시 저장」이 이유를 가리킨다', () => {
    const src = read('src/views/ViewerPage.jsx');
    expect(src).toContain('<span className="sr-only" role="status" id="viewer-position-notice">{positionError ? vt("읽기 위치를 저장하지 못했어요.") : \'\'}</span>');
    const banner = sliceBetween(src, '{positionError && <div className="error-banner">', '</div>}');
    expect(banner).not.toContain('role="status"');
    expect(banner).toContain('<span aria-hidden="true">{vt("읽기 위치를 저장하지 못했어요.")}</span>');
    expect(banner).toContain('aria-describedby="viewer-position-notice"');
  });
  it('교재 참고 자료 검색 결과 수(BookReader)', () => {
    const src = read('src/components/books/BookReader.jsx');
    expect(src).toMatch(/<span className="sr-only" role="status">\{unit === 'reference' && query\.trim\(\) \? \(searchCount \?/);
    expect(src).toMatch(/\{unit === 'reference' && query\.trim\(\) && <p className="manabi-status" aria-hidden="true">/);
    expect(src).not.toMatch(/query\.trim\(\) && <p className="manabi-status" role="status"/);
  });
});

describe('①b 결과 알림 영역 2차 — 서재 · 노트 · 뷰어 더 알아보기', () => {
  it('서재 정리 결과 · 미확인(LibraryShelf) — 영역 하나에 두 줄, 다시 시도 · 실패 다시 선택 · 되돌리기가 가리킨다', () => {
    const src = read('src/components/library/LibraryShelf.jsx');
    expect(src).toContain('<span className="sr-only" role="status" id="shelf-organize-notice">{[pendingLine,resultLine].filter(Boolean).join(\' \')}</span>');
    expect(src).toContain('{pendingLine&&<div className="shelf-notice"><span aria-hidden="true">{pendingLine} </span><button aria-describedby="shelf-organize-notice"');
    expect(src).toContain('{result&&<div className="shelf-notice"><span aria-hidden="true">{resultLine}</span>');
    expect((src.match(/aria-describedby="shelf-organize-notice"/g) || []).length).toBe(3);
    expect(src).not.toMatch(/className="shelf-notice" role="status"/);
  });
  it('폴더 변경 「저장됨」(LibraryCollections)', () => {
    const src = read('src/components/library/LibraryCollections.jsx');
    expect(src).toContain('<span className="sr-only" role="status" id="collections-undo-notice">{undo?\'저장됨\':\'\'}</span>');
    expect(src).toContain('{undo&&<div className="shelf-notice"><span aria-hidden="true">저장됨 </span><button aria-describedby="collections-undo-notice"');
  });
  it('노트 표현 담기 — 줄마다 · 바닥 줄(NoteVocabulary)', () => {
    const src = read('src/components/notes/NoteVocabulary.jsx');
    expect(src).toContain("<span className=\"sr-only\" role=\"status\" id={`note-outcome-${row.id}`}>{outcome?.error||(outcome?.ok?outcome.text:'')}</span>");
    expect(src).toContain('<div className="note-row-error"><p aria-hidden="true">{outcome.error}</p>');
    expect(src).toContain('aria-describedby={`note-outcome-${row.id}`}');
    expect(src).toContain('{outcome?.ok&&<p className="note-saved" aria-hidden="true">{outcome.text}</p>}');
    expect(src).toContain('<footer><span className="sr-only" role="status">{notice||message||\'\'}</span>{(notice||message)&&<p className="note-review-notice" aria-hidden="true">{notice||message}</p>}');
  });
  it('뷰어 비슷한 말 실패 — 영역은 조건 밖, 「✦ 비슷한 말 찾기」가 가리킨다', () => {
    const src = read('src/views/ViewerPage.jsx');
    const live = '<span className="sr-only" role="status" id="viewer-synant-notice">{synAntEligible(selectedToken,materialLang) && !synAnt?.loading && synAnt?.error ? vt("불러오지 못했어요.") : \'\'}</span>';
    expect(src).toContain(live);
    expect(sliceBetween(src, live, '{wordDetail?.loading')).toContain('{synAnt?.error && <p className="syn-ant__error" aria-hidden="true">{vt("불러오지 못했어요.")}</p>}<button type="button" className="btn btn--ghost btn--sm reader-card-learn__ask" aria-describedby="viewer-synant-notice"');
  });
  it('일본어로는 대응어 실패(ViewerJapaneseMore) — 찾는 중 · 결과 두 갈래의 같은 자리에 같은 영역', () => {
    const src = read('src/components/viewer/ViewerJapaneseMore.jsx');
    expect(src).toContain("const notice=<span className=\"sr-only\" role=\"status\" id={noticeId}>{!query.isFetching&&query.isError?vt('대응어를 불러오지 못했어요.'):''}</span>;");
    expect(src).toContain("if(query.isFetching)return <>{warnLine}{notice}<p aria-busy=\"true\">"); // 찾는 중 = 칸 안 짧은 대기(LOADING-ANNOUNCE-001 ①)
    expect(src).toMatch(/return <>\s*\{warnLine\}\s*\{notice\}\s*\{query\.isError&&<p className="reader-card-learn__ja-error" aria-hidden="true">/);
    expect(src).toContain('aria-describedby={noticeId}');
  });
});

describe('② 글자 없는 아이콘 버튼에는 이름이 있다', () => {
  it('✕ · × 만 든 버튼은 aria-label이 있다(화면 코드 전체)', () => {
    const offenders = [];
    for (const file of walk(path.join(ROOT, 'src'))) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/<button\b([^>]*)>\s*(?:<span aria-hidden="true">)?\s*[×✕✖]\s*(?:<\/span>)?\s*<\/button>/g)) {
        if (!/aria-label(ledby)?=/.test(m[1])) offenders.push(`${path.relative(ROOT, file)}: ${m[0].slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
  it('읽기 확인 닫기(✕)', () => {
    expect(read('src/components/ReadingTest.jsx')).toContain('<button type="button" aria-label="닫기" onClick={onClose}');
  });
});

describe('③ 가벼운 팝업 — 열면 안으로 · Esc로 닫기 · 닫으면 연 자리로(useDialogReturn)', () => {
  const hook = read('src/lib/useDialogReturn.js');
  it('훅: Esc · 첫 조작 요소로 포커스 · 연 요소가 살아 있고 포커스가 body일 때만 돌려준다 · onClose는 ref', () => {
    expect(hook).toContain("if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); close.current?.(); }");
    expect(hook).toContain("document.addEventListener('keydown', onKey);");
    expect(hook).toContain("document.removeEventListener('keydown', onKey);");
    expect(hook).toContain('if (opener?.isConnected && document.activeElement === document.body) opener.focus({ preventScroll: true });');
    expect(hook).toContain('(first || box).focus({ preventScroll: true });');
    expect(hook).toMatch(/useEffect\(\(\) => \{[\s\S]*\}, \[\]\);/);
  });
  it('현황 타일 창(TileModal) · 문형 카드(PatternCard)가 훅을 쓰고 aria-modal을 단다', () => {
    const tile = sliceBetween(read('src/views/ProfileStats.jsx'), 'function TileModal(', '\n}\n');
    expect(tile).toContain('const dialogRef = useDialogReturn(onClose);');
    expect(tile).toContain('role="dialog" aria-modal="true" aria-label={title} ref={dialogRef} tabIndex={-1}');
    const card = sliceBetween(read('src/views/ReadingTextView.jsx'), 'function PatternCardDialog(', '\n}\n');
    expect(card).toContain('const dialogRef = useDialogReturn(onClose);');
    expect(card).toMatch(/ref=\{dialogRef\}\s+tabIndex=\{-1\}\s+role="dialog"\s+aria-modal="true"/);
  });
});

describe('④ axe 스캔(Preview b5d2fc7, 2026-10-17 KST) — 제목 단계', () => {
  it('뷰어 토론 칸 제목은 본문 h1 바로 아래 단계(h2) — h3로 건너뛰지 않는다', () => {
    const src = read('src/views/ViewerComments.jsx');
    expect(src).toMatch(/<h2 style=\{\{ fontSize: '1rem', fontWeight: 700, marginBottom: '20px', color: 'var\(--text-primary\)' \}\}>\s*토론 /);
    expect(src).not.toMatch(/<h3\b/);
  });
});

// ⑤ 상시 알림 영역(.sr-only · .skeleton-sr role=status)이 보이는 줄과 같은 글을 가지면 e2e의 getByText가 둘을 잡는다(strict 위반 —
// cda41f93 실측). 그래서 보이는 사본은 aria-hidden이고, 알림 영역이 들어 있지 않은 **이름 있는 칸**(클래스) 안에 있어야 한다 —
// e2e는 그 클래스로 범위를 좁힌다(예: locator('.shelf-notice').getByText(…)). 새 상시 영역은 아래 목록에 칸을 함께 등록한다.
describe('⑤ 상시 알림 영역의 보이는 사본 — aria-hidden + 이름 있는 칸(e2e 범위)', () => {
  const REGISTRY = [
    // [파일, 상시 영역 표지, 보이는 사본(칸 클래스 + aria-hidden) — null = 보이는 사본 없음]
    ['src/components/Skeleton.jsx', '<span className="skeleton-sr" role="status">{line}</span>', null],
    ['src/components/library/LibraryCollections.jsx', 'id="collections-undo-notice"', '<div className="shelf-notice"><span aria-hidden="true">저장됨 </span>'],
    ['src/components/library/LibraryShelf.jsx', 'id="shelf-organize-notice"', '<div className="shelf-notice"><span aria-hidden="true">{pendingLine} </span>'],
    ['src/components/library/LibraryShelf.jsx', 'id="shelf-organize-notice"', '<div className="shelf-notice"><span aria-hidden="true">{resultLine}</span>'],
    ['src/components/notes/NoteVocabulary.jsx', 'id={`note-outcome-${row.id}`}', '<div className="note-row-error"><p aria-hidden="true">{outcome.error}</p>'],
    ['src/components/notes/NoteVocabulary.jsx', 'id={`note-outcome-${row.id}`}', '<p className="note-saved" aria-hidden="true">{outcome.text}</p>'],
    ['src/components/notes/NoteVocabulary.jsx', '<footer><span className="sr-only" role="status">', '<p className="note-review-notice" aria-hidden="true">{notice||message}</p>'],
    ['src/components/viewer/ViewerJapaneseMore.jsx', 'id={noticeId}', '<p className="reader-card-learn__ja-error" aria-hidden="true">'],
    ['src/components/learn/GoalTrackTile.jsx', 'id={noticeId}', '<span aria-hidden="true"><span className="learn-goal__line">{GOAL_PROGRESS_FAILED}</span></span>'],
    ['src/components/learning/SaveContextButton.jsx', '<span className="sr-only" role="status">{message}</span>', '<p className="learning-context-save__message" aria-hidden="true">{message}</p>'],
    ['src/components/books/BookReader.jsx', "<span className=\"sr-only\" role=\"status\">{unit === 'reference'", '<p className="manabi-status" aria-hidden="true">'],
    ['src/views/ViewerPage.jsx', 'id="viewer-synant-notice"', '<p className="syn-ant__error" aria-hidden="true">'],
    ['src/views/ViewerPage.jsx', 'id="viewer-position-notice"', '<div className="error-banner"><span aria-hidden="true">'],
    // 긴 작업 진행(LOADING-ANNOUNCE-001 ③ — loadingAnnounce.test.js)
    ['src/views/ViewerPage.jsx', '<span className="sr-only" role="status">{wordDetail?.loading', '<p className="reader-card-learn__pending" aria-hidden="true">'],
    ['src/views/ViewerPage.jsx', '<span className="sr-only" role="status">{isAnalyzing', '<span className="analyzing-banner__line" aria-hidden="true">{vt(analyzingLine)}</span>'],
    ['src/views/ViewerPage.jsx', '<span className="sr-only" role="status">{isAnalyzing', '<span className="analyzing-banner__line" aria-hidden="true">{recoveryLine('],
    // 듣기 따라가기 멈춤(목업 listen-resume) — 보이는 칩 글은 「지금 문장으로」라 같은 글의 사본이 없다
    ['src/views/ViewerPage.jsx', '<span className="sr-only" role="status">{listenFollowable && listenStopped', null],
    ['src/components/admin/BulkAnalysisPanel.jsx', '<span className="sr-only" role="status">{running ?', '<span className="bulk-analysis__progress" aria-hidden="true">'],
    ['src/components/LiteraturePublishPanel.jsx', '<span className="sr-only" role="status">{batch ?', '<span className="literature-batch__progress" aria-hidden="true">'],
    // 사용자 화면의 긴 작업(LOADING-ANNOUNCE-002) — 필기 인식은 버튼 글자가 보이는 쪽이라 숨긴 사본이 없다
    ['src/views/StudySessionPage.jsx', "<span className=\"sr-only\" role=\"status\">{phase === 'feedback' && produceState?.status === 'grading'", '<p className="study-produce__pending" aria-hidden="true"'],
    ['src/views/StudySessionPage.jsx', "<span className=\"sr-only\" role=\"status\">{phase === 'feedback' && produceState?.status === 'grading'", '<p className="study-produce__error" aria-hidden="true"'],
    // /study 오프라인 한 줄(STUDY-OFFLINE-LINE — studyUnavailable.test.jsx)
    ['src/views/StudySessionPage.jsx', "<span className=\"sr-only\" role=\"status\">{offline ? STUDY_OFFLINE_LINE : ''}</span>", '<p className="study-offline-line" aria-hidden="true">{STUDY_OFFLINE_LINE}</p>'],
    // 연습 화면의 긴 작업(QUICK-FOCUS-001 · WRITING-FOCUS-001 — practiceFocus.test.js) — 보이는 사본은 단추 글자라 따로 없다
    ['src/views/QuickPage.jsx', "<span className=\"sr-only\" role=\"status\">{analyzing ?", null],
    ['src/views/WritingStudioPage.jsx', "<span className=\"sr-only\" role=\"status\">{loading ?", null],
    ['src/components/notes/NoteRecognition.jsx', "<span className=\"sr-only\" role=\"status\">{busy?'선택한 필기를 읽는 중…'", null],
    ['src/components/classroom/BoardInkRecognition.jsx', "<span className=\"sr-only\" role=\"status\">{busy?'선택한 필기를 읽는 중…'", null],
  ];
  it('화면 코드의 상시 알림 영역은 모두 목록에 있다(새 영역은 칸과 함께 등록)', () => {
    const found = [];
    for (const file of walk(path.join(ROOT, 'src'))) {
      const src = fs.readFileSync(file, 'utf8');
      const n = (src.match(/className="(?:sr-only|skeleton-sr)" role="status"/g) || []).length;
      if (n) found.push([path.relative(ROOT, file), n]);
    }
    const expected = {};
    for (const [file, marker] of REGISTRY) expected[file] = new Set([...(expected[file] || []), marker]);
    expect(Object.fromEntries(found.sort())).toEqual(Object.fromEntries(Object.entries(expected).map(([f, set]) => [f, set.size]).sort()));
  });
  it('등록된 보이는 사본은 aria-hidden이고 이름 있는 칸(클래스) 안에 있으며, 그 칸에는 상시 영역이 없다', () => {
    for (const [file, marker, visible] of REGISTRY) {
      const src = read(file);
      expect(src, file).toContain(marker);
      if (visible === null) continue;
      expect(src, file).toContain(visible);
      expect(visible).toMatch(/aria-hidden="true"/);
      expect(visible).toMatch(/className="[a-z][\w-]*"/);
      expect(visible).not.toMatch(/sr-only|skeleton-sr|role="status"/);
    }
  });
});

describe('⑥ 채점 버튼 이름 — 라벨과 간격 보조 글이 붙어 읽히지 않는다(GRADE-NAME-001)', () => {
  // 「다시」 뒤에 <small>10분</small> · <span class="save-grade__sub">오늘 또</span>이 바로 붙으면 JSX가 줄바꿈 공백을 지워
  // 화면 읽기 이름이 「다시10분」이 된다(CSS 세로 flex를 셈하지 않는 환경 — 스타일 없이 실측). 보조 글 안 첫머리에 {' '}를 둔다 —
  // 보조 글은 버튼(세로 flex)의 따로 선 줄이라 줄 첫머리 공백은 그려지지 않는다(1440 · 390 화면 픽셀 같음 실측).
  // 버튼 안 · 보조 글 밖에 두면 공백만 든 flex 항목이 생겨 gap 3px만큼 버튼이 커진다(실측) — 그래서 안쪽이다.
  // aria-label로 덮어쓰지 않는다(보이는 글과 어긋남).
  const SUB = /<small>|<span className="save-grade__sub">/g;
  const buttons = walk(path.join(ROOT, 'src')).filter((f) => !f.includes('__tests__')).flatMap((file) => {
    const src = fs.readFileSync(file, 'utf8');
    return [...src.matchAll(/<button\b[\s\S]*?<\/button>/g)].map((m) => m[0])
      .filter((b) => b.includes('review-score-btn')).map((button) => ({ file: path.relative(ROOT, file), button }));
  });
  const withSub = buttons.filter(({ button }) => { SUB.lastIndex = 0; return SUB.test(button); });

  it('간격 보조 글이 있는 채점 버튼을 실제로 찾는다(FSRS 복습 · 뷰어 단어 카드 4등급)', () => {
    expect([...new Set(withSub.map((b) => b.file))].sort()).toEqual(['src/components/vocab/FsrsReviewSession.jsx', 'src/views/ViewerPage.jsx']);
  });

  it('보조 글은 띄어쓰기 글({\' \'})로 시작한다', () => {
    for (const { file, button } of withSub) {
      for (const m of button.matchAll(SUB)) expect(button.slice(m.index + m[0].length), file).toMatch(/^\{' '\}/);
    }
  });

  it('채점 버튼에 aria-label을 덮어쓰지 않는다 — 이름은 보이는 글에서', () => {
    expect(buttons.length).toBeGreaterThanOrEqual(6);
    for (const { file, button } of buttons) expect(button, file).not.toMatch(/aria-label=/);
  });
});

describe('⑦ 책 안 이동 뒤 초점 — 누른 링크가 사라지면 새 쪽 제목으로(KBD-WALK-001)', () => {
  // 키보드 둘러보기(Preview 8d2b681, 2026-10-17 KST): 목차 → 01과 · 「02과로 →」 · 「← 책 목차」 뒤 activeElement = body(1440 · 390 모두).
  // 책 안 이동은 pathname이 같아 전역 되찾기(Layout → routeFocus)가 건너뛴다 — BookReader가 같은 정본(focusPageIfLost)을 쓴다.
  const src = read('src/components/books/BookReader.jsx');
  const effect = sliceBetween(src, "if (target?.classList.contains('kanji-card'))", 'pendingAnchor.current = null; pendingPosition.current = null;');
  const go = sliceBetween(src, 'const go = useCallback((id, originAnchor) => {', '}, [book.edition');
  const sync = sliceBetween(src, 'const sync = (restorePosition, href = window.location.href) => {', "window.addEventListener('hashchange', hash);");

  it('routeFocus 정본을 쓴다(새 판정 함수를 만들지 않는다)', () => {
    expect(src).toContain("import { focusIsLost, focusPageIfLost } from '@/lib/routeFocus';");
  });

  it('앱 안 이동 · 해시 바뀜 · 뒤로/앞으로는 표시를 켜고, 첫 진입(sync(true) 한 번 · bfcache 복귀)은 켜지 않는다', () => {
    expect(go).toContain('focusAfterMove.current = true;');
    // 이동 주소는 이벤트에서 받는다(BOOK-HASH-RACE-001 — bookHashEntry.test.js).
    expect(sync).toContain('const pop = () => { traversedHref = window.location.href; focusAfterMove.current = true; sync(true, traversedHref); };');
    expect(sync).toContain('traversedHref = null; focusAfterMove.current = true; sync(false, href);');
    expect(sliceBetween(src, 'const sync = (restorePosition, href = window.location.href) => {', 'let traversedHref;')).not.toContain('focusAfterMove.current = true');
    expect(src).toContain("const acquire = event => { window.history.scrollRestoration = 'manual'; if (event.persisted) sync(true); };");
  });

  it('쪽 맞춤이 끝난 뒤 한 번만, 초점을 잃었을 때만 옮긴다(한자 카드 초점 다음)', () => {
    expect(effect).toContain('if (focusAfterMove.current) {\n        focusAfterMove.current = false;');
    expect(effect).toContain('focusPageIfLost(document);');
    expect(effect.indexOf('focusPageIfLost')).toBeGreaterThan(effect.indexOf("target.focus({ preventScroll: true })"));
  });
});

describe('⑧ 숨은 초점 · 고정 머리줄에 가린 초점(실브라우저 확인 integrate-queue c5ba857, 2026-10-17 KST)', () => {
  it('책: 누른 링크가 접혀 숨었으면(모바일 「이 과의 목차」) 잃은 것으로 보고 풀어 새 쪽 제목으로 — 보이는 초점은 그대로', () => {
    const src = read('src/components/books/BookReader.jsx');
    const effect = sliceBetween(src, 'if (focusAfterMove.current) {', 'pendingAnchor.current = null; pendingPosition.current = null;');
    expect(effect).toContain('if (!focusIsLost(document) && active?.getClientRects?.().length === 0) active.blur();');
    expect(effect.indexOf('active.blur()')).toBeLessThan(effect.indexOf('focusPageIfLost(document);'));
    expect(src).toContain("onClick={event => event.currentTarget.closest('details').removeAttribute('open')}"); // 접히는 쪽은 그대로
  });

  it('「오늘의 소식」 제목은 #today-news로 내려올 때 고정 머리줄 아래에 선다(scroll-margin-top, 수준표 선례와 같은 식)', () => {
    const block = sliceBetween(read('src/index.css'), '.suggestions-section__title {', '}');
    expect(block).toContain('scroll-margin-top: calc(var(--gnb-height, 78px) + 12px);');
  });
});
