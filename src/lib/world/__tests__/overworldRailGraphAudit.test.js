import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EMEA_RAIL_NETWORK } from '../emeaRail.js';
import { auditOverworldRailGraph } from '../overworldRailGraphAudit.js';

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

function fixtureDocument(segments, overrides = {}) {
  return {
    formatVersion: 1,
    kind: 'rail-segments',
    quantization: 1024,
    haloTiles: 1,
    cx: 0,
    cy: 0,
    segments,
    ...overrides,
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

describe('오버월드 철도 그래프 자동 감사', () => {
  it('halo 중복 선분을 한 번만 세고 결정적인 컴포넌트를 만든다', () => {
    const first = fixtureSegment('a', [0, 0], [1024, 0]);
    const second = fixtureSegment('b', [1024, 0], [2048, 0]);
    const report = auditOverworldRailGraph({
      documents: [fixtureDocument([second, first]), fixtureDocument([first])],
      hubs: [{ id: 'left', tile: [0, 0] }, { id: 'right', tile: [2, 0] }],
    });
    expect(report).toMatchObject({
      quantization: 1024,
      segmentCount: 2,
      nodeCount: 3,
      componentCount: 1,
    });
    expect(new Set(report.hubs.map(({ componentId }) => componentId)).size).toBe(1);
  });

  it('halo 사본 drift·양자화 drift·스냅 임계 초과를 거부한다', () => {
    const segment = fixtureSegment('a', [0, 0], [1024, 0]);
    expect(() => auditOverworldRailGraph({
      documents: [fixtureDocument([])],
      hubs: [{ id: 'hub', tile: [0, 0] }],
    })).toThrow('no segments');
    expect(() => auditOverworldRailGraph({
      documents: [fixtureDocument([segment]), fixtureDocument([{ ...segment, end: [2048, 0] }])],
      hubs: [{ id: 'hub', tile: [0, 0] }],
    })).toThrow('halo copy drifted');
    expect(() => auditOverworldRailGraph({
      documents: [fixtureDocument([segment]), fixtureDocument([], { quantization: 512 })],
      hubs: [{ id: 'hub', tile: [0, 0] }],
    })).toThrow('quantization mismatch');
    expect(() => auditOverworldRailGraph({
      documents: [fixtureDocument([segment])],
      hubs: [{ id: 'far', tile: [0, 3] }],
    })).toThrow('from the network');
  });

  it('체크인된 EMEA 철도 6,272선분과 7개 허브의 실제 연결성을 고정한다', () => {
    const report = auditOverworldRailGraph({
      documents: checkedInEmeaRailDocuments(),
      hubs: EMEA_RAIL_NETWORK.hubs,
    });
    expect(report).toMatchObject({
      formatVersion: 1,
      quantization: 1024,
      segmentCount: 6272,
      nodeCount: 6298,
    });
    expect(Math.max(...report.hubs.map(({ snapDistanceTiles }) => snapDistanceTiles)))
      .toBeLessThan(0.62);

    const byId = Object.fromEntries(report.hubs.map((hub) => [hub.id, hub]));
    const continentalIds = [
      'berlin-rail-hub',
      'istanbul-rail-hub',
      'madrid-rail-hub',
      'paris-rail-hub',
      'rome-rail-hub',
      'vienna-rail-hub',
    ];
    expect(new Set(continentalIds.map((id) => byId[id].componentId)).size).toBe(1);
    expect(byId['london-rail-hub'].componentId).not.toBe(byId['paris-rail-hub'].componentId);
  });
});
