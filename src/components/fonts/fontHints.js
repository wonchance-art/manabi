import ReactDOM from 'react-dom';

// 병음 · 라틴 본문(Noto Sans)을 그리는 세그먼트만 그 라틴 조각을 미리 받는다(FONT-HINT-001, 2026-10-17 KST).
// 선언은 루트 한 벌(src/app/layout.jsx, preload: false)이다 — 여기서 다시 선언하면 @font-face가 두 벌 생겨
// 같은 바이트를 두 번 받는다(시제품 폐기 사유). 주소는 빌드가 그 한 벌의 산출 파일 이름으로 채운다
// (next.config.mjs env ← scripts/fonts/next-font-file-url.cjs). 비어 있으면(글꼴 사본 없는 next dev) 건너뛴다.
// 세그먼트 layout(서버 컴포넌트) 렌더 중에 부른다 — React가 HTML <link> · Link 헤더 · RSC 힌트로 내보내고
// href로 중복을 없앤다. next/font 자신의 preload와 같은 경로다(글꼴이면 crossOrigin은 React가 ''로 맞춘다).
// 어느 세그먼트가 거는지는 src/app/__tests__/fontHints.test.js가 지킨다.
export function preloadNotoSansLatin() {
  const href = process.env.MANABI_FONT_HINT_NOTO_SANS;
  if (href) ReactDOM.preload(href, { as: 'font', type: 'font/woff2' });
}
