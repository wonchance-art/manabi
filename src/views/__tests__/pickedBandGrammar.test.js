import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');
const block = (re) => css.match(re)?.[0] || '';
const decls = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * 계약: 지정 칠 문법 통일 — 안 A (오너 확정 2026-09-02, #1077 5503687165).
 * 08-29 지정 밴드(±1px·각형 1px)와 08-30 상태 알약(확장 0·5px)이 서로 다른 문법이라
 * 지정 순간 폭·모서리·이음(낱개가 한 덩어리)이 한꺼번에 바뀌었다. 안 A는 알약 문법을
 * 기반 ::before로 올리고, 연속 지정 구간에서만 안쪽 모서리를 죽여 「하나의 긴 알약」을
 * 만든다 — 낱개 단어 지정은 색만 바뀐다(08-29 원래 계약 「형태·범위 불변」이 성립).
 * 배제 기록: 상태를 밴드로 올리기(인접 하이라이트가 이어져 보이는 회귀) · 지정을 낱개
 * 알약으로 내리기(안 B — 「여기까지 골랐다」가 안 읽힌다).
 */
describe('지정 칠 문법 — 안 A (index.css)', () => {
  const base = decls(block(/\.word-token \.surface::before \{[^}]*\}/s));
  const picked = decls(block(/\.word-token--picked \.surface::before \{[^}]*\}/s));
  // 이음 신호(TAP-INP-HAS-002): :has는 토큰 자신에 걸고 변수만 준다 — 칠하는 규칙은 :has 없이 변수를 읽는다.
  const rightCut = decls(block(/\.word-token--picked:has\(\+ \.word-token--picked\) \{[^}]*\}/s));
  const leftCut = decls(block(/\.word-token--picked \+ \.word-token--picked:has\(\.surface\) \{[^}]*\}/s));
  const corners = [...css.matchAll(/\.word-token--picked \.surface::before \{([^}]*)\}/g)].map((m) => decls(m[1])).find((d) => d.includes('radius')) || '';
  const seam = decls(block(/\.word-token--picked \.surface::after \{[^}]*\}/s));

  it('단어 하나만 지정 — ::before의 left·right·border-radius가 비지정과 동일(색만 바뀐다)', () => {
    expect(base).toContain('left: 0;');
    expect(base).toContain('right: 0;');
    expect(base).toContain('border-radius: 5px;');
    // 지정 칠 규칙은 background만 — 기하(left/right/radius/top/height)를 다시 쓰지 않는다
    expect(picked).toContain('background: var(--picked-bg');
    expect(picked).not.toMatch(/left:|right:|border-radius|top:|height:/);
    // 모서리 규칙은 이음 신호가 없으면 기반과 같은 값(5px) — 낱개 지정의 기하는 그대로다(TAP-INP-HAS-002)
    for (const side of ['top-left', 'bottom-left']) expect(corners).toContain(`border-${side}-radius: var(--picked-join-start, 5px);`);
    for (const side of ['top-right', 'bottom-right']) expect(corners).toContain(`border-${side}-radius: var(--picked-join-end, 5px);`);
    expect(corners).not.toMatch(/left:|right:|top:|height:|border-radius:|background/);
    // 혼색(--hl picked×상태) 규칙도 기하 무접촉
    for (const m of css.matchAll(/\.reader-area--hl \.word-token--picked\.word-token--\w+ \.surface::before \{([^}]*)\}/g)) {
      expect(m[1]).not.toMatch(/left:|right:|border-radius/);
    }
  });

  it('연속 지정 구간 — 안쪽 모서리만 죽인다(앞 토큰 오른쪽·뒤 토큰 왼쪽), 바깥 모서리는 둥근 채', () => {
    // 앞 토큰(다음도 지정) = 오른쪽 신호만, 뒤 토큰(앞도 지정) = 왼쪽 신호만 — 신호는 0(안쪽 모서리만 죽인다)
    expect(rightCut).toContain('--picked-join-end: 0;');
    expect(rightCut).not.toContain('--picked-join-start');
    expect(leftCut).toContain('--picked-join-start: 0;');
    expect(leftCut).not.toContain('--picked-join-end');
    // 신호 규칙은 변수만 — 토큰 자신의 칠 · 기하는 건드리지 않는다
    expect(`${rightCut}${leftCut}`).not.toMatch(/(^|[\s;{])(border|background|left|right|top|height|content):/);
    // 두 신호 모두 :has에 걸려 있다 — 미지원 엔진에서 이음매와 함께 빠져 온전한 알약으로 남는다
    expect(css).toMatch(/\.word-token--picked:has\(\+ \.word-token--picked\) \{/);
    expect(css).toMatch(/\.word-token--picked \+ \.word-token--picked:has\(\.surface\) \{/);
    expect(css).not.toMatch(/\.word-token--picked \+ \.word-token--picked \.surface::before \{/);
    // :has 뒤에 .surface를 두는 옛 형태 부활 금지 — 요소 하나 붙을 때마다 본문 .surface 전부를 다시 계산했다
    expect(css).not.toMatch(/\.word-token--picked[^{,]*:has\([^{,]*\)[^{,]*\.surface/);
  });

  it('연속 지정 구간 안에 지면색 틈 0 — 이음매가 자간 + 양끝 1px(칠 확장 0의 보상)를 덮는다', () => {
    // 이음매는 다음 토큰도 지정일 때(신호 --picked-seam)만 생긴다 — 신호가 없으면 content none
    expect(seam).toContain('content: var(--picked-seam, none);');
    expect(rightCut).toContain("--picked-seam: '';");
    expect(leftCut).not.toContain('--picked-seam');
    expect(seam).toContain('right: calc(-1 * var(--char-gap, 0.25rem) - 1px);');
    expect(seam).toContain('width: calc(var(--char-gap, 0.25rem) + 2px);');
    expect(seam).toContain('z-index: -2;'); // 밴드 밑 — 글리프 불가침 승계
    expect(seam).toContain('top: var(--hl-band-top);');
    expect(seam).toContain('height: var(--hl-band-h);');
  });

  it('비지정 인접 간격 4px 유지 — 어떤 ::before 규칙도 칠을 상자 밖으로 넓히지 않는다', () => {
    for (const m of css.matchAll(/[^{}]*\.surface::before \{([^}]*)\}/g)) {
      expect(m[1]).not.toMatch(/left: -|right: -/);
    }
  });

  it('--hl 블록에 죽은 기하 오버라이드가 없다 — 상태 알약은 기반 문법 하나로만 산다', () => {
    const hl = sliceBetween(css, '/* ── 단어 상태 하이라이트', '/* failed 토큰 전용 빈 furigana 영역');
    expect(hl.length).toBeGreaterThan(500);
    for (const m of hl.matchAll(/\.surface::before \{([^}]*)\}/g)) {
      expect(m[1]).not.toMatch(/left:|right:|border-radius/);
    }
  });

  it(':has 폴백 — 밴드·지정색 자체는 :has에 의존하지 않는다(글자·밴드 온전, 이음매만 생략)', () => {
    expect(block(/\.word-token \.surface::before \{[^}]*\}/s)).not.toContain(':has');
    expect(css).toMatch(/^\.word-token--picked \.surface::before \{/m);
  });
});
