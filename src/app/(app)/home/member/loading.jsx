import { MemberHomeSkeleton } from '@/components/learn/HomeSkeleton';

// 배움 대기 화면 · 로그인 판(/home/member · /home/member/sc) — 쿠키를 읽지 않는다(판을 고른 것은 middleware). 골격 설명은 HomeSkeleton.jsx.
export default function Loading() {
  return <MemberHomeSkeleton />;
}
