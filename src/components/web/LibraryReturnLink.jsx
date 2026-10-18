'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { safeReaderReturn, readerReturnLabel, readerReturnTarget } from '@/lib/libraryReturn';

// 읽기 화면의 「← 돌아가기」(서재 · 공개 목록 · 산책). LibraryReaderLink.jsx에서 뺐다 — 그 파일은 서재 카드의 조기 조회 · 의도
// prefetch를 품고 있어, 교재 · 뷰어가 「←」 하나 때문에 그 그래프를 끌었다(뷰어 모듈 미리 받기 R2가 있던 때는 fontScope.test ②까지).
// guest = 확인된 손님(로그인 확인이 끝난 뒤) — 맥락 없는 「←」를 산책으로(readerReturnTarget). 회원 · 확인 중은 지금 그대로.
export function LibraryReturnLink({ children, onlyWithContext = false, guest = false, ...props }) {
  const params = useSearchParams();
  const returnTo = params.get('returnTo');
  const back = safeReaderReturn(returnTo);
  if (onlyWithContext && (!returnTo || (back === '/materials' && returnTo !== '/materials'))) return null;
  const label = readerReturnLabel(back);
  // 라벨 · 맥락 판정은 back(저장 주소) 기준, 이동은 readerReturnTarget(→ readerReturnHref) — 공개 목록은 /materials를 거치지 않고
  // /discover?view=reading으로. 손님 기본 「← 산책」도 children(아이콘)을 그대로 그린다 — 보이는 그림은 바뀌지 않는다.
  const target = readerReturnTarget(returnTo, { guest });
  return <Link {...props} href={target.href}>{target.guestDefault || label === '← 내 서재' ? children || target.label : label}</Link>;
}
