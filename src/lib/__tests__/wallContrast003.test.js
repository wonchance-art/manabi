import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

// WALL-005(2026-11-03 KST) → 경고 세트 판 5(오너 확정 2026-11-04 KST, 시안: https://claude.ai/artifact/Rvox4P1LTvxHXXtbhN5Xqq).
// 노랑 #D4962A(--warning)는 그 색 그대로 둔다: ① 글자만 노란 자리 = --warning 글자(대비 4.5 미달을 알고 두는 예외 — 아래 목록),
// ② 옅은 노랑 바탕 위 글자 = --warning-on-tint(#5C3A00) ③ 꽉 찬 노랑 위 글자 = 흰색(판 6 오너 예외 — 인접 배지와 통일). 어두운 판 값은 그대로.
// 예외 목록이 정본이다 — 새 자리에 노랑 글자를 쓰면 이 목록에 사유와 함께 더해야 하고, 지우면 여기서도 지운다.
describe('경고 세트 — 노랑 글자는 예외 목록 안에서만, 노랑 바탕 위 글자는 짝 토큰', () => {
  const walk = (dir, re) => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return ['__tests__', 'world'].includes(e.name) ? [] : walk(p, re);
    return re.test(e.name) ? [p] : [];
  });
  // 속성 이름이 정확히 color인 선언만(border-color · background-color 제외), 값 전체가 var(--warning)일 때.
  const TEXT_WARNING = /(?:^|[;{\s])color\s*:\s*var\(--warning\)\s*(?:!important\s*)?(?=[;}]|$)/gm;
  const CSS_EXCEPTIONS = [
    'src/components/classroom/class-course.css .course-timer--warn',
    'src/components/viewer/reader-controls.css .reader-settings__warning',
    'src/index.css .group-card__tag--due',
    'src/index.css .kana-test__pct.is-no',
    'src/index.css .version-badge__btn--stale',
    'src/index.css .version-badge__reload--danger',
    'src/index.css .version-badge__warn',
  ];
  // 인라인(JS · JSX) — 파일마다 `color: 'var(--warning)'` 개수. 기억 건강은 글자가 아니라 점(●) 색이다.
  // 삼항 · 함수로 고르는 자리(작문 scoreColor 3점 · 재작문 하락 줄)도 같은 「글자만 노랑」 예외다 — 이 검사식 밖이라 판 5 시안 표가 정본.
  const INLINE_EXCEPTIONS = {
    'src/components/DictationPanel.jsx': 1, 'src/components/MaterialAddSentenceSection.jsx': 1, 'src/components/learn/MemoryHealthCard.jsx': 1,
    'src/views/ClassTeamPage.jsx': 1, 'src/views/GroupsPage.jsx': 1, 'src/views/StudySessionPage.jsx': 1,
  };
  const ON_TINT = [
    ['src/index.css', '.tag--due {'], ['src/index.css', '.badge--stage-young {'], ['src/index.css', '.vocab-row__due {'],
    ['src/index.css', '.tag--score {'], ['src/index.css', '.pattern-card__due {'], ['src/views/CourseMapPage.module.css', '.lessonBody .lessonBadgeRecommended {'],
  ];

  it('CSS의 노랑 글자(`color: var(--warning)`)는 예외 목록과 정확히 같다', () => {
    const hits = walk('src', /\.css$/).flatMap(f => [...read(f).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(m => TEXT_WARNING.test(m[2]) && !(TEXT_WARNING.lastIndex = 0)).map(m => `${f} ${m[1].trim().split(/\s+/).pop()}`));
    TEXT_WARNING.lastIndex = 0;
    expect([...new Set(hits)].sort()).toEqual(CSS_EXCEPTIONS);
  });

  it('인라인 노랑 글자도 예외 목록과 정확히 같다', () => {
    const counts = {};
    for (const f of walk('src', /\.(jsx?|tsx?)$/)) {
      const n = (read(f).match(/color:\s*'var\(--warning\)'/g) || []).length;
      if (n) counts[f] = n;
    }
    expect(counts).toEqual(INLINE_EXCEPTIONS);
  });

  it('검사식이 실제로 잡는다 — 글자색은 잡고, 테두리 · 바탕 · 섞은 색은 놓아 둔다', () => {
    const count = (css) => (css.match(TEXT_WARNING) || []).length;
    expect(count('.a { color: var(--warning); }')).toBe(1);
    expect(count('.a {color:var(--warning)}')).toBe(1);
    expect(count('.a {\n  color: var(--warning);\n}')).toBe(1);
    expect(count('.a { border-color: var(--warning); background-color: var(--warning); }')).toBe(0);
    expect(count('.a { color: color-mix(in srgb, var(--warning) 15%, transparent); color: var(--warning-on-tint); }')).toBe(0);
  });

  it('옅은 노랑 바탕 위 글자는 --warning-on-tint — 셸 값 #5C3A00이 알약 바탕(노랑 15%) 위 4.5:1 이상', () => {
    for (const [f, sel] of ON_TINT) expect(sliceBetween(read(f), sel, '}'), sel).toMatch(/color:\s*var\(--warning-on-tint\)/);
    const onTint = shellToken('--warning-on-tint');
    expect(onTint).toBe('#5c3a00');
    const pill = '#f9eedc'; // color-mix(--warning 15%, --sheet) 실측
    expect(contrast(onTint, pill)).toBeGreaterThanOrEqual(4.5);
    expect(read('src/index.css')).toMatch(/:root\s*\{[^}]*--warning-on-tint: #5C3A00;/s);
  });

  it('꽉 찬 노랑 위 흰 글자는 예외 두 자리뿐 — 오너 결정 11/4: 인접 배지와 흰 글자 통일(대비 2.56)', () => {
    // 오늘 학습 채점 배지 「조금 아쉬워요」(로즈 · 빨강 배지와 한 줄) · 읽기 트랙 「파일럿」(관리자 전용).
    // 판 6에서 짙은 글자(#252721 · #4A2E00)를 견줬고 오너가 흰색을 골랐다. 새 자리는 이 목록에 사유와 함께 더한다.
    expect(contrast('#ffffff', '#d4962a')).toBeLessThan(4.5);
    const study = read('src/views/StudySessionPage.jsx');
    expect(study).toContain("const badgeColor = ts >= 2 ? 'var(--accent)' : ts === 1 ? 'var(--warning)' : 'var(--danger)';");
    expect(study).toContain("background: badgeColor, color: '#fff',");
    expect(read('src/views/ReadingTrackPage.jsx')).toContain("background: 'var(--warning)', color: '#fff', fontWeight: 600 }}>파일럿");
    const solidWhite = walk('src', /\.(jsx?|tsx?)$/).filter(f => /background:\s*'var\(--warning\)',\s*color:\s*'#fff'/.test(read(f)));
    expect(solidWhite).toEqual(['src/views/ReadingTrackPage.jsx']);
    expect(read('src/index.css')).not.toContain('--warning-on-solid');
  });

  it('뷰어 설정 경고는 밝은 면 노랑 · 어두운 면은 --reader-warn 그대로', () => {
    const css = read('src/components/viewer/reader-controls.css');
    expect(sliceBetween(css, '.reader-settings__warning {', '}')).toMatch(/color:var\(--warning\)/);
    expect(css).toContain('.viewer-layout[data-reader-theme="dark"] .reader-settings__warning {color:var(--reader-warn);}');
  });
});
