import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

/**
 * 계약: 뷰어 정돈 A안 「끝은 끝에」 (#1077 5547935464, 오너 「A안」 2026-09-05).
 *
 * 실측(브라우저 좌표, 390px, GNB 포함): 첫 글자가 화면 35~63% 지점에서 나왔다 — 본문 위에 뒤로가기 줄·
 * 시리즈 내비 줄·배지·액션바(두 줄 89px)·책 내비 바(50px)·PDF 출처 카드(148px)가 쌓여 있었다.
 * 끝의 행동(읽기 완료 = 퀴즈·완독 화면을 여는 버튼, 오늘 학습)은 본문 **위**에, 다음 편·리딩 테스트·회화는
 * **아래**에 갈려 있었다. 여기서는 배치 계약만 심는다 — 모양은 v2-Q(viewerChrome)·v2-R이 지킨다.
 * 기하는 e2e/viewer-chrome.e2e.mjs가 브라우저 좌표로 지킨다(크롬 기하는 소스 계약으로 못 잡는다 — v2-Q 교훈).
 */
const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const VIEWER = 'src/views/ViewerPage.jsx';

const src = () => read(VIEWER);
/** 본문 위 크롬 전부 — 헤더 시작부터 리더 카드 직전까지. */
const above = () => stripComments(sliceBetween(src(), '<header className="page-header viewer-header">', 'className={`card reader-area'));
/** 본문 아래 — 리더 카드 끝(문장 이동 필 뒤)부터 댓글까지. */
const below = () => stripComments(sliceBetween(src(), '<TokenRangeGrips', '<aside className="viewer-side viewer-side--right">'));
const aCss = () => stripComments(sliceBetween(read('src/index.css'), '/* ========= 뷰어 정돈 A안', '/* ========= /뷰어 정돈 A안 ========= */'));

describe('① 본문 위에는 경로·제목·도구만 — 끝의 행동 0', () => {
  it('읽기 완료·오늘 학습·다음 범위 분석이 본문 위에 없다', () => {
    const a = above();
    for (const s of ['markCompleteMutation.mutate', '읽기 완료', '오늘 학습 만들기', 'nextRangeMutation.mutate', '리딩 테스트', '회화 연습']) {
      expect(a, `${s}이 본문 위로 되돌아왔다`).not.toContain(s);
    }
    // 예전 자리들 — 액션바·책 내비 바·PDF 카드가 되살아나지 않는다
    for (const cls of ['className="viewer-actionbar"', 'className="book-nav"', 'u-highlight-card']) {
      expect(src()).not.toContain(cls);
    }
  });

  it('경로 줄 하나에 [← 자료실 · 형제 내비] 왼쪽, [도구] 오른쪽 — 도구는 듣기·Aa(+분석 중단)', () => {
    const bar = sliceBetween(src(), '<div className="viewer-topbar">', '{titleEditing && user?.id === material?.owner_id');
    const order = ['className="viewer-back-link"', '<div className="viewer-series-nav"', 'className="viewer-topbar__tools"', '<ListenControls', 'className="viewer-aa"']
      .map((s) => { const i = bar.indexOf(s); expect(i, `${s} 없음`).toBeGreaterThan(-1); return i; });
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    // 경로 줄은 헤더 **안** 첫 자식 — 제목보다 앞
    const header = sliceBetween(src(), '<header className="page-header viewer-header">', '</header>');
    expect(header.indexOf('viewer-topbar')).toBeLessThan(header.indexOf('viewer-titlerow'));
  });

  it('PDF 출처는 유튜브 출처와 같은 한 줄(.viewer-attribution) — 원본 링크는 순수 함수 주소 그대로', () => {
    const a = above();
    const pdf = sliceBetween(a, '{sourcePdf && material.page_start && (', '</p>');
    expect(pdf).toContain('className="viewer-attribution"');
    expect(pdf).toContain('pdfViewerHref(sourcePdf.id, material.page_start)');
    expect(pdf).toContain('원본 PDF 보기');
    expect(pdf, '다음 범위 버튼은 본문 아래 다음 카드로 갔다').not.toContain('nextRangeMutation');
    expect(src()).not.toContain('pdf-origin__back');
  });
});

describe('② 끝의 행동은 본문 아래 「다 읽었다면」 한 줄 + 다음 카드 하나', () => {
  it('읽기 완료 → 오늘 학습 → 리딩 테스트 → 회화 순서로 같은 옷', () => {
    const row = sliceBetween(below(), '<div className="post-reading-actions">', '{(isDone || isPending) && (() => {');
    const order = ['markCompleteMutation.mutate()', '오늘 학습 만들기', '리딩 테스트', '회화 연습']
      .map((s) => { const i = row.indexOf(s); expect(i, `${s} 없음`).toBeGreaterThan(-1); return i; });
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect((row.match(/className="post-reading-actions__btn/g) || []).length).toBe(5); // 완료 2상태 + 셋
    // 이벤트·퀴즈·핸드오프는 자리만 옮겼다 — 오늘 학습 핸드오프 키·읽기 완료 mutation 그대로
    expect(row).toContain('localStorage.setItem(`study_source_${materialLang}`');
    expect(row).toContain('/study?source=mine&lang=');
    expect(src()).toContain('const markCompleteMutation = useReadingCompletion({');
  });

  it('「다 읽었다면」 줄은 라벨이 있고, 분석 중인 자료엔 없다', () => {
    const b = below();
    expect(b).toContain('<div className="post-reading__label">다 읽었다면</div>');
    expect(b).toContain('{(isDone || isPending) && !showReadingTest && !showConversation && (');
  });

  it('다음 카드는 한 자리에 하나 — 시리즈 다음 편 → 책 다음 과 → 다음 과 적기 → PDF 다음 범위 → 완주', () => {
    const next = sliceBetween(below(), '{(isDone || isPending) && (() => {', "{material?.visibility !== 'private' && (");
    const order = [
      'if (nextLesson) {',
      'if (bookNav?.next) {',
      'if (bookNav?.canAppend) {',
      'if (sourcePdf && material.page_end && material.page_end < sourcePdf.page_count) {',
      'if (isDone && seriesEndCard) {',
    ].map((s) => { const i = next.indexOf(s); expect(i, `${s} 없음`).toBeGreaterThan(-1); return i; });
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    // 이어 적기 딥링크(bookAppend 계약)·PDF 다음 범위 mutation이 카드 안에 산다
    expect(next).toContain('href={`/materials/add?book=${encodeURIComponent(bookNav.key)}`}');
    expect(next).toContain('nextRangeMutation.mutate({ chunkSize: 5 })');
    expect(next).toContain('className="next-lesson-card next-lesson-card--button"');
    // 카드 정의는 next-lesson-card 한 벌 — 별도 카드 신설 없음
    expect(src()).not.toContain('book-next-card');
  });
});

describe('③ 안내문은 첫 자료에만, 데스크톱은 빈 패널이 대신한다', () => {
  it('reader-hint는 단어를 아직 안 담은 로그인 사용자에게만', () => {
    expect(src()).toContain('{isDone && user && savedCount === 0 && (');
    expect((src().match(/className="reader-hint"/g) || []).length).toBe(1);
    // 게스트 배너가 같은 말을 하니 게스트에겐 두 번 말하지 않는다
    expect(src()).toContain('단어를 클릭해 뜻을 확인할 수 있어요.');
  });

  it('CSS: 기본 감춤 + 좌우 패널이 접히는 블록에서만 켬 — 새 뷰포트 쿼리 0', () => {
    const css = read('src/index.css');
    expect(sliceBetween(css, '\n.reader-hint {', '}')).toContain('display: none;');
    expect(css).toContain('  .reader-hint { display: block; }');
    expect(aCss(), '새 브레이크포인트 금지 — 접힘은 flex-wrap이 한다').not.toContain('@media');
  });
});

describe('④ 비공개 자료에는 토론이 없다 — 카드도 조회도', () => {
  it('렌더 게이트 + 조회 게이트', () => {
    expect(src()).toContain("{material?.visibility !== 'private' && (\n        <ViewerComments");
    expect(src()).toContain("enabled: !!material && material.visibility !== 'private',");
    const hook = read('src/lib/useMaterialComments.js');
    expect(hook).toContain('enabled = true }');
    expect(hook).toContain('enabled: !!materialId && enabled,');
  });
});

describe('⑤ CSS — 토큰만 · 본문 무접촉 · 44px', () => {
  it('A안 블록은 색 리터럴 0, 리더 셀렉터 0, 끝의 행동 버튼 44px', () => {
    const c = aCss();
    expect(c).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    for (const sel of ['reader-area', 'word-token', '.surface', 'rt-an', 'furi-off']) expect(c).not.toContain(sel);
    expect(sliceBetween(c, '.post-reading .post-reading-actions__btn {', '}')).toContain('min-height: 44px;');
    expect(c).toContain('.viewer-topbar__tools .listen-controls { margin: 0; }');
    // 옛 규칙은 죽은 CSS로 남기지 않는다
    const css = read('src/index.css');
    for (const dead of ['.viewer-actionbar {', '.book-nav {', '.pdf-origin__back {', '.grammar-btn--complete {', '.viewer-complete-badge {']) {
      expect(css, `${dead} 죽은 규칙`).not.toContain(dead);
    }
  });
});
