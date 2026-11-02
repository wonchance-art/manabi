import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TOUCH_EXCEPTIONS } from '../../../scripts/wall-core.mjs';
import { sliceBetween } from './helpers/sliceBetween.js';

// 화면 벽 WALL-003(2026-11-02 KST) 수정 요청 13건 — 오너 「권장대로 13건 모두 구현해」.
// 13장면이 원인 8가지로 묶였다(시안: https://claude.ai/artifact/L8BeH5DzZdp7WPT52EbAJb). 같은 원인이 되살아나지 않게 값과 배선을 고정한다.
// 픽셀 대비는 화면 벽 캡처(axe)가 본다 — 여기는 그 원인 자리의 값 · 배선(계약 = 배선 보증, ui-conventions §5).
const read = (p) => readFileSync(p, 'utf8');
function luminance(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const PAPER = '#f6f4ee'; // v2 셸 바탕(--paper)
const shell = read('src/components/web/web-shell.css');
const shellToken = (name) => shell.match(new RegExp(`\\.manabi-app\\{[^}]*${name}:(#[0-9a-f]{6})`, 'i'))?.[1];

describe('화면 벽 WALL-003 — 대비', () => {
  it('① 복습 재대결 띠는 채점 「어려움」 글자 · 바탕 토큰을 쓴다(배경용 --warning을 글자에 쓰지 않는다)', () => {
    const css = read('src/index.css');
    const rule = sliceBetween(css, '.vocab-rematch {', '}');
    expect(rule).toMatch(/color:\s*var\(--grade-hard\)/);
    expect(rule).toMatch(/background:\s*var\(--grade-hard-bg\)/);
    expect(rule).not.toMatch(/var\(--warning\)/);
    expect(contrast(shellToken('--grade-hard'), shellToken('--grade-hard-bg'))).toBeGreaterThanOrEqual(4.5);
  });

  it('② 교재 「함께 읽기」 장식 번호는 큰 글자 기준(3:1) 이상', () => {
    const color = read('src/components/books/reading-shell.css').match(/\.manabi-culture-card>span\{[^}]*color:(#[0-9a-f]{6})/i)?.[1];
    expect(contrast(color, PAPER)).toBeGreaterThanOrEqual(3);
  });

  it('③ 레벨 목록 흐린 글자(--lv-faint)도 종이 · 카드 위 4.5:1 이상 — 셸 값과 index.css 밝은 값이 같다', () => {
    const shellFaint = read('src/components/levels/level-list.css').match(/--lv-faint:(#[0-9a-f]{6})/i)?.[1];
    // index.css에는 어두운 값 → 밝은 값 순으로 두 번 나온다 — 밝은 값(마지막)을 본다.
    const rootFaint = [...read('src/index.css').matchAll(/--lv-faint: (#[0-9a-f]{6})/gi)].map(m => m[1]).at(-1);
    for (const value of [shellFaint, rootFaint]) {
      expect(contrast(value, PAPER)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(value, '#fffdf9')).toBeGreaterThanOrEqual(4.5);
    }
    expect(shellFaint.toLowerCase()).toBe(rootFaint.toLowerCase());
  });

  it('④ 일본어 30일은 v2 셸 토큰을 입고, 테마 파랑을 글자에 직접 쓰지 않는다', () => {
    const layout = read('src/app/nihongo/layout.jsx');
    expect(layout).toMatch(/className="manabi-app"/);
    expect(layout).toMatch(/web-shell\.css/);
    for (const page of ['src/app/nihongo/page.jsx', 'src/app/nihongo/[day]/page.jsx']) {
      const src = read(page);
      expect(src).not.toMatch(/color:\s*THEME\.color/);
      expect(src).toMatch(/text:\s*'var\(--grade-easy\)'/);
    }
    expect(contrast(shellToken('--grade-easy'), '#dfe0de')).toBeGreaterThanOrEqual(4.5); // 테마 파랑 12% 바탕 위
    expect(read('src/index.css')).toMatch(/\.manabi-app \.fr-callout--tip \.fr-callout__label \{ color: #6B4FD1; \}/);
  });

  it('⑤ 지역학 화면은 글자를 투명도로 흐리지 않는다(보조 글자 토큰으로)', () => {
    for (const file of ['src/app/(app)/studies/[country]/page.jsx', 'src/views/StudiesDocPage.jsx']) {
      expect(read(file)).not.toMatch(/opacity:\s*0?\.\d/);
    }
  });

  it('⑥ 대화 화면 보조 글자(--chat-meta)는 대화 바탕 위 4.5:1 이상(밝은 값)', () => {
    const css = read('src/components/conversation/conversation.css');
    const light = css.match(/\.conv \{[^}]*--chat-bg: (#[0-9A-F]{6});[^}]*--chat-meta: (#[0-9A-F]{6});/i);
    expect(contrast(light[2], light[1])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('화면 벽 WALL-003 — 터치 타깃 예외(ui-conventions §3)', () => {
  it('⑦ 문장 막대 · ⑧ 지도 핀만 24px로 잰다 — 규약 문서와 검사표가 같은 목록이다', () => {
    expect(TOUCH_EXCEPTIONS.map(e => [e.selector, e.min])).toEqual([['.line-pick', 24], ['.jpmap-pin', 24]]);
    const doc = read('docs/ui-conventions.md');
    for (const e of TOUCH_EXCEPTIONS) expect(doc).toContain(`\`${e.selector}`);
  });

  it('⑧ 지도 핀은 모든 점 아래 한 층에 보이지 않는 터치 원(반지름 20 — 390에서 24.8px)을 깐다 — 점보다 먼저 그린다', () => {
    const src = read('src/views/JapanStudiesMapPage.jsx');
    // 터치 원 층이 점 층보다 앞(=아래)에 그려진다 — 터치 원 앵커에서 점 앵커까지가 잘려 나와야 한다.
    const hitLayer = sliceBetween(src, 'className="jpmap-pin-hit"', 'className={`jpmap-pin${');
    expect(hitLayer).toMatch(/r="20"/);
    expect(read('src/index.css')).toMatch(/\.jpmap-pin-hit \{ fill: transparent;/);
  });
});
