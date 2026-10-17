'use strict';

// 화면별 글꼴 미리 받기 힌트의 주소 — next/font가 만들 파일 이름을 빌드 입력에서 다시 계산한다
// (FONT-HINT-001, 2026-10-17 KST).
//
// 왜: next/font의 `preload`는 선언과 한 몸이다. 루트에 선언하면 모든 화면이 미리 받고, 쓰는 구간에 한 번 더
// 선언하면 @font-face가 두 벌(`…-s.woff2`·`…-s.p.woff2`) 생겨 같은 바이트를 두 번 받는다(시제품 실측, 중국어
// 뷰어 교체 2.0–2.2초로 늦어짐 — 폐기). 그래서 선언은 루트 한 벌(`preload: false`)로 두고, 쓰는 세그먼트가
// 그 한 벌이 가리키는 주소 그대로 `ReactDOM.preload`만 건다(src/components/fonts/fontHints.js).
//
// 파일 이름 = `static/media/[내용 해시]-s.woff2`(next 15.5 next-font-loader emitFontFile — 해시는 바이트만 본다,
// `-s`는 대체 글꼴 크기 보정, `.p`는 preload: true에만). next/font는 `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`
// 모듈에서 CSS를 `module[cssUrl]`로 찾고 `/`로 시작하는 글꼴 주소를 파일에서 읽는다. 같은 모듈 · 같은 바이트 ·
// 같은 해시 함수를 쓰므로 배포(vendor/google-fonts 사본)와 e2e(대역 글꼴) 모두 실제 산출 파일과 일치한다.
// 해시 규칙이 바뀌는 next 업그레이드는 scripts/fonts/check-font-hints.mjs(빌드 산출 대조)가 잡는다.

const fs = require('node:fs');

/** 미리 받기 힌트를 다는 글꼴 — cssUrl은 해당 next/font 호출이 요청하는 Google CSS 주소다. */
const FONT_HINTS = Object.freeze({
  notoSans: Object.freeze({
    // src/app/layout.jsx Noto_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], display: 'swap' })
    cssUrl: 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
    subset: 'latin',
    env: 'MANABI_FONT_HINT_NOTO_SANS',
  }),
});

/** Google CSS에서 `/* <subset> *\/` 블록의 글꼴 주소(중복 제거). weight가 달라도 가변 글꼴이면 1개다. */
function subsetFontUrls(css, subset) {
  const urls = new Set();
  for (const m of css.matchAll(/\/\*\s*([^*]+?)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
    if (m[1] !== subset) continue;
    const src = /url\(([^)]+)\)/.exec(m[2]);
    if (src) urls.add(src[1]);
  }
  return [...urls];
}

/** next-font-loader와 같은 함수 · 같은 틀로 파일 이름을 만든다(`static/media/<hash>-s.woff2`). */
function nextFontMediaName(content) {
  const { interpolateName } = require('next/dist/compiled/loader-utils3');
  return interpolateName({ resourcePath: '/next-font-file-url.cjs', rootContext: '/' }, 'static/media/[hash]-s.woff2', { context: '/', content });
}

/** 응답 모듈(module[cssUrl] → CSS)에서 힌트 하나의 href(`/_next/static/media/…`)를 구한다. */
function fontHintHref(responses, { cssUrl, subset }) {
  const css = responses[cssUrl];
  if (typeof css !== 'string') throw new Error(`글꼴 응답 모듈에 CSS가 없다: ${cssUrl}`);
  const urls = subsetFontUrls(css, subset);
  if (urls.length !== 1) throw new Error(`${subset} 조각이 1개가 아니다(${urls.length}): ${cssUrl}`);
  // next는 `/`로 시작하지 않는 주소를 파일로 읽지 않는다(문자열을 바이트로 쓴다) — 그 경우는 지원하지 않는다.
  if (!urls[0].startsWith('/')) throw new Error(`글꼴 주소가 로컬 파일이 아니다: ${urls[0]}`);
  return `/_next/${nextFontMediaName(fs.readFileSync(urls[0]))}`;
}

/**
 * next.config `env`에 넣을 값. 응답 모듈이 없는 실행(네트워크로 글꼴을 받는 `next dev`)은 파일 이름을 미리 알 수
 * 없어 비운다 — 힌트만 빠지고 글꼴은 @font-face대로 받는다.
 */
function fontHintEnv(env = process.env) {
  const modulePath = env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES;
  if (!modulePath) return {};
  const responses = require(modulePath);
  return Object.fromEntries(Object.values(FONT_HINTS).map((hint) => [hint.env, fontHintHref(responses, hint)]));
}

module.exports = { FONT_HINTS, subsetFontUrls, nextFontMediaName, fontHintHref, fontHintEnv };
