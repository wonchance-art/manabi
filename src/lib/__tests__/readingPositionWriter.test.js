import { describe, it, expect, vi, afterEach } from 'vitest';
import { createPositionWriter } from '../readingPositionWriter';
import { sliceBetween } from './helpers/sliceBetween.js';
afterEach(()=>vi.useRealTimers());
describe('reading position writes',()=>{
  it('flushes the last position when leaving before the debounce interval',async()=>{
    vi.useFakeTimers();const write=vi.fn();const writer=createPositionWriter(write);
    writer.schedule(2);writer.schedule(8);await writer.close();expect(write.mock.calls).toEqual([[8]]);
    await vi.runAllTimersAsync();expect(write).toHaveBeenCalledTimes(1);
  });
  it('discards pending positions on account changes',async()=>{
    vi.useFakeTimers();const write=vi.fn();const writer=createPositionWriter(write);
    writer.schedule(5);await writer.close(false);await vi.runAllTimersAsync();expect(write).not.toHaveBeenCalled();
  });
  it('serializes a newer position after the earlier network write',async()=>{
    let finish;const order=[];const writer=createPositionWriter(async n=>{order.push(n);if(n===1)await new Promise(r=>{finish=r;});});
    writer.schedule(1);const first=writer.flush();await Promise.resolve();
    writer.schedule(9);const second=writer.flush();expect(order).toEqual([1]);finish();await first;await second;expect(order).toEqual([1,9]);await writer.close();
  });
  it('retains failed positions for an explicit retry, then clears the error',async()=>{
    const fail=new Error('offline'),errors=[];const write=vi.fn().mockRejectedValueOnce(fail).mockResolvedValueOnce();
    const writer=createPositionWriter(write,e=>errors.push(e));writer.schedule(4);await writer.flush();await writer.flush();
    expect(write.mock.calls).toEqual([[4],[4]]);expect(errors).toEqual([fail,null]);await writer.close();
  });
  it('accepts the first token and ignores invalid positions',async()=>{
    const write=vi.fn(),writer=createPositionWriter(write);writer.schedule(0);writer.schedule(-1);writer.schedule(NaN);writer.schedule(2.5);await writer.close();expect(write.mock.calls).toEqual([[0]]);
  });
  it('does not requeue a failed older write over a newer successful position',async()=>{
    let rejectFirst;const positions=[];
    const writer=createPositionWriter(async n=>{positions.push(n);if(n===1)await new Promise((_,reject)=>{rejectFirst=reject;});});
    writer.schedule(1);writer.flush();await Promise.resolve();writer.schedule(9);const next=writer.flush();
    rejectFirst(new Error('old request failed'));await next;await writer.close();expect(positions).toEqual([1,9]);
  });
});

describe('paged view keeps the token-index position (READER-PAGED-001)', async () => {
  const { readFileSync } = await import('node:fs');
  const restore = readFileSync(new URL('../useScrollRestore.js', import.meta.url), 'utf8');
  const viewer = readFileSync(new URL('../../views/ViewerPage.jsx', import.meta.url), 'utf8');
  it('restores the saved token on its page instead of scrolling, and never records vertical positions there', () => {
    expect(restore).toContain('if (pager) pager.reveal(el);');
    expect(restore).toContain("else withFullReader(el, () => el.scrollIntoView({ behavior: 'instant', block: 'center' }));"); // 스크롤 보기 — 뛰는 순간 본문 전부(VIEWER-CV-SCROLL-001)
    expect(restore).toContain('if (pagerFor(readerRef?.current)) return;');
  });
  it('saves the first token of a turned-to page through the same writer; the stored value is a token index', () => {
    const turn = sliceBetween(viewer, 'onUserPage: anchor => {', 'canSwipe:');
    expect(turn).toContain('material?.processed_json?.sequence?.indexOf(tokenId)');
    expect(turn).toContain('saveScrollPosition(index)');
    expect(viewer).toContain(".select('is_completed, last_token_idx')");
  });
});
