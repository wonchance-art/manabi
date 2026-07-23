import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  CITY_BOOT_MODE,
  CITY_MANIFEST,
  createCityLoaderRegistry,
  hasCity,
  loadCitiesForBoot,
} from '../cities/manifest.js';

const fixture = (id, load) => ({
  id,
  name: id.toUpperCase(),
  cols: 2,
  rows: 3,
  viewerGroup: 'test',
  load,
});

const payload = (id) => ({
  id,
  name: id.toUpperCase(),
  cols: 2,
  rows: 3,
  buildGrid: () => new Uint8Array(6),
});

describe('경량 도시 manifest와 loader 상태 기계', () => {
  it('26개 metadata와 literal loader를 같은 순서로 고정하고 import만으로 loader를 실행하지 않는다', () => {
    expect(CITY_BOOT_MODE).toBe('lazy');
    expect(CITY_MANIFEST).toHaveLength(26);
    expect(Object.isFrozen(CITY_MANIFEST)).toBe(true);
    expect(new Set(CITY_MANIFEST.map(({ id }) => id)).size).toBe(26);
    for (const city of CITY_MANIFEST) {
      expect(city).toEqual({
        id: expect.any(String),
        name: expect.any(String),
        cols: expect.any(Number),
        rows: expect.any(Number),
        viewerGroup: expect.any(String),
      });
      expect(Object.isFrozen(city)).toBe(true);
      expect(city).not.toHaveProperty('buildGrid');
      expect(city).not.toHaveProperty('nodes');
      expect(city).not.toHaveProperty('terrain');
    }

    const source = readFileSync(new URL('../cities/manifest.js', import.meta.url), 'utf8');
    const literalImports = [...source.matchAll(/import\('(\.\/[^']+\.js)'\)/g)].map((match) => match[1]);
    expect(literalImports).toHaveLength(26);
    expect(new Set(literalImports).size).toBe(26);

    const loader = vi.fn(() => payload('idle'));
    createCityLoaderRegistry([fixture('idle', loader)]);
    expect(loader).not.toHaveBeenCalled();
  });

  it('동시 요청을 같은 Promise로 합치고 성공 payload를 재사용한다', async () => {
    let resolve;
    const loader = vi.fn(() => new Promise((done) => { resolve = done; }));
    const registry = createCityLoaderRegistry([fixture('alpha', loader)]);
    const first = registry.loadCity('alpha');
    const second = registry.loadCity('alpha');
    expect(first).toBe(second);
    await Promise.resolve();
    resolve(payload('alpha'));
    await expect(first).resolves.toMatchObject({ id: 'alpha' });
    await expect(registry.loadCity('alpha')).resolves.toBe(await first);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('unknown은 import 0회로 거부하고 실패·mismatch cache는 제거해 재시도한다', async () => {
    const unknownLoader = vi.fn();
    const unknown = createCityLoaderRegistry([fixture('known', unknownLoader)]);
    await expect(unknown.loadCity('missing')).rejects.toMatchObject({ code: 'UNKNOWN_CITY' });
    expect(unknownLoader).not.toHaveBeenCalled();

    const flakyLoader = vi.fn()
      .mockRejectedValueOnce(new Error('temporary CDN failure'))
      .mockResolvedValueOnce(payload('flaky'));
    const flaky = createCityLoaderRegistry([fixture('flaky', flakyLoader)]);
    await expect(flaky.loadCity('flaky')).rejects.toThrow('temporary CDN failure');
    await expect(flaky.loadCity('flaky')).resolves.toMatchObject({ id: 'flaky' });
    expect(flakyLoader).toHaveBeenCalledTimes(2);

    const mismatchLoader = vi.fn()
      .mockResolvedValueOnce({ ...payload('wrong'), id: 'other' })
      .mockResolvedValueOnce(payload('wrong'));
    const mismatch = createCityLoaderRegistry([fixture('wrong', mismatchLoader)]);
    await expect(mismatch.loadCity('wrong')).rejects.toMatchObject({ code: 'CITY_PAYLOAD_MISMATCH' });
    await expect(mismatch.loadCity('wrong')).resolves.toMatchObject({ id: 'wrong' });
    expect(mismatchLoader).toHaveBeenCalledTimes(2);
  });

  it('완료 순서가 뒤섞여도 loadAllCities 반환은 manifest 순서다', async () => {
    const deferred = new Map();
    const entries = ['one', 'two', 'three'].map((id) => fixture(
      id,
      () => new Promise((resolve) => deferred.set(id, resolve)),
    ));
    const registry = createCityLoaderRegistry(entries);
    const all = registry.loadAllCities();
    await Promise.resolve();
    deferred.get('three')(payload('three'));
    deferred.get('one')(payload('one'));
    deferred.get('two')(payload('two'));
    await expect(all).resolves.toEqual([
      expect.objectContaining({ id: 'one' }),
      expect.objectContaining({ id: 'two' }),
      expect.objectContaining({ id: 'three' }),
    ]);
  });

  it('lazy 일반 부팅은 0개, 저장/dev spawn은 대상 1개, eager 롤백은 전수를 요청한다', async () => {
    const loadCityFn = vi.fn(async (id) => ({ id }));
    const loadAllCitiesFn = vi.fn(async () => [{ id: 'all' }]);
    await expect(loadCitiesForBoot(null, { loadCityFn, loadAllCitiesFn })).resolves.toEqual([]);
    await expect(loadCitiesForBoot(
      { scene: 'city:geneva', x: 1, y: 2 },
      { loadCityFn, loadAllCitiesFn },
    )).resolves.toEqual([{ id: 'geneva' }]);
    await expect(loadCitiesForBoot(null, {
      mode: 'eager',
      loadCityFn,
      loadAllCitiesFn,
    })).resolves.toEqual([{ id: 'all' }]);
    expect(loadCityFn).toHaveBeenCalledTimes(1);
    expect(loadCityFn).toHaveBeenCalledWith('geneva');
    expect(loadAllCitiesFn).toHaveBeenCalledTimes(1);
    expect(hasCity('geneva')).toBe(true);
    expect(hasCity('no-such-city')).toBe(false);
  });
});
