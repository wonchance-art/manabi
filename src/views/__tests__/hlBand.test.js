import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');

/**
 * 계약: 하이라이트 글자 밴드 (오너 확정 2026-08-29 — 시연 아티팩트 3라운드).
 * ① 상태·저장·복습·지정의 모든 면 칠은 .surface 직접 배경이 아니라 ::before 밴드가 진다.
 *    밴드 세로 범위(0.58~1.62em)는 잉크 실측값 — 병음 잉크(0.32~0.50em)와 안 겹치고
 *    한자 잉크(0.58~1.54em)를 온전히 덮는다. .surface line-height(2.2)를 바꾸면
 *    rt-an bottom 비율(pinyinRuby 계약)과 함께 이 값도 다시 재야 한다.
 * ② 지정 중 상태는 혼색(T1) — 상태가 끝까지 '배경'이라는 한 언어로 살아야
 *    지정 전이에서 눈이 놓치지 않는다(형태·범위 불변, 색만 크로스페이드).
 * ③ 문장 막대(line-pick) 시각도 같은 변수(--hl-band-*)를 공유한다(히트 영역은 불변).
 */
describe('하이라이트 글자 밴드 (index.css)', () => {
  it('밴드 변수 — 잉크 실측 확정값(0.58em/1.04em)이 reader-area에 정의된다', () => {
    expect(css).toMatch(/\.reader-area \{[^}]*--hl-band-top: 0\.58em;\s*--hl-band-h: 1\.04em;/s);
  });

  it('surface는 inline-block 기준 상자 + 스택 문맥 — 밴드 절대배치가 2.2em 상자 기준이 된다', () => {
    const block = css.match(/\.word-token \.surface \{[^}]*\}/s)?.[0] || '';
    expect(block).toMatch(/line-height: 2\.2;/); // pinyinRuby 계약과 같은 값 공유
    expect(block).toContain('display: inline-block');
    expect(block).toContain('position: relative');
    expect(block).toContain('z-index: 0');
  });

  it('기반 밴드 ::before — 변수 기하·글자 뒤(z:-1)·색 전이 0.18s', () => {
    const block = css.match(/\.word-token \.surface::before \{[^}]*\}/s)?.[0] || '';
    expect(block).toContain('z-index: -1');
    expect(block).toContain('top: var(--hl-band-top)');
    expect(block).toContain('height: var(--hl-band-h)');
    expect(block).toContain('transition: background-color 0.18s ease');
    expect(css).toMatch(/prefers-reduced-motion[^}]*\{\s*\.word-token \.surface::before \{ transition: none; \}/s);
  });

  it('surface 직접 면 칠 소멸 — 상태·지정 계열 .surface 블록에 background가 없다', () => {
    const surfaceBlocks = [...css.matchAll(/\.(?:word-token--|reader-area--hl )[^{]*\.surface \{[^}]*\}/g)].map((m) => m[0]);
    expect(surfaceBlocks.length).toBeGreaterThan(0);
    for (const b of surfaceBlocks) {
      expect(b).not.toMatch(/background/);
      expect(b).not.toMatch(/border-bottom/); // 밑줄도 밴드(::before)가 진다
    }
  });

  it('상태 하이라이트(B안)·저장 밑줄·복습 펄스가 전부 ::before를 칠한다', () => {
    expect(css).toMatch(/\.reader-area--hl \.word-token--new:not\(\.word-token--picked\) \.surface::before \{\s*background: var\(--ws-new\);/);
    expect(css).toMatch(/\.reader-area--hl \.word-token--met:not\(\.word-token--picked\) \.surface::before \{\s*background: var\(--ws-met\);/);
    expect(css).toMatch(/\.word-token--saved \.surface::before \{\s*border-bottom: 2px solid var\(--primary-light\);/);
    expect(css).toMatch(/\.word-token--due \.surface::before \{[^}]*animation: due-pulse/s);
  });

  it('T1 혼색 — 지정 중 4상태의 밴드가 지정색×상태색 color-mix로 칠해진다', () => {
    for (const [cls, src] of [
      ['new', '--ws-new-ln'],
      ['met', '--ws-met-ln'],
      ['saved', '--ws-learn-ln'],
      ['due', '--warning'],
    ]) {
      const re = new RegExp(
        `\\.reader-area--hl \\.word-token--picked\\.word-token--${cls} \\.surface::before \\{[^}]*color-mix\\(in srgb, var\\(${src}\\) \\d+%, var\\(--picked-bg`, 's'
      );
      expect(css).toMatch(re);
    }
    // 밑줄 강등 문법(2px dotted)은 폐기 — 부활 금지
    expect(css).not.toMatch(/2px dotted var\(--ws-/);
  });

  it('문장 막대 시각이 밴드 변수를 공유하고, 버튼은 2.2em·top 정렬(글꼴 무관 기하 일치)', () => {
    const bar = css.match(/\.line-pick::before \{[^}]*\}/s)?.[0] || '';
    expect(bar).toContain('height: var(--hl-band-h)');
    // 보정값(transform) 부활 금지 — middle 정렬+실측 보정은 x-height(글꼴) 의존이라
    // 실기(PingFang)에서 어긋났다(오너 보고 2026-08-29). 2.2em·top이면 flex 중앙 = 밴드 중앙.
    expect(bar).not.toContain('transform');
    const btn = css.match(/\.line-pick \{[^}]*\}/s)?.[0] || '';
    expect(btn).toContain('height: 2.2em');
    expect(btn).toContain('vertical-align: top');
    expect(btn).not.toContain('transform');
  });

  it('밴드 좌우 여유는 ±1px — 기본 자간에서 이웃 밴드와 맞닿지 않고 이음매 2px가 노출된다', () => {
    const base = css.match(/\.word-token \.surface::before \{[^}]*\}/s)?.[0] || '';
    expect(base).toContain('left: -1px');
    expect(base).toContain('right: -1px');
  });
});
