'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { libraryReaderHref, safeLibraryReturn } from '@/lib/libraryReturn';

export function useLibraryReader() {
  const router = useRouter();
  const params = useSearchParams();
  const readerHref = href => libraryReaderHref(href, `/materials?${params}`);
  const openReader = (href, event) => {
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0)) return;
    event?.preventDefault();
    router.push(libraryReaderHref(href, window.location.pathname + window.location.search, window.scrollY));
  };
  return { readerHref, openReader };
}

export default function LibraryReaderLink({ href, children, ...props }) {
  const { readerHref, openReader } = useLibraryReader();
  return <Link {...props} href={readerHref(href)} onClick={event => openReader(href, event)}>{children}</Link>;
}

export function LibraryReturnLink({ children = '← 내 서재', ...props }) {
  const params = useSearchParams();
  return <Link {...props} href={safeLibraryReturn(params.get('returnTo'))}>{children}</Link>;
}
