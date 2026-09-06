import { createRequire } from 'node:module';

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

function mockResponse(url, claims) {
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
  return null;
}

globalThis.fetch = async (input, init) => {
  const requestURL = input instanceof Request ? input.url : String(input);
  const url = new URL(requestURL);
  if (!supabaseOrigin || url.origin !== supabaseOrigin) return originalFetch(input, init);
  return mockResponse(url, bearerClaims(input, init)) || originalFetch(input, init);
};

// Next's Edge middleware uses its own fetch function, so the Node fetch stub above cannot
// verify archive access. Intercept the same fixture-only origin at Undici's dispatcher too.
// This file is loaded only by the E2E server's NODE_OPTIONS, never by the product build.
if (supabaseOrigin) {
  const require = createRequire(import.meta.url);
  require('next/dist/compiled/@edge-runtime/primitives/fetch');
  const key = Symbol.for('undici.globalDispatcher.1');
  const original = globalThis[key];
  globalThis[key] = new Proxy(original, {
    get(target, property) {
      if (property !== 'dispatch') {
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return (options, handler) => {
        const url = new URL(options.path, options.origin);
        if (url.origin !== supabaseOrigin) return target.dispatch(options, handler);
        const headers = new Headers();
        if (Array.isArray(options.headers)) {
          for (let i = 0; i < options.headers.length; i += 2) headers.append(String(options.headers[i]), String(options.headers[i + 1]));
        } else new Headers(options.headers).forEach((value, name) => headers.append(name, value));
        const response = mockResponse(url, bearerClaims(url.href, { headers }));
        if (!response) return target.dispatch(options, handler);
        let aborted = false;
        queueMicrotask(async () => {
          try {
            handler.onConnect(() => { aborted = true; }, null);
            const body = Buffer.from(await response.arrayBuffer());
            if (aborted) return;
            handler.onHeaders(response.status, ['content-type', 'application/json', 'content-length', String(body.length)], () => {}, response.statusText);
            if (aborted) return;
            handler.onData(body);
            handler.onComplete([]);
          } catch (error) { handler.onError(error); }
        });
        return true;
      };
    },
  });
}
