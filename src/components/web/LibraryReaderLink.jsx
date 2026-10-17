'use client';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { libraryReaderHref, safeReaderReturn, libraryBrowseReturn, readerReturnLabel, readerReturnTarget } from '@/lib/libraryReturn';

export function useLibraryReader() {
  const router = useRouter();
  const params = useSearchParams();
  const pathname=usePathname();
  const readerHref = href => libraryReaderHref(href, libraryBrowseReturn(pathname,`?${params}`));
  const openReader = (href, event) => {
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0)) return;
    event?.preventDefault();
    router.push(libraryReaderHref(href, libraryBrowseReturn(window.location.pathname,window.location.search), window.scrollY));
  };
  return { readerHref, openReader };
}

export default function LibraryReaderLink({ href, children, ...props }) {
  const { readerHref, openReader } = useLibraryReader();
  return <Link {...props} href={readerHref(href)} onClick={event => openReader(href, event)}>{children}</Link>;
}

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
