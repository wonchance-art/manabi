import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ALL_WORLD_NODES,
  getNode,
} from '../../../components/world/worldNodes.js';
import {
  OVERWORLD_STORAGE_CHUNK_TILES,
  decodeOverworldChunkV1,
} from '../overworldChunk.js';
import {
  overworldRegionById,
  projectOverworldRegionCoordinate,
} from '../overworldRegions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const APAC = overworldRegionById('asia-pacific');
const PLAYABILITY_DIR = path.join(ROOT, 'public/assets/overworld', APAC.manifest.regionId);
const TRANSPORT_MANIFEST = JSON.parse(readFileSync(
  path.join(ROOT, 'scripts/world/overworld-transport-nodes-apac-v1.json'),
  'utf8',
));

function cellAt(x, y) {
  const cx = Math.floor(x / OVERWORLD_STORAGE_CHUNK_TILES);
  const cy = Math.floor(y / OVERWORLD_STORAGE_CHUNK_TILES);
  const chunk = decodeOverworldChunkV1(readFileSync(
    path.join(PLAYABILITY_DIR, `${cx}/${cy}.owc`),
  ), {
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

function interactionDistance(left, right) {
  return Math.max(Math.abs(left[0] - right[0]), Math.abs(left[1] - right[1]));
}

describe('캔버라 APAC 도시 게이트', () => {
  it('캔버라역/킹스턴 좌표를 결정적으로 투영하고 원점의 체크인된 보행 타일에 도착한다', () => {
    const node = getNode('canberra');
    const projected = projectOverworldRegionCoordinate(APAC, node.lon, node.lat);

    expect(node).toMatchObject({
      regionId: APAC.id,
      lon: 149.1493,
      lat: -35.319,
      arrivalOffset: [0, 0],
      gate: { type: 'city', to: 'canberra' },
    });
    expect([projected.x, projected.y]).toEqual([1954, 2380]);
    expect(node.overworldTile).toEqual([1954, 2380]);
    expect(cellAt(...node.overworldTile)).toMatchObject({
      valid: true,
      collision: 0,
      viewOnly: 0,
    });
  });

  it('도착점은 기존 APAC 월드·수송 노드의 상호작용 반경을 침범하지 않는다', () => {
    const node = getNode('canberra');
    const committedWorldNodes = ALL_WORLD_NODES.filter(
      ({ id, regionId }) => id !== node.id && regionId === APAC.id,
    );
    const committedTransportNodes = TRANSPORT_MANIFEST.nodes.map((transportNode) => {
      const projected = projectOverworldRegionCoordinate(APAC, transportNode.lon, transportNode.lat);
      return {
        id: transportNode.id,
        tile: [projected.x, projected.y],
      };
    });
    const fixedRegionNodes = [
      { id: APAC.gate.id, tile: [APAC.gate.tile.x, APAC.gate.tile.y] },
      { id: APAC.airArrival.id, tile: [APAC.airArrival.tile.x, APAC.airArrival.tile.y] },
    ];

    for (const existing of [
      ...committedWorldNodes.map(({ id, overworldTile: tile }) => ({ id, tile })),
      ...committedTransportNodes,
      ...fixedRegionNodes,
    ]) {
      expect(interactionDistance(node.overworldTile, existing.tile), existing.id)
        .toBeGreaterThan(1);
    }
  });
});
