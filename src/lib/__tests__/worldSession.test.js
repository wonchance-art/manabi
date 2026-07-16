import { describe, it, expect } from 'vitest';
import {
  extractClientIp, normalizePosition, normalizePositionScene, isSpawnTileValid,
  isPersistablePosition, cityRedirectScene, corridorRedirectScene,
  defaultOverworldRegionSpawn, overworldRegionRedirectScene,
} from '../world/session.js';

// ─────────────────────────────────────────────────────────────
describe('extractClientIp — 헤더에서 클라이언트 IP 추출(순수)', () => {
  const from = (map) => extractClientIp((n) => map[n] ?? null);

  it('x-forwarded-for 의 첫 항목(원 클라이언트)을 고른다', () => {
    expect(from({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' })).toBe('203.0.113.7');
  });

  it('첫 항목 앞뒤 공백을 다듬는다', () => {
    expect(from({ 'x-forwarded-for': '  198.51.100.2 , 10.0.0.1' })).toBe('198.51.100.2');
  });

  it('x-forwarded-for 가 없으면 x-real-ip 로 폴백', () => {
    expect(from({ 'x-real-ip': '192.0.2.44' })).toBe('192.0.2.44');
  });

  it('둘 다 없으면 null(→ RPC 에 NULL = IP 검사 생략)', () => {
    expect(from({})).toBeNull();
  });

  it('빈 문자열 헤더는 무시하고 폴백/ null', () => {
    expect(from({ 'x-forwarded-for': '', 'x-real-ip': '  ' })).toBeNull();
    expect(from({ 'x-forwarded-for': '  ,10.0.0.1', 'x-real-ip': '192.0.2.9' })).toBe('192.0.2.9');
  });

  it('getHeader 가 함수가 아니면 안전하게 null', () => {
    expect(extractClientIp(null)).toBeNull();
    expect(extractClientIp(undefined)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
describe('normalizePosition — 저장 좌표 정규화(순수)', () => {
  it('정수 좌표 + 허용 씬을 그대로 통과', () => {
    expect(normalizePosition({ scene: 'plaza', x: 68, y: 208 })).toEqual({ scene: 'plaza', x: 68, y: 208 });
    expect(normalizePosition({ scene: 'airport', x: 3, y: 4 })).toEqual({ scene: 'airport', x: 3, y: 4 });
  });

  it('알 수 없는 씬은 plaza 로 강제', () => {
    expect(normalizePosition({ scene: 'moon', x: 1, y: 2 }).scene).toBe('plaza');
    expect(normalizePosition({ x: 1, y: 2 }).scene).toBe('plaza'); // 씬 누락 → plaza
  });

  it('도시 정밀맵 씬(city:<id>)은 그대로 보존한다(계층형 맵)', () => {
    expect(normalizePosition({ scene: 'city:fukuoka', x: 47, y: 60 })).toEqual({ scene: 'city:fukuoka', x: 47, y: 60 });
    // 형식 밖(대문자·공백·빈 id)은 plaza 로 강등(임의 문자열 저장 차단).
    expect(normalizePosition({ scene: 'city:', x: 1, y: 2 }).scene).toBe('plaza');
    expect(normalizePosition({ scene: 'City:Fukuoka', x: 1, y: 2 }).scene).toBe('plaza');
  });

  it('미출시 횡단철도 씬은 플랫폼 좌표여도 서버 저장을 거부한다', () => {
    expect(normalizePosition({ scene: 'transsib-corridor', x: 8, y: 8 })).toBeNull();
    expect(normalizePositionScene('transsib-corridor')).toBe('plaza');
    expect(normalizePositionScene('transsib-admin')).toBe('plaza');
    expect(normalizePosition({ scene: 'transsib-corridor', x: 9, y: 8 })).toBeNull();
  });

  it('출시된 APAC은 저장하고 미출시 EMEA는 거부한다', () => {
    expect(normalizePosition({ scene: 'overworld:asia-pacific', x: 1576, y: 442 })).toEqual({
      scene: 'overworld:asia-pacific', x: 1576, y: 442,
    });
    expect(normalizePosition({ scene: 'overworld:emea', x: 768, y: 253 })).toBeNull();
    expect(normalizePosition({ scene: 'overworld:emea', x: 964, y: 253 })).toBeNull();
    expect(normalizePosition({ scene: 'overworld:asia-pacific', x: 1576, y: 2669 })).toBeNull();
    expect(normalizePositionScene('overworld:unknown')).toBe('plaza');
  });

  it('명시적인 관리자 미리보기 권한에서만 등록된 미출시 지역 좌표를 허용한다', () => {
    expect(normalizePosition({
      scene: 'overworld:asia-pacific', x: 1576, y: 442,
    }, { allowPreview: true })).toEqual({
      scene: 'overworld:asia-pacific', x: 1576, y: 442,
    });
    expect(normalizePosition({
      scene: 'overworld:emea', x: 768, y: 253,
    }, { allowPreview: true })).toEqual({
      scene: 'overworld:emea', x: 768, y: 253,
    });
    expect(normalizePosition({
      scene: 'overworld:emea', x: 964, y: 253,
    }, { allowPreview: true })).toBeNull();
    expect(normalizePositionScene('overworld:emea', { allowPreview: true })).toBe('overworld:emea');
    expect(normalizePositionScene('overworld:unknown', { allowPreview: true })).toBe('plaza');
  });

  it('소수 좌표는 반올림', () => {
    expect(normalizePosition({ scene: 'plaza', x: 5.6, y: 9.2 })).toEqual({ scene: 'plaza', x: 6, y: 9 });
  });

  it('문자열 숫자도 수용', () => {
    expect(normalizePosition({ scene: 'plaza', x: '10', y: '20' })).toEqual({ scene: 'plaza', x: 10, y: 20 });
  });

  it('비유한/음수/비객체는 null', () => {
    expect(normalizePosition({ scene: 'plaza', x: NaN, y: 1 })).toBeNull();
    expect(normalizePosition({ scene: 'plaza', x: 'abc', y: 1 })).toBeNull();
    expect(normalizePosition({ scene: 'plaza', x: -1, y: 1 })).toBeNull();
    expect(normalizePosition(null)).toBeNull();
    expect(normalizePosition('nope')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
describe('isSpawnTileValid — 스폰 타일 유효성(순수)', () => {
  const cols = 10, rows = 8;
  const walkableAll = () => true;

  it('범위 안 + 보행 가능이면 true', () => {
    expect(isSpawnTileValid(5, 4, cols, rows, walkableAll)).toBe(true);
  });

  it('범위 밖(음수·경계 초과)이면 false', () => {
    expect(isSpawnTileValid(-1, 0, cols, rows, walkableAll)).toBe(false);
    expect(isSpawnTileValid(0, -1, cols, rows, walkableAll)).toBe(false);
    expect(isSpawnTileValid(cols, 0, cols, rows, walkableAll)).toBe(false);
    expect(isSpawnTileValid(0, rows, cols, rows, walkableAll)).toBe(false);
  });

  it('비정수 좌표는 false', () => {
    expect(isSpawnTileValid(1.5, 2, cols, rows, walkableAll)).toBe(false);
  });

  it('보행 불가(바다·울타리·팻말) 타일이면 false', () => {
    const blockedAt = (x, y) => !(x === 3 && y === 3); // (3,3)만 막힘
    expect(isSpawnTileValid(3, 3, cols, rows, blockedAt)).toBe(false);
    expect(isSpawnTileValid(2, 3, cols, rows, blockedAt)).toBe(true);
  });

  it('isWalkable 미제공이면 범위만 검사', () => {
    expect(isSpawnTileValid(5, 4, cols, rows)).toBe(true);
    expect(isSpawnTileValid(50, 4, cols, rows)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
describe('isPersistablePosition — 위치 영속 판정(순수)', () => {
  it('일반 플라자 좌표(persistable 누락/true)는 영속 대상', () => {
    expect(isPersistablePosition({ scene: 'plaza', x: 5, y: 6 })).toBe(true);            // 하위호환(필드 없음)
    expect(isPersistablePosition({ scene: 'plaza', x: 5, y: 6, persistable: true })).toBe(true);
  });

  it('persistable:false(페리 항해·물 타일·공항 좌표)는 영속 제외', () => {
    expect(isPersistablePosition({ scene: 'plaza', x: 5, y: 6, persistable: false })).toBe(false);
    expect(isPersistablePosition({ scene: 'airport', x: 3, y: 4, persistable: false })).toBe(false);
  });

  it('도시 정밀맵(city:<id>) 좌표는 영속 대상(도시 내 위치 저장)', () => {
    expect(isPersistablePosition({ scene: 'city:fukuoka', x: 47, y: 60 })).toBe(true);
    expect(isPersistablePosition({ scene: 'city:fukuoka', x: 47, y: 60, persistable: true })).toBe(true);
    expect(isPersistablePosition({ scene: 'city:fukuoka', x: 47, y: 60, persistable: false })).toBe(false);
  });

  it('공항 씬은 플래그와 무관하게 영속 제외(플라자·도시만 스폰 원천)', () => {
    expect(isPersistablePosition({ scene: 'airport', x: 3, y: 4 })).toBe(false);
    expect(isPersistablePosition({ scene: 'airport', x: 3, y: 4, persistable: true })).toBe(false);
  });

  it('미출시 횡단철도는 플랫폼과 운행 중 좌표를 모두 저장하지 않는다', () => {
    expect(isPersistablePosition({ scene: 'transsib-corridor', x: 8, y: 8, persistable: true })).toBe(false);
    expect(isPersistablePosition({ scene: 'transsib-corridor', x: 90, y: 8, persistable: false })).toBe(false);
    expect(isPersistablePosition({ scene: 'transsib-admin', x: 8, y: 8, persistable: true })).toBe(false);
  });

  it('출시된 APAC 좌표만 확장 지역 영속 대상으로 삼는다', () => {
    expect(isPersistablePosition({ scene: 'overworld:asia-pacific', x: 1576, y: 442 })).toBe(true);
    expect(isPersistablePosition({ scene: 'overworld:emea', x: 768, y: 253, persistable: true })).toBe(false);
    expect(isPersistablePosition({ scene: 'overworld:emea', x: 768, y: 253, persistable: false })).toBe(false);
    expect(isPersistablePosition({ scene: 'overworld:unknown', x: 1, y: 1 })).toBe(false);
  });

  it('null/undefined/비객체는 영속 제외(안전)', () => {
    expect(isPersistablePosition(null)).toBe(false);
    expect(isPersistablePosition(undefined)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
describe('cityRedirectScene — 초기 부팅 시 도시 직행 스폰 판별(순수, Codex P1-1)', () => {
  const hasCity = (id) => id === 'fukuoka'; // CITY_DATA 레지스트리 페이크
  const savedCity = { scene: 'city:fukuoka', x: 47, y: 60 };

  it('Phaser autostart 기본 데이터 {} 에서도 저장 city 씬으로 리다이렉트한다(핵심 회귀)', () => {
    // Phaser 3 는 초기 autostart 에도 Scene Settings 기본 `{}` 를 create 에 전달한다 —
    // `!bootData` 판별이면 이 케이스가 무시돼 서울 폴백이 났다(P1-1 재현).
    expect(cityRedirectScene({}, savedCity, hasCity)).toBe('city:fukuoka');
  });

  it('bootData 가 undefined 여도 리다이렉트한다 — 단, 순수 초기 부팅에만 해당', () => {
    // 실전에서 씬 재시작(도시 출구·공항 출구)은 **항상 { spawn }** 을 전달한다(WorldScene.enterAirport
    // 가 returnSpawn 을 실어 보내고 airportScene.returnPlaza 가 그대로 { spawn } 으로 복귀). undefined
    // 는 Phaser 가 데이터 없이 부팅하는 순수 초기 진입에만 해당하는 방어적 동등 취급이다.
    expect(cityRedirectScene(undefined, savedCity, hasCity)).toBe('city:fukuoka');
  });

  it('복귀 데이터({spawn:...})가 있으면 리다이렉트하지 않는다 — 도시→전국 복귀 재귀 방지', () => {
    const back = { spawn: { scene: 'plaza', x: 135, y: 307 } };
    expect(cityRedirectScene(back, savedCity, hasCity)).toBeNull();
  });

  it('회귀 시퀀스(Codex 재검수 P1): 저장 city → 초기 redirect({}) → 도시 출구({spawn}) → 공항 출구({spawn:returnSpawn})', () => {
    // 저장 씬이 city:fukuoka 인 사용자의 실제 이동 경로를 순서대로 검증한다.
    // ① 초기 부팅(Phaser autostart 기본 {}) — 도시 직행 리다이렉트.
    expect(cityRedirectScene({}, savedCity, hasCity)).toBe('city:fukuoka');
    // ② 도시 출구 → 전국 복귀({spawn: 도시 노드 앞}) — 리다이렉트 없음.
    expect(cityRedirectScene({ spawn: { scene: 'plaza', x: 135, y: 307 } }, savedCity, hasCity)).toBeNull();
    // ③ 전국 → 공항 진입(enterAirport 가 게이트 앞 타일을 returnSpawn 으로 전달) → 공항 출구가
    //    { spawn: returnSpawn } 으로 복귀 — 저장 씬이 여전히 city:* 여도 **다시 도시로 튕기지 않는다**
    //    (공항 출구가 데이터 없이 start('world') 하던 회귀의 고정 테스트 — 마지막이 null 이어야 한다).
    const returnSpawn = { scene: 'plaza', x: 57, y: 211 }; // 인천공항 게이트 앞
    expect(cityRedirectScene({ spawn: returnSpawn }, savedCity, hasCity)).toBeNull();
  });

  it('저장 씬이 plaza/airport/없음이면 null(전국맵 진행)', () => {
    expect(cityRedirectScene({}, { scene: 'plaza', x: 68, y: 208 }, hasCity)).toBeNull();
    expect(cityRedirectScene({}, { scene: 'airport', x: 7, y: 10 }, hasCity)).toBeNull();
    expect(cityRedirectScene({}, null, hasCity)).toBeNull();
    expect(cityRedirectScene({}, undefined, hasCity)).toBeNull();
  });

  it('도시 데이터가 없는 city id 는 null(전국맵 폴백)', () => {
    expect(cityRedirectScene({}, { scene: 'city:tokyo', x: 1, y: 1 }, hasCity)).toBeNull();
  });

  it('hasCity 미제공(비함수)이면 안전하게 null', () => {
    expect(cityRedirectScene({}, savedCity, null)).toBeNull();
  });
});

describe('corridorRedirectScene — 초기 부팅 시 횡단철도 플랫폼 복귀', () => {
  const saved = { scene: 'transsib-corridor', x: 80, y: 8 };

  it('미출시 상태에서는 저장된 플랫폼이 있어도 직행하지 않는다', () => {
    expect(corridorRedirectScene({}, saved)).toBeNull();
    expect(corridorRedirectScene(undefined, saved)).toBeNull();
  });

  it('다른 씬에서 복귀 중이거나 플랫폼 밖 좌표면 직행하지 않는다', () => {
    expect(corridorRedirectScene({ spawn: { scene: 'plaza', x: 68, y: 208 } }, saved)).toBeNull();
    expect(corridorRedirectScene({}, { scene: 'transsib-corridor', x: 81, y: 8 })).toBeNull();
    expect(corridorRedirectScene({}, { scene: 'plaza', x: 68, y: 208 })).toBeNull();
  });

  it('관리자 미리보기 복귀만 명시적 권한으로 허용한다', () => {
    expect(corridorRedirectScene({}, saved, { allowPreview: true })).toBe('transsib-corridor');
    expect(corridorRedirectScene({}, {
      scene: 'transsib-corridor', x: 81, y: 8,
    }, { allowPreview: true })).toBeNull();
    expect(corridorRedirectScene({ spawn: { scene: 'plaza', x: 1, y: 1 } }, saved, {
      allowPreview: true,
    })).toBeNull();
  });
});

describe('overworldRegionRedirectScene — 초기 부팅 시 확장 지역 복귀', () => {
  it('출시된 APAC 저장 위치로 직행하고 미출시 EMEA는 거부한다', () => {
    expect(overworldRegionRedirectScene({}, {
      scene: 'overworld:asia-pacific', x: 1576, y: 442,
    })).toBe('overworld:asia-pacific');
    expect(overworldRegionRedirectScene(undefined, {
      scene: 'overworld:emea', x: 768, y: 253,
    })).toBeNull();
  });

  it('다른 씬에서 복귀 중이거나 미등록/범위 밖 좌표면 직행하지 않는다', () => {
    const saved = { scene: 'overworld:emea', x: 768, y: 253 };
    expect(overworldRegionRedirectScene({ spawn: { scene: 'transsib-corridor', x: 208, y: 8 } }, saved)).toBeNull();
    expect(overworldRegionRedirectScene({}, { scene: 'overworld:unknown', x: 1, y: 1 })).toBeNull();
    expect(overworldRegionRedirectScene({}, { scene: 'overworld:emea', x: 964, y: 253 })).toBeNull();
  });

  it('관리자 미리보기 복귀만 명시적 권한으로 허용한다', () => {
    expect(overworldRegionRedirectScene({}, {
      scene: 'overworld:emea', x: 768, y: 253,
    }, { allowPreview: true })).toBe('overworld:emea');
    expect(overworldRegionRedirectScene({}, {
      scene: 'overworld:emea', x: 964, y: 253,
    }, { allowPreview: true })).toBeNull();
    expect(overworldRegionRedirectScene({ spawn: { scene: 'plaza', x: 1, y: 1 } }, {
      scene: 'overworld:emea', x: 768, y: 253,
    }, { allowPreview: true })).toBeNull();
  });
});

describe('defaultOverworldRegionSpawn — 신규 사용자 기본 지역 진입', () => {
  const seoul = { scene: 'overworld:asia-pacific', x: 1468, y: 579 };

  it('저장 위치와 복귀 데이터가 없는 최초 진입만 서울로 보낸다', () => {
    expect(defaultOverworldRegionSpawn({}, null, seoul)).toEqual(seoul);
    expect(defaultOverworldRegionSpawn(undefined, undefined, seoul)).toEqual(seoul);
  });

  it('기존 plaza·도시·지역 저장 위치는 건드리지 않는다', () => {
    expect(defaultOverworldRegionSpawn({}, { scene: 'plaza', x: 68, y: 208 }, seoul)).toBeNull();
    expect(defaultOverworldRegionSpawn({}, { scene: 'city:fukuoka', x: 47, y: 60 }, seoul)).toBeNull();
    expect(defaultOverworldRegionSpawn({}, seoul, seoul)).toBeNull();
  });

  it('씬 복귀 데이터와 미출시·범위 밖 기본값은 닫는다', () => {
    expect(defaultOverworldRegionSpawn({ spawn: seoul }, null, seoul)).toBeNull();
    expect(defaultOverworldRegionSpawn({}, null, {
      scene: 'overworld:emea', x: 214, y: 420,
    })).toBeNull();
    expect(defaultOverworldRegionSpawn({}, null, {
      scene: 'overworld:asia-pacific', x: 2631, y: 579,
    })).toBeNull();
  });
});
