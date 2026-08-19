'use strict';

// e2e 빌드 전용 Google Fonts 응답 대역(代役) — 빌드 시점 네트워크 의존을 없앤다.
//
// 왜 필요한가(2026-08-19 실측):
//   `next/font/google`은 빌드 때 패밀리별 CSS를 받아 거기 적힌 woff2를 **전부** 내려받는다.
//   `subsets: ['latin']`은 preload 여부만 정할 뿐 다운로드 대상을 줄이지 않는다
//   (next 15.5.21 `google/loader.js` — subsets는 preloadFontFile 판정에만 쓰인다).
//   이 리포의 4패밀리 실측: Inter 7 + Noto Sans KR 124 + Noto Sans JP 124 + Noto Serif KR 124
//   = **고유 폰트 파일 379개 + CSS 4개 = 빌드 1회당 383 요청 / 약 15.4MB**.
//   내부 재시도는 파일당 3회(100·200·400ms)뿐이라, 383개 중 하나가 그 사이에 못 살아나면
//   빌드 전체가 죽는다. 2026-08-17~18 CI에서 관측된 fonts.gstatic 플레이크 4회의 정체다.
//
// e2e는 글꼴 렌더링을 검증하지 않는다(선택자·텍스트 기반). 그래서 Next가 자체 테스트용으로
// 열어둔 `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` 훅으로 e2e 빌드에서만 네트워크를 걷어낸다.
// **배포(Vercel) 빌드는 손대지 않는다** — 사용자에게 가는 글꼴은 제품 그대로다.
//
// 왜 실제 woff2를 물리나:
//   대역이 없으면 Next는 폰트 본문을 URL 문자열 버퍼로 대체한다. 그러면 크롬이
//   "Failed to decode downloaded font"를 console.error로 찍고, e2e 스위트는 console.error를
//   실패로 집계한다(smoke/learning-flow 공통). 그래서 리포에 이미 있는 진짜 woff2를 물려
//   디코드가 성공하게 둔다. 라틴 글리프가 없어 브라우저가 글자별 폴백을 쓰지만,
//   e2e 관점에서는 텍스트가 정상 렌더된다.

const path = require('node:path');

// `fetch-font-file.js`는 `/`로 시작하는 경로를 fs에서 읽는다 — 절대 경로여야 한다.
const STUB_FONT = path.resolve(__dirname, '../../public/fonts/KanjiStrokeOrders-kana.woff2');

// Google이 실제로 돌려주는 라틴 서브셋 unicode-range. 값 자체가 검증되지는 않지만
// 실물과 같은 모양을 유지해 Next의 CSS 처리 경로를 그대로 태운다.
const LATIN_RANGE = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, '
  + 'U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, '
  + 'U+2215, U+FEFF, U+FFFD';

/** `family=Noto+Sans+KR:wght@400;500;700` → { family, variants:[{weight,style}] } */
function parseFamilyQuery(url) {
  const matched = /[?&]family=([^&]+)/.exec(url);
  if (!matched) return null;
  const [namePart, axesPart] = decodeURIComponent(matched[1]).split(':');
  const family = namePart.replace(/\+/g, ' ');
  if (!family) return null;
  if (!axesPart) return { family, variants: [{ weight: '400', style: 'normal' }] };

  const [keysRaw, valuesRaw = ''] = axesPart.split('@');
  const keys = keysRaw.split(',');
  const variants = valuesRaw
    .split(';')
    .filter(Boolean)
    .map((tuple) => {
      const values = tuple.split(',');
      const pick = (key) => {
        const index = keys.indexOf(key);
        return index === -1 ? undefined : values[index];
      };
      // 가변 축 요청은 `wght@100..900` 범위로 온다 — CSS 문법(`100 900`)으로 옮긴다.
      const weight = (pick('wght') || '400').replace('..', ' ');
      return { weight, style: pick('ital') === '1' ? 'italic' : 'normal' };
    });
  return { family, variants: variants.length ? variants : [{ weight: '400', style: 'normal' }] };
}

/**
 * Google CSS 응답 형태를 그대로 흉내 낸다. `find-font-files-in-css.js`가
 * 바로 윗줄 주석으로 서브셋을 판정하므로 `/* latin *\/` 줄이 반드시 앞에 와야 한다.
 */
function buildCss(url) {
  const parsed = parseFamilyQuery(url);
  if (!parsed) return undefined;
  const display = (/[?&]display=([^&]+)/.exec(url) || [, 'swap'])[1];
  return `${parsed.variants
    .map(({ weight, style }) => `/* latin */
@font-face {
  font-family: '${parsed.family}';
  font-style: ${style};
  font-weight: ${weight};
  font-display: ${display};
  src: url(${STUB_FONT}) format('woff2');
  unicode-range: ${LATIN_RANGE};
}`)
    .join('\n')}\n`;
}

// URL 문자열을 키로 조회당한다(`mockFile[url]`). 고정 표를 두면 layout의 weight 한 줄만
// 바뀌어도 "Missing mocked response"로 CI가 죽으므로, 오는 URL을 해석해 응답을 만든다.
module.exports = new Proxy(
  {},
  {
    get(_target, key) {
      if (typeof key !== 'string') return undefined;
      if (!key.startsWith('https://fonts.googleapis.com/css2?')) return undefined;
      return buildCss(key);
    },
  },
);

