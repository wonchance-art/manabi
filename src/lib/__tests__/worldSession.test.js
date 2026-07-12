import { describe, it, expect } from 'vitest';
import {
  extractClientIp, normalizePosition, isSpawnTileValid, isPersistablePosition,
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

  it('null/undefined/비객체는 영속 제외(안전)', () => {
    expect(isPersistablePosition(null)).toBe(false);
    expect(isPersistablePosition(undefined)).toBe(false);
  });
});
