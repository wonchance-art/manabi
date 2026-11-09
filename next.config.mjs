import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildReleaseVersion } from './src/lib/releaseVersion.js';
import { cspReportOnly as buildCspReportOnly } from './src/lib/cspPolicy.js';
import { htmlLimitedBotsRegex } from './src/lib/htmlBots.js';

// 화면별 글꼴 미리 받기 주소(FONT-HINT-001) — 이번 빌드의 글꼴 입력(NEXT_FONT_GOOGLE_MOCKED_RESPONSES)에서
// next/font 산출 파일 이름을 다시 계산한다. 쓰는 곳: src/components/fonts/fontHints.js.
const { fontHintEnv } = createRequire(import.meta.url)('./scripts/fonts/next-font-file-url.cjs');
// 간체 중국어 독립 스타일시트(SC-LINK-001 1단계) — 같은 글꼴 입력에서 public/_fonts/noto-sans-sc/에 CSS를 쓰고(글꼴은 next/font 산출 주소 그대로 — 리뷰 B1) 주소를 env로 준다.
// 글꼴 입력이 없는 실행(next dev · 테스트의 config import)은 아무것도 쓰지 않는다. 산출 대조: scripts/fonts/check-sc-stylesheet.mjs.
const { scStylesheetEnv, tcStylesheetEnv } = createRequire(import.meta.url)('./scripts/fonts/sc-stylesheet.cjs');

// 메타데이터를 <head>에 막고 보낼 봇 — Next 기본 목록 + Googlebot · Daumoa · kakaotalk-scrap(src/lib/htmlBots.js, LH-BASELINE-001).
const { HTML_LIMITED_BOT_UA_RE } = createRequire(import.meta.url)('next/dist/shared/lib/router/utils/html-bots.js');

const releaseVersion = {
  ...buildReleaseVersion(process.env),
  bundledEditionId: JSON.parse(readFileSync(new URL('./src/content/textbookEditions/index.json', import.meta.url))).current,
};

// 정본 문학책 장 원문 — 작품 폴더의 chapters.json만(원문 source.txt · entry.json · 대조표는 싣지 않는다).
const LITERATURE_CHAPTERS = './src/content/literature/*/*/chapters.json';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode
  reactStrictMode: true,

  // 메타데이터 blocking 대상 봇(위 htmlBots) — 사람 방문자는 그대로 흘려 받는다(첫 바이트가 메타데이터 조회를 기다리지 않는다).
  htmlLimitedBots: htmlLimitedBotsRegex(HTML_LIMITED_BOT_UA_RE.source),

  // Keep the production compiler below the 8 GB build-container limit. This changes
  // Webpack's build-time memory management, not the served content or font selection.
  experimental: { webpackMemoryOptimizations: true, webpackBuildWorker: true, serverMinification: false },

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
    // 서버 분석 작업(CANON-SERVER-ANALYSIS-001) — 분석 라우트를 같은 프로세스 안에서 부르므로 /api/analyze와 같은 사전 · wasm이 필요하다.
    // 정본 문학책 장 원문도 읽는다(아래 LITERATURE_CHAPTERS).
    '/api/cron/analysis-jobs': [
      './node_modules/kuromoji/dict/**/*',
      './node_modules/jieba-wasm/pkg/nodejs/**/*',
      LITERATURE_CHAPTERS,
    ],
    // 정본 문학책 장 원문(BUILD-OOM-001) — 번들에 싣지 않고 서버가 파일로 읽는다(src/lib/server/literatureBooks.js).
    // 문학책을 읽는 라우트에만 싣는다(/api/admin/art-books는 그림 책만 — 싣지 않는다). 계약: scripts/output-file-tracing.test.js.
    '/api/admin/literature': [LITERATURE_CHAPTERS],
    '/api/admin/analysis-jobs': [LITERATURE_CHAPTERS],
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
    ...tcStylesheetEnv(),
  },

  // 공개 서비스 기본 보안 헤더
  async headers() {
    // /embed/* 를 뺀 나머지에만 적용하는 공통 보안 헤더(프레임 정책은 각 그룹에서 따로 지정).
    const baseSecurity = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // 마이크는 같은 출처만 연다(MIC-POLICY-001, 2026-11-06 KST): microphone=()는 브라우저가 권한 창도 띄우지 않고 막아 대화 모드의 말하기
      // (ConversationThread — getUserMedia · SpeechRecognition)와 월드 음성(lib/world/voice.js)이 조용히 실패했다. 카메라 · 위치는 계속 막는다.
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), interest-cohort=()' },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
    ];

    // CSP는 보고만(Report-Only, SEC-HEADERS-001 → SEC-CSP-002 출처 허용 목록 · 2026-11-07 KST 오케스트레이터 승인 — 관측을 늘리는 일).
    // 정책 정본은 src/lib/cspPolicy.js · 근거와 단계는 docs/security-csp.md. 강제(Content-Security-Policy) 전환과 nonce 기반 엄격한 script-src는
    // 오너 결정 항목이다(정적/ISR 판 · 막힌 기능 노출). 보고는 /api/csp-report → 운영 오류 기록(csp.*)으로 모은다.
    const cspReportOnly = buildCspReportOnly(process.env);

    return [
      {
        // /embed/* 는 제외한 전역 catch-all — Next.js source는 정규식 그룹을 지원한다.
        // 앱 본편은 클릭재킹 방지를 위해 계속 SAMEORIGIN(동일 출처만 프레이밍) 유지.
        source: '/((?!embed/).*)',
        headers: [
          ...baseSecurity,
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // 다른 출처 창이 이 창을 window.opener로 붙잡지 못하게 — 우리가 연 팝업(새 탭 열기 등)과의 연결은 그대로 둔다(allow-popups).
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Reporting-Endpoints', value: 'csp="/api/csp-report"' },
          { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
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
        // 뷰어 한글 하위 집합(KR-VIEWER-SUBSET-001) — 파일 이름이 내용 sha256 앞 16자(scripts/fonts/kr-viewer-subset.py)라 1년 immutable.
        source: '/fonts/kr-viewer/:path*',
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
