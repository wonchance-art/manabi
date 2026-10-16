import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
const spy = vi.hoisted(() => ({ checked: 0 }));
vi.mock('../server', async importOriginal => {
  const real = await importOriginal();
  return { ...real, checkedAsset: (...args) => { spy.checked++; return real.checkedAsset(...args); } };
});
import { verifiedAsset } from '../assetFile';
import { candidate } from '../server';

// 교재 asset 경로(PERF-TAB-003) — 발행 확인은 해시만(원고 없이), 판본은 인스턴스 재사용, 파일 해시 검증은 `판본:파일`당 한 번.
const EDITION = '7f572327dc67893e9453246c';
const read = file => fs.readFileSync(path.resolve(__dirname, '../../../..', file), 'utf8');

describe('asset 경로 조회', () => {
  it('발행 확인은 readEditionStamp, 판본은 cachedCandidate — 원고(readEdition) · 매번 검증(candidate)으로 돌아가지 않는다', () => {
    const route = read('src/app/api/books/japanese-n5/[edition]/asset/route.js');
    expect(route).toMatch(/await readEditionStamp\(db,edition\)/);
    expect(route).toMatch(/await cachedCandidate\(edition\)/);
    expect(route).not.toMatch(/\breadEdition\(/);
    expect(route).not.toMatch(/[^A-Za-z]candidate\(/);
  });
  it('공개 판본만 immutable로 보관하고, 미리보기는 no-store를 유지한다', () => {
    const route = read('src/app/api/books/japanese-n5/[edition]/asset/route.js');
    expect(route).toContain("'public, max-age=31536000, immutable'");
    expect(route).toMatch(/'Cache-Control':published\?PUBLIC_ASSET_CACHE:PREVIEW_ASSET_CACHE/);
    expect(route).toContain("PREVIEW_ASSET_CACHE='private, no-store'");
  });
});

describe('파일 해시 검증 기억(verifiedAsset)', () => {
  it('같은 판본 · 파일은 한 번만 해시하고 같은 바이트 · 형식을 돌려준다', async () => {
    const bundle = await candidate(EDITION);
    spy.checked = 0;
    const first = await verifiedAsset(bundle, 'style.css');
    const second = await verifiedAsset(bundle, 'style.css');
    expect(spy.checked).toBe(1);
    expect(second.type).toBe(first.type);
    expect(Buffer.compare(second.bytes, first.bytes)).toBe(0);
  });
  it('실패는 기억하지 않는다 — 기대 해시가 다르면 다시 검증해 거절한다', async () => {
    const bundle = await candidate(EDITION);
    const forged = { ...bundle, assets: { ...bundle.assets, 'app.js': { ...bundle.assets['app.js'], sha256: 'f'.repeat(64) } } };
    await expect(verifiedAsset(forged, 'app.js')).rejects.toMatchObject({ status: 503 });
    await expect(verifiedAsset(forged, 'app.js')).rejects.toMatchObject({ status: 503 });
    const ok = await verifiedAsset(bundle, 'app.js');
    expect(ok.type).toBe(bundle.assets['app.js'].type);
    // 맞은 뒤에도 다른 기대 해시는 기억으로 통과하지 않는다.
    await expect(verifiedAsset(forged, 'app.js')).rejects.toMatchObject({ status: 503 });
  });
});
