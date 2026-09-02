import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');

/**
 * 계약: 지정 이펙트(문장 막대 #1002 · 인앱 범위 지정 공용)는 불투명 등가색(--picked-bg)만
 * 칠한다. 반투명(rgba)을 이중 도색하면 인접 토큰·줄에서 겹치는 부분만 짙어진다
 * (오너 보고 실측 — 2026-08-15). 불투명색은 몇 겹을 칠해도 같은 색이다.
 * 글자 밴드 전환(오너 확정 2026-08-29) 후 페인트 지점은 .surface::before(밴드)와
 * ::after(자간 이음매)로 옮겨졌지만 두 원칙 — 불투명 등가색·이웃 글리프 불가침 — 은
 * 그대로 승계된다(이음매는 z:-2로 밴드 밑에 깔려 글리프를 덮는 것이 구조적으로 불가능).
 */
describe('지정 이펙트 불투명 등가색 (index.css)', () => {
  const block = css.match(/\.word-token--picked \.surface::before \{[^}]*\}/)?.[0] || '';

  it('picked 밴드는 --picked-bg로 칠한다(--primary-glow 직접 도색 금지, 폴백만 허용)', () => {
    expect(block).toContain('var(--picked-bg');
    // 폴백 표기(var(--picked-bg, var(--primary-glow)))를 걷어낸 뒤엔 rgba 계열 참조가 없어야 한다
    const withoutFallback = block.replace(/var\(--picked-bg, var\(--primary-glow\)\)/g, '');
    expect(withoutFallback).not.toContain('--primary-glow');
    expect(withoutFallback).not.toMatch(/rgba\(/);
  });

  it('reader 테마별 --picked-bg가 불투명 color-mix로 정의된다', () => {
    expect(css).toMatch(/\.reader-area--light \{ --picked-bg: color-mix\(in srgb, var\(--primary\)/);
    expect(css).toMatch(/\.reader-area--dark\s+\{ --picked-bg: color-mix\(in srgb, var\(--primary\)/);
  });

  // 구 box-shadow 확장(상하 2px·자간 이음)은 밴드·이음매로 대체 — 부활 금지.
  it('picked에 box-shadow 도색이 없다(밴드·이음매가 유일한 페인트 지점)', () => {
    expect(block).not.toContain('box-shadow');
    expect(css).not.toMatch(/\.word-token--picked \.surface \{/); // surface 직접 도색 규칙 소멸
    expect(css).not.toMatch(/\.word-token--picked \+ \.word-token--picked \.surface \{/);
  });

  it('자간 이음매는 연속 지정에서만, 밴드 밑(z:-2)에서 자간 폭으로만 잇는다', () => {
    const adj = css.match(/\.word-token--picked:has\(\+ \.word-token--picked\) \.surface::after \{[^}]*\}/)?.[0] || '';
    expect(adj).toContain('z-index: -2'); // 밴드(z:-1)보다 아래 — 이웃 글리프·밴드를 덮을 수 없다
    // 상자 [W-1px, W+gap+1px]: 칠의 확장이 0(안 A)이라 조각이 스스로 양끝 1px씩 밴드 밑으로
    // 물린다 — 실금 0. 노출부(기본 자간 4px)는 중립 이음매
    expect(adj).toContain('right: calc(-1 * var(--char-gap, 0.25rem) - 1px);');
    expect(adj).toContain('width: calc(var(--char-gap, 0.25rem) + 2px);');
    expect(adj).toContain('var(--picked-bg'); // 이음매도 불투명 등가색
  });
});
