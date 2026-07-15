import { describe, expect, it } from 'vitest';
import {
  MAP_H,
  MAP_W,
  TERRAIN,
  decodeMap,
  isBlocked,
} from '../../../components/world/mapData.js';
import { buildPlayableGrid } from '../mapGeo.js';
import { decodeOverworldChunkV1 } from '../overworldChunk.js';
import { OVERWORLD_FIXTURE_MANIFEST } from '../overworldFixture.js';
import {
  buildOverworldFixtureArtifacts,
  runOverworldFixtureBuild,
} from '../../../../scripts/world/build-overworld-fixture.mjs';

function artifactMap(artifacts) {
  return new Map(artifacts.map((artifact) => [artifact.path, artifact.bytes]));
}

describe('한일 canonical .owc 실화면 fixture', () => {
  it('반복 생성이 byte-identical이고 체크인 산출물과 일치한다', async () => {
    const first = buildOverworldFixtureArtifacts();
    const second = buildOverworldFixtureArtifacts();
    expect(first.map(({ path }) => path)).toEqual(second.map(({ path }) => path));
    for (let index = 0; index < first.length; index += 1) {
      expect(Buffer.compare(Buffer.from(first[index].bytes), Buffer.from(second[index].bytes))).toBe(0);
    }
    await expect(runOverworldFixtureBuild({ check: true })).resolves.toHaveLength(5);
  });

  it('4개 청크의 모든 유효 셀이 legacy playable 격자와 같고 패딩은 fail-closed다', () => {
    const grid = buildPlayableGrid(decodeMap());
    const artifacts = artifactMap(buildOverworldFixtureArtifacts());
    const contentManifest = JSON.parse(new TextDecoder().decode(artifacts.get('content-manifest.json')));
    expect(contentManifest.chunks.map(({ path }) => path)).toEqual([
      '0/0.owc',
      '0/1.owc',
      '1/0.owc',
      '1/1.owc',
    ]);
    expect(contentManifest).toMatchObject({
      width: MAP_W,
      height: MAP_H,
      ...OVERWORLD_FIXTURE_MANIFEST,
    });

    const mismatches = [];
    for (const entry of contentManifest.chunks) {
      const decoded = decodeOverworldChunkV1(artifacts.get(entry.path), {
        expected: {
          ...OVERWORLD_FIXTURE_MANIFEST,
          cx: entry.cx,
          cy: entry.cy,
        },
      });
      const originX = entry.cx * 256;
      const originY = entry.cy * 256;
      for (let y = 0; y < 256; y += 1) {
        for (let x = 0; x < 256; x += 1) {
          const globalX = originX + x;
          const globalY = originY + y;
          const valid = globalX < MAP_W && globalY < MAP_H;
          const expectedSurface = valid ? grid[globalY * MAP_W + globalX] : TERRAIN.SEA;
          const expectedCollision = valid ? Number(isBlocked(expectedSurface)) : 1;
          const expectedViewOnly = valid ? 0 : 1;
          if (decoded.isValidAt(x, y) !== valid
            || decoded.surfaceAt(x, y) !== expectedSurface
            || decoded.collisionAt(x, y) !== expectedCollision
            || decoded.viewOnlyAt(x, y) !== expectedViewOnly) {
            mismatches.push({ entry: entry.path, x, y });
            break;
          }
        }
        if (mismatches.length > 0) break;
      }
    }
    expect(mismatches).toEqual([]);
  });
});
