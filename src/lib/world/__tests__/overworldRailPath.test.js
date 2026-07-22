import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EMEA_RAIL_NETWORK } from '../emeaRail.js';
import { planOverworldRailPath } from '../overworldRailPath.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const EMEA_RAIL_DIR = path.join(
  REPO_ROOT,
  'public/assets/overworld/europe-mediterranean-middle-east-transport-preview-v1/rail',
);

function checkedInEmeaRailDocuments() {
  return readdirSync(EMEA_RAIL_DIR).sort().flatMap((cx) => (
    readdirSync(path.join(EMEA_RAIL_DIR, cx)).sort().map((file) => (
      JSON.parse(readFileSync(path.join(EMEA_RAIL_DIR, cx, file), 'utf8'))
    ))
  ));
}

function fixtureDocument(segments) {
  return {
    formatVersion: 1,
    kind: 'rail-segments',
    quantization: 1024,
    haloTiles: 1,
    cx: 0,
    cy: 0,
    segments,
  };
}

const fixtureSegment = (id, start, end) => ({
  id,
  routeId: id,
  sourceFeatureIndex: 0,
  segmentIndex: 0,
  scaleRank: 1,
  category: null,
  electric: null,
  multiTrack: null,
  start,
  end,
});

const hub = (id, tile) => ({ id, tile });

describe('오버월드 철도 실제 선형 경로', () => {
  it('가까운 철도선에 스냅하고 최단 선분 순서를 결정적으로 반환한다', () => {
    const first = fixtureSegment('a', [0, 0], [1024, 0]);
    const second = fixtureSegment('b', [1024, 0], [2048, 0]);
    const documents = [fixtureDocument([second, first]), fixtureDocument([first])];
    const input = {
      documents,
      origin: hub('origin', [0, 0]),
      terminal: hub('terminal', [2, 0]),
    };
    const pathResult = planOverworldRailPath(input);
    expect(pathResult).toMatchObject({
      formatVersion: 1,
      quantization: 1024,
      originId: 'origin',
      terminalId: 'terminal',
      distanceTiles: 2,
      segmentIds: ['a', 'b'],
      pointsQuantized: [[0, 0], [1024, 0], [2048, 0]],
    });
    expect(planOverworldRailPath({ ...input, documents: [...documents].reverse() })).toEqual(pathResult);
  });

  it('직선보다 긴 우회 분기를 선택하지 않는다', () => {
    const documents = [fixtureDocument([
      fixtureSegment('direct-a', [0, 0], [1024, 0]),
      fixtureSegment('direct-b', [1024, 0], [2048, 0]),
      fixtureSegment('detour-a', [0, 0], [0, 1024]),
      fixtureSegment('detour-b', [0, 1024], [2048, 1024]),
      fixtureSegment('detour-c', [2048, 1024], [2048, 0]),
    ])];
    expect(planOverworldRailPath({
      documents,
      origin: hub('origin', [0, 0]),
      terminal: hub('terminal', [2, 0]),
    }).segmentIds).toEqual(['direct-a', 'direct-b']);
  });

  it('같은 허브·허용 거리 밖 허브·분리된 그래프를 거부한다', () => {
    const documents = [fixtureDocument([
      fixtureSegment('west', [0, 0], [1024, 0]),
      fixtureSegment('east', [10240, 0], [11264, 0]),
    ])];
    expect(() => planOverworldRailPath({
      documents,
      origin: hub('same', [0, 0]),
      terminal: hub('same', [1, 0]),
    })).toThrow('must differ');
    expect(() => planOverworldRailPath({
      documents,
      origin: hub('origin', [0, 3]),
      terminal: hub('terminal', [0, 0]),
    })).toThrow('from the network');
    expect(() => planOverworldRailPath({
      documents,
      origin: hub('origin', [0, 0]),
      terminal: hub('terminal', [10, 0]),
    })).toThrow('disconnected');
  });

  it('대륙 5개 직접 연결은 실제 선형을 따르고 채널터널 서비스 edge는 물리 그래프와 분리한다', () => {
    const documents = checkedInEmeaRailDocuments();
    const hubs = Object.fromEntries(EMEA_RAIL_NETWORK.hubs.map((entry) => [entry.id, entry]));
    const continentalLinks = EMEA_RAIL_NETWORK.links.filter(([first, second]) => (
      first !== 'london-rail-hub' && second !== 'london-rail-hub'
    ));
    const paths = continentalLinks.map(([first, second]) => planOverworldRailPath({
      documents,
      origin: hubs[first],
      terminal: hubs[second],
    }));
    expect(paths).toHaveLength(5);
    expect(EMEA_RAIL_NETWORK.links).toContainEqual(['london-rail-hub', 'paris-rail-hub']);
    expect(paths.every((entry) => entry.distanceTiles > 0 && entry.segmentIds.length > 0)).toBe(true);
    expect(Math.max(...paths.map((entry) => entry.originSnap.distanceTiles))).toBeLessThan(0.62);
    expect(Math.max(...paths.map((entry) => entry.terminalSnap.distanceTiles))).toBeLessThan(0.62);
    expect(planOverworldRailPath({
      documents: [...documents].reverse(),
      origin: hubs['paris-rail-hub'],
      terminal: hubs['berlin-rail-hub'],
    })).toEqual(paths[1]);
    expect(() => planOverworldRailPath({
      documents,
      origin: hubs['london-rail-hub'],
      terminal: hubs['paris-rail-hub'],
    })).toThrow('disconnected');
  });
});
