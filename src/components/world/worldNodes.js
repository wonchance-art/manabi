// 🗺️ 장소 노드 시스템 — 학습 월드(GameCanvas)의 주요 지점(도시·공항·항구·랜드마크)과
// 그 상호작용(게이트)을 한 곳에 모은 정적 데이터. mapData.js(자동 생성, 무수정)는 읽기 전용으로만
// 소비한다 — 좌표는 POI(등장방형 투영 산출값)에서 그대로 가져온다.
//
// 노드 모양:
//   { id, name, desc, kind:'city'|'airport'|'port'|'landmark', tile:[x,y],
//     gate?: { type:'story-scene', scene:'airport', label } | { type:'ferry', to:'<node id>', label } }
//   desc: A(말 걸기)로 여는 GBC 설명 박스에 이름과 함께 표시하는 1~2문장(전 노드·명산 필수).
//
// gate 없는 노드는 표지 마커만(김해공항·도시·랜드마크) — 이름 라벨은 없고, A로 desc를 읽는다.
// gate 있는 노드는 근접 시 A로 상호작용(desc는 게이트 프롬프트에 한 줄 병기):
//   · story-scene : 같은 Phaser 게임의 씬으로 전환(인천공항 → 공항 스토리 씬 → 도쿄 독해).
//   · ferry       : 확인 다이얼로그 → 페이드 → 상대 항구 인접 land 로 이동(보상·XP 없음, 왕방향 대칭).
//
// React/Next/Phaser 의존 0 — vitest(node)에서 그대로 임포트해 무결성을 검증한다.

import { POI, MAP_W, MAP_H, TERRAIN, decodeMap, project } from './mapData';
import { buildPlayableGrid } from '../../lib/world/mapGeo';

// 명산(名山) — 전용 도트 조각. lon/lat 는 build-map.mjs NAMED_PEAKS 와 동일값이라
// project() 로 얻는 타일이 build-map 이 PEAK 로 보장한 타일과 정확히 일치한다(오프셋 0). peak 필드는
// GameCanvas 가 t_peak_<peak> 전용 텍스처를 골라 마커 대신 그리는 키다. 게이트 없음(A로 desc 열람).
//   백두·금강은 DMZ 북측이라 도달 불가 — 철조망 너머로 보이기만 하는 의도된 연출(라벨은 근접 시).
const NAMED_PEAKS = [
  { id: 'geumgang', name: '금강산', peak: 'geumgang', lon: 128.115, lat: 38.667, desc: '기암괴석으로 이름난 명산. 계절마다 다른 이름으로 불릴 만큼 경치가 빼어나요.' },
  { id: 'seorak', name: '설악산', peak: 'seorak', lon: 128.470, lat: 38.120, desc: '험준한 봉우리와 단풍으로 유명한 강원도의 명산이에요.' },
  { id: 'bukhan', name: '북한산', peak: 'bukhan', lon: 126.990, lat: 37.660, desc: '서울을 굽어보는 화강암 명산. 도심 가까이 우뚝 솟아 있어요.' },
  { id: 'jiri', name: '지리산', peak: 'jiri', lon: 127.730, lat: 35.340, desc: '남부 내륙에 넉넉하고 웅장한 산줄기를 펼친 명산이에요.' },
  { id: 'halla', name: '한라산', peak: 'halla', lon: 126.530, lat: 33.370, desc: '제주도 한가운데 우뚝한 한국 남단 최고봉. 정상에 백록담 분화구가 있어요.' },
  { id: 'aso', name: '아소산', peak: 'aso', lon: 131.090, lat: 32.880, desc: '일본 규슈의 활화산. 세계에서 손꼽히는 거대한 칼데라를 품고 있어요.' },
].map(({ id, name, peak, lon, lat, desc }) => {
  const { x, y } = project(lon, lat);
  return { id, name, kind: 'landmark', tile: [x, y], peak, desc };
});

export const WORLD_NODES = [
  // 서울 — 스폰 도시.
  { id: 'seoul', name: '서울', kind: 'city', tile: [POI.SEOUL.x, POI.SEOUL.y], desc: '대한민국의 수도. 한강이 도시를 가로지르고, 예부터 지금까지 나라의 중심지예요.' },
  // 인천공항(영종도) — 기존 하드코딩 "도쿄 여행" 게이트를 이 노드로 이관. A → 공항 스토리 씬.
  {
    id: 'incheon-airport', name: '인천공항', kind: 'airport', tile: [POI.INCHEON.x, POI.INCHEON.y],
    gate: { type: 'story-scene', scene: 'airport', label: '✈ 도쿄' },
    desc: '한국의 관문 국제공항. 여기서 비행기를 타고 도쿄로 떠나요.',
  },
  // 김해공항 — 게이트 없음(표지 마커만).
  { id: 'gimhae-airport', name: '김해공항', kind: 'airport', tile: [POI.GIMHAE_AIR.x, POI.GIMHAE_AIR.y], desc: '부산 곁의 국제공항. 영남 지방 하늘길의 중심이에요.' },
  // 부산 — 도시.
  { id: 'busan', name: '부산', kind: 'city', tile: [POI.BUSAN.x, POI.BUSAN.y], desc: '한국 제2의 도시이자 최대 항구도시. 바다와 산이 어우러져 있어요.' },
  // 부산국제여객터미널 — 후쿠오카항행 페리.
  {
    id: 'busan-port', name: '부산국제여객터미널', kind: 'port', tile: [POI.BUSAN_TERMINAL.x, POI.BUSAN_TERMINAL.y],
    gate: { type: 'ferry', to: 'fukuoka-port', label: '⚓ 후쿠오카' },
    desc: '일본으로 가는 국제여객선이 드나드는 항구. 후쿠오카행 페리가 출발해요.',
  },
  // 후쿠오카항 — 부산행 페리(왕방향 대칭).
  {
    id: 'fukuoka-port', name: '후쿠오카항', kind: 'port', tile: [POI.FUKUOKA_PORT.x, POI.FUKUOKA_PORT.y],
    gate: { type: 'ferry', to: 'busan-port', label: '⚓ 부산' },
    desc: '일본 규슈의 관문 항구. 부산행 페리가 오가요.',
  },
  // 도쿄 — 도시.
  { id: 'tokyo', name: '도쿄', kind: 'city', tile: [POI.TOKYO.x, POI.TOKYO.y], desc: '일본의 수도. 세계에서 가장 사람이 많이 사는 대도시권이에요.' },
  // 하네다 — 랜드마크(표지 마커만).
  { id: 'haneda', name: '하네다', kind: 'landmark', tile: [POI.HANEDA.x, POI.HANEDA.y], desc: '도쿄의 바닷가 국제공항. 일본에서 가장 붐비는 하늘길이에요.' },
  // 백두산 — 설산 랜드마크(게이트 없음, 마커만). DMZ 북측이라 철조망 너머로 보이기만 하고
  //   실제로는 도달 불가 — 의도된 연출(넘어갈 수 없는, 멀리 보이는 설산). PEAK 타일 위. peak='baekdu'.
  { id: 'baekdu', name: '백두산', kind: 'landmark', tile: [POI.BAEKDU.x, POI.BAEKDU.y], peak: 'baekdu', desc: '한반도에서 가장 높은 산. 정상에 천지라는 큰 화산 호수가 있어요.' },
  // 후지산 — 설산 랜드마크(게이트 없음). PEAK 타일 위, 혼슈에서 도달 가능. peak='fuji'.
  { id: 'fuji', name: '후지산', kind: 'landmark', tile: [POI.FUJI.x, POI.FUJI.y], peak: 'fuji', desc: '일본에서 가장 높은 산. 좌우 대칭의 아름다운 원뿔 모양으로 유명해요.' },
  // 명산 6종(금강·설악·북한·지리·한라·아소) — 전용 도트 조각 + 이름 라벨.
  ...NAMED_PEAKS,
  // 동해항 — 사카이미나토행 페리(실존 DBS 항로 모티프).
  {
    id: 'donghae-port', name: '동해항', kind: 'port', tile: [POI.DONGHAE_PORT.x, POI.DONGHAE_PORT.y],
    gate: { type: 'ferry', to: 'sakaiminato-port', label: '⚓ 사카이미나토' },
    desc: '동해 국제여객터미널. 일본 산인 지방으로 가는 항로가 열려 있어요.',
  },
  // 사카이미나토 — 동해항행 페리(왕방향 대칭).
  {
    id: 'sakaiminato-port', name: '사카이미나토', kind: 'port', tile: [POI.SAKAIMINATO.x, POI.SAKAIMINATO.y],
    gate: { type: 'ferry', to: 'donghae-port', label: '⚓ 동해' },
    desc: '돗토리현의 항구 도시. 신지호와 다이센으로 가는 관문이에요.',
  },
  // 거제 — 도시(게이트 없음, 표지 마커만). 두 다리로 이어진 섬(거제대교·통영 / 거가대교·가덕도·부산).
  { id: 'geoje', name: '거제', kind: 'city', tile: [POI.GEOJE.x, POI.GEOJE.y], desc: '거제대교로 통영과, 거가대교로 가덕도·부산과 이어진 섬. 조선업으로 이름난 항구 도시예요.' },
  // 통영 — 도시(게이트 없음, 표지 마커만). 견내량 건너 거제대교로 거제와 이어지는 본토측 관문.
  { id: 'tongyeong', name: '통영', kind: 'city', tile: [POI.TONGYEONG.x, POI.TONGYEONG.y], desc: '한려수도의 항구 도시. 견내량을 건너는 거제대교로 거제와 이어지고, 예부터 이름난 수산의 고장이에요.' },
  // 다이센 — 랜드마크(게이트 없음). peak 필드는 넣지 않음 — 전용 도트 조각은 후속, 일반 마커+라벨.
  { id: 'daisen', name: '다이센', kind: 'landmark', tile: [POI.DAISEN.x, POI.DAISEN.y], desc: '산인 지방의 명봉. 모양이 후지산을 닮아 "호키후지"라고도 불려요.' },
  // 돗토리 — 랜드마크(게이트 없음). 코야마호 곁의 해안 사구.
  { id: 'tottori', name: '돗토리', kind: 'landmark', tile: [POI.TOTTORI.x, POI.TOTTORI.y], desc: '일본 최대의 사구가 펼쳐진 해안 도시. 코야마호를 곁에 두고 있어요.' },
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

// 미니맵 편의: 현재 맵을 디코드 → 플레이 가능 격자(광장 SEA→LAND)로 변환해 다운샘플.
// buildPlayableGrid 를 거쳐 런타임 격자·관리자 뷰와 동일 산출을 표시한다(P2-6 — raw 격자 불일치 해소).
// GameCanvas 미니맵 오버레이가 1회 호출.
export function buildMinimap(factor = 4) {
  return downsampleMinimap(buildPlayableGrid(decodeMap()), factor);
}
