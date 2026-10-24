import HomeVariant, { homeMetadata } from '@/components/learn/HomeVariant';

// 배움 · 로그인 배치 + 간체 힌트 판(GUEST-STATIC-001 4단계). 대기 화면은 로그인 판의 것(member/loading.jsx)을 같이 쓴다. 판 설명은 HomeVariant.jsx.
export const revalidate = 3600;
export const metadata = homeMetadata;
export default function Page() {
  return <HomeVariant member sc />;
}
