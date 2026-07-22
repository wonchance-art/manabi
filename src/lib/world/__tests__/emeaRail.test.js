import { describe, expect, it } from 'vitest';
import {
  EMEA_RAIL_NETWORK,
  arriveEmeaRailTrip,
  boardEmeaRailTrip,
  confirmEmeaRailTerminalPersistence,
  continueEmeaRailTrip,
  disembarkEmeaRailTrip,
  emeaRailDestinations,
  emeaRailHubSpawn,
  emeaRailLogoutFallback,
  emeaRailSegmentPresentation,
  persistEmeaRailTerminalBeforeBoard,
  planEmeaRailRoute,
  prepareEmeaRailTrip,
} from '../emeaRail.js';

describe('유럽 철도 시간 중립 노선·여정 계약', () => {
  it('공개 지리 네트워크·오너 시간 미결정과 7개 허브를 명시한다', () => {
    expect(EMEA_RAIL_NETWORK).toMatchObject({
      releaseEligible: true,
      sceneId: 'overworld:emea',
      timingStatus: 'owner-decision-required',
    });
    expect(EMEA_RAIL_NETWORK.hubs.map(({ id }) => id)).toEqual([
      'berlin-rail-hub',
      'istanbul-rail-hub',
      'london-rail-hub',
      'madrid-rail-hub',
      'paris-rail-hub',
      'rome-rail-hub',
      'vienna-rail-hub',
    ]);
    expect(EMEA_RAIL_NETWORK.links).toHaveLength(6);
    expect(EMEA_RAIL_NETWORK.links).toContainEqual(['london-rail-hub', 'paris-rail-hub']);
    expect(EMEA_RAIL_NETWORK).not.toHaveProperty('headwayMinutes');
    expect(EMEA_RAIL_NETWORK).not.toHaveProperty('dwellMinutes');
    expect(EMEA_RAIL_NETWORK).not.toHaveProperty('segmentMinutes');
    expect(Object.isFrozen(EMEA_RAIL_NETWORK)).toBe(true);
    expect(Object.isFrozen(EMEA_RAIL_NETWORK.segmentPresentations)).toBe(true);
  });

  it('체크인된 철도 허브의 실제 보행 착지 좌표를 그대로 사용한다', () => {
    expect(Object.fromEntries(EMEA_RAIL_NETWORK.hubs.map(({ id }) => [id, emeaRailHubSpawn(id)])))
      .toEqual({
        'berlin-rail-hub': { scene: 'overworld:emea', x: 386, y: 333 },
        'istanbul-rail-hub': { scene: 'overworld:emea', x: 632, y: 617 },
        'london-rail-hub': { scene: 'overworld:emea', x: 172, y: 358 },
        'madrid-rail-hub': { scene: 'overworld:emea', x: 115, y: 632 },
        'paris-rail-hub': { scene: 'overworld:emea', x: 211, y: 424 },
        'rome-rail-hub': { scene: 'overworld:emea', x: 371, y: 595 },
        'vienna-rail-hub': { scene: 'overworld:emea', x: 433, y: 440 },
      });
  });

  it('분기형 네트워크에서 항상 같은 최소 환승 경로를 만든다', () => {
    expect(planEmeaRailRoute('madrid-rail-hub', 'istanbul-rail-hub')).toEqual([
      'madrid-rail-hub',
      'paris-rail-hub',
      'berlin-rail-hub',
      'vienna-rail-hub',
      'istanbul-rail-hub',
    ]);
    expect(planEmeaRailRoute('rome-rail-hub', 'madrid-rail-hub')).toEqual([
      'rome-rail-hub',
      'vienna-rail-hub',
      'berlin-rail-hub',
      'paris-rail-hub',
      'madrid-rail-hub',
    ]);
    expect(planEmeaRailRoute('london-rail-hub', 'paris-rail-hub')).toEqual([
      'london-rail-hub',
      'paris-rail-hub',
    ]);
    expect(planEmeaRailRoute('london-rail-hub', 'rome-rail-hub')).toEqual([
      'london-rail-hub',
      'paris-rail-hub',
      'berlin-rail-hub',
      'vienna-rail-hub',
      'rome-rail-hub',
    ]);
    expect(emeaRailDestinations('london-rail-hub').map(({ id }) => id)).toEqual([
      'berlin-rail-hub',
      'istanbul-rail-hub',
      'madrid-rail-hub',
      'paris-rail-hub',
      'rome-rail-hub',
      'vienna-rail-hub',
    ]);
    expect(emeaRailDestinations('paris-rail-hub').map(({ id }) => id)).toEqual([
      'berlin-rail-hub',
      'istanbul-rail-hub',
      'london-rail-hub',
      'madrid-rail-hub',
      'rome-rail-hub',
      'vienna-rail-hub',
    ]);
  });

  it('런던↔파리 가상 구간만 대칭적인 채널터널 연출을 사용한다', () => {
    const expected = {
      serviceId: 'eurostar',
      kind: 'channel-tunnel',
      label: '영불해협 해저터널',
      fadeMs: 260,
    };
    expect(emeaRailSegmentPresentation('london-rail-hub', 'paris-rail-hub')).toEqual(expected);
    expect(emeaRailSegmentPresentation('paris-rail-hub', 'london-rail-hub')).toEqual(expected);
    expect(emeaRailSegmentPresentation('paris-rail-hub', 'berlin-rail-hub')).toEqual({
      serviceId: null,
      kind: 'surface',
      label: '지상 철도',
      fadeMs: 0,
    });
    expect(Object.isFrozen(emeaRailSegmentPresentation('london-rail-hub', 'paris-rail-hub')))
      .toBe(true);
  });

  it('종착 오버월드 좌표를 저장하기 전에는 탑승할 수 없다', () => {
    const prepared = prepareEmeaRailTrip({
      originId: 'paris-rail-hub',
      terminalId: 'rome-rail-hub',
    });
    expect(prepared).toMatchObject({
      phase: 'awaiting-terminal-persistence',
      terminalPersisted: false,
      terminalSpawn: { scene: 'overworld:emea', x: 371, y: 595 },
    });
    expect(() => boardEmeaRailTrip(prepared)).toThrow('persistence is required');
    expect(() => confirmEmeaRailTerminalPersistence(prepared, emeaRailHubSpawn('paris-rail-hub')))
      .toThrow('does not match');
  });

  it('실제 저장 성공 뒤에만 출발 준비 상태를 승인한다', async () => {
    const prepared = prepareEmeaRailTrip({
      originId: 'paris-rail-hub',
      terminalId: 'madrid-rail-hub',
    });
    const calls = [];
    const ready = await persistEmeaRailTerminalBeforeBoard(prepared, async (spawn) => {
      calls.push(spawn);
      return true;
    });
    expect(calls).toEqual([emeaRailHubSpawn('madrid-rail-hub')]);
    expect(ready).toMatchObject({ phase: 'ready-to-board', terminalPersisted: true });
    await expect(persistEmeaRailTerminalBeforeBoard(prepared, async () => false))
      .rejects.toThrow('must succeed before boarding');
  });

  it('운행 중에는 저장·하차를 막고 중간 정차에서만 직접 하차한다', () => {
    const prepared = prepareEmeaRailTrip({
      originId: 'paris-rail-hub',
      terminalId: 'rome-rail-hub',
    });
    const ready = confirmEmeaRailTerminalPersistence(prepared, emeaRailHubSpawn('rome-rail-hub'));
    const riding = boardEmeaRailTrip(ready);
    expect(riding).toMatchObject({
      phase: 'riding',
      fromId: 'paris-rail-hub',
      toId: 'berlin-rail-hub',
    });
    expect(() => disembarkEmeaRailTrip(riding)).toThrow('must be stopped');

    const stopped = arriveEmeaRailTrip(riding);
    expect(stopped).toMatchObject({
      phase: 'stopped',
      stopId: 'berlin-rail-hub',
      canDisembark: true,
      persistable: false,
    });
    expect(disembarkEmeaRailTrip(stopped)).toMatchObject({
      phase: 'disembarked',
      stopId: 'berlin-rail-hub',
      localState: { scene: 'overworld:emea', x: 386, y: 333, persistable: true },
    });
  });

  it('미하차 시 다음 구간으로 진행하고 종착·로그아웃 폴백을 보존한다', () => {
    const prepared = prepareEmeaRailTrip({
      originId: 'madrid-rail-hub',
      terminalId: 'berlin-rail-hub',
    });
    const ready = confirmEmeaRailTerminalPersistence(prepared, emeaRailHubSpawn('berlin-rail-hub'));
    const firstRide = boardEmeaRailTrip(ready);
    const paris = arriveEmeaRailTrip(firstRide);
    const secondRide = continueEmeaRailTrip(paris);
    expect(secondRide).toMatchObject({
      phase: 'riding',
      fromId: 'paris-rail-hub',
      toId: 'berlin-rail-hub',
      canDisembark: false,
    });

    const terminal = arriveEmeaRailTrip(secondRide);
    expect(terminal).toMatchObject({
      phase: 'terminal',
      stopId: 'berlin-rail-hub',
      fallbackSpawn: emeaRailHubSpawn('berlin-rail-hub'),
    });
    expect(emeaRailLogoutFallback(terminal)).toEqual(emeaRailHubSpawn('berlin-rail-hub'));
    expect(emeaRailLogoutFallback(prepared)).toBeNull();
  });

  it('알 수 없는 역·동일 출발지·종착 이후 계속 운행을 거부한다', () => {
    expect(() => planEmeaRailRoute('none', 'paris-rail-hub')).toThrow('unknown');
    expect(() => planEmeaRailRoute('paris-rail-hub', 'paris-rail-hub')).toThrow('must differ');
    const prepared = prepareEmeaRailTrip({
      originId: 'paris-rail-hub',
      terminalId: 'berlin-rail-hub',
    });
    const ready = confirmEmeaRailTerminalPersistence(prepared, emeaRailHubSpawn('berlin-rail-hub'));
    const terminal = arriveEmeaRailTrip(boardEmeaRailTrip(ready));
    expect(() => continueEmeaRailTrip(terminal)).toThrow('intermediate');
  });
});
