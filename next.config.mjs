/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode
  reactStrictMode: true,

  // kuromoji 사전 파일(node_modules/kuromoji/dict/*.dat.gz)이 서버 번들에 포함되도록
  outputFileTracingIncludes: {
    '/api/analyze': ['./node_modules/kuromoji/dict/**/*'],
  },

  // kuromoji는 Node.js 런타임에서만 동작
  serverExternalPackages: ['kuromoji', 'kuromojin'],

  // 공개 서비스 기본 보안 헤더
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
