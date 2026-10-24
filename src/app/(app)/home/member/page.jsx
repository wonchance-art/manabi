import HomeVariant, { homeMetadata } from '@/components/learn/HomeVariant';

// 배움 · 로그인 배치 판(GUEST-STATIC-001 4단계) — 세션 쿠키(이름만)가 있으면 middleware가 /home을 여기로 넘긴다(주소창은 /home).
// 계정 데이터는 없다 — 로그인한 모든 사람이 같은 판을 받고, 칸 값은 브라우저가 채운다. 판 설명은 HomeVariant.jsx.
export const revalidate = 3600;
export const metadata = homeMetadata;
export default function Page() {
  return <HomeVariant member sc={false} />;
}
