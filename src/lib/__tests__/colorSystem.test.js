import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

// 색 체계 정리(설계안 https://claude.ai/artifact/Bz7Uc4dsZb4nmZXHpBQktL — 오너 「설계 승인」 2026-11-04 KST).
// 단계마다 결정된 값을 여기서 고정한다. 화면 벽 실측(https://claude.ai/artifact/SNM91N7kjTrRts5qkYr5WJ)이 근거.
const read = (p) => readFileSync(p, 'utf8');
const cssFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name);
  if (e.isDirectory()) return ['__tests__', 'world', 'textbookEditions'].includes(e.name) ? [] : cssFiles(p);
  return /\.css$/.test(e.name) ? [p] : [];
});

describe('단계 2-① 교재 보조 글자 = 셸 --muted (오너 「거의 똑같네. 통일 ㄱ」 2026-11-04 KST)', () => {
  // 교재 화면 12장면만 보조 글자가 교재 스타일시트 직접 값 #796D70(따뜻한 회갈색)이었다 — 나머지 98장면은 셸 #65675F.
  // 시안: https://claude.ai/artifact/4h8MyVDmm4axpwWWnKiDSU. 교재 판본별 스타일(content/textbookEditions, 편집 데이터)은 범위 밖.
  it('학습 웹 CSS에 옛 교재 회갈색 #796D70이 다시 들어오지 않는다', () => {
    const hits = cssFiles('src').filter((f) => /#796d70/i.test(read(f)));
    expect(hits).toEqual([]);
  });

  it('교재 셸 블록은 보조 글자 토큰을 다시 정의하지 않는다 — 셸(web-shell.css)이 정본', () => {
    const block = read('src/components/books/reading-shell.css').match(/\.manabi-app\{[^}]*\}/)?.[0] || '';
    expect(block).not.toMatch(/--text-secondary:|--text-muted:|--muted:/);
    expect(read('src/components/books/reading-content.css').match(/\.book-reading-content\{[^}]*\}/)?.[0]).not.toMatch(/--muted:/);
    expect(read('src/components/web/web-shell.css')).toMatch(/\.manabi-app\{[^}]*--muted:#65675f;[^}]*--text-secondary:var\(--muted\);[^}]*--text-muted:var\(--muted\)/);
  });

  it('교재 보조 글자 자리는 var(--muted)를 쓴다', () => {
    const shell = read('src/components/books/reading-shell.css');
    for (const sel of ['.manabi-app .gnb__link{', '.manabi-eyebrow{', '.manabi-section-heading>span{']) {
      expect(sliceBetween(shell, sel, '}'), sel).toContain('color:var(--muted)');
    }
    expect(read('src/components/books/study-route.css')).toContain('.book-recall-links strong{font-size:12px;color:var(--muted)}');
  });
});

describe('단계 1 계약 확대 — 색 직접 값은 늘지 않는다(라쳇)', () => {
  // 셈법 정본: scripts/color-literals.mjs. CSS 직접 값 전부 + JS/JSX 스타일 객체 · 여러 줄 · 삼항 · 이름색(white 등)까지 —
  // uiConventions ①은 한 줄 style={{}} 안의 #hex/rgba만 봤다. 교재 판본 · 월드 · 오류 화면도 세되 늘지 않게만 묶는다.
  // 값이 줄면(정리 단계 2) 기준 파일도 같이 낮춘다 — `node scripts/color-literals.mjs > src/lib/__tests__/fixtures/colorLiteralBaseline.json`.
  it('파일별 직접 색 개수가 기준과 같다 — 새 파일 · 늘어난 파일은 실패, 줄었으면 기준을 낮춘다', async () => {
    const { literalCounts } = await import('../../../scripts/color-literals.mjs');
    const baseline = JSON.parse(read('src/lib/__tests__/fixtures/colorLiteralBaseline.json'));
    expect(literalCounts()).toEqual(baseline);
  });

  it('셈법이 실제로 센다 — 스타일 객체 · 여러 줄 · 삼항 · 이름색 · CSS 선언(토큰 정의는 뺌)', async () => {
    const { cssLiterals, jsLiterals } = await import('../../../scripts/color-literals.mjs');
    expect(jsLiterals("const S = { del: { color: '#d4962a' } };")).toBe(1);
    expect(jsLiterals("<b style={{\n  color: 'white',\n  background: ok ? '#fff' : 'rgba(0,0,0,.2)',\n}} />")).toBe(3);
    expect(jsLiterals("<b style={{ color: 'var(--ink)' }} /> // color: '#fff'")).toBe(0);
    expect(cssLiterals('.a{--x:#fff;color:#000;background:rgb(1,2,3)}')).toBe(2);
    expect(cssLiterals('.a{color:var(--muted);font-family:Red Hat}')).toBe(0);
  });
});

describe('단계 1 이름 도입 — 값 그대로(화면 무변화)', () => {
  it('옅은 바탕 15%는 --warning-tint · --danger-tint 하나로 — 같은 식을 손으로 다시 쓰지 않는다', () => {
    const css = read('src/index.css');
    expect(css).toContain('--warning-tint: color-mix(in srgb, var(--warning) 15%, transparent);');
    expect(css).toContain('--danger-tint: color-mix(in srgb, var(--danger) 15%, transparent);');
    for (const f of cssFiles('src')) {
      const body = read(f).replace(/--(?:warning|danger)-tint:[^;]*;/g, '');
      expect(body, f).not.toMatch(/color-mix\(in srgb, var\(--(?:warning|danger)\) 15%, transparent\)/);
    }
    for (const sel of ['.tag--due {', '.badge--stage-young {', '.badge--stage-learning {', '.badge--stage-relearning {']) {
      expect(sliceBetween(css, sel, '}'), sel).toMatch(/background: var\(--(?:warning|danger)-tint\)/);
    }
  });
});

const srcFiles = (dir, re) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name);
  if (e.isDirectory()) return ['__tests__', 'world', 'textbookEditions'].includes(e.name) ? [] : srcFiles(p, re);
  return re.test(e.name) ? [p] : [];
});

describe('단계 2-② 옅은 노랑 바탕 = --warning-tint 하나 (오너 「전부 권장대로」 2026-11-04 KST)', () => {
  // 시안: https://claude.ai/artifact/1D1pG1Zm99d4j9XoXUTLa9 — 7 · 10 · 12 · 13 · 16% · 밝은 노랑 · rgba 직접 값이 흩어져 있었다.
  // 제외(시안에서 정함): 과정 지도 카드 바탕 7%(카드 면과 섞은 면 바탕) · 뷰어 「어려움」 채점 단추(채점 척도, 읽기면과 섞음).
  const ALLOW = [
    ['src/views/CourseMapPage.module.css', 'color-mix(in srgb, var(--warning) 7%, var(--bg-card))'],
    ['src/components/viewer/reader-controls.css', 'color-mix(in srgb,var(--warning) 13%,var(--reader-paper))'],
  ];
  it('노랑을 손으로 옅게 섞은 바탕이 없다 — 예외 둘만', () => {
    const offenders = [];
    for (const f of srcFiles('src', /\.(css|jsx|js)$/)) {
      let body = read(f).replace(/--warning-tint:[^;]*;/g, '');
      for (const [file, expr] of ALLOW) if (f === file) body = body.split(expr).join('');
      // 바탕 선언만 본다 — 테두리 · 급수 색 데이터(N5 노랑 bg 키)는 다른 역할.
      const hits = body.match(/background(?:-color)?\s*:\s*['"]?(?:color-mix\(in srgb,\s*var\(--warning(?:-bright)?\)\s*\d+%,[^)]*\)|rgba\(\s*(?:212,\s*150,\s*42|245,\s*195,\s*74|252,\s*196,\s*25)[^)]*\))/g);
      if (hits) offenders.push(`${f}: ${hits.join(' | ')}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('단계 2-③ 갈색 경고 글자 --warning-text를 걷었다 (오너 「전부 권장대로」 2026-11-04 KST)', () => {
  // 시안: https://claude.ai/artifact/FimxNgPnvMo9pXFbFexcmU — 경고 글자는 노랑(--warning) · 옅은 노랑 위 진한 글자(--warning-on-tint) 둘뿐.
  it('--warning-text 이름이 어디에도 없다', () => {
    const hits = srcFiles('src', /\.(css|jsx|js)$/).filter((f) => read(f).includes('--warning-text'));
    expect(hits).toEqual([]);
  });
  it('남은 자리는 on-tint로 — 함정 상자 라벨 · 알림 경고(노랑 15% 상자) · 관리자 게시 패널', () => {
    expect(read('src/index.css')).toContain('.fr-callout--pitfall .fr-callout__label { color: var(--warning-on-tint); }');
    expect(sliceBetween(read('src/components/profile/profile.css'), '.pf-warn{', '}')).toMatch(/color:var\(--warning-on-tint\);background:var\(--warning-tint\)/);
    expect(read('src/components/LiteraturePublishPanel.jsx').match(/var\(--warning-on-tint\)/g)).toHaveLength(3);
  });
});

describe('단계 2-④ 위험 글자는 --danger-text(#A3352B), 표시는 --danger (오너 「전부 권장대로」 2026-11-04 KST)', () => {
  // 시안: https://claude.ai/artifact/9ZRVeihieRFPyEbWnGW3J6 — #C84040 글자는 종이 위 4.48 · 회색 면 위 4.17로 본문 기준(4.5) 미달.
  // 테두리 · 줄긋기 선 · 점 · 꽉 찬 바탕은 --danger 그대로. 글자 아닌 예외: 대화 다시 보내기 ↻ 아이콘, 기억 건강 「위험」 점.
  it('셸이 #A3352B를 정의하고, 옛 판(셸 밖)은 --danger를 가리킨다', () => {
    expect(read('src/components/web/web-shell.css')).toMatch(/\.manabi-app\{[^}]*--danger-text:#a3352b;/);
    expect(read('src/index.css')).toContain('--danger-text: var(--danger);');
  });
  it('글자색으로 --danger를 직접 쓰지 않는다 — 예외 둘만', () => {
    const offenders = [];
    for (const f of srcFiles('src', /\.(css|jsx|js)$/)) {
      read(f).split('\n').forEach((line, i) => {
        if (!/(?<![-\w])color\s*:\s*'?var\(--danger\)/.test(line)) return;
        if (f.endsWith('conversation.css') && line.startsWith('.conv-retry {')) return;
        if (f.endsWith('MemoryHealthCard.jsx') && line.includes("key: 'forgotten'")) return;
        offenders.push(`${f}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe('화면 무변화 정리 — 덮여서 안 보이던 옛 색 규칙 (오케스트레이션 2026-11-04 KST 「화면 무변화 정리는 바로」)', () => {
  it('옛 채점 단추 open-color 그라데이션이 돌아오지 않는다 — 채점 4단 색은 복습실 · 뷰어 카드가 진다', () => {
    const css = read('src/index.css');
    expect(css).not.toMatch(/\.review-score-btn--(?:again|hard|good|easy)\s*\{[^}]*gradient/);
    expect(read('src/components/web/review-room.css')).toContain('.manabi-review-room .review-score-btn--again { background:var(--grade-again-bg); color:var(--grade-again); }');
    expect(read('src/components/viewer/reader-controls.css')).toMatch(/\.viewer-layout \.reader-card-actions \.review-score-btn--again \{background:/);
  });
});

describe('단계 3 · 옛 화면 이전 (오너 「승인 및 수용」 2026-11-04 KST, 시안 https://claude.ai/artifact/BY6Xqfw9Zmgw9x3LQCrSNe)', () => {
  it('알림(body 직속 .toast-container)은 셸과 같은 토큰 값을 받는다 — 기기가 어두운 모드여도 옛 어두운 판 알림이 뜨지 않는다', () => {
    const shell = read('src/components/web/web-shell.css');
    const block = (sel) => shell.match(new RegExp(`^${sel.replace('.', '\\.')}\\{([^}]*)\\}`, 'm'))?.[1] || '';
    const tokens = (b) => Object.fromEntries(b.split(';').filter(Boolean).map((d) => d.split(/:(.*)/s).slice(0, 2)));
    const app = tokens(block('.manabi-app')), toast = tokens(block('.toast-container'));
    expect(Object.keys(toast).length).toBeGreaterThan(5);
    for (const [name, value] of Object.entries(toast)) expect(value, name).toBe(app[name]);
    expect(block('.toast-container'), '토큰만 — 알림 상자 밖을 칠하지 않는다').not.toMatch(/(^|;)(background|color):/);
    expect(sliceBetween(read('src/index.css'), '.toast {', '}')).toContain('background: var(--sheet, var(--bg-elevated));');
  });
  it('함께 읽기 · 고급 가져오기는 지금 디자인의 부품 — 머리 그림 글자 없음 · 각진 면 · 선 입력칸', () => {
    const groups = read('src/views/GroupsPage.jsx');
    expect(groups).not.toContain('👥');
    expect(groups).toContain('<p className="manabi-eyebrow groups-page__eyebrow">TOGETHER / 서재</p>');
    const gcss = read('src/views/groups.css');
    expect(sliceBetween(gcss, '.groups-page .card {', '}')).toContain('border-radius: 0;');
    expect(sliceBetween(gcss, '.groups-page .group-field {', '}')).toContain('border-bottom: 1px solid var(--rule);');
    const icss = read('src/views/material-import.css');
    expect(sliceBetween(icss, '.add-page .card {', '}')).toContain('border-radius: 0;');
    expect(icss).toMatch(/\.add-page \.toggle-btn\.toggle-btn--primary[^{]*\{ background: var\(--ja\)/);
  });
});

describe('단계 3-② 기기 모드와 상관없이 같은 화면 (오너 「전부 권장대로」 2026-11-05 KST, 시안 https://claude.ai/artifact/QStowgGqxhx2CqcbktJEPP)', () => {
  it('앱 틀 밖 안내 쪽 네 곳은 셸로 감싸고 셸 CSS를 직접 부른다 — 404 선례', () => {
    for (const p of ['help', 'privacy', 'terms', 'credits']) {
      const src = read(`src/app/${p}/page.jsx`);
      expect(src, p).toContain("import '@/components/web/web-shell.css';");
      expect(src, p).toContain("import '@/components/books/reading-shell.css';");
      expect(src, p).toContain('<div className="manabi-app"><div style={{ maxWidth: 760');
    }
  });
  it('쪽 제목은 먹색 하나 — 그라데이션 · 밝은 모드 로즈는 학습 월드(data-world)에만 남는다', () => {
    const css = read('src/index.css');
    const base = sliceBetween(css, '.page-header__title {', '}');
    expect(base).toContain('color: var(--text-primary);');
    expect(base).not.toContain('gradient');
    expect(css).not.toMatch(/\[data-theme="light"\] \.page-header__title\s*\{/);
    expect(css).toContain('[data-theme="light"] .manabi-app[data-world] .page-header__title {');
    expect(read('src/components/Layout.jsx')).toContain('data-world={isWorldRoute(pathname) || undefined}');
  });
  it('도움말에 내부 용어 FSRS 항목이 없다(오너 2026-11-05 KST — 내부 용어 화면 비노출)', () => {
    expect(read('src/app/help/page.jsx')).not.toMatch(/FSRS/);
  });
});
