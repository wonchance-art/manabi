import HomeVariant, { homeMetadata } from '@/components/learn/HomeVariant';

// 배움 · 손님 판(GUEST-STATIC-001 4단계) — 세션 쿠키 · 간체 힌트가 없는 요청. 다른 판은 middleware가 고른다:
// /home/member(로그인 배치) · /home/sc · /home/member/sc(간체 스타일시트). 주소창은 늘 /home이다. 판 설명은 HomeVariant.jsx.
export const revalidate = 3600;
export const metadata = homeMetadata;
export default function Page() {
  return <HomeVariant member={false} sc={false} />;
}
