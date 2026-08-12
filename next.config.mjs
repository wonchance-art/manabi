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
