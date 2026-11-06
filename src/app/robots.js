import { ROBOTS_DISALLOW, siteUrl } from '@/lib/seo';

// robots.txt(LAUNCH-META-001) — 막을 화면 목록과 정본 주소는 lib/seo 한 곳. 예전 판은 비공개 서재(/materials)를 Allow로 두고
// 학습 · 복습 · 로그인 화면을 열어 둔 채 옛 기본 주소(anatomy-studio)의 사이트 지도를 가리켰다(운영 감사 2026-11-06 KST).
export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: [...ROBOTS_DISALLOW] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
