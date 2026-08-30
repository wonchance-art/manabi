/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode
  reactStrictMode: true,

  // 사전·WASM이 서버 번들에 포함되도록 — kuromoji(ja) 사전과 jieba-wasm(zh)의 .wasm.
  // (네이티브 @node-rs/jieba는 서버리스 플랫폼 바이너리 로드 실패로 WASM 교체 — 단일 파일·플랫폼 무관)
  outputFileTracingIncludes: {
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
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'dev',
    NEXT_PUBLIC_BUILD_REF: process.env.VERCEL_GIT_COMMIT_REF || 'local',
    NEXT_PUBLIC_BUILD_AT: new Date().toISOString(),
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
