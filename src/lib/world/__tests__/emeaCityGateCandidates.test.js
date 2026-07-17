import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_WORLD_NODES } from '../../../components/world/worldNodes.js';
import { EMEA_RAIL_NETWORK } from '../emeaRail.js';
import {
  OVERWORLD_STORAGE_CHUNK_TILES,
  decodeOverworldChunkV1,
} from '../overworldChunk.js';
import {
  overworldRegionById,
  projectOverworldRegionCoordinate,
} from '../overworldRegions.js';
import { createRegionalWorldNode } from '../worldNodeGeo.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const EMEA = overworldRegionById('emea');
const PLAYABILITY_DIR = path.join(ROOT, 'public/assets/overworld', EMEA.manifest.regionId);
const CANDIDATES = Object.freeze([
  Object.freeze({
    id: 'london-st-pancras-gate-candidate',
    regionId: EMEA.id,
    lon: -0.1258,
    lat: 51.5316,
    arrivalOffset: Object.freeze([0, -2]),
    expectedProjection: Object.freeze([172, 358]),
    expectedArrival: Object.freeze([172, 356]),
  }),
  Object.freeze({
    id: 'bruxelles-midi-gate-candidate',
    regionId: EMEA.id,
    lon: 4.3355,
    lat: 50.8358,
    arrivalOffset: Object.freeze([0, 0]),
    expectedProjection: Object.freeze([242, 375]),
    expectedArrival: Object.freeze([242, 375]),
  }),
]);

function cellAt(x, y) {
  const cx = Math.floor(x / OVERWORLD_STORAGE_CHUNK_TILES);
  const cy = Math.floor(y / OVERWORLD_STORAGE_CHUNK_TILES);
  const chunk = decodeOverworldChunkV1(readFileSync(
    path.join(PLAYABILITY_DIR, `${cx}/${cy}.owc`),
  ), {
    expected: {
      schemaVersion: EMEA.manifest.schemaVersion,
      cx,
      cy,
      regionHash: EMEA.manifest.regionHash,
      projectionManifestHash: EMEA.manifest.projectionManifestHash,
    },
  });
  return chunk.cellAt(
    x - cx * OVERWORLD_STORAGE_CHUNK_TILES,
    y - cy * OVERWORLD_STORAGE_CHUNK_TILES,
  );
}

function interactionDistance(left, right) {
  return Math.max(Math.abs(left[0] - right[0]), Math.abs(left[1] - right[1]));
}

describe('런던·브뤼셀 EMEA 도시 게이트 후보', () => {
  it.each(CANDIDATES)('$id 좌표를 결정적으로 투영하고 체크인된 보행 타일에 도착한다', (candidate) => {
    const projected = projectOverworldRegionCoordinate(EMEA, candidate.lon, candidate.lat);
    const node = createRegionalWorldNode(candidate);

    expect([projected.x, projected.y]).toEqual(candidate.expectedProjection);
    expect(node.overworldTile).toEqual(candidate.expectedArrival);
    expect(cellAt(...node.overworldTile)).toMatchObject({
      valid: true,
      collision: 0,
      viewOnly: 0,
    });
  });

  it('세인트판크라스 원점은 런던 철도 허브와 겹치므로 2칸 떨어진 보행 타일을 사용한다', () => {
    const candidate = CANDIDATES[0];
    const node = createRegionalWorldNode(candidate);
    const londonHub = EMEA_RAIL_NETWORK.hubs.find(({ id }) => id === 'london-rail-hub');

    expect(candidate.expectedProjection).toEqual(londonHub.tile);
    expect(candidate.arrivalOffset).toEqual([0, -2]);
    expect(interactionDistance(node.overworldTile, londonHub.tile)).toBe(2);
  });

  it('두 후보 도착점은 기존 EMEA 철도 허브·도시 게이트의 상호작용 반경을 침범하지 않는다', () => {
    const committedCityNodes = ALL_WORLD_NODES.filter(({ regionId }) => regionId === EMEA.id);
    for (const candidate of CANDIDATES) {
      const node = createRegionalWorldNode(candidate);
      for (const hub of EMEA_RAIL_NETWORK.hubs) {
        expect(interactionDistance(node.overworldTile, hub.tile), `${candidate.id}:${hub.id}`)
          .toBeGreaterThan(1);
      }
      for (const city of committedCityNodes) {
        expect(interactionDistance(node.overworldTile, city.overworldTile), `${candidate.id}:${city.id}`)
          .toBeGreaterThan(1);
      }
    }
  });
});
