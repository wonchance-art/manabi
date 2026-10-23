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
