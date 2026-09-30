'use client';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { libraryReaderHref, safeReaderReturn, libraryBrowseReturn, readerReturnLabel } from '@/lib/libraryReturn';

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

export function LibraryReturnLink({ children, onlyWithContext = false, ...props }) {
  const params = useSearchParams();
  const returnTo = params.get('returnTo');
  const back = safeReaderReturn(returnTo);
  if (onlyWithContext && (!returnTo || (back === '/materials' && returnTo !== '/materials'))) return null;
  const label = readerReturnLabel(back);
  return <Link {...props} href={back}>{label === '← 내 서재' ? children || label : label}</Link>;
}
