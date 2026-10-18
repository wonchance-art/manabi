'use client';

import { useLinkStatus } from 'next/link';

// 링크를 누른 뒤 다음 화면이 오기 전까지 탭 밑줄이 숨 쉬듯 깜빡인다(APP-FEEL-003, 2026-10-17 KST).
// prefetch:false 탭(배움 · 서재 — performanceRepairs P5)은 첫 클릭에 서버 응답 전까지 화면이 그대로라
// 눌렸는지 알 수 없었다(운영 실측 산책 → 서재 359ms DOM 변화 0). Next 15 useLinkStatus — 반드시 <Link> 안에 둔다.
// 100ms 안에 끝나는 이동에는 보이지 않는다(CSS animation-delay). 화면 읽기에는 숨긴다 — 경로 알림이 따로 있다.
export default function NavPendingMark() {
  const { pending } = useLinkStatus();
  return <span className="nav-pending" data-pending={pending || undefined} aria-hidden="true" />;
}
