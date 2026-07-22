import { describe, expect, it } from 'vitest';
import { SYDNEY_DOORS, sydneyDoorById } from '../sydneyDoors.js';
import { HONG_KONG_DOORS, hongKongDoorById } from '../hongKongDoors.js';
import { SHANGHAI_DOORS, shanghaiDoorById } from '../shanghaiDoors.js';
import { LONDON_DOORS } from '../londonDoors.js';
import { ZH_DOORS } from '../zhDoors.js';
import { trackChapterHref } from '../cultureDoors.js';
import ENGLISH from '../../../content/english/index.js';
import CHINESE from '../../../content/chinese/index.js';

// 🚪 2호 도시 도어 세트(en-07~12·zh-07~12) — 챕터 실존·라우팅·세트 간 비중복·배선 보행성 고정.

describe('시드니·홍콩·상하이 도어 세트 계약', () => {
  const englishSlugs = new Set((ENGLISH.ALL_CHAPTERS ?? []).map((c) => c.slug));
  const chineseSlugs = new Set((CHINESE.ALL_CHAPTERS ?? []).map((c) => c.slug));

  it('id 체계 — en-07~12 / zh-07~09 / zh-10~12', () => {
    expect(SYDNEY_DOORS.map((d) => d.id)).toEqual(['en-07', 'en-08', 'en-09', 'en-10', 'en-11', 'en-12']);
    expect(HONG_KONG_DOORS.map((d) => d.id)).toEqual(['zh-07', 'zh-08', 'zh-09']);
    expect(SHANGHAI_DOORS.map((d) => d.id)).toEqual(['zh-10', 'zh-11', 'zh-12']);
  });

  it('모든 챕터가 실존하고 트랙 라우팅된다', () => {
    for (const door of SYDNEY_DOORS) {
      expect(englishSlugs.has(door.chapter), `${door.id} → ${door.chapter}`).toBe(true);
      expect(trackChapterHref('english', door.chapter)).toBe(`/english/grammar/${encodeURIComponent(door.chapter)}`);
    }
    for (const door of [...HONG_KONG_DOORS, ...SHANGHAI_DOORS]) {
      expect(chineseSlugs.has(door.chapter), `${door.id} → ${door.chapter}`).toBe(true);
      expect(trackChapterHref('chinese', door.chapter)).toBe(`/chinese/grammar/${encodeURIComponent(door.chapter)}`);
    }
  });

  it('세트 간 챕터 비중복 — 같은 트랙의 1호 세트와 겹치지 않는다', () => {
    const londonChapters = new Set(LONDON_DOORS.map((d) => d.chapter));
    for (const door of SYDNEY_DOORS) expect(londonChapters.has(door.chapter), door.id).toBe(false);
    const taipeiChapters = new Set(ZH_DOORS.map((d) => d.chapter));
    for (const door of [...HONG_KONG_DOORS, ...SHANGHAI_DOORS]) expect(taipeiChapters.has(door.chapter), door.id).toBe(false);
    // 홍콩·상하이 상호 비중복
    const hkChapters = new Set(HONG_KONG_DOORS.map((d) => d.chapter));
    for (const door of SHANGHAI_DOORS) expect(hkChapters.has(door.chapter), door.id).toBe(false);
  });

  it('2축 규격 + 문화 사실', () => {
    for (const door of SYDNEY_DOORS) {
      expect(door.culture?.length).toBeGreaterThan(0);
      for (const line of door.lines) {
        expect(line.en?.length).toBeGreaterThan(0);
        expect(line.reading?.length).toBeGreaterThan(0);
        expect(line.gloss?.length).toBeGreaterThan(0);
      }
    }
    for (const door of [...HONG_KONG_DOORS, ...SHANGHAI_DOORS]) {
      expect(door.culture?.length).toBeGreaterThan(0);
      for (const line of door.lines) {
        expect(line.zh?.length).toBeGreaterThan(0);
        expect(line.pinyin?.length).toBeGreaterThan(0);
        expect(line.reading?.length).toBeGreaterThan(0);
        expect(line.gloss?.length).toBeGreaterThan(0);
      }
    }
  });

  it('doorById — 존재/부재', () => {
    expect(sydneyDoorById('en-07')?.nameEn).toBe('Ferry wharf');
    expect(hongKongDoorById('zh-08')?.nameZh).toBe('茶餐厅');
    expect(shanghaiDoorById('zh-10')?.nameZh).toBe('小笼包店');
    expect(sydneyDoorById('en-99')).toBeNull();
  });
});

describe('도어 배선 — 보행 타일 위에 있다(시드니·홍콩·상하이)', () => {
  // 대형 geo 동적 임포트 — kyotoGeo/parisDoors 선례대로 타임아웃 확장.
  it.each([
    ['sydney', 'SYDNEY', 'en-', 6],
    ['hong-kong', 'HONG_KONG', 'zh-0', 3],
    ['shanghai', 'SHANGHAI', 'zh-1', 3],
    ['marseille', 'MARSEILLE', 'fr-', 6],
    ['kawaguchiko', 'KAWAGUCHIKO', 'ja-', 4],
    ['geneva', 'GENEVA', 'fr-1', 3],
    ['leman-riviera', 'LEMAN_RIVIERA', 'fr-1', 3],
  ])('%s 도어가 CITY_NODES에 track·chapter와 함께 배선되고 보행 가능', { timeout: 20000 }, async (file, exportName, prefix, count) => {
    const cityModule = await import(`../cities/${file}.js`);
    const { isCityWalkable } = await import('../cities/terrain.js');
    const city = cityModule[exportName];
    const grid = city.buildGrid();
    const doorNodes = city.nodes.filter((node) => node.track && node.id.startsWith(prefix));
    expect(doorNodes).toHaveLength(count);
    for (const node of doorNodes) {
      expect(node.chapter, node.id).toBeTruthy();
      const [x, y] = node.tile;
      expect(isCityWalkable(grid[y * city.cols + x]), `${node.id} @${x},${y}`).toBe(true);
    }
  });
});
