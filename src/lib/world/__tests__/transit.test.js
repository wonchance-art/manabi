import { describe, expect, it } from 'vitest';
import { activeVehiclesAt, directTransitDestinations, planTransitTrip, tripStateAt } from '../transit.js';

const stations = [
  { id: 'a', tile: [0, 0] },
  { id: 'b', tile: [10, 0] },
  { id: 'c', tile: [20, 10] },
];
const lines = [{
  id: 'test', stopIds: ['a', 'b', 'c'], segmentMinutes: [5, 10], dwellMinutes: 1,
  serviceWindows: [{ startMinute: 0, endMinute: 1440, headwayMinutes: 20 }],
}];

describe('세계시 기반 교통 엔진', () => {
  it('같은 입력은 같은 운행편·차량 위치를 만든다', () => {
    expect(activeVehiclesAt(lines, stations, 3)).toEqual(activeVehiclesAt(lines, stations, 3));
    const forward = activeVehiclesAt(lines, stations, 3).find((vehicle) => vehicle.fromId === 'a' && vehicle.toId === 'b');
    expect(forward).toMatchObject({ lineId: 'test', fromId: 'a', toId: 'b' });
    expect(forward.tile).toEqual([6, 0]);
  });

  it('직통 역만 보여주고 다음 출발·도착을 계산한다', () => {
    expect(directTransitDestinations(lines, stations, 'a').map((station) => station.id)).toEqual(['b', 'c']);
    const trip = planTransitTrip(lines, stations, 'a', 'c', 3);
    expect(trip).toMatchObject({ departureMinute: 20, arrivalMinute: 36, waitGameMinutes: 17 });
    expect(tripStateAt(trip, 19)).toBe('waiting');
    expect(tripStateAt(trip, 25)).toBe('riding');
    expect(tripStateAt(trip, 36)).toBe('arrived');
  });

  it('중간역 도착에는 그 역의 정차시간을 포함하지 않는다', () => {
    const trip = planTransitTrip(lines, stations, 'a', 'b', 3);
    expect(trip).toMatchObject({ departureMinute: 20, arrivalMinute: 25, durationGameMinutes: 5 });
    expect(tripStateAt(trip, 24.99)).toBe('riding');
    expect(tripStateAt(trip, 25)).toBe('arrived');
  });
});
