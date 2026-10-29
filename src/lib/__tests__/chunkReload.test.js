import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CHUNK_RELOAD_KEY, isChunkLoadError, reloadOnceForChunkError } from '../chunkReload';

// PWA-SHELL-001 ⑧ — 새 배포 뒤 열려 있던 화면의 옛 조각 404(ChunkLoadError) → 한 번만 새로 고침.
// 재현(빌드 탐침): 첫 화면 뒤 아직 받지 않은 /_next/static 조각을 404로 두고 서재 · 대화로 이동 → 오류 화면 「인터넷 연결을 확인해 주세요」.

function memoryStore(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}
const chunkError = () => Object.assign(new Error('Loading chunk 41325 failed.\n(error: https://manabi.example/_next/static/chunks/app/x.js)'), { name: 'ChunkLoadError' });

describe('isChunkLoadError — 조각 받기 실패만 고른다', () => {
  it.each([
    [chunkError()],
    [new Error('Loading CSS chunk 2203 failed. (/_next/static/css/a.css)')],
    [new TypeError('Failed to fetch dynamically imported module: https://manabi.example/_next/static/chunks/a.js')],
    [new TypeError('Importing a module script failed.')],
    [new TypeError('error loading dynamically imported module')],
  ])('조각 실패: %s', (error) => expect(isChunkLoadError(error)).toBe(true));

  it.each([
    [new TypeError('Failed to fetch')],
    [new Error('자료를 찾을 수 없어요')],
    [null],
    [undefined],
  ])('조각 실패 아님: %s', (error) => expect(isChunkLoadError(error)).toBe(false));
});

describe('reloadOnceForChunkError — 한 번만, 반복 금지', () => {
  it('처음 만난 조각 오류는 시각을 남기고 새로 고친다', () => {
    const storage = memoryStore();
    const reload = vi.fn();
    expect(reloadOnceForChunkError(chunkError(), { storage, now: 1_000_000, reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.data[CHUNK_RELOAD_KEY]).toBe('1000000');
  });

  it('30초 안에 또 나면 새로 고치지 않는다(진짜 끊김 · 서버 이상 — 무한 새로 고침 금지)', () => {
    const storage = memoryStore({ [CHUNK_RELOAD_KEY]: '1000000' });
    const reload = vi.fn();
    expect(reloadOnceForChunkError(chunkError(), { storage, now: 1_000_000 + 29_999, reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('30초가 지난 다음 배포의 어긋남은 다시 한 번 고친다', () => {
    const storage = memoryStore({ [CHUNK_RELOAD_KEY]: '1000000' });
    const reload = vi.fn();
    expect(reloadOnceForChunkError(chunkError(), { storage, now: 1_000_000 + 30_000, reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('조각 오류가 아니면 손대지 않는다', () => {
    const storage = memoryStore();
    const reload = vi.fn();
    expect(reloadOnceForChunkError(new TypeError('Failed to fetch'), { storage, reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(storage.data).toEqual({});
  });

  it('저장소를 못 쓰면(없음 · 읽기 실패 · 쓰기 실패) 새로 고치지 않는다 — 반복을 막을 수 없으므로', () => {
    const reload = vi.fn();
    expect(reloadOnceForChunkError(chunkError(), { storage: null, reload })).toBe(false);
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => {} };
    expect(reloadOnceForChunkError(chunkError(), { storage: broken, reload })).toBe(false);
    const readOnly = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    expect(reloadOnceForChunkError(chunkError(), { storage: readOnly, reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('기기 시계가 뒤로 가 남은 시각이 미래여도 새로 고침을 영영 막지 않는다', () => {
    const storage = memoryStore({ [CHUNK_RELOAD_KEY]: '9000000' });
    const reload = vi.fn();
    expect(reloadOnceForChunkError(chunkError(), { storage, now: 1_000_000, reload })).toBe(true);
  });
});

describe('배선 — 모든 오류 경계가 조각 오류를 넘긴다', () => {
  const ROOT = process.cwd();
  const boundaries = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return boundaries(p);
    return /^(global-)?error\.jsx$/.test(e.name) ? [path.relative(ROOT, p)] : [];
  });

  it('src/app의 error.jsx · global-error.jsx 전부(새 경계도)', () => {
    const files = boundaries(path.join(ROOT, 'src/app'));
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      expect(src, f).toContain("import { reloadOnceForChunkError } from '@/lib/chunkReload';");
      expect(src, f).toMatch(/useEffect\([^]*?reloadOnceForChunkError\(error\)[^]*?\[error\]\)/);
    }
  });
});
