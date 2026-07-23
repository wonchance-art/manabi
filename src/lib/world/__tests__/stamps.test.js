import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { claimStampMilestoneRewards } from '../stampMilestones.js';
import { STAMP_ALBUM_NODES } from '../stampUniverse.js';
import {
  collectGuestStamp,
  collectStamp,
  GUEST_STAMPS_STORAGE_KEY,
  loadGuestStamps,
  loadStamps,
  parseStamps,
} from '../stamps.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// 스탬프 응답 파싱(순수부) — 네트워크 미접촉. 다양한 응답 형태를 안전하게 nodeId 배열로 접는다.
describe('parseStamps (순수)', () => {
  it('{stamps:[{nodeId,at}]} 에서 nodeId 만 추출', () => {
    const ids = parseStamps({ stamps: [{ nodeId: 'seoul', at: 'x' }, { nodeId: 'busan', at: 'y' }] });
    expect(ids).toEqual(['seoul', 'busan']);
  });

  it('문자열 배열 형태도 지원', () => {
    expect(parseStamps({ stamps: ['seoul', 'tokyo'] })).toEqual(['seoul', 'tokyo']);
  });

  it('깨진/누락 항목은 조용히 건너뛴다', () => {
    const ids = parseStamps({ stamps: [null, { at: 'no-id' }, { nodeId: 5 }, { nodeId: 'fuji' }, ''] });
    expect(ids).toEqual(['fuji']);
  });

  it('stamps 가 없거나 배열이 아니면 빈 배열', () => {
    expect(parseStamps(null)).toEqual([]);
    expect(parseStamps({})).toEqual([]);
    expect(parseStamps({ stamps: 'nope' })).toEqual([]);
    expect(parseStamps(undefined)).toEqual([]);
  });
});

describe('제품 로그인 서버 계약', () => {
  it('기존 GET/POST 요청 모양을 유지한다', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stamps: [{ nodeId: 'seoul', at: 'x' }] }),
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', request);

    await expect(loadStamps()).resolves.toEqual(['seoul']);
    await expect(collectStamp('busan')).resolves.toBe(true);
    expect(request).toHaveBeenNthCalledWith(1, '/api/world/stamps', {
      credentials: 'same-origin',
    });
    expect(request).toHaveBeenNthCalledWith(2, '/api/world/stamps', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nodeId: 'busan' }),
    });
  });
});

describe('devGuest guest-stamps 로컬 폴백', () => {
  it('수집을 누적·중복 제거하고 다시 로드한다', () => {
    const storage = memoryStorage();

    expect(collectGuestStamp('seoul', storage)).toBe(true);
    expect(collectGuestStamp('busan', storage)).toBe(true);
    expect(collectGuestStamp('seoul', storage)).toBe(true);

    expect(loadGuestStamps(storage)).toEqual(['seoul', 'busan']);
    expect(storage.getItem(GUEST_STAMPS_STORAGE_KEY)).toBe('["seoul","busan"]');
  });

  it('깨진 JSON과 유령 id를 fail-closed 처리한다', () => {
    expect(loadGuestStamps(memoryStorage({
      [GUEST_STAMPS_STORAGE_KEY]: '{broken',
    }))).toEqual([]);
    expect(loadGuestStamps(memoryStorage({
      [GUEST_STAMPS_STORAGE_KEY]: JSON.stringify([
        'ghost-node',
        'seoul',
        'seoul',
        17,
        null,
        'busan',
      ]),
    }))).toEqual(['seoul', 'busan']);

    const storage = memoryStorage({ [GUEST_STAMPS_STORAGE_KEY]: '["ghost-node"]' });
    expect(collectGuestStamp('ghost-node', storage)).toBe(false);
    expect(storage.getItem(GUEST_STAMPS_STORAGE_KEY)).toBe('["ghost-node"]');
  });

  it('게스트 로드 Set이 기존 마일스톤·보상 소비자에 그대로 연결된다', () => {
    const firstTen = STAMP_ALBUM_NODES.slice(0, 10).map(({ id }) => id);
    const storage = memoryStorage({
      [GUEST_STAMPS_STORAGE_KEY]: JSON.stringify([...firstTen, 'ghost-node']),
    });

    expect(claimStampMilestoneRewards(new Set(loadGuestStamps(storage)), storage))
      .toMatchObject({
        stampCount: 10,
        unlocked: ['stamp-10'],
        titles: ['stamp-10'],
        inventory: { 'pet-food': 1 },
      });
  });

  it('localStorage 접근·쓰기가 막혀도 빈 상태/false로 닫힌다', () => {
    const blocked = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };

    expect(loadGuestStamps(blocked)).toEqual([]);
    expect(collectGuestStamp('seoul', blocked)).toBe(false);
  });
});
