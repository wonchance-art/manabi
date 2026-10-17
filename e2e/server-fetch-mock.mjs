import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { BOUNDARY_ACTORS, BOUNDARY_MARKER, BOUNDARY_MATERIAL_ID } from './fixtures/account-boundary-actors.mjs';

const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseOrigin = supabaseURL ? new URL(supabaseURL).origin : null;
const originalFetch = globalThis.fetch;

// Mirror a published release using the checked-in, hash-verified book. These rows exist
// only inside the E2E process; production publication and its database remain untouched.
const editionRoot = new URL('../src/content/textbookEditions/', import.meta.url);
const { current, reviewCandidates } = JSON.parse(readFileSync(new URL('index.json', editionRoot), 'utf8'));
const requestedFixture = process.env.E2E_PUBLISHED_EDITION;
if (requestedFixture && !reviewCandidates.includes(requestedFixture)) throw new Error('Unknown local fixture edition');
const editionId = requestedFixture || current;
const publishedFixtures = new Set([current, editionId]);
const edition = JSON.parse(readFileSync(new URL(`${editionId}/bundle.json`, editionRoot), 'utf8'));
// N4 표지 등 다른 교재는 켤 때만 발행한다(E2E_PUBLISHED_BOOKS=japanese-n4) — 기본은 지금처럼 N5만 발행돼 있다.
// 켜면 그 교재의 index.json current 판본을 같은 방식(저장소의 해시 검증된 판본 파일)으로 비춘다.
const extraBooks = new Map((process.env.E2E_PUBLISHED_BOOKS || '').split(',').map((id) => id.trim()).filter((id) => /^japanese-n[1-4]$/.test(id))
  .map((id) => [id, JSON.parse(readFileSync(new URL(`${id}/index.json`, editionRoot), 'utf8')).current]));
const bookOf = (url) => url.searchParams.get('book_id')?.replace(/^eq\./, '') || 'japanese-n5';

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

// 계정 경계 e2e(e2e/account-boundary.e2e.mjs, AUTH-ROUTER-REFRESH-001) 전용 표식 계정 두 개. 다른 e2e는 이 sub를 쓰지 않으므로
// 기존 응답은 하나도 바뀌지 않는다. A에게만 서버 렌더 표식(지난 문단 · 비공개 자료 제목)을 주고, B에게는 RLS처럼 빈 결과를 준다.
function boundaryResponse(url, claims) {
  const sub = claims?.sub;
  if (sub !== BOUNDARY_ACTORS.A && sub !== BOUNDARY_ACTORS.B) return null;
  const isA = sub === BOUNDARY_ACTORS.A;
  if (url.pathname.endsWith('/rest/v1/study_paragraphs')) {
    const at = new Date().toISOString();
    return json(isA ? [{ id: 'boundary-a-1', theme: `${BOUNDARY_MARKER} 주제`, level: 'N5', materials: {}, used_at: at, created_at: at,
      paragraph: { paragraph: `${BOUNDARY_MARKER} 문단`, translation: `${BOUNDARY_MARKER} 번역`, sentences: [{ text: `${BOUNDARY_MARKER}です。`, ko: BOUNDARY_MARKER }] } }] : []);
  }
  if (url.pathname.endsWith('/rest/v1/reading_materials') && url.searchParams.get('id') === `eq.${BOUNDARY_MATERIAL_ID}`) {
    return isA ? json({ title: `${BOUNDARY_MARKER} 제목` }) : json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 406);
  }
  return null;
}

function mockResponse(url, claims) {
  const boundary = boundaryResponse(url, claims);
  if (boundary) return boundary;
  // Archive rendering resolves published overrides on the server. Do not let that
  // request escape to the nonexistent fixture host and wait on DNS/network retries.
  if (url.pathname.endsWith('/rest/v1/content_overrides')) return json([]);
  if (url.pathname.endsWith('/rest/v1/textbook_book_releases')) {
    if (extraBooks.has(bookOf(url))) return json({ book_id: bookOf(url), edition_id: extraBooks.get(bookOf(url)), version: 1 });
    return json({ book_id: 'japanese-n5', edition_id: editionId, version: 1 });
  }
  if (url.pathname.endsWith('/rest/v1/textbook_book_editions') && extraBooks.has(bookOf(url))) {
    const book = bookOf(url), requested = url.searchParams.get('edition_id')?.replace(/^eq\./, '');
    if (requested && requested !== extraBooks.get(book)) return json(null);
    const snapshot = JSON.parse(readFileSync(new URL(`${extraBooks.get(book)}/bundle.json`, editionRoot), 'utf8'));
    return json({ book_id: book, edition_id: extraBooks.get(book), content_hash: snapshot.contentHash, manuscript: snapshot.manuscript,
      artifact_manifest: snapshot.artifactManifest, published_at: '2026-10-17T00:00:00+09:00' });
  }
  if (url.pathname.endsWith('/rest/v1/textbook_book_editions')) {
    const requested = url.searchParams.get('edition_id')?.replace(/^eq\./, '');
    if (requested && !publishedFixtures.has(requested)) return json(null);
    const selected = requested || editionId;
    const snapshot = selected === editionId ? edition : JSON.parse(readFileSync(new URL(`${selected}/bundle.json`, editionRoot), 'utf8'));
    return json({ book_id: 'japanese-n5', edition_id: selected,
      content_hash: snapshot.contentHash, manuscript: snapshot.manuscript,
      artifact_manifest: snapshot.artifactManifest, published_at: '2026-09-05T00:00:00+09:00' });
  }
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
  // 레퍼런스 어휘 fixture에는 별도 문맥 행이 없다. 회상 카드의 출처 조회도 합성 서버 안에서 끝낸다.
  if (url.pathname.endsWith('/rest/v1/vocabulary_contexts')) {
    return claims?.sub ? json([]) : json({ message: 'missing e2e identity' }, 401);
  }
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
