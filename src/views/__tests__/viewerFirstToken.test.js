import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// 뷰어 첫 단어(VIEWER-FIRST-TOKEN-001) — 게스트 직접 진입에서 첫 .word-token이 2~3s 걸렸다(운영 /viewer/45 · 49, 2026-10-17 KST).
// 임계 경로: HTML → JS 받기 · 하이드레이션(~1.5s) → 그제야 useQuery가 붙어 supabase-js 청크를 받고(+0.1s) → Supabase에 새 연결
// (TCP · TLS 389ms) + CORS 사전 요청 → 자료 GET(서버 대기 0.3~0.8s) → 그리기. 고친 두 가지를 계약으로 둔다:
//   ① 루트 레이아웃이 Supabase 출처로 preconnect(crossOrigin anonymous — supabase-js는 자격 증명 없이 보낸다)
//   ② 뷰어 모듈이 평가될 때(하이드레이션 전) 주소의 자료 조회를 먼저 띄우고, useQuery가 같은 id로 한 번만 받아 쓴다

const query = vi.hoisted(() => ({ calls: [], result: { data: { id: 45, title: '자료' }, error: null } }));
vi.mock('../../lib/supabase', () => {
  const builder = (table) => {
    const chain = {
      select: () => chain,
      eq: (column, value) => { query.calls.push([table, column, value]); return chain; },
      maybeSingle: async () => query.result,
    };
    return chain;
  };
  return { supabase: { from: builder, auth: { getSession: async () => ({ data: { session: null } }) } }, getSupabase: async () => ({}) };
});

const read = (rel) => readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('② 직접 진입 — 자료 조회를 하이드레이션 전에 띄운다', () => {
  let viewer;
  beforeEach(async () => {
    query.calls.length = 0;
    query.result = { data: { id: 45, title: '자료' }, error: null };
    viewer = await import('../ViewerPage.jsx');
    viewer.takeEarlyMaterial('__reset__'); // 다른 테스트가 띄워 둔 것을 비운다(id가 달라 넘기지 않지만 상태를 정리)
  }, 120000);

  it('주소가 /viewer/<id>면 조회를 띄우고, 같은 id로 한 번만 넘긴다(두 번째는 새로 조회)', async () => {
    const early = viewer.startEarlyMaterial('/viewer/45', 1000);
    expect(early.id).toBe('45');
    expect(query.calls).toEqual([['reading_materials', 'id', '45']]);
    expect(await viewer.takeEarlyMaterial('45', 1500)).toEqual({ id: 45, title: '자료' });
    expect(viewer.takeEarlyMaterial('45', 1600)).toBe(null);
  });

  it('다른 id · 늦은 소비 · 뷰어가 아닌 주소 · 팀 사본은 넘기지 않는다', () => {
    viewer.startEarlyMaterial('/viewer/45', 1000);
    expect(viewer.takeEarlyMaterial('49', 1100)).toBe(null); // 다른 자료 — 그대로 둔다
    expect(viewer.takeEarlyMaterial('45', 1000 + viewer.EARLY_MATERIAL_MAX_AGE_MS + 1)).toBe(null); // 오래된 응답은 버린다
    expect(viewer.startEarlyMaterial('/materials')).toBe(null);
    expect(viewer.startEarlyMaterial('/viewer/45/edit')).toBe(null);
    query.calls.length = 0;
    expect(viewer.startEarlyMaterial('/viewer/local%3A7')).toBe(null);
    expect(query.calls).toEqual([]); // 팀 사본은 네트워크 0(기기 사본만)
  });

  it('조회 오류는 useQuery가 받는다 — 띄운 쪽에서 처리되지 않은 거부로 새지 않는다', async () => {
    query.result = { data: null, error: null }; // → NOT_FOUND
    viewer.startEarlyMaterial('/viewer/999', 1000);
    await expect(viewer.takeEarlyMaterial('999', 1001)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('useQuery는 띄워 둔 조회를 먼저 받고, 없으면 전처럼 fetchMaterial로 받는다 · 모듈 평가 때 한 번 띄운다', () => {
    const source = read('src/views/ViewerPage.jsx');
    expect(source).toContain('queryFn: () => takeEarlyMaterial(id) ?? fetchMaterial(id),');
    expect(source).toContain("if (typeof window !== 'undefined') startEarlyMaterial(window.location.pathname);");
  });
});

describe('① Supabase preconnect', () => {
  it('루트 레이아웃이 Supabase 출처로 crossOrigin anonymous preconnect를 단다(잘못된 값이면 힌트만 뺀다)', () => {
    const layout = read('src/app/layout.jsx');
    expect(layout).toContain('<link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />');
    expect(layout).toMatch(/return new URL\(process\.env\.NEXT_PUBLIC_SUPABASE_URL\)\.origin;\s*\} catch \{\s*return null;/u);
  });
});
