import { describe, it, expect } from 'vitest';
import { WORLD_NODES, getNode, downsampleMinimap, buildMinimap } from '../worldNodes.js';
import { decodeMap, MAP_W, MAP_H, TERRAIN, isBlocked } from '../mapData.js';
import { buildPlayableGrid } from '../../../lib/world/mapGeo.js';

// 🧭 장소 노드 시스템 무결성 + 미니맵 다운샘플(순수 함수) 검증.
// mapData(무수정, 소비만)의 실제 디코드 격자에 대해 노드가 통행 가능 타일 위에 있는지,
// 게이트 참조가 유효한지, 페리가 왕방향 대칭인지, 다운샘플이 결정적 4색인지 확인한다.

const grid = decodeMap();
const KINDS = new Set(['city', 'airport', 'port', 'landmark']);

describe('WORLD_NODES 무결성', () => {
  it('id 는 고유하고 kind 는 허용된 4종', () => {
    const ids = WORLD_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of WORLD_NODES) expect(KINDS.has(n.kind)).toBe(true);
  });

  it('모든 노드 tile 은 격자 범위 안', () => {
    for (const n of WORLD_NODES) {
      const [x, y] = n.tile;
      expect(x >= 0 && x < MAP_W).toBe(true);
      expect(y >= 0 && y < MAP_H).toBe(true);
    }
  });

  it('모든 노드는 통행 가능 타일 위(!isBlocked)', () => {
    for (const n of WORLD_NODES) {
      const [x, y] = n.tile;
      const code = grid[y * MAP_W + x];
      expect(isBlocked(code)).toBe(false);
    }
  });

  it('모든 노드·명산은 desc(설명) 1~2문장을 갖는다 — A(말 걸기) 설명 박스용', () => {
    for (const n of WORLD_NODES) {
      expect(typeof n.desc).toBe('string');
      expect(n.desc.trim().length).toBeGreaterThan(0);
    }
    // 대표 노드 몇 개는 내용까지 확인(간결 저작).
    expect(getNode('seoul').desc).toContain('수도');
    expect(getNode('fuji').desc).toContain('가장 높은 산');
  });

  it('스폰 도시 서울 존재 + 필수 노드 구성', () => {
    expect(getNode('seoul')).toBeTruthy();
    expect(getNode('seoul').kind).toBe('city');
    // 인천공항(스토리 게이트)·김해공항(게이트 없음)·부산/후쿠오카 항구·도쿄·하네다.
    expect(getNode('incheon-airport').kind).toBe('airport');
    expect(getNode('gimhae-airport').gate).toBeUndefined();
    expect(getNode('haneda').kind).toBe('landmark');
  });
});

describe('게이트 참조 유효성', () => {
  it('인천공항 게이트는 story-scene(airport)', () => {
    const g = getNode('incheon-airport').gate;
    expect(g).toMatchObject({ type: 'story-scene', scene: 'airport' });
    expect(typeof g.label).toBe('string');
  });

  it('모든 ferry 게이트의 to 는 실존 항구(port) 노드를 가리킨다', () => {
    for (const n of WORLD_NODES) {
      if (n.gate?.type !== 'ferry') continue;
      const dest = getNode(n.gate.to);
      expect(dest).toBeTruthy();
      expect(dest.kind).toBe('port');
      expect(typeof n.gate.label).toBe('string');
    }
  });

  it('페리는 왕방향 대칭 — A→B 면 B→A', () => {
    const ferries = WORLD_NODES.filter((n) => n.gate?.type === 'ferry');
    expect(ferries.length).toBeGreaterThan(0);
    for (const n of ferries) {
      const back = getNode(n.gate.to);
      expect(back.gate?.type).toBe('ferry');
      expect(back.gate.to).toBe(n.id);
    }
  });

  it('부산국제여객터미널 ↔ 후쿠오카항 왕복', () => {
    expect(getNode('busan-port').gate.to).toBe('fukuoka-port');
    expect(getNode('fukuoka-port').gate.to).toBe('busan-port');
  });
});

describe('미니맵 다운샘플(순수 함수)', () => {
  it('4타일→1px 로 112×96 격자를 만든다', () => {
    const { w, h, codes } = downsampleMinimap(grid, 4);
    expect(w).toBe(Math.ceil(MAP_W / 4));
    expect(h).toBe(Math.ceil(MAP_H / 4));
    expect(w).toBe(112);
    expect(h).toBe(96);
    expect(codes.length).toBe(w * h);
  });

  it('코드는 6색(sea/land/river/fence/mountain/peak) 이내로만 축약된다', () => {
    const { codes } = downsampleMinimap(grid, 4);
    const allowed = new Set([TERRAIN.SEA, TERRAIN.LAND, TERRAIN.RIVER, TERRAIN.FENCE, TERRAIN.MOUNTAIN, TERRAIN.PEAK]);
    for (let i = 0; i < codes.length; i++) expect(allowed.has(codes[i])).toBe(true);
  });

  it('산지·설산이 미니맵에 대표색으로 남는다(PLAIN 은 land 로 접힘)', () => {
    const { w, codes } = downsampleMinimap(grid, 4);
    let hasMountain = false, hasPeak = false, hasPlain = false;
    for (let i = 0; i < codes.length; i++) {
      if (codes[i] === TERRAIN.MOUNTAIN) hasMountain = true;
      if (codes[i] === TERRAIN.PEAK) hasPeak = true;
      if (codes[i] === TERRAIN.PLAIN) hasPlain = true;
    }
    expect(hasMountain).toBe(true);
    expect(hasPeak).toBe(true);
    expect(hasPlain).toBe(false); // PLAIN → LAND 로 접힘
    expect(w).toBe(112);
  });

  it('결정적 — 두 번 호출 결과 동일', () => {
    const a = downsampleMinimap(grid, 4);
    const b = downsampleMinimap(grid, 4);
    expect(Array.from(a.codes)).toEqual(Array.from(b.codes));
  });

  it('factor 를 바꾸면 해상도가 달라진다', () => {
    const a = downsampleMinimap(grid, 4);
    const b = downsampleMinimap(grid, 8);
    expect(b.w).toBeLessThan(a.w);
    expect(b.h).toBeLessThan(a.h);
  });

  it('우선순위: 블록에 fence 가 있으면 fence 로 대표된다', () => {
    // fence(DMZ) 타일이 든 블록을 찾아 대표값이 FENCE 인지 확인.
    let fx = -1, fy = -1;
    for (let i = 0; i < grid.length && fx < 0; i++) {
      if (grid[i] === TERRAIN.FENCE) { fx = i % MAP_W; fy = (i / MAP_W) | 0; }
    }
    expect(fx).toBeGreaterThanOrEqual(0);
    const { w, codes } = downsampleMinimap(grid, 4);
    const bx = (fx / 4) | 0, by = (fy / 4) | 0;
    expect(codes[by * w + bx]).toBe(TERRAIN.FENCE);
  });

  it('buildMinimap() 은 플레이 가능 격자(광장 SEA→LAND)를 downsample 한 결과', () => {
    // buildMinimap 은 buildPlayableGrid 를 거쳐 런타임·관리자 뷰와 동일 산출을 그린다(P2-6).
    const a = buildMinimap(4);
    const b = downsampleMinimap(buildPlayableGrid(decodeMap()), 4);
    expect(a.w).toBe(b.w);
    expect(Array.from(a.codes)).toEqual(Array.from(b.codes));
  });
});
