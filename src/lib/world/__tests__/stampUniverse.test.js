import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CITY_DATA } from '../../../components/world/cities/index.js';
import {
  REGIONAL_WORLD_NODES,
  WORLD_NODES,
} from '../../../components/world/worldNodes.js';
import {
  canCollectStamp,
  isStampAlbumNodeId,
  STAMP_ALBUM_NODES,
} from '../stampUniverse.js';

const REGIONAL_STAMP_IDS = Object.freeze([
  'hong-kong',
  'taipei',
  'shanghai',
  'beijing',
  'brisbane',
  'sydney',
  'canberra',
  'melbourne',
  'paris',
  'mont-saint-michel',
  'nice',
  'brussels',
  'london',
  'marseille',
  'geneva',
  'leman-riviera',
  'lyon',
  'bordeaux',
  'strasbourg',
]);

function manifestJson() {
  return JSON.stringify(STAMP_ALBUM_NODES.map((node, index) => ({
    index,
    source: index < WORLD_NODES.length ? 'legacy' : 'regional',
    id: node.id,
    kind: node.kind,
    gateTo: node.gate?.to ?? null,
    regionId: node.regionId ?? null,
    noStamp: node.noStamp === true,
  })));
}

describe('스탬프 우주 85노드 계약', () => {
  it('기존 66개 prefix와 지역 19개 suffix를 exact 순서로 보존한다', () => {
    expect(WORLD_NODES).toHaveLength(66);
    expect(REGIONAL_WORLD_NODES).toHaveLength(19);
    expect(STAMP_ALBUM_NODES).toHaveLength(85);
    expect(Object.isFrozen(STAMP_ALBUM_NODES)).toBe(true);

    expect(STAMP_ALBUM_NODES.slice(0, 66).map((node) => node.id))
      .toEqual(WORLD_NODES.map((node) => node.id));
    expect(STAMP_ALBUM_NODES.slice(66).map((node) => node.id))
      .toEqual(REGIONAL_STAMP_IDS);
    expect(new Set(STAMP_ALBUM_NODES.map((node) => node.id)).size).toBe(85);
  });

  it('지역 19개는 실재 city gate이고 noStamp 금지 플래그가 없다', () => {
    for (const node of REGIONAL_WORLD_NODES) {
      expect(node.kind, node.id).toBe('city');
      expect(node.gate?.type, node.id).toBe('city');
      expect(CITY_DATA[node.gate?.to], `${node.id} → ${node.gate?.to}`).toBeTruthy();
      expect(node.noStamp, node.id).not.toBe(true);
      expect(canCollectStamp(node), node.id).toBe(true);
    }
  });

  it('멤버십과 인스턴스 noStamp 를 함께 검사한다', () => {
    for (const node of STAMP_ALBUM_NODES) {
      expect(isStampAlbumNodeId(node.id), node.id).toBe(true);
      expect(canCollectStamp(node), node.id).toBe(true);
    }

    expect(canCollectStamp({ ...WORLD_NODES[0], noStamp: true })).toBe(false);
    expect(canCollectStamp({ id: 'fukuoka-konbini', noStamp: false })).toBe(false);
    expect(canCollectStamp({ id: 'no-such-node' })).toBe(false);
    expect(canCollectStamp(null)).toBe(false);
    expect(isStampAlbumNodeId('')).toBe(false);
    expect(isStampAlbumNodeId(undefined)).toBe(false);
  });

  it('기존 저장 ID 66개는 그대로 66개로 집계되고 지역 ID를 재매핑하지 않는다', () => {
    const legacySaved = new Set(WORLD_NODES.map((node) => node.id));
    const got = STAMP_ALBUM_NODES.reduce(
      (count, node) => count + (legacySaved.has(node.id) ? 1 : 0),
      0,
    );
    expect(got).toBe(66);
    expect(STAMP_ALBUM_NODES.find((node) => node.id === 'paris')?.gate?.to).toBe('grand-paris');
    expect(STAMP_ALBUM_NODES.find((node) => node.id === 'nice')?.gate?.to).toBe('cote-dazur');
    expect(isStampAlbumNodeId('grand-paris')).toBe(false);
    expect(isStampAlbumNodeId('cote-dazur')).toBe(false);
  });

  it('정본 manifest SHA-256을 고정한다', () => {
    const manifest = manifestJson();
    expect(Buffer.byteLength(manifest)).toBe(10458);
    expect(createHash('sha256').update(manifest).digest('hex'))
      .toBe('7457ac81ba78ce2070e6c80ddd53f60da7afb391a0cef97712cc39bf419ce8ca');
  });
});
