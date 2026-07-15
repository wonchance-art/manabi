import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodeOverworldChunkV1, OVERWORLD_STORAGE_CHUNK_TILES } from '../overworldChunk.js';
import {
  OVERWORLD_REGION_LIST,
  isOverworldRegionTile,
  overworldRegionById,
  overworldRegionByScene,
  overworldRegionForCorridorStop,
  overworldRegionSpawn,
  overworldRegionSpawnForCorridorStop,
} from '../overworldRegions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');

function checkedInGateCell(region) {
  const { x, y } = region.gate.tile;
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

  it('미등록 지역과 범위 밖 좌표는 거부한다', () => {
    expect(isOverworldRegionTile('overworld:emea', -1, 0)).toBe(false);
    expect(isOverworldRegionTile('overworld:emea', 964, 0)).toBe(false);
    expect(isOverworldRegionTile('overworld:unknown', 0, 0)).toBe(false);
    expect(overworldRegionSpawn('unknown')).toBeNull();
    expect(overworldRegionSpawnForCorridorStop('novosibirsk')).toBeNull();
  });
});
