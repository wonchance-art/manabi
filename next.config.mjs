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
};

export default nextConfig;
