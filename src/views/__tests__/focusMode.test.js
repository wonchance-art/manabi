import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 계약: 집중 모드(오너 승인 2026-08-19) — 지정 문장만 원래 밝기, 나머지는 어둡게.
// 실렌더 검증(투명도·좌표 불변)은 e2e/typography.e2e.mjs가 담당하고, 여기는 배선만 지킨다.
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('집중 모드 배선', () => {
  const css = read('src/index.css');
  const viewer = read('src/views/ViewerPage.jsx');
  const settings = read('src/lib/useViewerSettings.js');

  it('옵트인 기본 꺼짐 — 관례(한자 대조·성조 색상 선례)', () => {
    expect(settings).toContain("readPref('focusMode', false)");
  });

  it('지정이 있을 때만 발동한다 — 지정 없이 켜면 화면이 통째로 어두워지면 안 된다', () => {
    expect(viewer).toContain("focusMode && (pickedLineIdx !== null || tokenRange.range) ? ' reader-area--focus' : ''");
  });

  it('어둡기는 비지정 토큰에만 걸린다(지정 토큰·상속 무관 opacity)', () => {
    expect(css).toMatch(/\.reader-area--focus \.word-token:not\(\.word-token--picked\) \{\s*opacity: 0\.18;/);
  });

  it('전환 애니메이션 + 모션 축소 존중', () => {
    expect(css).toMatch(/\.word-token \{[^}]*transition: opacity 0\.25s ease;/s);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.word-token \{ transition: none; \}/);
  });

  it('토글이 설정에 있고 언어 무관이다', () => {
    expect(viewer).toContain("'☑ 집중 모드 켜짐' : '◻ 집중 모드 꺼짐'");
    // 중국어 조건(materialLang === 'Chinese') 블록 밖 — 후리가나 토글과 같은 층위
    const idx = viewer.indexOf('집중 모드 켜짐');
    const before = viewer.slice(idx - 600, idx);
    expect(before).toContain('후리가나');
    expect(before).not.toContain("materialLang === 'Chinese' && (");
  });
});
