// GUEST-STATIC-001 — 추천 읽을거리 한 편(/api/suggestions/[id])은 공유 캐시(CDN)에 맡긴다. 그 전제는 「응답이 요청자와 무관하다」이다.
// 이 파일이 지키는 것:
//  ① 응답을 만드는 동안 쿠키 · 요청 헤더를 한 번도 읽지 않는다(읽으면 즉시 실패하는 대역으로 실제 GET을 부른다 — 소스 문자열 검사만으로는
//     한 단계 아래 모듈이 읽는 것을 놓친다).
//  ② anon 클라이언트는 세션을 저장 · 갱신하지 않는다(Set-Cookie를 실을 재료가 없다).
//  ③ 공개 캐시는 찾은 글(200)에만 — 없음(404) · 실패(503)는 no-store(막 들어온 글이 「없음」으로 굳지 않게).
//  ④ 남의 비공개 자료를 가리키는 링크는 캐시본에도 실리지 않는다(publicSuggestionTargets가 visibility=public만 남긴다).
// 페이지 쪽 정적화(/home · /discover · /lessons · /books)는 별도 결정이다 — 근거 문서: 스크래치 guest-static.md.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

const { state, createClient } = vi.hoisted(() => {
  const state = { suggestion: null, materials: [], fail: false, calls: [] };
  const createClient = vi.fn((_url, _key, options) => {
    state.options = options;
    return {
      from(table) {
        const q = { table, filters: [] };
        const chain = {
          select(fields) { q.fields = fields; return chain; },
          eq(key, value) { q.filters.push(['eq', key, value]); return chain; },
          in(key, value) { q.filters.push(['in', key, value]); return chain; },
          async maybeSingle() { state.calls.push(q); if (state.fail) return { data: null, error: { message: 'down' } }; return { data: state.suggestion, error: null }; },
          then(resolve, reject) { state.calls.push(q); return Promise.resolve({ data: state.materials, error: null }).then(resolve, reject); },
        };
        return chain;
      },
    };
  });
  return { state, createClient };
});
vi.mock('@supabase/supabase-js', () => ({ createClient }));
// 쿠키 · 헤더를 읽는 순간 실패 — 공유 캐시 응답이 요청자에 따라 달라질 재료를 갖지 않는다.
vi.mock('next/headers', () => ({
  cookies: () => { throw new Error('cookies() read in a shared-cache route'); },
  headers: () => { throw new Error('headers() read in a shared-cache route'); },
  draftMode: () => { throw new Error('draftMode() read in a shared-cache route'); },
}));
import { GET } from '@/app/api/suggestions/[id]/route';

const ID = '0f3b2c1a-1111-4222-8333-444455556666';
const call = (id = ID) => GET(new Request(`https://manabi.test/api/suggestions/${id}`, { headers: { cookie: 'sb-ref-auth-token=secret' } }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  state.suggestion = { id: ID, date: '2026-10-23', language: 'Japanese', source: 'nhk-easy', title: '공개 글', transcript: '本文', material_id: 77 };
  state.materials = [];
  state.fail = false;
  state.calls = [];
});

describe('/api/suggestions/[id] — 요청자와 무관한 응답만 공유 캐시에 맡긴다', () => {
  it('찾은 글은 public · s-maxage — 쿠키를 들고 와도 쿠키 · 헤더를 읽지 않고 Set-Cookie도 없다', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=300, stale-while-revalidate=3600');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('vary') || '').not.toMatch(/cookie/i);
  });

  it('anon 클라이언트는 세션을 저장 · 갱신하지 않는다', async () => {
    await call();
    expect(state.options?.auth).toEqual(expect.objectContaining({ persistSession: false, autoRefreshToken: false }));
  });

  it('비공개 자료를 가리키면 캐시본에서도 링크가 지워진다(공개 · 처리 완료 자료만 남는다)', async () => {
    state.materials = []; // visibility=public 조건에 걸린 행이 없다 = 남의 비공개 자료
    const hidden = await (await call()).json();
    expect(hidden.material_id).toBeNull();
    const lookup = state.calls.find(q => q.table === 'reading_materials');
    expect(lookup.filters).toContainEqual(['eq', 'visibility', 'public']);
    state.materials = [{ id: 77, status: 'completed' }];
    expect((await (await call()).json()).material_id).toBe(77);
  });

  it('없음(404) · 실패(503) · 잘못된 id는 no-store', async () => {
    state.suggestion = null;
    expect((await call()).headers.get('cache-control')).toBe('no-store');
    expect((await call('not-a-uuid')).status).toBe(404);
    expect((await call('not-a-uuid')).headers.get('cache-control')).toBe('no-store');
    state.suggestion = { id: ID }; state.fail = true;
    const failed = await call();
    expect(failed.status).toBe(503);
    expect(failed.headers.get('cache-control')).toBe('no-store');
  });

  it('소스에도 쿠키 세션 · 요청 헤더 재료가 없다(route와 그 서버 모듈)', () => {
    for (const file of ['src/app/api/suggestions/[id]/route.js', 'src/lib/server/suggestionReading.js']) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(/from\s+['"]next\/headers['"]/);
      expect(src, file).not.toMatch(/createSupabaseServerClient|requireUser|requireAdmin/);
      expect(src, file).not.toMatch(/_request\.(headers|cookies)|request\.(headers|cookies)/);
    }
  });
});
