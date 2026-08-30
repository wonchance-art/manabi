import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 배선 계약: 이합사 시각 연동 R4b (오너 확정 2026-08-30 — "각괘선도 높이 낮춰서 ㄱㄱ").
// zh에서 이합사 조각(base_form 2자 ≠ 표면)을 탭하면 ⑴ 같은 줄 파트너 글자에 옅은 띠
// ⑵ 조각 상단→파트너 상단 각괘선(높이 7px)이 한 번만 그려진다. 카드 문구는 A안(현행) 유지.
// 시연 승인 아티팩트: 이합사 카드 시연(bracket-7px-final).

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const css = read('src/index.css');

describe('연동 띠(CSS)', () => {
  it('옅은 띠는 picked-bg 파생 변수 — 테마를 그대로 탄다', () => {
    expect(css).toContain('--sep-linked-bg: color-mix(in srgb, var(--picked-bg) 45%, transparent);');
  });

  it(':where로 특이성 (0,1,1) — 상태색(saved/due/혼색)·지정이 항상 이긴다', () => {
    expect(css).toContain('.word-token:where(.word-token--sep-linked) .surface::before');
  });

  it('밴드 기하 불변 — 연동 규칙은 background만 만진다(0.58em 산식 비침범)', () => {
    const rule = css.match(/\.word-token:where\(\.word-token--sep-linked\) \.surface::before \{[\s\S]*?\}/)?.[0] || '';
    expect(rule).toContain('background: var(--sep-linked-bg);');
    expect(rule).not.toMatch(/top|height|left|right|transform/);
  });

  it('아치 오버레이 — 절대배치·포인터 무시·overflow 노출(잘림 방지)', () => {
    const rule = css.match(/\.sep-arc \{[\s\S]*?\}/)?.[0] || '';
    expect(rule).toContain('position: absolute;');
    expect(rule).toContain('pointer-events: none;');
    expect(rule).toContain('overflow: visible;');
  });
});

describe('뷰어 배선(ViewerPage)', () => {
  it('zh 전용 게이트 + 2자 기본형 게이트(fr 활용형 오발동 방지)', () => {
    expect(viewer).toMatch(/materialLang !== 'Chinese' \|\| !tok\?\.id \|\| !base \|\| base === tok\.text \|\| \[\.\.\.base\]\.length !== 2/);
  });

  it('파트너 탐색은 같은 줄(rawIdx 접두) + data-text 정확 일치 — 토큰이 표기를 싣는다', () => {
    expect(viewer).toContain('data-text={token.text}');
    expect(viewer).toMatch(/el\.dataset\.text === partner/);
    expect(viewer).toMatch(/\^\(\?:id\|failed\)_\$\{m\[1\]\}_/);
  });

  it('각괘선 높이 7px 고정(오너 확정) + 잉크 상단은 밴드 계약 좌표(0.58em)', () => {
    expect(viewer).toContain('Math.min(a.y, b.y) - 7;');
    expect(viewer).toContain('0.58 * fs');
  });

  it('한 번만 그려진다 — 대시 드로우온 1회, reduced-motion이면 즉시 완성선', () => {
    expect(viewer).toContain("window.matchMedia('(prefers-reduced-motion: reduce)').matches");
    expect(viewer).toMatch(/strokeDashoffset = '0'/);
    expect(viewer).not.toMatch(/setInterval|animation-iteration-count/);
  });

  it('띠는 클래스 배선(파트너만), 아치는 reader-area 오버레이', () => {
    expect(viewer).toContain("sepLink?.partnerIds.includes(tokenId) ? ' word-token--sep-linked' : ''");
    expect(viewer).toContain('<svg ref={sepArcRef} className="sep-arc" aria-hidden="true" />');
  });
});
