import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodeOverworldChunkV1, OVERWORLD_STORAGE_CHUNK_TILES } from '../overworldChunk.js';
import { WORLD_NODES, getNode } from '../../../components/world/worldNodes.js';
import { normalizeOverworldOverlayDocument } from '../overworldFeatureOverlay.js';
import { normalizeOverworldTransportNodeDocument } from '../overworldTransportNodes.js';
import {
  OVERWORLD_REGION_LIST,
  isOverworldRegionTile,
  overworldRegionById,
  overworldRegionByScene,
  overworldRegionAirSpawn,
  overworldRegionForCorridorStop,
  overworldRegionSpawn,
  overworldRegionSpawnForCorridorStop,
  projectOverworldRegionCoordinate,
  unprojectOverworldRegionTile,
} from '../overworldRegions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');

function checkedInGateCell(region, gate = region.gate) {
  const { x, y } = gate.tile;
  const cx = Math.floor(x / OVERWORLD_STORAGE_CHUNK_TILES);
  const cy = Math.floor(y / OVERWORLD_STORAGE_CHUNK_TILES);
  const chunk = decodeOverworldChunkV1(readFileSync(path.join(
    ROOT,
    'public/assets/overworld',
    region.manifest.regionId,
    `${cx}/${cy}.owc`,
  )), {
    expected: {
      schemaVersion: region.manifest.schemaVersion,
      cx,
      cy,
      regionHash: region.manifest.regionHash,
      projectionManifestHash: region.manifest.projectionManifestHash,
    },
  });
  return chunk.cellAt(
    x % OVERWORLD_STORAGE_CHUNK_TILES,
    y % OVERWORLD_STORAGE_CHUNK_TILES,
  );
}

describe('오버월드 지역 레지스트리', () => {
  it('지역①과 지역②의 씬·횡단철도 종착 게이트를 고정한다', () => {
    expect(OVERWORLD_REGION_LIST.map(({ id }) => id)).toEqual(['asia-pacific', 'emea']);
    expect(overworldRegionByScene('overworld:asia-pacific')?.id).toBe('asia-pacific');
    expect(overworldRegionByScene('overworld:emea')?.id).toBe('emea');
    expect(overworldRegionForCorridorStop('vladivostok')?.id).toBe('asia-pacific');
    expect(overworldRegionForCorridorStop('moscow')?.id).toBe('emea');
    expect(overworldRegionById('unknown')).toBeNull();
    expect(overworldRegionByScene('overworld:unknown')).toBeNull();
    expect(overworldRegionById('asia-pacific')?.releaseEligible).toBe(true);
    expect(overworldRegionById('emea')?.releaseEligible).toBe(false);
    expect(overworldRegionById('asia-pacific')?.boundaryNotice).toBeUndefined();
    expect(overworldRegionById('emea')?.boundaryNotice).toBe(
      '지도상의 경계·명칭·표시는 특정 지역의 법적 지위나 경계 주장에 대한 승인 또는 지지를 의미하지 않습니다.',
    );
  });

  it.each(OVERWORLD_REGION_LIST)('$label 게이트가 범위 안의 체크인된 보행 타일이다', (region) => {
    const { x, y } = region.gate.tile;
    expect(isOverworldRegionTile(region.sceneId, x, y)).toBe(true);
    expect(checkedInGateCell(region)).toMatchObject({
      valid: true,
      collision: 0,
      viewOnly: 0,
    });
    expect(overworldRegionSpawn(region)).toEqual({ scene: region.sceneId, x, y });
    expect(overworldRegionSpawnForCorridorStop(region.gate.corridorStopId))
      .toEqual({ scene: region.sceneId, x, y });
  });

  it('EMEA는 파리·몽생미셸 게이트, APAC은 인천 도착 타일을 사용한다', () => {
    const region = overworldRegionById('emea');
    expect(region.airGate).toMatchObject({
      id: 'paris-cdg-air', type: 'air-gate', airportCode: 'CDG', contentLocale: 'fr',
    });
    expect(checkedInGateCell(region, region.airGate)).toMatchObject({
      valid: true, collision: 0, viewOnly: 0,
    });
    expect(projectOverworldRegionCoordinate(region, region.airGate.lon, region.airGate.lat))
      .toEqual(region.airGate.tile);
    expect(overworldRegionAirSpawn(region)).toEqual({
      scene: region.sceneId, x: region.airGate.tile.x, y: region.airGate.tile.y,
    });
    const paris = getNode('paris');
    expect(paris.overworldTile).toEqual([213, 424]);
    expect(checkedInGateCell(region, {
      tile: { x: paris.overworldTile[0], y: paris.overworldTile[1] },
    })).toMatchObject({ valid: true, collision: 0, viewOnly: 0 });
    expect(projectOverworldRegionCoordinate(region, paris.lon, paris.lat))
      .toEqual({
        x: paris.overworldTile[0] - paris.arrivalOffset[0],
        y: paris.overworldTile[1] - paris.arrivalOffset[1],
      });
    const montSaintMichel = getNode('mont-saint-michel');
    expect(montSaintMichel.overworldTile).toEqual([150, 429]);
    expect(checkedInGateCell(region, {
      tile: { x: montSaintMichel.overworldTile[0], y: montSaintMichel.overworldTile[1] },
    })).toMatchObject({ valid: true, collision: 0, viewOnly: 0 });
    expect(projectOverworldRegionCoordinate(region, montSaintMichel.lon, montSaintMichel.lat))
      .toEqual({ x: 150, y: 429 });
    const apac = overworldRegionById('asia-pacific');
    expect(apac.airArrival).toMatchObject({
      id: 'incheon-air-arrival', airportCode: 'ICN', contentLocale: 'ko', arrivalOffset: [4, 0],
    });
    expect(checkedInGateCell(apac, apac.airArrival)).toMatchObject({
      valid: true, collision: 0, viewOnly: 0,
    });
    expect(overworldRegionAirSpawn(apac)).toEqual({
      scene: apac.sceneId, x: 1460, y: 582,
    });
  });

  it('코트다쥐르 니스 게이트 후보가 투영 충돌을 피해 체크인된 보행 타일에 도착한다', () => {
    const region = overworldRegionById('emea');
    const projected = projectOverworldRegionCoordinate(region, 7.262, 43.7045);
    const arrivalOffset = [0, -1];
    const tile = {
      x: projected.x + arrivalOffset[0],
      y: projected.y + arrivalOffset[1],
    };

    expect(projected).toEqual({ x: 289, y: 551 });
    expect(tile).toEqual({ x: 289, y: 550 });
    expect(checkedInGateCell(region, { tile })).toMatchObject({
      valid: true,
      collision: 0,
      viewOnly: 0,
    });
  });

  it('신규 사용자의 APAC 서울 기본 진입점이 체크인된 보행 타일이다', () => {
    const apac = overworldRegionById('asia-pacific');
    const seoul = WORLD_NODES.find(({ id }) => id === 'seoul');
    expect(seoul).toMatchObject({
      regionId: apac.id,
      overworldTile: [1468, 579],
    });
    expect(checkedInGateCell(apac, {
      tile: { x: seoul.overworldTile[0], y: seoul.overworldTile[1] },
    })).toMatchObject({ valid: true, collision: 0, viewOnly: 0 });
  });

  it.each(OVERWORLD_REGION_LIST)('$label의 위경도와 타일 좌표를 뷰어용으로 왕복한다', (region) => {
    const tile = projectOverworldRegionCoordinate(region.id, region.gate.lon, region.gate.lat);
    expect(tile).toEqual(region.gate.tile);
    const geo = unprojectOverworldRegionTile(region.id, tile.x, tile.y);
    expect(geo.lon).toBeCloseTo(region.gate.lon, 1);
    expect(geo.lat).toBeCloseTo(region.gate.lat, 1);
    expect(projectOverworldRegionCoordinate('unknown', 0, 0)).toBeNull();
    expect(unprojectOverworldRegionTile('unknown', 0, 0)).toBeNull();
  });

  it.each(OVERWORLD_REGION_LIST)('$label의 체크인된 희소 오버레이를 검증한다', (region) => {
    const cx = Math.floor(region.gate.tile.x / OVERWORLD_STORAGE_CHUNK_TILES);
    const cy = Math.floor(region.gate.tile.y / OVERWORLD_STORAGE_CHUNK_TILES);
    expect(region.overlaySources).toHaveLength(region.id === 'emea' ? 3 : 2);
    for (const source of region.overlaySources) {
      const manifest = JSON.parse(readFileSync(path.join(
        ROOT, 'public/assets/overworld', source.regionId, 'content-manifest.json',
      ), 'utf8'));
      expect(manifest).toMatchObject({
        regionId: source.regionId,
        regionHash: source.regionHash,
        projectionManifestHash: source.projectionManifestHash,
        width: region.width,
        height: region.height,
      });
      const gateOverlayPath = `${source.pathPrefix}/${cx}/${cy}.json`;
      const overlayPath = manifest.overlays.some(({ path: entry }) => entry === gateOverlayPath)
        ? gateOverlayPath
        : manifest.overlays.find(({ path: entry }) => entry.startsWith(`${source.pathPrefix}/`))?.path;
      expect(overlayPath).toBeDefined();
      const [, overlayCx, overlayFile] = overlayPath.split('/');
      const overlayCy = overlayFile.replace(/\.json$/, '');
      const document = normalizeOverworldOverlayDocument(JSON.parse(readFileSync(path.join(
        ROOT, 'public/assets/overworld', source.regionId, overlayPath,
      ), 'utf8')), { kind: source.kind, cx: Number(overlayCx), cy: Number(overlayCy) });
      expect(document.segments.length).toBeGreaterThan(0);
    }
  });

  it.each(OVERWORLD_REGION_LIST)('$label의 게이트가 체크인된 교통 노드 인덱스와 일치한다', (region) => {
    const { x, y } = region.gate.tile;
    const cx = Math.floor(x / OVERWORLD_STORAGE_CHUNK_TILES);
    const cy = Math.floor(y / OVERWORLD_STORAGE_CHUNK_TILES);
    const manifest = JSON.parse(readFileSync(path.join(
      ROOT, 'public/assets/overworld', region.nodeSource.regionId, 'content-manifest.json',
    ), 'utf8'));
    expect(manifest).toMatchObject({
      regionId: region.nodeSource.regionId,
      regionHash: region.nodeSource.regionHash,
      projectionManifestHash: region.nodeSource.projectionManifestHash,
      width: region.width,
      height: region.height,
      releaseEligible: false,
    });
    expect(manifest.nodes).toContainEqual(expect.objectContaining({ path: `nodes/${cx}/${cy}.json` }));
    const document = normalizeOverworldTransportNodeDocument(JSON.parse(readFileSync(path.join(
      ROOT,
      'public/assets/overworld',
      region.nodeSource.regionId,
      `nodes/${cx}/${cy}.json`,
    ), 'utf8')), { cx, cy, width: region.width, height: region.height });
    expect(document.nodes).toContainEqual({
      id: region.gate.id,
      type: 'transsib-gate',
      label: region.gate.label,
      contentLocale: region.gate.contentLocale,
      corridorStopId: region.gate.corridorStopId,
      tile: [x, y],
    });
  });

  it('EMEA 항공 게이트가 체크인된 교통 노드 인덱스와 일치한다', () => {
    const region = overworldRegionById('emea');
    const { x, y } = region.airGate.tile;
    const cx = Math.floor(x / OVERWORLD_STORAGE_CHUNK_TILES);
    const cy = Math.floor(y / OVERWORLD_STORAGE_CHUNK_TILES);
    const document = normalizeOverworldTransportNodeDocument(JSON.parse(readFileSync(path.join(
      ROOT, 'public/assets/overworld', region.nodeSource.regionId, `nodes/${cx}/${cy}.json`,
    ), 'utf8')), { cx, cy, width: region.width, height: region.height });
    expect(document.nodes).toContainEqual({
      id: region.airGate.id,
      type: 'air-gate',
      label: region.airGate.label,
      contentLocale: region.airGate.contentLocale,
      airportCode: region.airGate.airportCode,
      tile: [x, y],
    });
  });

  it('미등록 지역과 범위 밖 좌표는 거부한다', () => {
    expect(isOverworldRegionTile('overworld:emea', -1, 0)).toBe(false);
    expect(isOverworldRegionTile('overworld:emea', 964, 0)).toBe(false);
    expect(isOverworldRegionTile('overworld:unknown', 0, 0)).toBe(false);
    expect(overworldRegionSpawn('unknown')).toBeNull();
    expect(overworldRegionSpawnForCorridorStop('novosibirsk')).toBeNull();
  });
});
