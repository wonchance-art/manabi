'use client';
// 공통 푸터 — 이용약관 · 개인정보 처리방침 · 도움말 · 자료 출처(오너 승인 2026-11-07 KST, 목업 CrsGiHf5bS4tmQk3n2HVBx ③-1 권장 A).
// 개인정보 보호법 제30조 · 시행령 제31조: 처리방침을 홈페이지에 계속 게재 — 손님이 배움 · 서재 · 교재 어디서든 찾게 한다.
// 작성지침대로 처리방침만 먹색 · 굵게 구분한다. 몰입 화면(뷰어 · 오늘 학습 세션 · 복습 · 월드 · 수업 · 대화 · 필기 노트 · PDF)에는 두지 않는다.
// 이 부품은 별도 파일이다 — Layout.jsx · webNavigation.js는 첫 화면 한글 하위 집합의 글자 출처라(krViewerSubset),
// 여기 글자는 하위 집합 밖(일반 조각)에서 받는다. 스크롤 끝이라 첫 그림 · CLS와 무관하다.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isFocusedReadingRoute } from '@/lib/webNavigation';
import './site-footer.css';

const IMMERSIVE = /^\/(?:viewer|review|world|class|pdf|notes|admin|offline)(?:\/|$)|^\/study\/?$|^\/conversation\/new(?:\/|$)/;

export function siteFooterHidden(pathname) {
  const path = pathname || '';
  return isFocusedReadingRoute(path) || IMMERSIVE.test(path);
}

export default function SiteFooter() {
  const pathname = usePathname();
  if (siteFooterHidden(pathname)) return null;
  return (
    <footer className="site-footer"><div className="site-footer__inner">
      <nav className="site-footer__links" aria-label="사이트 정보">
        <Link href="/terms" prefetch={false}>이용약관</Link>
        <Link href="/privacy" prefetch={false} className="site-footer__privacy">개인정보 처리방침</Link>
        <Link href="/help" prefetch={false}>도움말</Link>
        <Link href="/credits" prefetch={false}>자료 출처</Link>
      </nav>
      <small className="site-footer__copy">© 2026 manabi</small>
    </div></footer>
  );
}
