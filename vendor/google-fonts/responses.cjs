'use strict';

// 배포 빌드의 Google Fonts 입력 — `next/font/google`이 받던 CSS·woff2를 저장소 사본에서 준다.
//
// scripts/next-build.mjs가 `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`로 이 파일을 넘긴다. next 15는 이 훅이
// 있으면 CSS를 `module[url]`로 찾고, CSS 안의 `/`로 시작하는 글꼴 주소를 파일에서 읽는다
// (`google/fetch-css-from-google-fonts.js`·`fetch-font-file.js`). 그래서 Google이 준 CSS의
// fonts.gstatic 주소만 사본의 절대 경로로 바꿔 돌려준다. 글꼴 바이트·CSS 본문은 Google 응답 그대로라
// next/font가 만드는 결과물(파일 이름 해시·@font-face·대체 글꼴 보정·preload)은 네트워크 빌드와 같다.
// e2e 빌드의 대역(e2e/fixtures/google-fonts-mock.cjs)과 달리 진짜 글꼴이다.
//
// 사본에 없는 URL(새 글꼴 호출·weight 변경)은 빌드를 멈추고 갱신 명령을 알려 준다.

const fs = require('node:fs');
const path = require('node:path');
const { GSTATIC, fontFileName, fontUrlsInCss } = require('./paths.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));

function localCss(url) {
  const name = manifest.responses[url];
  if (!name) {
    throw new Error(`vendor/google-fonts에 없는 Google Fonts 요청: ${url}\n`
      + `글꼴 호출을 추가·변경했다면 사본을 받는다: node scripts/fonts/vendor-google-fonts.mjs '${url}'`);
  }
  let css = fs.readFileSync(path.join(__dirname, 'css', name), 'utf8');
  for (const fontUrl of fontUrlsInCss(css)) {
    const file = path.join(__dirname, 'files', fontFileName(fontUrl));
    if (!fs.existsSync(file)) throw new Error(`글꼴 사본이 없다: ${file} (${fontUrl})`);
    css = css.split(`url(${fontUrl})`).join(`url(${file})`);
  }
  if (css.includes(GSTATIC)) throw new Error(`사본으로 바꾸지 못한 글꼴 주소가 남았다: ${name}`);
  return css;
}

module.exports = new Proxy({}, {
  get(_target, key) {
    if (typeof key !== 'string' || !key.startsWith('https://fonts.googleapis.com/')) return undefined;
    return localCss(key);
  },
});
