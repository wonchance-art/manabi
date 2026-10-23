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
