import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 계약: PWA-SHELL-001 — 휴대폰(iOS Safari · 안드로이드 Chrome, 브라우저 탭 · 설치 앱) 앱 셸.
 * 점검 표 · 근거 · 실측: 이 PR 본문(pwa-shell-audit). 브랜드 값(이름 · 색 · 아이콘)은 brandAssets.test.js가 따로 본다.
 * 계약 = 배선 보증(ui-conventions §5). 노치 · 홈 막대 · 길게 누르기 실제 모습은 실기(iOS) 확인 몫이다.
 */

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const manifest = () => JSON.parse(read('public/manifest.webmanifest'));

describe('PWA-SHELL-001 ① manifest — 설치 앱 정체성', () => {
  it('id는 지금 계산값(start_url)과 같은 /home으로 못 박는다 — start_url을 옮겨도 이미 설치한 앱이 「다른 앱」이 되지 않게', () => {
    const m = manifest();
    // id를 처음 적을 때 지금 계산값과 다르면 설치한 사람의 앱이 갈린다(Chrome Page.getAppId 실측 recommendedId "/home").
    expect(m.id).toBe('/home');
    expect(m.start_url).toBe('/home');
  });

  it('scope는 사이트 전체 — 교재 · 서재 · 뷰어 어디로 가도 설치 앱 창 안에 남는다', () => {
    const m = manifest();
    expect(m.scope).toBe('/');
    expect(m.start_url.startsWith(m.scope)).toBe(true);
  });

  it('표시 형식 standalone · 언어 ko', () => {
    const m = manifest();
    expect(m.display).toBe('standalone');
    expect(m.lang).toBe('ko');
    expect(m.dir).toBe('ltr');
  });
});

/** src 아래 CSS 파일 전부(교재 판본 스냅숏 제외 — 별도 문서라 이 셸 밖이다). */
function cssFiles(dir = path.join(ROOT, 'src')) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'textbookEditions' ? [] : cssFiles(p);
    return e.name.endsWith('.css') ? [path.relative(ROOT, p)] : [];
  });
}

describe('PWA-SHELL-001 ② 화면 가장자리 — viewport-fit=cover와 안전 영역', () => {
  const layout = () => read('src/app/layout.jsx');
  const viewportExport = () => {
    const m = layout().match(/export const viewport = \{([^}]*)\};/);
    expect(m, 'layout.jsx에 export const viewport가 없다').not.toBeNull();
    return m[1];
  };

  it('CSS가 env(safe-area-inset-*)를 쓰는 한 viewport는 cover다 — 없으면 iOS가 그 값을 전부 0으로 돌려준다', () => {
    const users = cssFiles().filter((f) => read(f).includes('env(safe-area-inset-'));
    expect(users.length).toBeGreaterThan(0);
    expect(viewportExport()).toMatch(/viewportFit:\s*'cover'/);
  });

  it('손가락 확대를 막지 않는다(maximumScale · userScalable 금지 — 접근성)', () => {
    expect(viewportExport()).not.toMatch(/maximumScale|minimumScale|userScalable/);
    expect(layout()).not.toMatch(/user-scalable|maximum-scale/);
  });

  it('표준 mobile-web-app-capable과 iOS 옛 이름을 함께 둔다', () => {
    expect(layout()).toContain('<meta name="mobile-web-app-capable" content="yes" />');
    expect(layout()).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
  });

  it('노치 가로 화면: 셸 본문은 좌우 안쪽 여백, 위 · 아래 고정 막대는 좌우 자리를 안전 영역만큼 비킨다', () => {
    const shell = read('src/components/web/web-shell.css');
    expect(shell).toContain('.manabi-app .app-layout{padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)}');
    expect(shell).toContain('.manabi-app .gnb,.manabi-app .mobile-nav{left:env(safe-area-inset-left,0px);right:env(safe-area-inset-right,0px)}');
  });

  it('셸 최소 높이는 동적 뷰포트 — 100vh(주소창 숨긴 큰 높이)만 두면 짧은 화면도 주소창 높이만큼 스크롤된다', () => {
    expect(read('src/components/books/reading-shell.css')).toMatch(/\.manabi-app \.app-layout\{[^}]*min-height:100vh;min-height:100dvh\}/);
  });
});

describe('PWA-SHELL-001 ③ 터치 정책 — 글자 부풀리기 · 두 번 탭 확대 · 탭 하이라이트', () => {
  const css = () => read('src/index.css');
  const allCss = () => cssFiles().map(read).join('\n');

  it('글자 크기 부풀리기는 100%로 끈다(none 금지 — 사용자 글자 크기 · 확대를 막는다)', () => {
    expect(css()).toMatch(/\nhtml \{\s*-webkit-text-size-adjust: 100%;\s*text-size-adjust: 100%;\s*\}/);
    expect(css()).not.toMatch(/(^|\n)html[^{]*\{[^}]*text-size-adjust:\s*none/);
  });

  it('누르는 요소는 touch-action: manipulation — 두 번 탭 확대만 끄고 두 손가락 확대 · 스크롤은 남긴다', () => {
    expect(css()).toContain('a, button, input, select, textarea, label, summary, [role="button"] { touch-action: manipulation; }');
  });

  it('탭 하이라이트를 끄는 요소는 모두 자기 눌림(:active)이 있다 — 하단 메뉴만 예외(대기 밑줄이 반응)', () => {
    const m = css().match(/\n([^{}]*?)\{\s*-webkit-tap-highlight-color: transparent;\s*\}/);
    expect(m, '탭 하이라이트 목록 규칙을 찾지 못했다').not.toBeNull();
    const selectors = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    expect(selectors.length).toBeGreaterThan(10);
    const sheets = allCss();
    // 웹 셸의 눌림은 :is(…):active 묶음으로 적혀 있다(web-shell.css).
    const shellPressed = sheets.match(/\.manabi-app :is\(([^)]*)\):active/);
    expect(shellPressed).not.toBeNull();
    const shellGroup = shellPressed[1].split(',').map((s) => s.trim());
    for (const sel of selectors) {
      if (sel === '.mobile-nav__link') continue;
      if (sel.startsWith('.manabi-app ')) {
        expect(shellGroup, `${sel}의 눌림이 web-shell 묶음에 없다`).toContain(sel.slice('.manabi-app '.length));
        continue;
      }
      const escaped = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(sheets, `${sel}에 :active 규칙이 없다`).toMatch(new RegExp(`${escaped}(:not\\([^)]*\\))?:active`));
    }
  });

  it('안에 단추를 품은 카드에는 하이라이트 끄기를 걸지 않는다(상속돼 안쪽 단추의 유일한 반응까지 사라진다)', () => {
    const m = css().match(/\n([^{}]*?)\{\s*-webkit-tap-highlight-color: transparent;\s*\}/);
    expect(m[1]).not.toMatch(/\.lw-card\b|\.lv-entry--solo\b|\.suggestion-card\b/);
  });
});

/** CSS를 규칙 단위로 훑는다 — 각 규칙의 선택자 · 본문 · 감싼 @규칙 조건들(바깥부터). 주석은 지운다. */
function rulesOf(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const stack = [];
  let buf = '';
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === '{') {
      const head = buf.trim(); buf = '';
      if (head.startsWith('@')) { stack.push(head); continue; }
      const end = css.indexOf('}', i);
      rules.push({ selector: head, body: css.slice(i + 1, end), at: [...stack] });
      i = end;
    } else if (ch === '}') {
      stack.pop(); buf = '';
    } else if (ch === ';' && buf.trim().startsWith('@')) {
      buf = ''; // @import · @charset 같은 한 줄 @규칙
    } else {
      buf += ch;
    }
  }
  return rules;
}

describe('PWA-SHELL-001 ④ 호버 들림은 마우스 기기만', () => {
  it('규칙 훑개 자체 확인 — 감싼 @media 조건을 읽는다', () => {
    const rules = rulesOf('.a:hover{transform:scale(2)}@media (hover:hover){.b:hover{transform:translateY(-1px)}}');
    expect(rules).toEqual([
      { selector: '.a:hover', body: 'transform:scale(2)', at: [] },
      { selector: '.b:hover', body: 'transform:translateY(-1px)', at: ['@media (hover:hover)'] },
    ]);
  });

  it(':hover로 transform을 바꾸는 규칙은 모두 @media (hover: hover) 안에 있다 — 터치는 누른 뒤 :hover가 남아 들린 채 굳는다', () => {
    const leaks = [];
    for (const file of cssFiles()) {
      for (const rule of rulesOf(read(file))) {
        if (!/:hover/.test(rule.selector)) continue;
        const t = rule.body.match(/(?:^|;)\s*transform\s*:\s*([^;]+)/);
        if (!t || /^none\b/.test(t[1].trim())) continue;
        if (rule.at.some((a) => /hover\s*:\s*hover/.test(a))) continue;
        // 월드 지도(개발 동결 · 게임 팔레트 — ui-conventions §1 예외)는 핀 이름표를 터치에서도 :hover로 띄운다. 손대지 않는다.
        if (/^\.world-map-viewer__/.test(rule.selector)) continue;
        leaks.push(`${file} ${rule.selector}`);
      }
    }
    expect(leaks).toEqual([]);
  });
});

describe('PWA-SHELL-001 ⑥ 셸 바깥 바탕 = 셸 종이', () => {
  it('셸이 있는 화면의 body 바탕은 셸 --paper와 같은 값이다(OS 어둡게에서 당김 자리에 진한 띠가 비치지 않게)', () => {
    const shell = read('src/components/web/web-shell.css');
    const paper = shell.match(/\.manabi-app\{--paper:(#[0-9a-fA-F]{6})/);
    expect(paper).not.toBeNull();
    const body = shell.match(/\nbody:has\(\.manabi-app\)\{background-color:(#[0-9a-fA-F]{6})\}/);
    expect(body, 'body:has(.manabi-app) 바탕 규칙이 없다').not.toBeNull();
    expect(body[1].toLowerCase()).toBe(paper[1].toLowerCase());
  });

  it('어두운 읽기 테마의 body 규칙이 더 구체적이라 그대로 이긴다', () => {
    // body:has(.manabi-app) = (0,1,1) < body:has(.viewer-layout[data-reader-theme="dark"]) = (0,2,1)
    expect(read('src/components/viewer/reader-controls.css')).toMatch(/body:has\(\.viewer-layout\[data-reader-theme="dark"\]\),\s*\n\.manabi-app:has\(\.viewer-layout\[data-reader-theme="dark"\]\) \{background:var\(--reader-paper\)/);
  });
});

describe('PWA-SHELL-001 ⑦ 고정 막대는 안전 영역을 진다(viewport-fit=cover의 대가)', () => {
  // 생성물(build-reading-styles.mjs)은 손대지 않는다 — 그 음성 막대는 reading-shell.css가 덮는다(아래 마지막 검사).
  const GENERATED = new Set(['src/components/books/reading-manuscript.css']);
  /** 좌우 끝에 붙어도 안전 영역을 직접 지지 않는 이유가 있는 것만. 새 막대는 여기 넣지 말고 안전 영역을 진다. */
  const EDGE_EXEMPT = {
    '.gnb': 'web-shell.css의 .manabi-app .gnb 규칙이 좌우 자리를 비킨다(②)',
    '.mobile-nav': '같은 규칙(②)',
    '.lw-scrim': '바탕만 칠하는 어둠막 — 글자가 없다',
    '.pdf-detail-overlay': '투명 클릭 받이 — 그리는 것이 없다',
    '.manabi-app.hz-portal': '투명 그릇(pointer-events:none) — 안쪽 .hz-overlay가 진다',
    '.viewer-progress-bar': '2px 진행선 — 글자가 없다',
    '.viewer-workspace-boundary[data-active="true"]': '판서 HUD(teaching-board.css)가 안전 영역을 직접 진다 — 그릇까지 지면 두 번 들어간다',
    '.personal-note': '같은 판서 HUD를 품는다',
    '.shelf-dialog': '폭 상한 가운데 대화 상자(margin:auto · width:min(520px,…)) — 가장자리에 닿지 않는다',
    '.note-recognition': '폭 상한 가운데 대화 상자(width:min(620px,…))',
  };
  const BOTTOM_EXEMPT = {
    '.lw-pop': '누른 단어 자리에 띄우는 말풍선 — 좌표를 스크립트가 정한다',
    '.pdf-detail-popup': '같은 말풍선',
  };

  const sides = (body) => {
    const v = (k) => (body.match(new RegExp(`(?:^|;)\\s*${k}\\s*:\\s*([^;]+)`)) || [])[1]?.trim();
    const inset = v('inset');
    let [top, right, bottom, left] = [v('top'), v('right'), v('bottom'), v('left')];
    if (inset) {
      const p = inset.split(/\s+(?![^(]*\))/);
      const [t, r = t, b = t, l = r] = p;
      top ??= t; right ??= r; bottom ??= b; left ??= l;
    }
    return { top, right, bottom, left };
  };
  const zero = (x) => x !== undefined && /^0(px)?$/.test(x);
  const set = (x) => x !== undefined && x !== 'auto';

  const fixedRules = () => cssFiles().filter((f) => !GENERATED.has(f)).flatMap((file) =>
    rulesOf(read(file)).filter((r) => /position\s*:\s*fixed/.test(r.body)).map((r) => ({ file, ...r, s: sides(r.body) })));

  it('훑개가 inset 줄임말을 읽는다', () => {
    expect(sides('inset:0')).toEqual({ top: '0', right: '0', bottom: '0', left: '0' });
    expect(sides('inset:auto 12px max(8px,env(safe-area-inset-bottom))')).toEqual({ top: 'auto', right: '12px', bottom: 'max(8px,env(safe-area-inset-bottom))', left: '12px' });
  });

  it('좌우 끝(left:0 · right:0 · inset:0)에 붙은 고정 요소는 좌우 안전 영역을 진다(안쪽 여백이든 자리든)', () => {
    const missing = fixedRules()
      .filter((r) => zero(r.s.left) && zero(r.s.right))
      .filter((r) => !(r.body.includes('safe-area-inset-left') && r.body.includes('safe-area-inset-right')))
      .filter((r) => !(r.selector in EDGE_EXEMPT))
      .map((r) => `${r.file} ${r.selector}`);
    expect(missing).toEqual([]);
  });

  it('아래에 붙은 고정 요소(위는 비움)는 홈 막대 자리(safe-area-inset-bottom)를 진다', () => {
    const missing = fixedRules()
      .filter((r) => set(r.s.bottom) && !set(r.s.top))
      .filter((r) => !r.body.includes('safe-area-inset-bottom'))
      .filter((r) => !(r.selector in BOTTOM_EXEMPT))
      .map((r) => `${r.file} ${r.selector}`);
    expect(missing).toEqual([]);
  });

  it('가장자리에서 24px 이하로 떠 있는 고정 막대는 그 쪽 안전 영역을 더한다(노치 가로만 비키고 세로 · 데스크톱은 그대로)', () => {
    const missing = [];
    for (const r of fixedRules()) {
      if (r.selector in BOTTOM_EXEMPT) continue;
      // 같은 파일에서 같은 선택자를 다시 적은 규칙(기존 선언을 지키고 덮는 경우)까지 본다.
      const sameSelector = rulesOf(read(r.file)).filter((o) => o.selector === r.selector).map((o) => o.body).join(';');
      for (const side of ['left', 'right']) {
        const px = r.s[side]?.match(/^(\d+(?:\.\d+)?)px$/);
        if (px && Number(px[1]) > 0 && Number(px[1]) <= 24 && !sameSelector.includes(`safe-area-inset-${side}`)) missing.push(`${r.file} ${r.selector} ${side}:${r.s[side]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('가운데(left:50%) 고정 막대의 폭 상한이 화면 폭에서 빼는 값은 좌우 안전 영역도 뺀다', () => {
    const missing = fixedRules()
      .filter((r) => r.s.left === '50%')
      .filter((r) => /(?:max-)?width\s*:\s*[^;]*calc\(100(?:vw|%) -/.test(r.body))
      .filter((r) => !(r.body.includes('safe-area-inset-left') && r.body.includes('safe-area-inset-right')))
      .map((r) => `${r.file} ${r.selector}`);
    expect(missing).toEqual([]);
  });

  it('화면 맨 아래에 붙는 sticky 막대(bottom:0)도 홈 막대 자리를 진다', () => {
    // 칸 안 스크롤에 붙는 것(화면 아래가 아님)만 사유와 함께 뺀다.
    const STICKY_EXEMPT = {
      '.board-entry-actions': '판서 팝오버 안 스크롤 칸의 아래 — 화면 아래가 아니다',
      '.hz-nextbar': '한자 겹화면 흐름 칸(.hz-flow) 안 — 칸이 아래 안전 영역 여백을 진다',
    };
    const missing = cssFiles().flatMap((file) => rulesOf(read(file))
      .filter((r) => /position\s*:\s*sticky/.test(r.body) && /(?:^|;)\s*bottom\s*:\s*0(px)?\s*(;|$)/.test(r.body))
      .filter((r) => !(r.selector in STICKY_EXEMPT))
      .filter((r) => !rulesOf(read(file)).some((o) => o.selector === r.selector && o.body.includes('safe-area-inset-bottom')))
      .map((r) => `${file} ${r.selector}`));
    expect(missing).toEqual([]);
  });

  it('예외 목록은 실제로 있는 규칙만 가리킨다(죽은 예외 금지)', () => {
    const selectors = new Set(fixedRules().map((r) => r.selector));
    for (const sel of [...Object.keys(EDGE_EXEMPT), ...Object.keys(BOTTOM_EXEMPT)]) expect(selectors, sel).toContain(sel);
  });

  it('하단 메뉴 위 토스트는 메뉴가 홈 막대만큼 커진 몫도 올라간다', () => {
    expect(read('src/index.css')).toContain('bottom: calc(var(--mobile-nav-height, 64px) + 12px + env(safe-area-inset-bottom, 0px));');
  });

  it('생성 파일의 교재 음성 막대는 reading-shell.css가 좌우 · 아래 안전 영역으로 덮는다', () => {
    expect(read('src/components/books/reading-manuscript.css')).toContain('.book-reading-content .player{position:fixed;bottom:0;left:0;right:0;');
    expect(read('src/components/books/reading-shell.css')).toContain('.manabi-app .book-reading-content .player{left:env(safe-area-inset-left,0px);right:env(safe-area-inset-right,0px);border-bottom:env(safe-area-inset-bottom,0px) solid white}');
  });
});
