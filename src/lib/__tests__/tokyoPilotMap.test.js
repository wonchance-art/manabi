import { describe, expect, it } from 'vitest';
import {
  TOKYO_PILOT_MAPS,
  TOKYO_PILOT_SCENE,
  TOKYO_PILOT_TILE,
  buildTokyoPilotGrid,
  isTokyoPilotWalkable,
  tokyoPilotAnchor,
  tokyoPilotMap,
  validateTokyoPilotMap,
} from '../tokyoPilotMap';

describe('도쿄 현지어 파일럿 회색 박스', () => {
  it('하네다 32×24, 전철 24×12, 시부야 40×30만 선언한다', () => {
    expect(Object.keys(TOKYO_PILOT_MAPS)).toEqual([
      TOKYO_PILOT_SCENE.HANEDA,
      TOKYO_PILOT_SCENE.TRAIN,
      TOKYO_PILOT_SCENE.SHIBUYA,
    ]);
    expect(tokyoPilotMap(TOKYO_PILOT_SCENE.HANEDA)).toMatchObject({ cols: 32, rows: 24 });
    expect(tokyoPilotMap(TOKYO_PILOT_SCENE.TRAIN)).toMatchObject({ cols: 24, rows: 12 });
    expect(tokyoPilotMap(TOKYO_PILOT_SCENE.SHIBUYA)).toMatchObject({ cols: 40, rows: 30 });
  });

  it('알 수 없는 scene과 anchor는 fail closed다', () => {
    expect(() => tokyoPilotMap('city:tokyo')).toThrow(/unknown scene/);
    expect(() => tokyoPilotAnchor(TOKYO_PILOT_SCENE.HANEDA, 'missing')).toThrow(/unknown anchor/);
  });

  it.each(Object.values(TOKYO_PILOT_SCENE))('%s의 모든 언어·회복·게이트 anchor가 4방 연결된다', (sceneId) => {
    const map = tokyoPilotMap(sceneId);
    const result = validateTokyoPilotMap(sceneId);
    expect(result.anchorCount).toBe(map.anchors.length);
    expect(result.walkableTiles).toBeGreaterThan(map.anchors.length);
  });

  it('하네다 핵심 순서의 anchor를 보존한다', () => {
    expect(tokyoPilotMap(TOKYO_PILOT_SCENE.HANEDA).anchors.map(({ id }) => id)).toEqual([
      'haneda-arrivals-exit',
      'haneda-rail-sign',
      'haneda-bus-recovery',
      'haneda-station-agent',
      'haneda-ticket-gate',
      'haneda-train-door',
    ]);
  });

  it('시부야는 오출구 회복부터 교차로·길 묻기·카페 주문·만남을 잇는다', () => {
    expect(tokyoPilotMap(TOKYO_PILOT_SCENE.SHIBUYA).anchors.map(({ id }) => id)).toEqual([
      'shibuya-platform-arrival',
      'shibuya-wrong-exit',
      'shibuya-crossing-exit',
      'shibuya-crossing',
      'shibuya-direction-npc',
      'shibuya-cafe-door',
      'shibuya-cafe-order',
      'shibuya-meeting',
    ]);
  });

  it('전철은 승차점·도착 방송·시부야 하차문을 짧게 잇는다', () => {
    expect(tokyoPilotMap(TOKYO_PILOT_SCENE.TRAIN).anchors.map(({ id }) => id)).toEqual([
      'train-haneda-door',
      'train-arrival-announcement',
      'train-shibuya-door',
    ]);
  });

  it('격자는 호출마다 독립된 Uint8Array이고 선언 데이터는 불변이다', () => {
    const first = buildTokyoPilotGrid(TOKYO_PILOT_SCENE.HANEDA);
    const second = buildTokyoPilotGrid(TOKYO_PILOT_SCENE.HANEDA);
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    first.fill(TOKYO_PILOT_TILE.WALL);
    expect(second.some(isTokyoPilotWalkable)).toBe(true);
    expect(Object.isFrozen(TOKYO_PILOT_MAPS[TOKYO_PILOT_SCENE.HANEDA])).toBe(true);
  });

  it('플랫폼과 교차로는 일반 바닥과 다른 타일 의미를 유지한다', () => {
    const haneda = tokyoPilotMap(TOKYO_PILOT_SCENE.HANEDA);
    const hanedaGrid = buildTokyoPilotGrid(haneda.id);
    expect(hanedaGrid[19 * haneda.cols + 25]).toBe(TOKYO_PILOT_TILE.PLATFORM);

    const shibuya = tokyoPilotMap(TOKYO_PILOT_SCENE.SHIBUYA);
    const shibuyaGrid = buildTokyoPilotGrid(shibuya.id);
    expect(shibuyaGrid[19 * shibuya.cols + 24]).toBe(TOKYO_PILOT_TILE.CROSSING);
  });

  it('같은 선언은 byte-identical 격자와 검증 요약을 만든다', () => {
    for (const sceneId of Object.values(TOKYO_PILOT_SCENE)) {
      expect(Buffer.from(buildTokyoPilotGrid(sceneId)).toString('hex'))
        .toBe(Buffer.from(buildTokyoPilotGrid(sceneId)).toString('hex'));
      expect(JSON.stringify(validateTokyoPilotMap(sceneId)))
        .toBe(JSON.stringify(validateTokyoPilotMap(sceneId)));
    }
  });
});
