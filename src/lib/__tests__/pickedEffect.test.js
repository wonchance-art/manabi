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
});
