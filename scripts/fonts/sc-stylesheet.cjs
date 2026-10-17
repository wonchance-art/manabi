'use strict';

// 간체 중국어(Noto Sans SC) 독립 스타일시트 — next/font 밖에서 만드는 SC @font-face CSS와 그 주소(SC-LINK-001 1단계,
// 2026-10-17 KST, 설계 메모 A안 · 오너 「권장대로」).
//
// 왜: next/font는 선언한 모듈을 import한 라우트의 CSS에 @font-face 303개(gz 약 95KB, 렌더 차단)를 통째로 싣는다.
// A안은 중국어를 실제로 그리는 부품이 React 19 `<link rel="stylesheet" precedence>`로 이 스타일시트를 걸게 한다 —
// 그러려면 next/font와 무관한 고정 주소의 CSS 파일 하나가 필요하다. 이 모듈이 그 CSS · 글꼴 파일 · 주소를 만든다.
//
// 입력은 next/font와 같은 글꼴 입력(NEXT_FONT_GOOGLE_MOCKED_RESPONSES — 배포는 vendor/google-fonts 사본, e2e는 대역)이고
// Google CSS 본문(가중치 · unicode-range · font-display)을 그대로 쓴다. 바뀌는 것은 글꼴 주소뿐이다:
//   글꼴: /_fonts/noto-sans-sc/<sha256 앞 16자>.woff2   (바이트가 같으면 이름이 같다 — 오래 캐시해도 안전)
//   CSS : /_fonts/noto-sans-sc/noto-sans-sc.<CSS 본문 sha256 앞 16자>.css
// 파일은 public/_fonts/noto-sans-sc/에 쓴다(빌드 산출물 — .gitignore). 산출 대조: scripts/fonts/check-sc-stylesheet.mjs.
// 1단계는 산출만 한다 — 화면에 거는 것(링크 · ScFontScope 교체)은 다음 단계다.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SC_STYLESHEET = Object.freeze({
  // src/components/fonts/ScFontScope.jsx(범위 PR) · 지금 루트의 Noto_Sans_SC({ subsets: ['latin'], weight: ['400', '500', '700'], display: 'swap' })와 같은 요청
  cssUrl: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap',
  family: 'Noto Sans SC',
  publicDir: '_fonts/noto-sans-sc',
  env: 'MANABI_SC_STYLESHEET',
});

const hash16 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);

/** Google CSS의 @font-face 블록(원문 그대로)과 그 글꼴 주소. */
function fontFaces(css) {
  const faces = [];
  for (const m of css.matchAll(/@font-face\s*\{[^}]*\}/g)) {
    const src = /url\(([^)]+)\)/.exec(m[0]);
    if (!src) throw new Error(`글꼴 주소 없는 @font-face: ${m[0].slice(0, 80)}`);
    faces.push({ block: m[0], url: src[1] });
  }
  return faces;
}

/**
 * 응답 모듈(module[cssUrl] → CSS, 글꼴 주소는 `/`로 시작하는 로컬 파일)에서 독립 스타일시트를 계산한다.
 * 돌려주는 것: { href, css, files: [{ name, from }] } — 쓰지는 않는다(writeScStylesheet).
 */
function scStylesheet(responses, spec = SC_STYLESHEET) {
  const source = responses[spec.cssUrl];
  if (typeof source !== 'string') throw new Error(`글꼴 응답 모듈에 CSS가 없다: ${spec.cssUrl}`);
  const base = `/${spec.publicDir}`;
  const files = new Map();
  const blocks = fontFaces(source).map(({ block, url }) => {
    if (!url.startsWith('/')) throw new Error(`글꼴 주소가 로컬 파일이 아니다: ${url}`);
    const name = `${hash16(fs.readFileSync(url))}.woff2`;
    files.set(name, url);
    const family = /font-family:\s*(['"]?)([^;'"]+)\1/.exec(block)?.[2];
    if (family !== spec.family) throw new Error(`family가 다르다: ${family} ≠ ${spec.family}`);
    return block.replace(`url(${url})`, `url(${base}/${name})`);
  });
  if (!blocks.length) throw new Error(`@font-face가 없다: ${spec.cssUrl}`);
  const css = `/* ${spec.family} — scripts/fonts/sc-stylesheet.cjs가 글꼴 입력에서 만든 독립 스타일시트(SC-LINK-001) */\n${blocks.join('\n')}\n`;
  return { href: `${base}/noto-sans-sc.${hash16(css)}.css`, css, files: [...files].map(([name, from]) => ({ name, from })) };
}

/** public 아래에 CSS · 글꼴을 쓴다(이미 같은 이름이 있으면 건너뜀 — 이름이 내용 해시라 같은 파일이다). */
function writeScStylesheet(result, publicRoot) {
  const dir = path.join(publicRoot, ...SC_STYLESHEET.publicDir.split('/'));
  fs.mkdirSync(dir, { recursive: true });
  for (const { name, from } of result.files) {
    const to = path.join(dir, name);
    if (!fs.existsSync(to)) fs.copyFileSync(from, to);
  }
  const cssFile = path.join(publicRoot, ...result.href.slice(1).split('/'));
  if (!fs.existsSync(cssFile)) fs.writeFileSync(cssFile, result.css);
  return cssFile;
}

/**
 * next.config `env`에 넣을 값 + public 산출. 글꼴 입력이 없는 실행(네트워크로 받는 `next dev`)은 비운다 —
 * 그때는 걸 스타일시트가 없다(부르는 쪽은 없으면 걸지 않는다).
 */
function scStylesheetEnv(env = process.env, publicRoot = path.join(__dirname, '..', '..', 'public')) {
  const modulePath = env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES;
  if (!modulePath) return {};
  const result = scStylesheet(require(modulePath));
  writeScStylesheet(result, publicRoot);
  return { [SC_STYLESHEET.env]: result.href };
}

module.exports = { SC_STYLESHEET, fontFaces, scStylesheet, writeScStylesheet, scStylesheetEnv };
