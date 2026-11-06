import { PRIVATE_METADATA } from '@/lib/seo';

// 관리자 화면 — 검색에 싣지 않는다(LAUNCH-META-001). 접근은 middleware가 막고, 이 층은 메타만 낸다(그리는 것은 그대로).
export const metadata = PRIVATE_METADATA;

export default function Layout({ children }) {
  return children;
}
