import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 계약: 읽기 모드 머리 높이 = 도구줄이 붙는 자리(READER-HEADER-001, 2026-11-08 KST).
 * #1558(상태 표시줄 겹침)이 머리 높이를 var(--gnb-height)로 바꿨는데, .gnb 자신이 셸 · 교재 셸에서 --gnb-height(78 · 폰 66)와
 * height(68 · 64)를 따로 지녀 머리만 커졌다. 도구줄(.viewer-topbar sticky top = 위 컨테이너의 56 + 안전 영역)은 그대로라
 * 붙으면 22px(폰 10px)가 머리 밑에 가려졌다. 실제 위치는 e2e viewer-reading-controls(toolbar joins actual navigation)가 잰다.
 */
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const squash = (s) => s.replace(/\s+/g, '');
const READING = 'calc(56px+env(safe-area-inset-top,0px))';

describe('읽기 모드 머리 — 56px + 상태 표시줄', () => {
  const css = squash(read('src/components/web/focused-reader.css'));
  it('머리가 자기 --gnb-height를 56 + 안전 영역으로 다시 정하고 그 값으로 높이를 잡는다', () => {
    const rule = sliceBetween(css, '.manabi-app.manabi-app--reading.gnb{', '}');
    expect(rule).toContain(`--gnb-height:${READING}`);
    expect(rule).toContain('height:var(--gnb-height)');
  });
  it('높은 우선순위 규칙은 높이 · 변수만 — 간격 · 옆 여백은 예전 우선순위로 남아 좁은 화면 셸 규칙이 이긴다', () => {
    const strong = sliceBetween(css, '.manabi-app.manabi-app--reading.gnb{', '}');
    expect(strong).not.toMatch(/padding|gap/);
    // 앞 규칙의 닫는 괄호까지 붙여 찾는다 — 그냥 찾으면 위 「.manabi-app.manabi-app--reading .gnb」의 꼬리에 걸린다.
    expect(css).toContain('}.manabi-app--reading.gnb{gap:12px;padding-inline:20px;}');
  });
  it('셸 · 교재 셸은 읽기 모드 머리 높이를 따로 정하지 않는다 — 정하면 이 규칙과 파일 순서 다툼이 된다', () => {
    for (const f of ['src/components/web/web-shell.css', 'src/components/books/reading-shell.css']) {
      const other = read(f);
      // :not(.manabi-app--reading)은 읽기 모드 밖이라 뺀다.
      for (const m of other.matchAll(/([^{}]*\.manabi-app--reading[^{}]*\.gnb)\s*\{([^}]*)\}/g)) if (!m[1].includes(':not(.manabi-app--reading)')) expect(m[2], `${f}: ${m[1].trim()}`).not.toMatch(/(^|;)\s*(height|--gnb-height)\s*:/);
    }
  });
  it('도구줄 · 본문 자리는 같은 56 + 안전 영역 값을 본다', () => {
    expect(sliceBetween(css, '.manabi-app--reading{', '}')).toContain(`--gnb-height:${READING}`);
    expect(sliceBetween(css, '.manabi-app--reading.app-layout{', '}')).toContain(`--gnb-height:${READING}`);
    expect(sliceBetween(css, '.manabi-app--reading.viewer-topbar{', '}')).toContain('top:var(--gnb-height)');
  });
});
