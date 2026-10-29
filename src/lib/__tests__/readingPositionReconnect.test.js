import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createPositionWriter } from '../readingPositionWriter';

// OFFLINE-SWEEP-001 — 끊긴 동안 못 쓴 읽기 위치는 연결이 돌아오면 다시 보낸다.
// 390 실측(2026-10-23 KST): 뷰어에서 끊긴 뒤 다시 연결해도 「읽기 위치를 저장하지 못했어요 · 다시 저장」이 그대로 남았다.
describe('읽기 위치 — 다시 연결되면 보류분을 보낸다', () => {
  it('실패한 위치는 보류되고, 다음 flush(연결 복귀)에 같은 위치를 보내며 오류가 걷힌다', async () => {
    let fail = true;
    const write = vi.fn(async () => { if (fail) throw new TypeError('Failed to fetch'); });
    const errors = [];
    const writer = createPositionWriter(write, error => errors.push(error ? 'error' : 'clear'), 10_000);
    writer.schedule(42);
    await writer.flush();
    expect(errors).toEqual(['error']);
    fail = false;
    await writer.flush();
    expect(write).toHaveBeenLastCalledWith(42);
    expect(errors).toEqual(['error', 'clear']);
  });

  it('뷰어 훅이 online 이벤트에 flush를 걸고 떠날 때 뗀다', () => {
    const src = fs.readFileSync('src/lib/useScrollRestore.js', 'utf8');
    expect(src).toMatch(/window\.addEventListener\('online', flush\)/);
    expect(src).toMatch(/window\.removeEventListener\('online', flush\)/);
  });
});
