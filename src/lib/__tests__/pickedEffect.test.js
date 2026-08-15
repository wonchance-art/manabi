import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');

/**
 * 계약: 지정 이펙트(문장 막대 #1002 · 인앱 범위 지정 공용)는 불투명 등가색(--picked-bg)만
 * 칠한다. 반투명(rgba)을 배경+이음 그림자로 이중 도색하면 인접 토큰·줄에서 겹치는 부분만
 * 짙어진다(오너 보고 실측 — 2026-08-15). 불투명색은 몇 겹을 칠해도 같은 색이다.
 */
describe('지정 이펙트 불투명 등가색 (index.css)', () => {
  const block = css.match(/\.word-token--picked \.surface \{[^}]*\}/)?.[0] || '';

  it('picked surface는 --picked-bg로 칠한다(--primary-glow 직접 도색 금지, 폴백만 허용)', () => {
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

  // 불투명색은 나중 형제가 앞 형제 글자를 가린다 — 확장은 이웃 글리프를 못 덮는 방향만.
  // 전방향 spread(0 0 0 Npx)가 부활하면 "다음 글자 이펙트가 앞 글자 가림"이 재발한다.
  it('기본 picked에 전방향 spread·수평 확장이 없다(상하 2px만)', () => {
    expect(block).not.toMatch(/0 0 0 \d/);
    const offsets = [...block.matchAll(/(?:^|,|:)\s*(-?[\d.]+(?:px|rem|em)|0|calc\([^)]*\)) (-?[\d.]+(?:px|rem|em)|0) 0/g)];
    for (const [, x] of offsets) expect(x).toBe('0'); // 기본 규칙의 수평 오프셋은 전부 0
  });

  it('자간 이음은 연속 지정(+ 결합자)에서만, 정확히 --char-gap 폭 왼쪽으로만 칠한다', () => {
    const adj = css.match(/\.word-token--picked \+ \.word-token--picked \.surface \{[^}]*\}/)?.[0] || '';
    expect(adj).toContain('calc(-1 * var(--char-gap');
    expect(adj).not.toMatch(/0 0 0 \d/); // spread 금지 — gap을 넘어 앞 상자를 침범할 수 없다
  });
});
