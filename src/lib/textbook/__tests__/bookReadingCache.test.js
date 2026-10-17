import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sliceBetween } from '../../__tests__/helpers/sliceBetween.js';

// 계약: 교재 본문 읽기 응답(/api/books/japanese-n5/[edition]/reading)의 보관 방식 (bfcache 감사 후속, 2026-10-17 KST).
// no-store 응답을 받은 교재 본문 화면은 즉시 뒤로가기(bfcache)에 못 들어갔다. 공개 판본 본문은 판본 id + unit이 주소에 든
// 고정 출력물이고 사용자별 값이 없어 「이 브라우저만 보관 · 쓸 때마다 확인」(private, no-cache) + ETag로 둔다.
// 미리보기(관리자 · 미공개 판본)와 오류는 no-store 그대로. 사용자 값이 섞이면 이 계약이 깨진다 — 그때는 응답을 나눈다.

const h = vi.hoisted(() => ({ preview: false, sections: [] }));
const BOOK = { editionId: '8a8c1c1fd452773810abaf8c', contentHash: 'c0ffee', artifactManifest: { bundleHash: 'b0b' } };
vi.mock('@/lib/server/bookReading', () => ({
  publishedReading: vi.fn(async () => ({ book: BOOK, preview: h.preview })),
  readingSections: vi.fn(async () => h.sections),
}));
const { GET } = await import('../../../app/api/books/japanese-n5/[edition]/reading/route.js');

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const call = (unit, headers = {}) => GET(new Request(`http://x/api/books/japanese-n5/${BOOK.editionId}/reading?unit=${unit}`, { headers }),
  { params: Promise.resolve({ edition: BOOK.editionId }) });

beforeEach(() => {
  h.preview = false;
  h.sections = [{ unit: 'u01', id: 'u01-start', title: '1과', html: '<p>本文</p>' }, { unit: 'u02', id: 'u02-start', title: '2과', html: '<p>次</p>' }];
});

describe('공개 판본 본문 — private, no-cache + ETag', () => {
  it('보관은 이 브라우저만 · 쓸 때마다 다시 확인 — no-store가 아니다', async () => {
    const res = await call('u01');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
    expect(res.headers.get('etag')).toBe('"c0ffee.b0b.u01"');
    expect(await res.json()).toEqual({ edition: BOOK.editionId, unit: 'u01', sections: [h.sections[0]] });
  });

  it('If-None-Match가 같으면 304(본문 없음) · 다르면 다시 보낸다 · unit마다 다른 ETag', async () => {
    const same = await call('u01', { 'if-none-match': 'W/"c0ffee.b0b.u01"' });
    expect(same.status).toBe(304);
    expect(await same.text()).toBe('');
    expect(same.headers.get('cache-control')).toBe('private, no-cache');
    expect((await call('u01', { 'if-none-match': '"old.b0b.u01"' })).status).toBe(200);
    expect((await call('u02')).headers.get('etag')).toBe('"c0ffee.b0b.u02"');
  });

  it('미리보기(미공개 판본)와 오류는 no-store 그대로 — ETag도 없다', async () => {
    h.preview = true;
    const preview = await call('u01');
    expect(preview.headers.get('cache-control')).toBe('private, no-store');
    expect(preview.headers.get('etag')).toBeNull();
    h.preview = false;
    for (const res of [await call('nope'), await call('u03')]) {
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.headers.get('cache-control')).toBe('private, no-store');
    }
  });
});

describe('응답에 사용자 값이 없다', () => {
  const route = read('src/app/api/books/japanese-n5/[edition]/reading/route.js');
  it('경로는 쿠키 · 인증 · 사용자를 읽지 않고, 본문은 판본 · unit · 장만 싣는다', () => {
    expect(route).not.toMatch(/cookies\(|headers\(\)|getUser|getSession|requireAdmin|createSupabaseServerClient|user_id|userId/);
    expect(route).toContain('const body = { edition: book.editionId, unit, sections };');
    expect(route).toContain('if (preview) return respond(body);');
  });
  it('장 목록(readingSections)은 판본 출력본에서만 만든다 — DB · 인증을 거치지 않는다', () => {
    const lib = read('src/lib/server/bookReading.js');
    const build = sliceBetween(lib, 'async function buildReadingSections(edition) {', 'export function readingCatalog');
    expect(build).toContain('const { bytes } = await verifiedReadingHtml(book);');
    expect(build).not.toMatch(/createSupabaseServerClient|requireAdmin|cookies|getUser|user/);
    // 판본 인증(미공개면 관리자)은 publishedReading이 맡고, 그 결과는 preview 하나로만 응답 방식을 가른다.
    expect(sliceBetween(lib, 'export async function publishedReading', 'const sectionsByEdition')).toContain('return { book, preview: !published };');
  });
});
