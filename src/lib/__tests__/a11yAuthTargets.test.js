import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 계약: 로그인 화면 글자 조작의 누르는 범위 · 뷰어 카드 칸 제목 단계(A11Y-AUTH-001 디자인 넘김, 오케스트레이터 「바로 진행」 2026-11-08 KST).
 * 둘 다 보이는 화면은 그대로다(실제 빌드 화면 벽 이미지 해시 동일 — PR 기록). 실제 범위 · 이웃 침범은 e2e/touch-targets-auth.e2e.mjs가 잰다.
 */
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
// 선택자 바로 뒤에 여는 괄호가 오는 규칙 한 덩이(띄어 쓴 꼴 · 붙여 쓴 꼴 둘 다). 없으면 sliceBetween이 throw한다.
const rule = (css, selector) => sliceBetween(css, css.includes(`${selector} {`) ? `${selector} {` : `${selector}{`, '}');
// 세로(또는 가로) 44px — 요소가 44보다 작을 때만 바깥으로 넓히고, 크면 그대로(min(0px, …)).
const GROW = 'min(0px, calc(50% - 22px))';
const squash = (s) => s.replace(/\s+/g, '');

describe('/study 글자 링크 — 보이는 글자 그대로, 누르는 범위 세로 44', () => {
  const css = read('src/index.css');
  it('.study-textlink가 기준 상자이고 ::before가 위아래로만 넓힌다', () => {
    expect(rule(css, '.study-textlink')).toMatch(/position:\s*relative/);
    const before = squash(rule(css, '.study-textlink::before'));
    expect(before).toContain("content:''");
    expect(before).toContain('position:absolute');
    expect(before).toContain('left:0;right:0');
    expect(before).toContain(`top:${squash(GROW)}`);
    expect(before).toContain(`bottom:${squash(GROW)}`);
  });
  it('세 링크가 모두 그 클래스다 — 「왜 이게 답이에요?」 · 「번역 보기」 · 「지난 이야기 다시 읽기」', () => {
    const page = read('src/views/StudySessionPage.jsx');
    // 각 글자 앞 400자 안에 그 클래스가 있다(JSX 쪽 — 주석의 같은 글자는 앞 단락이라 빼고 마지막 것을 본다).
    for (const label of ['왜 이게 답이에요?', "'번역 보기 ▾'", '지난 이야기 다시 읽기 →']) {
      const at = page.lastIndexOf(label);
      expect(at, label).toBeGreaterThan(400);
      expect(page.substring(at - 400, at), `${label} 앞의 study-textlink`).toContain('className="study-textlink"');
    }
  });
});

describe('서재 바닥 줄 — 좁은 링크(「복습」)도 누르는 범위 가로 44', () => {
  const css = read('src/components/library/library.css');
  it('.shelf-footer a가 기준 상자이고 ::before가 좌우로만 넓힌다', () => {
    expect(rule(css, '.shelf-footer a')).toMatch(/position:relative/);
    const before = squash(rule(css, '.shelf-footer a::before'));
    expect(before).toContain("content:''");
    expect(before).toContain('top:0;bottom:0');
    expect(before).toContain(`left:${squash(GROW)}`);
    expect(before).toContain(`right:${squash(GROW)}`);
  });
});

describe('뷰어 카드 칸 제목 — h1(자료 제목) 다음 단계 h2', () => {
  it('클래스로 모양을 정하는 칸 제목 셋이 h2다(사전 뜻 · 더 알아보기 · 교재 설명)', () => {
    const page = read('src/views/ViewerPage.jsx');
    expect(page).not.toMatch(/<h3 className="reader-card-section__label"/);
    expect(page.match(/<h2 className="reader-card-section__label"/g)).toHaveLength(3);
  });
  it('모양은 클래스가 정한다 — 태그가 바뀌어도 글자 크기 · 굵기 · 줄 높이 · 여백이 같다', () => {
    const label = squash(rule(read('src/components/viewer/reader-controls.css'), '.reader-card-section__label'));
    for (const decl of ['margin:006px', 'font-size:.75rem', 'font-weight:500', 'line-height:1.5', 'color:var(--reader-muted)']) expect(label).toContain(decl);
  });
});

describe('작은 글자 조작 누르는 범위 44 · 「신규」 배지 대비(A11Y-LAUNCH-001 ③ · ④ A안 — 오너 「권장대로」 2026-11-12 KST, 목업 https://claude.ai/artifact/MAyWiF5LjbMmJaUaRJbgeE)', () => {
  const css = read('src/index.css');
  it('칩 단추 · 오늘의 소식 카드 단추 · 뷰어 손님 띠 링크 · 댓글 로그인 단추 — 보이는 크기 그대로, ::before가 위아래로만 넓힌다', () => {
    const sel = 'button.chip, .suggestion-card__actions .btn--sm, .viewer-guest-banner__cta, .viewer-comments__signin';
    expect(squash(rule(css, sel))).toContain('position:relative');
    const before = squash(rule(css, 'button.chip::before, .suggestion-card__actions .btn--sm::before, .viewer-guest-banner__cta::before, .viewer-comments__signin::before'));
    for (const d of ["content:''", 'position:absolute', 'left:0;right:0', `top:${squash(GROW)}`, `bottom:${squash(GROW)}`]) expect(before).toContain(d);
    expect(read('src/views/ViewerComments.jsx')).toContain('className="btn btn--secondary btn--sm viewer-comments__signin"');
  });
  it('교재 「교재 안내」 펼침 — 같은 꼴', () => {
    const shell = squash(read('src/components/web/web-shell.css'));
    expect(shell).toContain('.book-scopesummary{position:relative}');
    expect(shell).toContain(`.book-scopesummary::before{content:'';position:absolute;left:0;right:0;top:${squash(GROW)};bottom:${squash(GROW)}}`);
  });
  it('⋯ 메뉴 항목 · 로그인 입력칸은 보이는 높이 44', () => {
    expect(squash(rule(css, '.mat-menu__item'))).toContain('min-height:44px');
    expect(squash(rule(css, '.auth-input'))).toContain('min-height:44px');
  });
  it('「신규」 배지 — 바탕은 셸 면 색(4.86:1), 글자는 그대로', () => {
    expect(css).toContain('.badge--stage-new { background: var(--bg-secondary); color: var(--text-muted); }');
  });
});
