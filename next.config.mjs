import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildReleaseVersion } from './src/lib/releaseVersion.js';

// 화면별 글꼴 미리 받기 주소(FONT-HINT-001) — 이번 빌드의 글꼴 입력(NEXT_FONT_GOOGLE_MOCKED_RESPONSES)에서
// next/font 산출 파일 이름을 다시 계산한다. 쓰는 곳: src/components/fonts/fontHints.js.
const { fontHintEnv } = createRequire(import.meta.url)('./scripts/fonts/next-font-file-url.cjs');
// 간체 중국어 독립 스타일시트(SC-LINK-001 1단계) — 같은 글꼴 입력에서 public/_fonts/noto-sans-sc/에 CSS를 쓰고(글꼴은 next/font 산출 주소 그대로 — 리뷰 B1) 주소를 env로 준다.
// 글꼴 입력이 없는 실행(next dev · 테스트의 config import)은 아무것도 쓰지 않는다. 산출 대조: scripts/fonts/check-sc-stylesheet.mjs.
const { scStylesheetEnv } = createRequire(import.meta.url)('./scripts/fonts/sc-stylesheet.cjs');

const releaseVersion = {
  ...buildReleaseVersion(process.env),
  bundledEditionId: JSON.parse(readFileSync(new URL('./src/content/textbookEditions/index.json', import.meta.url))).current,
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode
  reactStrictMode: true,

  // Keep the production compiler below the 8 GB build-container limit. This changes
  // Webpack's build-time memory management, not the served content or font selection.
  experimental: { webpackMemoryOptimizations: true, webpackBuildWorker: true },

  // The source-only Vercel compiler exceeded its memory limit. Production builds
  // trade compiler cache reuse for lower retained memory;
  // keep the isolated compiler worker enabled when adding this custom config.
  webpack(config, { dev }) {
    if (!dev) config.cache = false;
    return config;
  },

  // 사전·WASM이 서버 번들에 포함되도록 — kuromoji(ja) 사전과 jieba-wasm(zh)의 .wasm.
  // (네이티브 @node-rs/jieba는 서버리스 플랫폼 바이너리 로드 실패로 WASM 교체 — 단일 파일·플랫폼 무관)
  outputFileTracingIncludes: {
    // 교재 폴더 전체(음성·PDF·글꼴)는 asset 경로만 받는다. 키는 picomatch 글롭이라 '[edition]'을 쓰면
    // 문자 집합으로 해석된다 — '*'로 쓴다. reading 경로는 자동 추적으로 bundle.json·index.html을 받는다.
    '/api/books/japanese-n5/*/asset': ['./src/content/textbookEditions/**/*'],
    '/api/books/japanese-n4/*/asset': ['./src/content/textbookEditions/**/*'],
    '/api/books/japanese-n3/*/asset': ['./src/content/textbookEditions/**/*'],
    '/api/books/japanese-n3/*/reading': ['./src/content/textbookEditions/**/bundle.json', './src/content/textbookEditions/**/index.html', './src/content/textbookEditions/japanese-n3/index.json'],
    '/api/admin/books/japanese-n3': ['./src/content/textbookEditions/**/bundle.json', './src/content/textbookEditions/japanese-n3/index.json'],
    '/books/japanese-n3': ['./src/content/textbookEditions/**/bundle.json', './src/content/textbookEditions/**/index.html', './src/content/textbookEditions/japanese-n3/index.json'],
    '/books/japanese-n3/**': ['./src/content/textbookEditions/**/bundle.json', './src/content/textbookEditions/japanese-n3/index.json'],
    '/api/books/japanese-n4/*/reading': ['./src/content/textbookEditions/**/bundle.json', './src/content/textbookEditions/**/index.html', './src/content/textbookEditions/japanese-n4/index.json'],
    '/api/admin/books/japanese-n4': ['./src/content/textbookEditions/**/bundle.json', './src/content/textbookEditions/japanese-n4/index.json'],
    '/books/japanese-n4': ['./src/content/textbookEditions/**/bundle.json', './src/content/textbookEditions/**/index.html', './src/content/textbookEditions/japanese-n4/index.json'],
    '/books/japanese-n4/**': ['./src/content/textbookEditions/**/bundle.json', './src/content/textbookEditions/japanese-n4/index.json'],
    '/api/admin/books/japanese-n5': ['./src/content/textbookEditions/**/bundle.json', './src/content/textbookEditions/index.json'],
    '/books/japanese-n5': ['./src/content/textbookEditions/**/bundle.json', './src/content/textbookEditions/**/index.html', './src/content/textbookEditions/index.json'],
    '/books/japanese-n5/**': ['./src/content/textbookEditions/**/bundle.json', './src/content/textbookEditions/index.json'],
    '/lessons': ['./src/content/textbookEditions/**/bundle.json', './src/content/textbookEditions/index.json'],
    '/home': ['./src/content/textbookEditions/**/bundle.json', './src/content/textbookEditions/index.json'],
    '/materials': ['./src/content/textbookEditions/**/bundle.json', './src/content/textbookEditions/index.json'],
    '/discover': ['./src/content/textbookEditions/**/bundle.json', './src/content/textbookEditions/index.json'],
    '/api/learning/vocabulary': ['./src/content/textbookEditions/**/bundle.json'],
    '/api/analyze': [
      './node_modules/kuromoji/dict/**/*',
      './node_modules/jieba-wasm/pkg/nodejs/**/*',
    ],
    '/api/admin/backfill-base-form': ['./node_modules/kuromoji/dict/**/*'],
  },

  // Node.js 런타임 전용 — kuromoji(사전 fs 접근)·jieba-wasm(.wasm을 fs로 로드).
  serverExternalPackages: ['kuromoji', 'kuromojin', 'jieba-wasm'],

  // 버전 배지(v2-J) — Vercel이 자동 주입하는 시스템 환경변수를 빌드 시점에 굳힌다.
  // 대시보드 설정이 필요 없어 하드리밋("Vercel env는 오너 수동")에 걸리지 않는다.
  // 여기 값은 '이 번들이 만들어진 커밋' — 요청 시점 최신 배포는 /api/version이 답한다
  // (둘을 비교해야 "내가 옛 번들을 보고 있나"(Q2)를 진단할 수 있다).
  // 커밋 메시지는 넣지 않는다(내부 문구 유출 방지 — 계약 1).
  env: {
    NEXT_PUBLIC_BUILD_SHA: releaseVersion.sha,
    NEXT_PUBLIC_BUILD_REF: releaseVersion.ref,
    NEXT_PUBLIC_BUILD_AT: releaseVersion.at,
    // Server artifact fallback for CLI deployments without runtime Git metadata.
    // /api/version stays dynamic/no-store and still checks request-time identity.
    MANABI_BUILD_IDENTITY: JSON.stringify(releaseVersion),
    ...fontHintEnv(),
    ...scStylesheetEnv(),
  },

  // 공개 서비스 기본 보안 헤더
  async headers() {
    // /embed/* 를 뺀 나머지에만 적용하는 공통 보안 헤더(프레임 정책은 각 그룹에서 따로 지정).
    const baseSecurity = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
    ];

    return [
      {
        // /embed/* 는 제외한 전역 catch-all — Next.js source는 정규식 그룹을 지원한다.
        // 앱 본편은 클릭재킹 방지를 위해 계속 SAMEORIGIN(동일 출처만 프레이밍) 유지.
        source: '/((?!embed/).*)',
        headers: [
          ...baseSecurity,
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        // 간체 중국어 독립 스타일시트(SC-LINK-001 리뷰 B2) — 파일 이름이 CSS 본문의 sha256(scripts/fonts/sc-stylesheet.cjs)이라
        // 내용이 바뀌면 이름이 바뀐다. 1년 immutable — 없으면 public 기본(max-age=0, must-revalidate)으로 렌더 차단 CSS를
        // 문서를 열 때마다 다시 확인했다(/_next/static의 next/font CSS는 원래 immutable).
        source: '/_fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // /embed/* 전용 — 게더타운 등 임의 호스트의 iframe 안에 띄워야 하므로 프레이밍을 개방한다.
        // X-Frame-Options는 넣지 않고 CSP frame-ancestors * 만 둔다.
        // (위젯은 자체 로그인 뒤에만 실제 콘텐츠가 뜨는 자기완결 구조라, 임베드를 열어줘도 클릭재킹으로 얻을 이득이 없다.)
        source: '/embed/:path*',
        headers: [
          ...baseSecurity,
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
    ];
  },
};

export default nextConfig;
