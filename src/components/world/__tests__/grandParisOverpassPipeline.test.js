import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mergeOverpassFiles } from '../../../../scripts/merge-overpass-json.mjs';
import { renderCitySnapshotPng } from '../../../../scripts/world/render-city-snapshot.mjs';

const PARTITIONS = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/grand-paris-overpass-partitions.json', import.meta.url),
  'utf8',
));
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/grand-paris-osm-v21.json', import.meta.url),
  'utf8',
));

describe('Grand Paris Overpass 분할 계약', () => {
  it('확정 bbox를 4×4 무중복 격자로 완전히 덮는다', () => {
    expect(PARTITIONS).toMatchObject({
      version: 1,
      bbox: [2.10, 48.78, 2.47, 48.94],
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

  it('대형 원본용 스트리밍 병합도 입력 순서와 무관하게 byte-identical이다', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'grand-paris-merge-'));
    const firstInput = path.join(directory, 'a.json');
    const secondInput = path.join(directory, 'b.json');
    const firstOutput = path.join(directory, 'first.json');
    const secondOutput = path.join(directory, 'second.json');
    fs.writeFileSync(firstInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: 1, lon: 1 }] },
      { type: 'node', id: 5, lat: 1, lon: 1 },
    ] }));
    fs.writeFileSync(secondInput, JSON.stringify({ elements: [
      { type: 'way', id: 9, geometry: [{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }] },
      { type: 'relation', id: 2, members: [] },
    ] }));
    mergeOverpassFiles([firstInput, secondInput], firstOutput);
    mergeOverpassFiles([secondInput, firstInput], secondOutput);
    expect(fs.readFileSync(firstOutput)).toEqual(fs.readFileSync(secondOutput));
    expect(JSON.parse(fs.readFileSync(firstOutput, 'utf8')).elements.map(({ type, id }) => `${type}:${id}`))
      .toEqual(['node:5', 'way:9', 'relation:2']);
    expect(JSON.parse(fs.readFileSync(firstOutput, 'utf8')).elements[1]).toEqual({
      type: 'way',
      id: 9,
      geometry: [{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }],
    });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('compact 원본과 오프라인 레이어 해시를 고정한다', () => {
    expect(SNAPSHOT).toMatchObject({
      city: 'grand-paris',
      bbox: [2.10, 48.78, 2.47, 48.94],
      metersPerTile: 20,
      grid: { w: 1355, h: 891 },
      source: {
        geometry: 'OpenStreetMap',
        license: 'ODbL 1.0',
        snapshot: '2026-07-16',
        providers: ['overpass-api.de'],
        rawOverpassSha256: '284d9c8cbf1ad5b9fd993c4e13eab33c67241fde4ff8ec0a2cf09d42cdaad375',
        partitionCount: 16,
        queryCount: 48,
        mergeStrategy: 'type-id-largest-geometry-compact-v1',
        buildingWays: 619_179,
        roadWays: 304_406,
        waterAreas: 1_251,
        riverWays: 627,
        parkAreas: 22_006,
        mountainAreas: 0,
        railwayWays: 9_523,
        coastlineWays: 0,
        crossingNodes: 53_861,
        crossingTiles: 53_861,
      },
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: '0c9a01f099dc8d4bd1f6ed54feea575cd15ece7ab8279c8246f189c4d94553d4',
      roadRle: '19025c261cb6ffe2fd6ee97eff7dc780354141a44a941b0cbb85cdb04b213c17',
      waterRle: 'ffcd1b4bfefd728abc0e7164cd4b75f4f01da5d2bb86964bbf034e45f984e27c',
      riverRle: 'dbc158df3b2380bc28cfe14e47ca169aa20fbce3d2b31b2477f9e77ec018fe58',
      parkRle: '3a9ca86fe105a9f1e896294467cdb0ed854ed1b770a6bf59a5372351e78aef6d',
      mountainRle: '9d60fd2bd2bb93dfac2eb710f3768b12dc9244cdf0c6b30d47fb4698902e68c0',
      railwayRle: '455c40c6022c3a7ac21eb68d34d23dd73d6ec916377531f227662d951f22e1b2',
    });
  });

  it('지형 전용 검수 PNG를 결정적으로 렌더링한다', () => {
    const png = renderCitySnapshotPng(SNAPSHOT);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(createHash('sha256').update(png).digest('hex'))
      .toBe('fe00f83f2f086a9af7147de9d6c024d77c27012f1032a629143ab7c221626fa4');
  });
});
