import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { serializeWorldNodeGeoDocument } from '../../../../scripts/world/build-world-node-geo-manifest.mjs';
import { WORLD_NODES } from '../../../components/world/worldNodes.js';
import {
  LEGACY_WORLD_REGION_ID,
  createRegionalWorldNode,
  migrateLegacyWorldNode,
  worldNodeGeoManifest,
  worldNodeReturnSpawn,
} from '../worldNodeGeo.js';
import {
  OVERWORLD_STORAGE_CHUNK_TILES,
  decodeOverworldChunkV1,
} from '../overworldChunk.js';
import { overworldRegionById } from '../overworldRegions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const APAC = overworldRegionById(LEGACY_WORLD_REGION_ID);
const PLAYABILITY_DIR = path.join(ROOT, 'public/assets/overworld', APAC.manifest.regionId);
const GEO_MANIFEST_PATH = path.join(ROOT, 'public/assets/overworld/world-node-geo-migration-v1.json');
const LEGACY_ID_TILE_SHA256 = '7d2b2debf9398957c196474b927f0b998c96d02f2ce2b888f1f3112ee9efd1cf';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function nodeCell(node) {
  return cellAt(node.overworldTile[0], node.overworldTile[1]);
}

function cellAt(x, y) {
  const cx = Math.floor(x / OVERWORLD_STORAGE_CHUNK_TILES);
  const cy = Math.floor(y / OVERWORLD_STORAGE_CHUNK_TILES);
  const chunk = decodeOverworldChunkV1(readFileSync(path.join(PLAYABILITY_DIR, `${cx}/${cy}.owc`)), {
    expected: {
      schemaVersion: APAC.manifest.schemaVersion,
      cx,
      cy,
      regionHash: APAC.manifest.regionHash,
      projectionManifestHash: APAC.manifest.projectionManifestHash,
    },
  });
  return chunk.cellAt(
    x - cx * OVERWORLD_STORAGE_CHUNK_TILES,
    y - cy * OVERWORLD_STORAGE_CHUNK_TILES,
  );
}

function nearestWalkableOffset(node, radius = 8) {
  const [originX, originY] = node.overworldTile;
  for (let distance = 1; distance <= radius; distance += 1) {
    for (let dy = -distance; dy <= distance; dy += 1) {
      for (let dx = -distance; dx <= distance; dx += 1) {
        if (Math.abs(dx) + Math.abs(dy) !== distance) continue;
        if (cellAt(originX + dx, originY + dy).collision === 0
          && cellAt(originX + dx, originY + dy).viewOnly === 0) return [dx, dy];
      }
    }
  }
  return null;
}

describe('기존 WORLD_NODES 오버월드 좌표 이중 운용', () => {
  it('기존 id·tile 전체 계약을 해시로 고정하고 legacyTile과 동일하게 보존한다', () => {
    const legacyIdentity = WORLD_NODES
      .map(({ id, tile }) => `${id}:${tile[0]},${tile[1]}`)
      .sort()
      .join('\n');
    expect(sha256(legacyIdentity)).toBe(LEGACY_ID_TILE_SHA256);
    for (const node of WORLD_NODES) expect(node.legacyTile).toEqual(node.tile);
  });

  it('모든 노드가 APAC 지역·위경도·새 타일·출처를 갖고 깊은 좌표 배열은 불변이다', () => {
    for (const node of WORLD_NODES) {
      expect(node.regionId).toBe(LEGACY_WORLD_REGION_ID);
      expect(Number.isFinite(node.lon)).toBe(true);
      expect(Number.isFinite(node.lat)).toBe(true);
      expect(['verified-input', 'legacy-tile-derived']).toContain(node.geoSource);
      expect(node.overworldTile).toHaveLength(2);
      expect(node.overworldTile.every(Number.isInteger)).toBe(true);
      expect(Object.isFrozen(node)).toBe(true);
      expect(Object.isFrozen(node.tile)).toBe(true);
      expect(Object.isFrozen(node.legacyTile)).toBe(true);
      expect(Object.isFrozen(node.arrivalOffset)).toBe(true);
      expect(Object.isFrozen(node.overworldTile)).toBe(true);
    }
  });

  it('검증 좌표는 그대로 쓰고 손 스냅 타일은 파생 출처로 숨기지 않는다', () => {
    expect(WORLD_NODES.find(({ id }) => id === 'hiroshima-peace')).toMatchObject({
      lon: 132.4536,
      lat: 34.3955,
      geoSource: 'verified-input',
    });
    expect(WORLD_NODES.find(({ id }) => id === 'gourmet-osaka')).toMatchObject({
      lon: 135.5019,
      lat: 34.6687,
      geoSource: 'verified-input',
    });
    expect(WORLD_NODES.find(({ id }) => id === 'yanagawa')?.geoSource)
      .toBe('legacy-tile-derived');
  });

  it('모든 새 도착 타일이 체크인된 APAC 플레이 가능 격자의 보행 칸이다', () => {
    const blocked = WORLD_NODES
      .filter((node) => !nodeCell(node).valid || nodeCell(node).collision !== 0 || nodeCell(node).viewOnly !== 0)
      .map((node) => ({ id: node.id, tile: node.overworldTile, nearest: nearestWalkableOffset(node) }));
    expect(blocked).toEqual([]);
  });

  it('manifest는 입력 순서와 무관하고 id 순으로 동결된다', () => {
    const forward = worldNodeGeoManifest(WORLD_NODES);
    const reverse = worldNodeGeoManifest([...WORLD_NODES].reverse());
    expect(reverse).toEqual(forward);
    expect(forward.map(({ id }) => id)).toEqual([...forward.map(({ id }) => id)].sort());
    expect(Object.isFrozen(forward)).toBe(true);
  });

  it('체크인된 migration manifest가 생성기와 byte-identical이고 preview 전용이다', () => {
    const bytes = readFileSync(GEO_MANIFEST_PATH, 'utf8');
    expect(bytes).toBe(serializeWorldNodeGeoDocument());
    expect(JSON.parse(bytes)).toMatchObject({
      schemaVersion: 1,
      regionId: LEGACY_WORLD_REGION_ID,
      source: 'WORLD_NODES',
      releaseEligible: false,
      legacyIdTileSha256: LEGACY_ID_TILE_SHA256,
      nodeCount: WORLD_NODES.length,
      geoSourceCounts: { 'legacy-tile-derived': 48, 'verified-input': 17 },
    });
  });

  it('잘못된 legacy tile·offset·node를 fail-closed로 거부한다', () => {
    expect(() => migrateLegacyWorldNode(null)).toThrow(/non-empty id/);
    expect(() => migrateLegacyWorldNode({ id: 'bad', tile: [1.2, 3] })).toThrow(/integer/);
    expect(() => migrateLegacyWorldNode({ id: 'bad', tile: [1, 3], arrivalOffset: [0.5, 0] }))
      .toThrow(/integer/);
  });

  it('신규 APAC 지역 노드는 legacy plaza가 아닌 APAC 오버월드로 복귀한다', () => {
    const node = createRegionalWorldNode({
      id: 'verified-apac-city',
      regionId: LEGACY_WORLD_REGION_ID,
      lon: 114.1722,
      lat: 22.2975,
    });

    expect(node).toMatchObject({
      regionId: LEGACY_WORLD_REGION_ID,
      geoSource: 'verified-input',
      overworldTile: [1187, 956],
    });
    expect(node.legacyTile).toBeUndefined();
    expect(worldNodeReturnSpawn(node)).toEqual({
      scene: APAC.sceneId,
      x: 1187,
      y: 956,
    });
    expect(worldNodeReturnSpawn(WORLD_NODES.find(({ id }) => id === 'seoul'))).toEqual({
      scene: 'plaza',
      x: WORLD_NODES.find(({ id }) => id === 'seoul').legacyTile[0],
      y: WORLD_NODES.find(({ id }) => id === 'seoul').legacyTile[1],
    });
  });
});
