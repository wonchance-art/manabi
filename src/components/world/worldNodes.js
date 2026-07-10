// 🗺️ 장소 노드 시스템 — 학습 월드(GameCanvas)의 주요 지점(도시·공항·항구·랜드마크)과
// 그 상호작용(게이트)을 한 곳에 모은 정적 데이터. mapData.js(자동 생성, 무수정)는 읽기 전용으로만
// 소비한다 — 좌표는 POI(등장방형 투영 산출값)에서 그대로 가져온다.
//
// 노드 모양:
//   { id, name, kind:'city'|'airport'|'port'|'landmark', tile:[x,y],
//     gate?: { type:'story-scene', scene:'airport', label } | { type:'ferry', to:'<node id>', label } }
//
// gate 없는 노드는 표지 마커+이름 라벨만(김해공항·도시·랜드마크). gate 있는 노드는 근접 시 A로 상호작용:
//   · story-scene : 같은 Phaser 게임의 씬으로 전환(인천공항 → 공항 스토리 씬 → 도쿄 독해).
//   · ferry       : 확인 다이얼로그 → 페이드 → 상대 항구 인접 land 로 이동(보상·XP 없음, 왕방향 대칭).
//
// React/Next/Phaser 의존 0 — vitest(node)에서 그대로 임포트해 무결성을 검증한다.

import { POI, MAP_W, MAP_H, TERRAIN, decodeMap } from './mapData';

export const WORLD_NODES = [
  // 서울 — 스폰 도시.
  { id: 'seoul', name: '서울', kind: 'city', tile: [POI.SEOUL.x, POI.SEOUL.y] },
  // 인천공항(영종도) — 기존 하드코딩 "도쿄 여행" 게이트를 이 노드로 이관. A → 공항 스토리 씬.
  {
    id: 'incheon-airport', name: '인천공항', kind: 'airport', tile: [POI.INCHEON.x, POI.INCHEON.y],
    gate: { type: 'story-scene', scene: 'airport', label: '✈ 도쿄' },
  },
  // 김해공항 — 게이트 없음(표지 마커만).
  { id: 'gimhae-airport', name: '김해공항', kind: 'airport', tile: [POI.GIMHAE_AIR.x, POI.GIMHAE_AIR.y] },
  // 부산 — 도시.
  { id: 'busan', name: '부산', kind: 'city', tile: [POI.BUSAN.x, POI.BUSAN.y] },
  // 부산국제여객터미널 — 후쿠오카항행 페리.
  {
    id: 'busan-port', name: '부산국제여객터미널', kind: 'port', tile: [POI.BUSAN_TERMINAL.x, POI.BUSAN_TERMINAL.y],
    gate: { type: 'ferry', to: 'fukuoka-port', label: '⚓ 후쿠오카' },
  },
  // 후쿠오카항 — 부산행 페리(왕방향 대칭).
  {
    id: 'fukuoka-port', name: '후쿠오카항', kind: 'port', tile: [POI.FUKUOKA_PORT.x, POI.FUKUOKA_PORT.y],
    gate: { type: 'ferry', to: 'busan-port', label: '⚓ 부산' },
  },
  // 도쿄 — 도시.
  { id: 'tokyo', name: '도쿄', kind: 'city', tile: [POI.TOKYO.x, POI.TOKYO.y] },
  // 하네다 — 랜드마크(표지 마커만).
  { id: 'haneda', name: '하네다', kind: 'landmark', tile: [POI.HANEDA.x, POI.HANEDA.y] },
  // 백두산 — 설산 랜드마크(게이트 없음, 마커+이름 라벨만). DMZ 북측이라 철조망 너머로 보이기만 하고
  //   실제로는 도달 불가 — 의도된 연출(넘어갈 수 없는, 멀리 보이는 설산). PEAK 타일 위.
  { id: 'baekdu', name: '백두산', kind: 'landmark', tile: [POI.BAEKDU.x, POI.BAEKDU.y] },
  // 후지산 — 설산 랜드마크(게이트 없음). PEAK 타일 위, 혼슈에서 도달 가능.
  { id: 'fuji', name: '후지산', kind: 'landmark', tile: [POI.FUJI.x, POI.FUJI.y] },
];

// id → 노드(게이트 참조 해석·페리 목적지 조회용).
export function getNode(id) {
  return WORLD_NODES.find((n) => n.id === id) || null;
}

// ── 미니맵 다운샘플(순수 함수) ──
// mapData 격자(TERRAIN 코드)를 factor×factor 블록으로 묶어 저해상 미니맵 코드 격자를 만든다.
// 6색 이내(sea/land/river/fence/mountain/peak)로 접으며, 블록 대표값은 "눈에 띄어야 하는 것" 우선순위:
//   fence(DMZ 차단벽) > river/lake(내륙 수계) > peak(설산) > mountain(산지) > land/plain/bridge(육지) > sea.
// (lake→RIVER, plain·bridge→LAND 로 접는다 — 평야는 육지와 동색, 산지·설산만 별색으로 강조.)
// 반환: { w, h, codes:Uint8Array(w*h) } — codes[i] ∈ {SEA,LAND,RIVER,FENCE,MOUNTAIN,PEAK}. 결정적·부작용 없음.
export function downsampleMinimap(grid, factor = 4) {
  const w = Math.ceil(MAP_W / factor);
  const h = Math.ceil(MAP_H / factor);
  const codes = new Uint8Array(w * h);
  for (let by = 0; by < h; by++) {
    for (let bx = 0; bx < w; bx++) {
      let hasFence = false, hasWater = false, hasPeak = false, hasMountain = false, hasLand = false;
      const y0 = by * factor, x0 = bx * factor;
      for (let dy = 0; dy < factor; dy++) {
        const ty = y0 + dy;
        if (ty >= MAP_H) break;
        for (let dx = 0; dx < factor; dx++) {
          const tx = x0 + dx;
          if (tx >= MAP_W) break;
          const c = grid[ty * MAP_W + tx];
          if (c === TERRAIN.FENCE) hasFence = true;
          else if (c === TERRAIN.RIVER || c === TERRAIN.LAKE) hasWater = true;
          else if (c === TERRAIN.PEAK) hasPeak = true;
          else if (c === TERRAIN.MOUNTAIN) hasMountain = true;
          else if (c === TERRAIN.LAND || c === TERRAIN.BRIDGE || c === TERRAIN.PLAIN) hasLand = true;
        }
      }
      codes[by * w + bx] = hasFence ? TERRAIN.FENCE
        : hasWater ? TERRAIN.RIVER
          : hasPeak ? TERRAIN.PEAK
            : hasMountain ? TERRAIN.MOUNTAIN
              : hasLand ? TERRAIN.LAND
                : TERRAIN.SEA;
    }
  }
  return { w, h, codes };
}

// 미니맵 편의: 현재 맵을 디코드해 다운샘플(GameCanvas 오버레이가 1회 호출).
export function buildMinimap(factor = 4) {
  return downsampleMinimap(decodeMap(), factor);
}
