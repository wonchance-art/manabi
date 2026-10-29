'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { safeReaderReturn, readerReturnLabel, readerReturnTarget } from '@/lib/libraryReturn';

// 읽기 화면의 「← 돌아가기」(서재 · 공개 목록 · 산책). LibraryReaderLink.jsx에서 뺐다 — 그 파일은 서재 카드의 조기 조회 · 의도
// prefetch를 품고 있어, 교재 · 뷰어가 「←」 하나 때문에 그 그래프를 끌었다(뷰어 모듈 미리 받기 R2가 있던 때는 fontScope.test ②까지).
// guest = 확인된 손님(로그인 확인이 끝난 뒤) — 맥락 없는 「←」를 산책으로(readerReturnTarget). 회원 · 확인 중은 지금 그대로.
export function LibraryReturnLink(props) {
  const params = useSearchParams();
  return <LibraryReturnLinkTo {...props} returnTo={params.get('returnTo')} />;
}

// 맥락(returnTo)을 받아 그리는 몸통 — 주소를 읽지 않는다. 교재는 BookReader가 읽은 값을 넘긴다(표지 ISR 판은 늘 없음, GUEST-STATIC-001 4단계).
export function LibraryReturnLinkTo({ children, onlyWithContext = false, guest = false, returnTo = null, ...props }) {
  const back = safeReaderReturn(returnTo);
  if (onlyWithContext && (!returnTo || (back === '/materials' && returnTo !== '/materials'))) return null;
  const label = readerReturnLabel(back);
  // 라벨 · 맥락 판정은 back(저장 주소) 기준, 이동은 readerReturnTarget(→ readerReturnHref) — 공개 목록은 /materials를 거치지 않고
  // /discover?view=reading으로. 손님 기본 「← 산책」도 children(아이콘)을 그대로 그린다 — 보이는 그림은 바뀌지 않는다.
  const target = readerReturnTarget(returnTo, { guest });
  // 서재(/materials)로 돌아가는 「←」는 화면에 들어올 때 미리 받지 않는다 — 서재는 자체 대기 화면이 없어 auto prefetch가 라우터 상태만
  // 받는다(메뉴 「서재」 prefetch:false와 같은 이유 · webNavigation.js). 누르면 지금처럼 서재가 열린다. 다른 행선지는 지금 그대로.
  const toLibrary = /^\/materials(?:[?#]|$)/.test(target.href);
  return <Link prefetch={toLibrary ? false : undefined} {...props} href={target.href}>{target.guestDefault || label === '← 내 서재' ? children || target.label : label}</Link>;
}
