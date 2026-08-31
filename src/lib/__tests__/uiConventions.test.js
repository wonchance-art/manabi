import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 계약: v2-K R1 UI 일관성 (#1077 설계, 오너 착수 승인 2026-08-30 "K ㄱㄱ").
 * 설계 §7 중 R1 해당분: ① 인라인 하드코딩 색상 0(예외는 값·경로 목록으로 좁게)
 * ④ ui-conventions.md 존재 + CLAUDE.md 상호 포인터 ⑤ 44px·포커스·모션 축소 회귀 방지.
 * (②③ 브레이크포인트 동결·@container 정책은 R2, ⑥ 계약 위생은 v2-L에서 완료.)
 */

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/** 게임 팔레트·특수 렌더는 학습 웹 토큰 체계 밖 — 경로로 좁게 예외 처리. */
const EXEMPT_PATHS = [
  'src/views/WorldPage.jsx',
  'src/components/world/',
  'src/app/global-error.jsx',      // 스타일시트 미로드 화면 — 토큰이 없을 수 있다
  'src/app/opengraph-image.jsx',   // Satori 서버 렌더 — CSS 변수 미동작
];
/** 채색 배경 위 대비 글자 — CSS 본문에서도 같은 관례라 값 목록으로 허용. */
const EXEMPT_VALUES = ['#fff', '#ffffff'];

const SRC_FILE = /\.(jsx?|tsx?)$/;
const INLINE_COLOR = /style=\{\{[^}]*?(#[0-9a-fA-F]{3,8}|rgba?\()/;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (SRC_FILE.test(name)) out.push(path.relative(ROOT, p));
  }
  return out;
}

describe('① 인라인 하드코딩 색상 0', () => {
  it('학습 웹 경로에는 색 리터럴이 없다 — 투명도는 color-mix로', () => {
    const files = walk(path.join(ROOT, 'src'))
      .filter((f) => !EXEMPT_PATHS.some((e) => f.startsWith(e) || f === e));
    const violations = [];
    for (const f of files) {
      const lines = read(f).split('\n');
      lines.forEach((line, i) => {
        if (!INLINE_COLOR.test(line)) return;
        // 허용 값만 남았으면 통과 — 그 값들을 지운 뒤 다시 본다
        let stripped = line;
        for (const v of EXEMPT_VALUES) stripped = stripped.split(v).join('');
        if (INLINE_COLOR.test(stripped)) violations.push(`${f}:${i + 1} — ${line.trim().slice(0, 90)}`);
      });
    }
    expect(violations, '색은 토큰으로 — docs/ui-conventions.md §1').toEqual([]);
  });

  it('토큰 폴백에도 색 리터럴을 넣지 않는다 — 미정의 토큰이면 그 폴백이 실제로 렌더된다', () => {
    const files = walk(path.join(ROOT, 'src'))
      .filter((f) => !EXEMPT_PATHS.some((e) => f.startsWith(e) || f === e));
    const bad = [];
    for (const f of files) {
      for (const m of read(f).matchAll(/var\(\s*--[a-z0-9-]+\s*,\s*([^)]*(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))[^)]*)\)/g)) {
        if (EXEMPT_VALUES.includes(m[1].trim())) continue;
        bad.push(`${f} — ${m[0].slice(0, 80)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('R1에서 승격한 토큰은 기존 인라인 값을 그대로 담는다(계산색 대조 확인)', () => {
    const css = read('src/index.css');
    expect(css).toContain('--warning-bright: #FCC419;');   // 옛 rgba(252,196,25) 그대로
    expect(css).toContain('--admin-accent: #FF922B;');     // 옛 #ff922b 그대로
    expect(css).toContain('--track-english: #3B6FB5;');
    expect(css).toContain('--track-chinese: #B0722F;');
  });

  it('미정의 토큰을 가리키던 세 폴백이 사라졌다(--success·--bg-subtle·--surface-2)', () => {
    for (const dead of ['--success,', '--bg-subtle,', '--surface-2,']) {
      const hits = walk(path.join(ROOT, 'src')).filter((f) => read(f).includes(dead));
      expect(hits, `${dead} 폴백이 남아 있다`).toEqual([]);
    }
  });
});

/* ── v2-K R2: 브레이크포인트 동결 ── */

/** 동결 목록 — 이 값들 밖으로 나가는 뷰포트 쿼리는 금지(docs/ui-conventions.md §2). */
/** R3에서 767(→768 병합)·880(→@container)이 빠졌다. 목록은 줄기만 하고 늘지 않는다. */
const ALLOWED_MAX = [400, 420, 480, 560, 600, 768, 1179];
const ALLOWED_MIN = [760, 900];
/** 현재 총 뷰포트 쿼리 수. 늘릴 수 없다 — 새 접힘은 @container로. */
const VIEWPORT_QUERY_CAP = 28;

function cssFiles() {
  const out = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules') continue;
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.css')) out.push(path.relative(ROOT, p));
    }
  })(path.join(ROOT, 'src'));
  return out;
}

function viewportQueries() {
  const found = [];
  for (const f of cssFiles()) {
    for (const m of read(f).matchAll(/@media[^{]*?\((max|min)-width:\s*(\d+)px/g)) {
      found.push({ file: f, kind: m[1], px: Number(m[2]) });
    }
  }
  return found;
}

describe('②③ 브레이크포인트 동결 + @container 정책 (R2)', () => {
  it('허용 목록 밖의 뷰포트 값이 없다 — 새 브레이크포인트 신설 금지', () => {
    const bad = viewportQueries().filter(
      (q) => !(q.kind === 'max' ? ALLOWED_MAX : ALLOWED_MIN).includes(q.px),
    );
    expect(bad.map((b) => `${b.file} — ${b.kind}-width: ${b.px}px`)).toEqual([]);
  });

  it('뷰포트 쿼리 총량에 상한이 있다 — 새 접힘은 @container로 쓰라는 강제', () => {
    const all = viewportQueries();
    expect(all.length).toBeGreaterThan(20);            // 스캐너가 비면 여기서 잡힌다
    expect(all.length).toBeLessThanOrEqual(VIEWPORT_QUERY_CAP);
  });

  it('컨테이너 쿼리 선례가 살아 있다 — 정책이 가리키는 실물', () => {
    expect(read('src/index.css')).toContain('container-type: inline-size');
  });

  /* ── v2-K R3: 이관 결과 고정 ── */

  it('뷰어 풀블리드 경계 = 모바일 크롬 경계 — 둘이 어긋나면 1px 구간에서 판단이 갈린다', () => {
    // 767이던 시절 폭 768px에서 크롬은 모바일인데 뷰어만 데스크톱이었다(R3 실측).
    const css = read('src/index.css');
    // 두 블록을 각각 **자기 내용으로** 찾는다 — 위치나 순서에 기대면 앵커가 조용히 샌다.
    const chrome = css.match(/@media \(max-width: (\d+)px\)[^{]*\{\s*:root\s*\{[^}]*--gnb-height/);
    expect(chrome, '모바일 크롬 블록(--gnb-height)을 못 찾았다').toBeTruthy();
    const viewer = css.match(/@media \(max-width: (\d+)px\)\s*\{\s*\.viewer-center \{ padding: 12px 12px 72px; \}/);
    expect(viewer, '뷰어 풀블리드 블록을 못 찾았다').toBeTruthy();
    expect(viewer[1], `뷰어 풀블리드는 모바일 크롬과 같은 ${chrome[1]}px여야 한다`).toBe(chrome[1]);
  });

  it('myplan 격자는 화면이 아니라 **자기 폭**으로 접힌다 — 컨테이너 전환의 실물', () => {
    const css = read('src/index.css');
    expect(css).toContain('.myplan { container-type: inline-size; }');
    expect(css).toContain('@container (max-width: 880px) { .myplan__grid { grid-template-columns: 1fr; } }');
    // 뷰포트로 되돌리면 사이드바 옆에서 다시 틀린 답을 낸다(실측: 실폭 712px에 2열)
    expect(css, 'myplan 격자에 뷰포트 쿼리가 되살아나면 안 된다')
      .not.toMatch(/@media[^{]*\)\s*\{\s*\.myplan__grid/);
  });

  it('문서가 R3 판정을 근거와 함께 싣는다 — 기각도 기록이다', () => {
    const doc = read('docs/ui-conventions.md');
    expect(doc).toContain('R3 1차 결과');
    for (const kept of ['767 → 768', '880 → @container']) expect(doc).toContain(kept);
    // 기각 2건은 근거가 함께 남아야 한다(다음 세션이 같은 시도를 반복하지 않게)
    expect(doc).toContain('136px 2열');
    expect(doc).toContain('이미 스크롤 없이');
  });

  /* ── v2-K R3 2차: 잔여 11건 전수 실측 결과 고정 ── */

  it('요음 획순 패널이 표를 밀어내지 않는다 — 글리프를 쌓아 기본 세트와 같은 폭', () => {
    // 실측: 패널이 글리프 2개(306px)를 가로로 물면, 챕터 본문 상한 712px 안에서
    // 요음 표가 뷰포트 759→760에 683→322px(−53%)로 무너졌다. 감싸면 478px로 회복되고
    // 낙폭이 기본 세트(683→478)와 같아진다.
    const css = read('src/index.css');
    expect(css).toContain('.gojuon-panel .kana-stroke-row { flex-wrap: wrap; max-width: var(--kana-glyph); }');
    // 패널 한정이어야 한다 — 획순 줄 전역을 감싸면 좁은 화면(패널이 표 위)에서도 쌓인다.
    expect(css, '감싸기는 gojuon 패널 안에서만')
      .not.toMatch(/^\s*\.kana-stroke-row\s*\{[^}]*flex-wrap/m);
  });

  it('글리프 한 변은 한 곳에서만 정한다 — 패널 폭 계산이 그 값에 걸려 있다', () => {
    const css = read('src/index.css');
    expect(css).toContain('--kana-glyph: 150px;');
    expect(css).toContain('.kana-stroke-glyph { width: var(--kana-glyph); height: var(--kana-glyph); }');
    // 좁은 화면 축소도 같은 변수로 — 리터럴로 되돌아가면 감싸는 폭과 조용히 갈린다.
    expect(css).toContain('.kana-stroke-row { --kana-glyph: 120px; }');
    expect(css, '글리프 크기를 리터럴로 다시 박으면 안 된다')
      .not.toMatch(/\.kana-stroke-glyph\s*\{\s*width:\s*\d+px/);
  });

  it('2차 판정이 유지로 끝난 10건에 뷰포트 쿼리가 그대로 있다 — 기각도 결정이다', () => {
    // 전부 뷰포트를 상수 오프셋으로 1:1 추종한다(실측). 컨테이너로 옮기면 같은 답을
    // 다른 숫자로 쓰는 churn이라 **일부러** 두었다. 누가 '정리'로 옮기면 여기서 잡힌다.
    const css = read('src/index.css');
    for (const re of [
      /@media \(min-width: 900px\)\s*\{\s*\.review-dash/,
      /@media \(min-width: 900px\)\s*\{\s*\.admin-edit__pencil/,
      /@media \(min-width: 760px\)\s*\{\s*\.jpmap-layout/,
      /@media \(min-width: 760px\)\s*\{\s*\.gojuon-board/,
    ]) expect(css, `${re} — R3 2차에서 유지로 판정한 쿼리다`).toMatch(re);
  });

  it('문서가 R3 2차 판정을 근거와 함께 싣는다 — 추측이 아니라 실측이었음이 남아야 한다', () => {
    const doc = read('docs/ui-conventions.md');
    expect(doc).toContain('R3 2차 결과');
    // 수리 1건: 붕괴 폭과 회복 폭
    expect(doc).toContain('683→**322px**');
    expect(doc).toContain('--kana-glyph');
    // 1차 추측이 기각된 두 건은 그 사실이 남아야 다음 세션이 다시 안 옮긴다
    expect(doc.match(/1차 추측 기각/g) || []).toHaveLength(2);
    // 유지한 역전 2건도 수치와 함께 (다시 재보지 않도록)
    expect(doc).toContain('넘침은 없다');
    // 사이드바 오해의 뿌리
    expect(doc).toContain('정의만 되고 아무 데서도 쓰이지 않는다');
  });

  it('문서의 쿼리 총량이 계약 상한과 같은 값을 말한다 — 두 곳이 갈리면 문서가 먼저 낡는다', () => {
    // 실측: 1차가 767을 없앴는데 문서는 29로 남아 있었다. 이제 갈리면 여기서 잡힌다.
    expect(read('docs/ui-conventions.md')).toContain(`현재 ${VIEWPORT_QUERY_CAP}`);
    expect(viewportQueries()).toHaveLength(VIEWPORT_QUERY_CAP);
  });

  it('문서가 정본 티어와 동결 목록을 싣는다', () => {
    const doc = read('docs/ui-conventions.md');
    expect(doc).toContain('정본 티어');
    expect(doc).toContain('동결 목록');
    for (const px of [480, 600, 768, 1180]) expect(doc).toContain(String(px));
    expect(doc).toContain('@container');
  });
});

describe('④ 규약 문서 — 존재 + 상호 포인터', () => {
  it('ui-conventions.md가 있고 R1이 정한 절을 담는다', () => {
    const doc = read('docs/ui-conventions.md');
    for (const section of ['색은 토큰으로만', '브레이크포인트', '접근성', '테마', '계약 = 배선 보증, e2e = 동작 보증']) {
      expect(doc).toContain(section);
    }
  });

  it('CLAUDE.md가 그 문서를 가리킨다 — 규약이 두 곳으로 갈리지 않게', () => {
    expect(read('CLAUDE.md')).toContain('docs/ui-conventions.md');
  });
});

describe('⑤ 접근성 하한 — 줄어들면 잡는다', () => {
  const css = read('src/index.css');
  const count = (re) => (css.match(re) || []).length;

  it('44px 터치 타깃·:focus-visible·prefers-reduced-motion이 하한 이상', () => {
    expect(count(/44px/g)).toBeGreaterThanOrEqual(29);
    expect(count(/focus-visible/g)).toBeGreaterThanOrEqual(12);
    expect(count(/prefers-reduced-motion/g)).toBeGreaterThanOrEqual(10);
  });
});

describe('테마 — 저장값이 없을 때만 OS를 따른다', () => {
  const hook = read('src/lib/useTheme.js');

  it('저장값이 정본이고, 없을 때만 prefers-color-scheme', () => {
    expect(hook).toContain("if (saved === 'dark' || saved === 'light') { setTheme(saved); return; }");
    expect(hook).toContain("window.matchMedia?.('(prefers-color-scheme: light)').matches");
  });

  it('자동 저장 금지 — 부착 effect가 localStorage를 쓰면 OS 추종 상태가 첫 렌더에 사라진다', () => {
    const attach = sliceBetween(hook, "document.documentElement.setAttribute('data-theme', theme);", '}, [theme]);');
    expect(attach).not.toContain('setItem');
    // 저장은 사용자가 고를 때만
    expect(hook).toMatch(/toggleTheme[\s\S]{0,200}?localStorage\.setItem\('theme', next\)/);
  });
});
