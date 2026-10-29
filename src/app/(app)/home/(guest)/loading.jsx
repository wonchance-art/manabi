import { GuestHomeSkeleton } from '@/components/learn/HomeSkeleton';

// 배움 대기 화면 · 손님 판(/home · /home/sc) — 쿠키를 읽지 않는다(판을 고른 것은 middleware). 골격 설명은 HomeSkeleton.jsx.
export default function Loading() {
  return <GuestHomeSkeleton />;
}
