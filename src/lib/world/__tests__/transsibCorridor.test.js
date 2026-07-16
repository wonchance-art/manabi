import { describe, expect, it } from 'vitest';
import {
  TRANS_SIBERIAN_CORRIDOR,
  canAccessCorridor,
  confirmCorridorTerminalPersistence,
  corridorLogoutFallback,
  corridorStopSpawn,
  corridorTripStateAt,
  disembarkCorridorTrip,
  persistCorridorTerminalBeforeBoard,
  prepareCorridorTrip,
} from '../transsibCorridor.js';

describe('시베리아 횡단 연결선 무스키마 상태기계', () => {
  it('미출시 회랑은 일반 사용자에게 닫고 관리자 미리보기만 허용한다', () => {
    expect(canAccessCorridor()).toBe(false);
    expect(canAccessCorridor({ allowPreview: false })).toBe(false);
    expect(canAccessCorridor({ allowPreview: true })).toBe(true);
    expect(canAccessCorridor({}, { ...TRANS_SIBERIAN_CORRIDOR, releaseEligible: true })).toBe(true);
  });

  it('출시 비활성·임시 시간표와 주요 9개 정차역을 명시한다', () => {
    expect(TRANS_SIBERIAN_CORRIDOR).toMatchObject({
      releaseEligible: false,
      sceneId: 'transsib-corridor',
      timingStatus: 'provisional-owner-review',
    });
    expect(TRANS_SIBERIAN_CORRIDOR.stops).toHaveLength(9);
    expect(TRANS_SIBERIAN_CORRIDOR.segmentMinutes).toHaveLength(8);
    expect(TRANS_SIBERIAN_CORRIDOR.stops.map((stop) => stop.id)).toEqual([
      'vladivostok', 'khabarovsk', 'chita', 'irkutsk', 'krasnoyarsk',
      'novosibirsk', 'yekaterinburg', 'kazan', 'moscow',
    ]);
  });

  it('종착 플랫폼 저장 확인 전에는 탑승 상태로 넘어가지 않는다', () => {
    const trip = prepareCorridorTrip({ originId: 'vladivostok', terminalId: 'moscow', nowMinute: 7 });
    expect(trip).toMatchObject({
      phase: 'awaiting-terminal-persistence', departureMinute: 15,
      terminalPersisted: false, terminalSpawn: corridorStopSpawn('moscow'),
    });
    expect(corridorTripStateAt(trip, 20)).toMatchObject({
      phase: 'awaiting-terminal-persistence', persistable: false,
    });
    expect(() => confirmCorridorTerminalPersistence(trip, corridorStopSpawn('kazan')))
      .toThrow('does not match');
  });

  it('실제 저장 콜백의 성공 응답 뒤에만 탑승을 승인한다', async () => {
    const prepared = prepareCorridorTrip({ originId: 'vladivostok', terminalId: 'moscow', nowMinute: 7 });
    const calls = [];
    const trip = await persistCorridorTerminalBeforeBoard(prepared, async (spawn) => {
      calls.push(spawn);
      return true;
    });
    expect(calls).toEqual([corridorStopSpawn('moscow')]);
    expect(trip).toMatchObject({ phase: 'waiting', terminalPersisted: true });

    await expect(persistCorridorTerminalBeforeBoard(prepared, async () => false))
      .rejects.toThrow('must succeed before boarding');
    await expect(persistCorridorTerminalBeforeBoard(prepared, async () => { throw new Error('offline'); }))
      .rejects.toThrow('offline');
  });

  it('저장 확인 후 대기·승차 좌표는 모두 비영속이며 동쪽→서쪽으로 운행한다', () => {
    const prepared = prepareCorridorTrip({ originId: 'vladivostok', terminalId: 'moscow', nowMinute: 7 });
    const trip = confirmCorridorTerminalPersistence(prepared, corridorStopSpawn('moscow'));
    expect(corridorTripStateAt(trip, 14)).toMatchObject({ phase: 'waiting', persistable: false });
    expect(corridorTripStateAt(trip, 24)).toMatchObject({
      phase: 'riding', fromId: 'vladivostok', toId: 'khabarovsk', progress: 0.5,
      persistable: false, canDisembark: false,
    });
  });

  it('중간역 정차 때만 직접 하차할 수 있고 내리지 않으면 다음 구간으로 진행한다', () => {
    const prepared = prepareCorridorTrip({ originId: 'vladivostok', terminalId: 'moscow', nowMinute: 0 });
    const trip = confirmCorridorTerminalPersistence(prepared, corridorStopSpawn('moscow'));
    const stopped = corridorTripStateAt(trip, 18.5);
    expect(stopped).toMatchObject({ phase: 'stopped', stopId: 'khabarovsk', canDisembark: true, persistable: false });
    expect(disembarkCorridorTrip(trip, stopped)).toMatchObject({
      phase: 'disembarked', stopId: 'khabarovsk',
      localState: { scene: 'transsib-corridor', x: 32, y: 8, persistable: true },
    });
    expect(corridorTripStateAt(trip, 21)).toMatchObject({
      phase: 'riding', fromId: 'khabarovsk', toId: 'chita',
    });
    expect(() => disembarkCorridorTrip(trip, corridorTripStateAt(trip, 21)))
      .toThrow('must be stopped');
  });

  it('반대 방향도 구간 시간을 역순으로 사용하고 종착 시 미하차 폴백을 유지한다', () => {
    const prepared = prepareCorridorTrip({ originId: 'kazan', terminalId: 'vladivostok', nowMinute: 0 });
    const trip = confirmCorridorTerminalPersistence(prepared, corridorStopSpawn('vladivostok'));
    expect(corridorTripStateAt(trip, 10)).toMatchObject({
      phase: 'riding', fromId: 'kazan', toId: 'yekaterinburg', progress: 0.5,
    });
    expect(corridorLogoutFallback(trip)).toEqual(corridorStopSpawn('vladivostok'));
    expect(corridorLogoutFallback(prepared)).toBeNull();

    const terminal = corridorTripStateAt(trip, 1000);
    expect(terminal).toMatchObject({
      phase: 'terminal', stopId: 'vladivostok', canDisembark: true,
      fallbackSpawn: corridorStopSpawn('vladivostok'),
    });
  });

  it('알 수 없는 역·비종착 목적지·동일 출발지는 거부한다', () => {
    expect(() => prepareCorridorTrip({ originId: 'none', terminalId: 'moscow', nowMinute: 0 })).toThrow('unknown');
    expect(() => prepareCorridorTrip({ originId: 'irkutsk', terminalId: 'kazan', nowMinute: 0 })).toThrow('must be a terminal');
    expect(() => prepareCorridorTrip({ originId: 'moscow', terminalId: 'moscow', nowMinute: 0 })).toThrow('must differ');
  });
});
