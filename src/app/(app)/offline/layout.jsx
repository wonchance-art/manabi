import { PRIVATE_METADATA } from '@/lib/seo';

// 끊겼을 때의 대체 화면 — 검색에 싣지 않는다(LAUNCH-META-001). page.jsx는 'use client'라 메타를 낼 수 없어 이 층이 낸다(그리는 것은 그대로).
export const metadata = PRIVATE_METADATA;

export default function Layout({ children }) {
  return children;
}
