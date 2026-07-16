// 학습 월드 세션·좌표 API 의 순수 헬퍼 — IP 추출/좌표 검증(라우트·WorldPage·테스트 공용).
// 부수효과 0(브라우저/서버 API 미의존)이라 유닛 테스트가 쉽다.

import { isCorridorPlatformTile, TRANS_SIBERIAN_CORRIDOR } from './transsibCorridor';
import { isOverworldRegionTile, overworldRegionByScene } from './overworldRegions';

// x-forwarded-for(첫 항목)·x-real-ip 순으로 클라이언트 IP 를 고른다. 서버 라우트만 신뢰 가능한
// 값이므로(클라 위조 무의미) 라우트에서 request 헤더로 이 함수를 부른다. getHeader(name)=>value|null.
//   · x-forwarded-for: "client, proxy1, proxy2" — 첫 항목이 원 클라이언트.
//   · 없으면 x-real-ip, 그것도 없으면 null(→ RPC 에 NULL 전달 = IP 검사 생략).
export function extractClientIp(getHeader) {
  const get = typeof getHeader === 'function' ? getHeader : () => null;
  const xff = get('x-forwarded-for');
  if (xff) {
    const first = String(xff).split(',')[0].trim();
    if (first) return first;
  }
  const real = get('x-real-ip');
  if (real) {
    const v = String(real).trim();
    if (v) return v;
  }
  return null;
}

// 도시 정밀맵 씬 식별자('city:<id>') 형식 — 임의 문자열 저장을 막는 화이트 패턴(소문자·숫자·하이픈).
const CITY_SCENE_RE = /^city:[a-z0-9-]+$/;
const TRANSIT_TERMINAL_SCENES = new Set(['transsib-corridor']);

function previewSceneReleaseEligibility(scene) {
  if (TRANSIT_TERMINAL_SCENES.has(scene)) {
    return TRANS_SIBERIAN_CORRIDOR.releaseEligible === true;
  }
  const region = overworldRegionByScene(scene);
  return region ? region.releaseEligible === true : null;
}

export function normalizePositionScene(rawScene, { allowPreview = false } = {}) {
  if (rawScene === 'airport') return 'airport';
  const previewEligibility = previewSceneReleaseEligibility(rawScene);
  if (previewEligibility === true || (allowPreview && previewEligibility === false)) return rawScene;
  if (CITY_SCENE_RE.test(rawScene)) return rawScene;
  return 'plaza';
}

// 저장/조회한 좌표 payload 를 정수 타일좌표로 정규화한다. 유효하지 않으면 null.
//   scene 은 'plaza' | 'airport' | 'city:<id>'와 출시 허용된 확장 씬만 허용한다.
//   알려진 미출시 씬은 plaza 로 강등하지 않고 null 처리해 임의 좌표 저장을 막는다.
//   x·y 는 유한 정수(음수 불가). 반올림해 정수로 만든다.
export function normalizePosition(raw, { allowPreview = false } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const rawScene = typeof raw.scene === 'string' ? raw.scene : '';
  if (previewSceneReleaseEligibility(rawScene) === false && !allowPreview) return null;
  const x = Number(raw.x);
  const y = Number(raw.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0) return null;
  const scene = normalizePositionScene(rawScene, { allowPreview });
  if (scene === 'transsib-corridor' && !isCorridorPlatformTile(xi, yi)) return null;
  if (overworldRegionByScene(scene) && !isOverworldRegionTile(scene, xi, yi)) return null;
  return { scene, x: xi, y: yi };
}

// ── 초기 부팅 시 도시 정밀맵 직행 여부(순수) — WorldScene.create(bootData) 가 판별(Codex P1-1) ──
// Phaser 3 는 autostart 초기 부팅에도 Scene Settings 기본 데이터 `{}` 를 create 에 전달하므로,
// "초기 부팅인가"를 bootData 유무(!bootData)로 판별하면 안 된다 — **복귀 데이터(bootData.spawn)
// 유무**로 판별한다: spawn 이 실려 있으면 도시→전국 복귀(리다이렉트 금지 — 재귀 방지), 없으면
// 초기 부팅이므로 저장 씬이 'city:<id>' 이고 해당 도시 데이터가 실존하면 그 씬 키를 반환한다.
// hasCity(id)=>bool 은 호출부가 주입(GameCanvas 는 CITY_DATA 레지스트리로, 테스트는 페이크로).
// 반환: 리다이렉트할 씬 키('city:<id>') | null(전국맵 진행 — 도시 데이터 없음 폴백 포함).
export function cityRedirectScene(bootData, savedSpawn, hasCity) {
  if (bootData && bootData.spawn) return null; // 도시→전국 복귀 — 리다이렉트하지 않음
  const sc = savedSpawn && typeof savedSpawn.scene === 'string' ? savedSpawn.scene : '';
  if (!sc.startsWith('city:')) return null;
  const id = sc.slice(5);
  return (typeof hasCity === 'function' && hasCity(id)) ? sc : null;
}

export function corridorRedirectScene(bootData, savedSpawn, { allowPreview = false } = {}) {
  if (bootData && bootData.spawn) return null;
  if (TRANS_SIBERIAN_CORRIDOR.releaseEligible !== true && !allowPreview) return null;
  if (savedSpawn?.scene !== 'transsib-corridor') return null;
  return isCorridorPlatformTile(Number(savedSpawn.x), Number(savedSpawn.y)) ? 'transsib-corridor' : null;
}

export function overworldRegionRedirectScene(bootData, savedSpawn, { allowPreview = false } = {}) {
  if (bootData && bootData.spawn) return null;
  const scene = typeof savedSpawn?.scene === 'string' ? savedSpawn.scene : '';
  const region = overworldRegionByScene(scene);
  if (!region || (region.releaseEligible !== true && !allowPreview)) return null;
  return isOverworldRegionTile(scene, Number(savedSpawn.x), Number(savedSpawn.y)) ? scene : null;
}

export function defaultOverworldRegionSpawn(bootData, savedSpawn, defaultSpawn) {
  if (bootData?.spawn || savedSpawn != null || !defaultSpawn || typeof defaultSpawn !== 'object') return null;
  const scene = typeof defaultSpawn.scene === 'string' ? defaultSpawn.scene : '';
  const region = overworldRegionByScene(scene);
  const x = Number(defaultSpawn.x);
  const y = Number(defaultSpawn.y);
  if (!region || region.releaseEligible !== true || !isOverworldRegionTile(scene, x, y)) return null;
  return Object.freeze({ scene, x, y });
}

// 스폰 타일이 맵 안이고 걸을 수 있는지(순수). isWalkable(tx,ty)=>bool 은 호출부가 주입
// (GameCanvas 는 씬의 tileCode/blocked 로, 테스트는 페이크로). 범위 밖·비보행이면 false.
export function isSpawnTileValid(tx, ty, cols, rows, isWalkable) {
  if (!Number.isInteger(tx) || !Number.isInteger(ty)) return false;
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return false;
  return typeof isWalkable === 'function' ? !!isWalkable(tx, ty) : true;
}

// 위치 영속 판정(순수) — local:state 페이로드가 재접속 스폰 원천으로 저장될 수 있는가.
//   ── persistable 계약 ──
//   저장 허용 씬은 'plaza', 'city:<id>'와 releaseEligible=true인 확장 씬이다.
//   · GameCanvas 는 페리 항해 중(this.ferrying)·물 타일 위 좌표를, airportScene 은 공항 좌표를
//     persistable:false 로 emit 한다 → 여기서 제외돼 서울/게이트 앞 폴백이 유지된다.
//   · 공항 씬(scene:'airport')은 플래그와 무관하게 영속 대상에서 제외한다(방어적 — 광장에 직접
//     배치 불가한 좌표). 플라자·도시·출시된 확장 씬만 재접속 스폰 원천이 된다.
//   · 미출시 횡단철도·지역은 persistable 플래그와 무관하게 제외한다.
//   payload 에 persistable 이 없으면(하위호환·일반 플라자 좌표) 영속 대상으로 본다.
export function isPersistablePosition(st) {
  if (!st || st.persistable === false) return false;
  const scene = typeof st.scene === 'string' ? st.scene : 'plaza';
  return scene === 'plaza' || CITY_SCENE_RE.test(scene)
    || previewSceneReleaseEligibility(scene) === true;
}
