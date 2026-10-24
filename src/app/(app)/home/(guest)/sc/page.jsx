import HomeVariant, { homeMetadata } from '@/components/learn/HomeVariant';

// 배움 · 손님 + 간체 힌트 판(GUEST-STATIC-001 4단계) — 중국어 학습자 힌트 쿠키(manabi_sc=1)가 있으면 middleware가 /home을 여기로 넘긴다.
// 대기 화면은 손님 판의 것((guest)/loading.jsx)을 같이 쓴다. 판 설명은 HomeVariant.jsx.
export const revalidate = 3600;
export const metadata = homeMetadata;
export default function Page() {
  return <HomeVariant member={false} sc />;
}
