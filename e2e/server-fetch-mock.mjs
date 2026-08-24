const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseOrigin = supabaseURL ? new URL(supabaseURL).origin : null;
const originalFetch = globalThis.fetch;

function bearerClaims(input, init) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }
  const token = headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function userFromClaims(claims) {
  const now = new Date().toISOString();
  const role = claims?.e2e_role === 'admin' ? 'admin' : 'learner';
  return {
    id: claims.sub,
    aud: 'authenticated',
    role: 'authenticated',
    email: `e2e-${role}@example.com`,
    email_confirmed_at: now,
    confirmed_at: now,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { display_name: role === 'admin' ? 'E2E 관리자' : 'E2E 학습자' },
    identities: [],
    created_at: now,
    updated_at: now,
  };
}

globalThis.fetch = async (input, init) => {
  const requestURL = input instanceof Request ? input.url : String(input);
  const url = new URL(requestURL);
  if (!supabaseOrigin || url.origin !== supabaseOrigin) return originalFetch(input, init);

  const claims = bearerClaims(input, init);
  if (url.pathname.endsWith('/auth/v1/user')) {
    if (!claims?.sub) return json({ message: 'invalid e2e token' }, 401);
    return json(userFromClaims(claims));
  }

  if (url.pathname.endsWith('/rest/v1/profiles')) {
    if (!claims?.sub) return json({ message: 'missing e2e identity' }, 401);
    const role = claims.e2e_role === 'admin' ? 'admin' : 'learner';
    return json({ id: claims.sub, role });
  }

  if (url.pathname.endsWith('/rest/v1/user_ref_progress')) return json([]);
  return originalFetch(input, init);
};
