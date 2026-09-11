// Keep auth returns inside the app while preserving a reader's query and anchor.
const INTERNAL_ORIGIN = 'https://manabi.invalid';

function internalPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const target = new URL(value, INTERNAL_ORIGIN);
    if (target.origin !== INTERNAL_ORIGIN || target.pathname.startsWith('//')) return null;
    return target.pathname + target.search + target.hash;
  } catch { return null; }
}

export function authReturnPath(value, fallback = '/home') {
  return internalPath(value) || internalPath(fallback) || '/home';
}

// The shared sign-in button keeps the current lesson, filters and text anchor.
// On the auth page itself, keep its existing intent instead of nesting /auth.
export function authEntryHref(value) {
  const current = new URL(authReturnPath(value), INTERNAL_ORIGIN);
  let from = current.pathname + current.search + current.hash;
  if (current.pathname === '/auth' || current.pathname.startsWith('/auth/')) {
    from = authReturnPath(current.searchParams.get('from'));
    const next = new URL(from, INTERNAL_ORIGIN);
    if (next.pathname === '/auth' || next.pathname.startsWith('/auth/')) from = '/home';
  }
  return '/auth?' + new URLSearchParams({ from });
}

// PKCE callbacks must exchange the code on the server before the lazy client
// checks for a session cookie. A code-verifier cookie is not a signed-in session.
export function authCallbackUrl(origin, next) {
  const callback = new URL('/auth/callback', origin);
  if (next !== undefined) callback.searchParams.set('next', authReturnPath(next));
  return callback.href;
}
