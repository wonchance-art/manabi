import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildStrasbourgCityGeo } from '../../../../scripts/build-strasbourg-city-geo.mjs';
import { encodeTerrainRle } from '../../../../scripts/build-french-city-geo-core.mjs';
import { renderCityPng } from '../../../../scripts/world/render-city-map.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { STRASBOURG_GEO } from '../cities/strasbourg.geo.js';
import {
  CITY_TILE,
  fastTravelDestinations,
  isCityBlocked,
} from '../cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const CARDINAL = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);
const POI_SPEC = Object.freeze({
  cathedrale: Object.freeze(['Cathédrale de Strasbourg', '스트라스부르 대성당', 7.7511, 48.5818]),
  'petite-france': Object.freeze(['La Petite France', '프티트 프랑스', 7.7405, 48.5800]),
  'place-kleber': Object.freeze(['Place Kléber', '클레베르 광장', 7.7455, 48.5833]),
  'barrage-vauban': Object.freeze(['Barrage Vauban', '보방 댐 전망대', 7.7385, 48.5790]),
  'ponts-couverts': Object.freeze(['Ponts Couverts', '퐁쿠베르(중세 탑교)', 7.7395, 48.5795]),
  'parlement-europeen': Object.freeze(['Parlement européen', '유럽의회', 7.7752, 48.5977]),
  orangerie: Object.freeze(["Parc de l'Orangerie", '오랑주리 공원', 7.7690, 48.5930]),
});
const STATION_SPEC = Object.freeze({
  'gare-de-strasbourg': Object.freeze(['Gare de Strasbourg', 7.7350, 48.5850]),
});
const hash = (value) => createHash('sha256').update(value).digest('hex');

function projector() {
  const [minLon, minLat, maxLon, maxLat] = STRASBOURG_GEO.meta.bbox;
  const webMercator = (lon, lat) => ({
    x: EARTH_RADIUS * lon * DEG,
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)),
  });
  const southWest = webMercator(minLon, minLat);
  const northEast = webMercator(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return (lon, lat) => {
    const point = webMercator(lon, lat);
    return [
      ((point.x - southWest.x) * correction) / STRASBOURG_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction) / STRASBOURG_GEO.meta.metersPerTile,
    ];
  };
}

function byId(entries, id) {
  return entries.find((entry) => entry.id === id);
}

function reachableFrom(startTile) {
  const { w, h } = STRASBOURG_GEO.meta.grid;
  const seen = new Uint8Array(STRASBOURG_GEO.terrain.length);
  const queue = new Int32Array(STRASBOURG_GEO.terrain.length);
  let head = 0;
  let tail = 0;
  const start = startTile[1] * w + startTile[0];
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const index = queue[head++];
    const x = index % w;
    const y = Math.floor(index / w);
    for (const [dx, dy] of CARDINAL) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      if (seen[next] || isCityBlocked(STRASBOURG_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function horizontalWaterRuns(y) {
  const { w } = STRASBOURG_GEO.meta.grid;
  const runs = [];
  let start = -1;
  for (let x = 0; x < w; x += 1) {
    const code = STRASBOURG_GEO.terrain[y * w + x];
    const water = code === CITY_TILE.WATER || code === CITY_TILE.RIVER;
    if (water && start < 0) start = x;
    if (!water && start >= 0) {
      runs.push([start, x - 1, (x - start) * 20]);
      start = -1;
    }
  }
  if (start >= 0) runs.push([start, w - 1, (w - start) * 20]);
  return runs;
}

function railwayDistance(tile) {
  const { w, h } = STRASBOURG_GEO.meta.grid;
  for (let radius = 0; radius <= 8; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = tile[0] + dx;
        const y = tile[1] + dy;
        if (x >= 0 && y >= 0 && x < w && y < h
          && STRASBOURG_GEO.railways.mask[y * w + x]) return radius;
      }
    }
  }
  return Infinity;
}

function renderStrasbourgPng(geo) {
  return renderCityPng({
    cols: geo.meta.grid.w,
    rows: geo.meta.grid.h,
    buildGrid: () => geo.terrain,
    railways: geo.railways,
    stations: geo.stations,
    nodes: geo.pois,
    entrance: geo.entrance,
  });
}

describe('스트라스부르 상세 geo 계약', () => {
  it('확정 bbox·20m·프랑스어 schema·중앙역 입구를 고정한다', () => {
    expect(STRASBOURG_GEO.meta).toMatchObject({
      city: 'strasbourg',
      bbox: [7.70, 48.55, 7.81, 48.63],
      grid: { w: 405, h: 446 },
      metersPerTile: 20,
      projection: 'webmercator',
      aspectCorrection: 0.66144277433,
      contentLocale: 'fr',
      schema: {
        nameField: 'nameFr',
        localeSlots: 'central-lookup-expandable',
      },
      source: {
        rawOverpassSha256: 'a9601cccf2c5acfc547acfdeca9512ce02b4494ee9b6a96b65f07e6c1072ffc8',
        snapshotSha256: 'db95f62b9bd063e1c60ee768b36c3ad10ce9b46d4f25a71cf70acee00850967b',
        partitionCount: 16,
        queryCount: 48,
        license: 'ODbL 1.0',
      },
      connectivity: {
        method: 'cardinal-land-no-water-carving-v1',
        initialComponentCount: 360,
        connectedComponentCount: 1,
        collapsedSmallComponentCount: 358,
        carvedRoadTileCount: 1,
        finalComponentCount: 1,
        walkableTileCount: 144_801,
        reachedTileCount: 144_801,
      },
    });
    expect(STRASBOURG_GEO.terrain).toHaveLength(180_630);
    expect(STRASBOURG_GEO.entrance).toEqual({ x: 128, y: 250, facing: 'down' });
    expect(STRASBOURG_GEO.exitTiles).toEqual([[128, 240], [128, 241]]);
  });

  it('POI 7종·표시 전용 역 1종의 exact 명칭·좌표와 150m 이내 스냅을 보존한다', () => {
    expect(STRASBOURG_GEO.pois.map(({ id }) => id)).toEqual(Object.keys(POI_SPEC));
    expect(STRASBOURG_GEO.stations.map(({ id }) => id)).toEqual(Object.keys(STATION_SPEC));
    const project = projector();
    for (const [id, [nameFr, nameKo, lon, lat]] of Object.entries(POI_SPEC)) {
      expect(byId(STRASBOURG_GEO.pois, id)).toMatchObject({
        id, nameFr, nameKo, lon, lat, contentLocale: 'fr',
      });
    }
    for (const [id, [nameFr, lon, lat]] of Object.entries(STATION_SPEC)) {
      const entry = byId(STRASBOURG_GEO.stations, id);
      expect(entry).toMatchObject({
        id, nameFr, lon, lat, contentLocale: 'fr', displayOnly: true,
      });
      expect(railwayDistance(entry.tile), id).toBe(0);
    }
    const entries = [...STRASBOURG_GEO.pois, ...STRASBOURG_GEO.stations];
    for (const entry of entries) {
      const [expectedX, expectedY] = project(entry.lon, entry.lat);
      expect(Math.hypot(expectedX - entry.tile[0], expectedY - entry.tile[1]), entry.id)
        .toBeLessThanOrEqual(2.5);
    }
    for (let left = 0; left < entries.length; left += 1) {
      for (let right = left + 1; right < entries.length; right += 1) {
        const distance = Math.max(
          Math.abs(entries[left].tile[0] - entries[right].tile[0]),
          Math.abs(entries[left].tile[1] - entries[right].tile[1]),
        );
        expect(distance, `${entries[left].id}/${entries[right].id}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('일강 양팔·dry 그랑딜·프티트 프랑스 운하·라인강과 BRIDGE=0을 보존한다', () => {
    expect(STRASBOURG_GEO.meta.hydrology).toEqual({
      rivers: ['Ill', 'Rhine'],
      feature: 'Grande Île enclosed by Ill branches',
      sourceWaterTileCount: 13_568,
      sourceRiverTileCount: 7_471,
      finalWaterTileCount: 8_780,
      finalRiverTileCount: 6_932,
      petiteFranceAccess: {
        method: 'petite-france-cardinal-bridge-access-v1',
        carvedTileCount: 3,
      },
      barrageSnappedToWalkable: true,
      grandeIleProfile: {
        sourceRow: 260,
        finalRow: 268,
        westBranch: [141, 142],
        eastBranch: [203, 206],
        dryCenterX: 184,
        rhine: [363, 375],
        bridgeDeckNote: 'source-west-branch-at-y260-normalized-to-road',
      },
      profileGate: 'ill-grande-ile-branches-and-rhine',
    });
    const grandeIle = horizontalWaterRuns(268);
    expect(grandeIle).toContainEqual([141, 142, 40]);
    expect(grandeIle).toContainEqual([203, 206, 80]);
    expect(grandeIle).toContainEqual([363, 375, 260]);
    const centerCode = STRASBOURG_GEO.terrain[268 * STRASBOURG_GEO.meta.grid.w + 184];
    expect([CITY_TILE.WATER, CITY_TILE.RIVER]).not.toContain(centerCode);
    expect(horizontalWaterRuns(278)).toContainEqual([139, 143, 100]);
    expect(horizontalWaterRuns(278)).toContainEqual([150, 156, 140]);
    expect(STRASBOURG_GEO.terrain).not.toContain(CITY_TILE.BRIDGE);
  });

  it('모든 마커·보행 타일이 단일 4방 성분에 속한다', () => {
    const seen = reachableFrom(STRASBOURG_GEO.stations[0].tile);
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < STRASBOURG_GEO.terrain.length; index += 1) {
      if (isCityBlocked(STRASBOURG_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect({ walkable, reached }).toEqual({ walkable: 144_801, reached: 144_801 });
    for (const entry of [...STRASBOURG_GEO.pois, ...STRASBOURG_GEO.stations]) {
      expect(seen[entry.tile[1] * STRASBOURG_GEO.meta.grid.w + entry.tile[0]], entry.id)
        .toBe(1);
    }
  });

  it('단독역은 표시 전용이며 fast-travel 목적지를 만들지 않는다', () => {
    expect(STRASBOURG_GEO.stations[0]).toMatchObject({
      id: 'gare-de-strasbourg',
      line: 'Grandes lignes',
      displayOnly: true,
    });
    expect(fastTravelDestinations(STRASBOURG_GEO.stations, 'gare-de-strasbourg')).toEqual([]);
    expect(STRASBOURG_GEO.railways.tileCount).toBe(10_372);
  });

  it('지형 질량·report-only 건물·기관 외관 전용 정책을 고정한다', () => {
    const counts = {};
    for (const code of STRASBOURG_GEO.terrain) counts[code] = (counts[code] ?? 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 55_433,
      [CITY_TILE.SIDEWALK]: 70_548,
      [CITY_TILE.CROSSWALK]: 4_356,
      [CITY_TILE.PLAZA]: 2,
      [CITY_TILE.PARK]: 14_462,
      [CITY_TILE.WATER]: 8_780,
      [CITY_TILE.BUILDING]: 20_117,
      [CITY_TILE.RIVER]: 6_932,
    });
    expect(STRASBOURG_GEO.meta.buildingTexture).toMatchObject({
      method: 'osm-existing-buildings-report-only',
      initialLandBuildingRatio: 0.109685,
      finalLandBuildingRatio: 0.121982,
    });
    expect(STRASBOURG_GEO.meta.contentPolicy.politicalAndInstitutionalActivityNarrative)
      .toBe('excluded');
    expect(byId(STRASBOURG_GEO.pois, 'parlement-europeen').representationPolicy)
      .toBe('architectural-exterior-and-geography-only-no-institutional-activity');
  });

  it('적응형 미니맵 추정 피크가 24 MiB 안이다', () => {
    const layout = cityMinimapLayout(STRASBOURG_GEO.meta.grid.w, STRASBOURG_GEO.meta.grid.h);
    const cells = STRASBOURG_GEO.meta.grid.w * STRASBOURG_GEO.meta.grid.h;
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedPeakBytes = cells * 3 + layout.backingBytes + sourceCanvasBytes * 2;
    expect(layout).toEqual({
      factor: 1,
      sourceWidth: 405,
      sourceHeight: 446,
      width: 1_215,
      height: 1_338,
      backingBytes: 6_502_680,
    });
    expect(estimatedPeakBytes).toBe(8_489_610);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('두 번 재생성과 전체 PNG가 byte-identical이다', () => {
    const first = buildStrasbourgCityGeo();
    const second = buildStrasbourgCityGeo();
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain))
      .toBe('f047caa5cb11e8f4524ab9ae50c8446dd32301f4389b1f9c2729b99558f9712e');
    expect(hash(first.railways.mask))
      .toBe('d8da48d21b8367ecb5661a39246bba399c77bd7c620b7cdc942dee1e0e597d86');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(70_228);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(7_873);
    expect(first.pois).toEqual(STRASBOURG_GEO.pois);
    expect(first.stations).toEqual(STRASBOURG_GEO.stations);
    const firstPng = renderStrasbourgPng(first);
    const secondPng = renderStrasbourgPng(second);
    expect(firstPng).toEqual(secondPng);
    expect(hash(firstPng))
      .toBe('12467c1b65cebec7b4f60e492134dde3931f555831efbfeecbf4916ff3b282e5');
  }, 120_000);
});
