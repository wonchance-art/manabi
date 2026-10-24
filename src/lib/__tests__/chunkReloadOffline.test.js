import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CHUNK_RELOAD_KEY, reloadOnceForChunkError, retryRouteError } from '../chunkReload';

// OFFLINE-SWEEP-001 — 끊긴 채 받지 못한 조각(ChunkLoadError)은 배포 어긋남이 아니다.
// 390 실측(2026-10-23 KST): 워커가 받아 둔 적 없는 화면을 끊긴 채 열면 오류 화면 → 지금 새로 고침(끊긴 채라 같은 실패) →
// 다시 연결돼도 오류 화면에 남고, 「다시 시도」(reset)를 눌러도 같은 오류. 홈으로를 누르거나 손으로 새로 고쳐야 했다.
function memoryStore(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}
const chunkError = () => Object.assign(new Error('Loading chunk 33067 failed.\n(error: https://manabi.example/_next/static/chunks/app/(app)/offline/page.js)'), { name: 'ChunkLoadError' });

describe('끊긴 동안의 조각 오류 — 지금 말고 연결되는 순간 한 번', () => {
  it('끊긴 동안은 새로 고치지 않고 · 한 번 기회(시각)를 쓰지 않고 · 다시 연결을 기다린다', () => {
    const storage = memoryStore();
    const reload = vi.fn();
    let reconnect = null;
    const onReconnect = vi.fn((run) => { reconnect = run; });
    expect(reloadOnceForChunkError(chunkError(), { storage, reload, online: false, onReconnect })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(storage.data).toEqual({});
    expect(onReconnect).toHaveBeenCalledTimes(1);
    reconnect();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.data[CHUNK_RELOAD_KEY]).toBeDefined();
  });

  it('연결된 동안의 조각 오류는 예전 그대로 바로 한 번(배포 어긋남)', () => {
    const storage = memoryStore();
    const reload = vi.fn();
    const onReconnect = vi.fn();
    expect(reloadOnceForChunkError(chunkError(), { storage, reload, online: true, onReconnect })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('다시 연결 뒤에도 30초 반복 금지는 그대로다', () => {
    const storage = memoryStore({ [CHUNK_RELOAD_KEY]: String(Date.now()) });
    const reload = vi.fn();
    let reconnect = null;
    reloadOnceForChunkError(chunkError(), { storage, reload, online: false, onReconnect: (run) => { reconnect = run; } });
    reconnect();
    expect(reload).not.toHaveBeenCalled();
  });

  it('조각 오류가 아니면 끊겨 있어도 기다리지 않는다', () => {
    const onReconnect = vi.fn();
    expect(reloadOnceForChunkError(new TypeError('Failed to fetch'), { storage: memoryStore(), online: false, onReconnect })).toBe(false);
    expect(onReconnect).not.toHaveBeenCalled();
  });
});

describe('「다시 시도」 — 조각 오류는 문서를 새로 받는다', () => {
  it('조각 오류: reset 대신 새로 고침', () => {
    const reset = vi.fn(), reload = vi.fn();
    retryRouteError(chunkError(), reset, { reload });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });
  it('그 밖의 오류: 예전 그대로 reset', () => {
    const reset = vi.fn(), reload = vi.fn();
    retryRouteError(new Error('자료를 찾을 수 없어요'), reset, { reload });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });
  it('모든 오류 경계(error.jsx · global-error.jsx)의 「다시 시도」가 이 길을 쓴다(reset 직결 0)', () => {
    const ROOT = process.cwd();
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return walk(p);
      return /^(global-)?error\.jsx$/.test(e.name) ? [p] : [];
    });
    const files = walk(path.join(ROOT, 'src/app'));
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src, f).toMatch(/onClick=\{\(\) => retryRouteError\(error, reset\)\}/);
      expect(src, f).not.toMatch(/onClick=\{reset\}/);
    }
  });
});
