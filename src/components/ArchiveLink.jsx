import NextLink from 'next/link';

/** Legacy readers load a complete authenticated document; the current book stays in the app router. */
export default function ArchiveLink({ href, prefetch, ...props }) {
  if (typeof href === 'string' && /^\/admin\/legacy-textbooks(?:[/?#]|$)/.test(href)) {
    return <a {...props} href={href} />;
  }
  return <NextLink {...props} href={href} prefetch={prefetch} />;
}
