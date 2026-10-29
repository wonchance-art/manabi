// 로그인 화면 공통 요청 잔손(로그인 감사 F10, 2026-10-25 KST) — 화면은 그대로.
// 출처 제목 100개 묶음을 함께 받기 · 진입 직후 받을 것 없는 링크의 화면 진입 prefetch 끄기(메뉴 prefetch:false 관례).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const links = vi.hoisted(() => []);
vi.mock('next/link', () => ({ default: (props) => { links.push(props); return null; } }));
vi.mock('../supabase', () => ({ supabase: {} }));

const { fetchMaterialTitles, MATERIAL_TITLE_BATCH } = await import('../useVocabData');
const { LibraryReturnLinkTo } = await import('../../components/web/LibraryReturnLink');
const ROOT = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('F10 출처 제목 묶음 — 함께 받되 결과는 차례 받기와 같다', () => {
  function titleClient(handler) {
    const started = [];
    return { started, from: (table) => ({ select: () => ({ in: (col, ids) => ({ abortSignal: () => { started.push(ids); return handler(ids); } }) }) }) };
  }
  it('묶음 둘을 동시에 띄우고, 묶음 순서대로 Map에 넣는다', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => String(1000 + i));
    const pending = [];
    const c = titleClient((batch) => new Promise((resolve) => pending.push(() => resolve({ data: batch.map((id) => ({ id, title: `t${id}` })), error: null }))));
    const result = fetchMaterialTitles(c, ids);
    await Promise.resolve();
    expect(c.started.map((b) => b.length)).toEqual([MATERIAL_TITLE_BATCH, 50]); // 둘째 묶음이 첫 응답을 기다리지 않는다
    pending[1](); pending[0](); // 늦게 온 첫 묶음도 순서는 그대로
    const titles = await result;
    expect([...titles.keys()]).toEqual(ids);
  });
  it('한 묶음이라도 실패하면 오류(부분 제목 없음) · 계정이 바뀌었으면 버린다', async () => {
    const fail = titleClient((batch) => Promise.resolve(batch[0] === '1100' ? { data: null, error: { message: 'boom' } } : { data: [], error: null }));
    await expect(fetchMaterialTitles(fail, Array.from({ length: 150 }, (_, i) => String(1000 + i)))).rejects.toMatchObject({ message: 'boom' });
    const ok = titleClient(() => Promise.resolve({ data: [{ id: '1', title: 'a' }], error: null }));
    await expect(fetchMaterialTitles(ok, ['1'], { current: () => false })).rejects.toThrow('fsrs_stale_account');
    expect(read('src/lib/useVocabData.js')).toContain('queryFn: ({ signal }) => fetchMaterialTitles(supabase, materialIds, { signal, current: () => actorRef.current === user.id }),');
  });
});

describe('F10 진입 직후 받을 것 없는 링크 — 화면 진입 prefetch 끄기(메뉴 prefetch:false 관례)', () => {
  it('서재 「자료 추가」(대화 칸은 서재에서 빠졌다 — CONV-CHAT-001 8차), 오늘 학습 「✕」(→ /home)', () => {
    const shelf = read('src/components/library/LibraryShelf.jsx');
    expect(shelf.match(/href=\{libraryComposerHref\(returnTo,filters\.collection\)\} prefetch=\{false\}>자료 추가<\/Link>/g)).toHaveLength(2);
    expect(read('src/views/StudySessionPage.jsx').match(/<Link href="\/home" prefetch=\{false\} aria-label="나가기"/g)).toHaveLength(2);
  });
  it('읽기 화면 「←」는 서재(/materials)로 갈 때만 끈다 — 산책 등 다른 행선지는 지금 그대로', () => {
    const render = (props) => { links.length = 0; renderToStaticMarkup(createElement(LibraryReturnLinkTo, props)); return links[0]; };
    expect(render({ returnTo: '/materials?restoreY=10' })).toMatchObject({ href: '/materials?restoreY=10', prefetch: false });
    expect(render({ returnTo: null })).toMatchObject({ href: '/materials', prefetch: false });
    expect(render({ returnTo: null, guest: true }).prefetch).toBe(undefined); // 손님 기본 「← 산책」
    expect(render({ returnTo: '/materials?tab=public' }).prefetch).toBe(undefined); // 함께 읽는 글(/discover?view=reading)
    expect(render({ returnTo: '/materials', prefetch: true }).prefetch).toBe(true); // 부르는 쪽이 정하면 그대로
  });
});
