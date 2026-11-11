import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

// DATA-CACHE-1109(2026-11-09 KST) — Data Cache → Runtime Cache 이전(Hobby, 11/29) 대비. 문법 장 ISR · 오버라이드 조회 Data Cache가 60초 주기라
// 언어 키 4개 × 분당 1회 쓰기로 월 최대 약 17만 건(Hobby 쓰기 20만)이었다. 주기는 1시간 안전망으로 늘리고, 저장 · 복원은 태그 · 경로로 바로 버린다
// (관리자 API 계약은 api/admin/chapter route.test.js — 저장 → 즉시 반영).
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

describe('오버라이드 조회 Data Cache', () => {
  it('조회 fetch는 1시간 주기 + content-overrides 태그로 캐시된다', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
    const fetch = vi.fn(async () => ({ ok: true, json: async () => [{ slug: 'a', data: { title: 't' } }] }));
    vi.stubGlobal('fetch', fetch);
    const mod = await import('../contentOverrides.js');
    expect(mod.CONTENT_OVERRIDES_TAG).toBe('content-overrides');
    const map = await mod.getOverridesForLang('Japanese');
    expect(map.get('a')).toEqual({ title: 't' });
    expect(fetch.mock.calls[0][1].next).toEqual({ revalidate: 3600, tags: ['content-overrides'] });
  });

  it.each(['japanese', 'english', 'french', 'chinese'])('%s 문법 장은 ISR 1시간(안전망) — 60초 주기로 되돌리지 않는다', (lang) => {
    const page = read(`src/app/(app)/${lang}/grammar/[slug]/page.jsx`);
    expect(page).toMatch(/^export const revalidate = 3600;$/m);
  });
});
