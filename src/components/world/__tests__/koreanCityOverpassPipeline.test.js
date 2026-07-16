import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mergeOverpassDocuments } from '../../../../scripts/merge-overpass-json.mjs';
import { overpassQueries } from '../../../../scripts/build-overpass-partition-queries.mjs';

const PARTITIONS = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/seoul-overpass-partitions.json', import.meta.url),
  'utf8',
));

describe('서울 Overpass 분할 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮는다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [126.79, 37.43, 127.18, 37.69],
      provider: 'overpass-api.de',
    });
    expect(PARTITIONS.partitions).toHaveLength(16);
    expect(new Set(PARTITIONS.partitions.map(({ id }) => id)).size).toBe(16);
    const [minLon, minLat, maxLon, maxLat] = PARTITIONS.bbox;
    const expectedArea = (maxLon - minLon) * (maxLat - minLat);
    const partitionArea = PARTITIONS.partitions.reduce((sum, { bbox }) => (
      sum + (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
    ), 0);
    expect(partitionArea).toBeCloseTo(expectedArea, 12);
    for (const { bbox } of PARTITIONS.partitions) {
      expect(bbox[0]).toBeGreaterThanOrEqual(minLon);
      expect(bbox[1]).toBeGreaterThanOrEqual(minLat);
      expect(bbox[2]).toBeLessThanOrEqual(maxLon);
      expect(bbox[3]).toBeLessThanOrEqual(maxLat);
    }
  });

  it('type:id로 중복 제거하고 가장 완전한 geometry를 결정적으로 선택한다', () => {
    const shortWay = { type: 'way', id: 9, tags: { building: 'yes' }, geometry: [{ lat: 1, lon: 1 }] };
    const longWay = { type: 'way', id: 9, tags: { building: 'yes' }, geometry: [{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }] };
    const documents = [
      { elements: [shortWay, { type: 'relation', id: 2, members: [] }] },
      { elements: [{ type: 'node', id: 5, lat: 1, lon: 1 }, longWay] },
    ];
    const first = mergeOverpassDocuments(documents);
    const second = mergeOverpassDocuments([...documents].reverse());
    expect(first).toEqual(second);
    expect(first.elements.map(({ type, id }) => `${type}:${id}`)).toEqual(['node:5', 'way:9', 'relation:2']);
    expect(first.elements[1]).toEqual(longWay);
  });

  it('산림 relation과 한국 산지 녹지 태그를 area geometry 쿼리에 포함한다', () => {
    const { areas } = overpassQueries(PARTITIONS.partitions[0].bbox);
    expect(areas).toContain('relation["landuse"~"^(grass|recreation_ground|forest)$"]');
    expect(areas).toContain('way["natural"~"^(wood|scrub|heath|grassland)$"]');
    expect(areas).toContain('relation["natural"~"^(wood|scrub|heath|grassland)$"]');
    expect(areas).toContain('way["landcover"="trees"]');
    expect(areas).toContain('relation["landcover"="trees"]');
    expect(areas).toContain('out geom;');
  });
});
