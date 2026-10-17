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
//   글꼴: next/font(ScFontScope)가 같은 빌드에서 내는 /_next/static/media/<hash>-s(.p).woff2 그대로(SC-LINK-001 리뷰 B1, 2026-10-17 KST)
//         — 배움 · 발견(독립 스타일시트)과 ScFontScope 세그먼트(next/font) 사이를 오가면 @font-face가 두 벌 생기는데,
//         주소가 다르면 같은 글자 조각을 두 주소에서 두 번 받는다(FONT-HINT-001이 실측으로 금지한 이중 다운로드).
//         주소가 같으면 두 벌이어도 한 번만 받는다. 이름 규칙은 next-font-file-url.cjs(nextFontUrlMap — next loader와 같은 함수).
//   CSS : /_fonts/noto-sans-sc/noto-sans-sc.<CSS 본문 sha256 앞 16자>.css — 이름이 곧 내용이라 1년 immutable(next.config headers).
// CSS 하나만 public/_fonts/noto-sans-sc/에 쓴다(빌드 산출물 — .gitignore). 산출 대조: scripts/fonts/check-sc-stylesheet.mjs.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { nextFontUrlMap } = require('./next-font-file-url.cjs');

const SC_STYLESHEET = Object.freeze({
  // src/components/fonts/ScFontScope.jsx(범위 PR) · 지금 루트의 Noto_Sans_SC({ subsets: ['latin'], weight: ['400', '500', '700'], display: 'swap' })와 같은 요청
  cssUrl: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap',
  family: 'Noto Sans SC',
  // 같은 바이트를 가리킬 next/font 선언(ScFontScope.jsx Noto_Sans_SC)의 인자 — 다르면 next 산출 이름이 달라진다(계약이 소스와 대조).
  nextFont: Object.freeze({ subsets: Object.freeze(['latin']), preload: true, adjustFontFallback: true }),
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
 * 돌려주는 것: { href, css, fonts: [next/font 산출 주소] } — 쓰지는 않는다(writeScStylesheet).
 */
function scStylesheet(responses, spec = SC_STYLESHEET) {
  const source = responses[spec.cssUrl];
  if (typeof source !== 'string') throw new Error(`글꼴 응답 모듈에 CSS가 없다: ${spec.cssUrl}`);
  const faces = fontFaces(source);
  for (const { url } of faces) if (!url.startsWith('/')) throw new Error(`글꼴 주소가 로컬 파일이 아니다: ${url}`);
  const urlMap = nextFontUrlMap(source, { family: spec.family, ...spec.nextFont });
  const blocks = faces.map(({ block, url }) => {
    const family = /font-family:\s*(['"]?)([^;'"]+)\1/.exec(block)?.[2];
    if (family !== spec.family) throw new Error(`family가 다르다: ${family} ≠ ${spec.family}`);
    const to = urlMap.get(url);
    if (!to) throw new Error(`next/font 산출 주소를 모른다: ${url}`);
    return block.replace(`url(${url})`, `url(${to})`);
  });
  if (!blocks.length) throw new Error(`@font-face가 없다: ${spec.cssUrl}`);
  const css = `/* ${spec.family} — scripts/fonts/sc-stylesheet.cjs가 글꼴 입력에서 만든 독립 스타일시트(SC-LINK-001). 글꼴은 next/font 산출 주소 그대로 */\n${blocks.join('\n')}\n`;
  return { href: `/${spec.publicDir}/noto-sans-sc.${hash16(css)}.css`, css, fonts: [...new Set(urlMap.values())] };
}

/** public 아래에 CSS를 쓴다(이미 같은 이름이 있으면 건너뜀 — 이름이 내용 해시라 같은 파일이다). 글꼴은 next/font가 낸다. */
function writeScStylesheet(result, publicRoot) {
  const cssFile = path.join(publicRoot, ...result.href.slice(1).split('/'));
  fs.mkdirSync(path.dirname(cssFile), { recursive: true });
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
