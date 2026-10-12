'use strict';

// vendor/google-fonts의 이름 규칙 — 저작 도구(scripts/fonts/vendor-google-fonts.mjs)와
// 빌드 입력(responses.cjs)이 같은 규칙을 쓰도록 한곳에 둔다.

const GSTATIC = 'https://fonts.gstatic.com/s/';

/** `css2?family=Noto+Sans+KR:wght@400;500;700&display=swap` → `noto-sans-kr-wght-400-500-700-swap.css` */
function cssFileName(url) {
  const query = url.slice(url.indexOf('?') + 1);
  const params = new URLSearchParams(query);
  const parts = [...params.getAll('family'), params.get('display') || ''].join('-');
  return `${parts.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.css`;
}

/** `https://fonts.gstatic.com/s/notosanskr/v39/abc.0.woff2` → `notosanskr/v39/abc.0.woff2` */
function fontFileName(fontUrl) {
  if (!fontUrl.startsWith(GSTATIC)) throw new Error(`fonts.gstatic 주소가 아니다: ${fontUrl}`);
  const rel = fontUrl.slice(GSTATIC.length);
  if (rel.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error(`잘못된 글꼴 경로: ${fontUrl}`);
  return rel;
}

/** next `google/find-font-files-in-css.js`와 같은 규칙으로 CSS의 글꼴 주소를 순서대로(중복 없이) 뽑는다. */
function fontUrlsInCss(css) {
  const urls = [];
  for (const line of css.split('\n')) {
    const url = /src: url\((.+?)\)/.exec(line)?.[1];
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

module.exports = { GSTATIC, cssFileName, fontFileName, fontUrlsInCss };
