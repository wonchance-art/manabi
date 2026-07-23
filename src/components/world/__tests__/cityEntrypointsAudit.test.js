import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  cityDistrictOpenAt,
  resolveCityDistricts,
} from '../cityDistricts.js';
import { resolveCityMainRoute } from '../cityMainRoute.js';
import { CITY_MANIFEST, loadAllCities } from '../cities/manifest.js';
import {
  isCityWalkable,
  resolveArrivalTile,
  resolveRespawnTile,
} from '../cities/terrain.js';
import { ALL_WORLD_NODES } from '../worldNodes.js';

const EXPECTED_MANIFEST_SHA256 = 'dc7581fb1d4a85591864a254d8108c17b1f2483befaaadbbccbd09665b8dd64a';

function sameTile(first, second) {
  return first[0] === second[0] && first[1] === second[1];
}

async function buildEntrypointManifest() {
  const cities = await loadAllCities();
  const cityGates = ALL_WORLD_NODES.filter((node) => node.gate?.type === 'city');

  return cities.map((city) => {
    const grid = city.buildGrid();
    const districts = resolveCityDistricts(
      city,
      grid,
      resolveCityMainRoute(city, grid),
    );
    const gateIds = cityGates
      .filter((node) => node.gate.to === city.id)
      .map((node) => node.id);
    const stops = [
      ...(Array.isArray(city.stations) ? city.stations : []),
      ...(Array.isArray(city.transitPoints) ? city.transitPoints : []),
    ];
    const transitLines = Array.isArray(city.transit) ? city.transit : [];
    const stopIdReferences = transitLines
      .flatMap((line) => (Array.isArray(line.stopIds) ? line.stopIds : []));
    const stopIds = [...new Set(stopIdReferences)];
    const arrivals = stopIds.map((id) => {
      const matches = stops.filter((stop) => stop?.id === id);
      const authored = matches[0]?.tile ?? null;
      const resolved = authored == null
        ? null
        : resolveArrivalTile(grid, city.cols, city.rows, authored);
      return {
        id,
        exactMatches: matches.length,
        authored,
        authoredOpen: authored != null
          && cityDistrictOpenAt(districts, authored[0], authored[1]),
        resolved,
        resolvedOpen: resolved != null
          && cityDistrictOpenAt(districts, resolved[0], resolved[1]),
        resolvedWalkable: resolved != null
          && isCityWalkable(grid[resolved[1] * city.cols + resolved[0]]),
        relocated: authored != null && resolved != null && !sameTile(authored, resolved),
      };
    });
    const entrance = [city.entrance.x, city.entrance.y];
    const entranceRespawn = resolveRespawnTile(
      grid,
      city.cols,
      city.rows,
      city.entrance,
      { x: city.entrance.x, y: city.entrance.y },
    );

    return {
      id: city.id,
      districtVersion: districts?.version ?? null,
      gateIds,
      entrance,
      entranceOpen: cityDistrictOpenAt(districts, entrance[0], entrance[1]),
      entranceWalkable: isCityWalkable(grid[entrance[1] * city.cols + entrance[0]]),
      entranceRespawn,
      transitLineCount: transitLines.length,
      transitStopReferenceCount: stopIdReferences.length,
      transitModes: [...new Set(
        transitLines.map((line) => line.mode ?? 'rail'),
      )].sort(),
      arrivals,
    };
  });
}

describe('S22 도시 진입 착지점 26도시 report-only 감사', () => {
  it('오버월드 도시 게이트 spawn과 모든 TRANSIT 실제 착지를 open 지구에서 재현한다', async () => {
    const first = await buildEntrypointManifest();
    const second = await buildEntrypointManifest();
    const firstBytes = JSON.stringify(first);
    const secondBytes = JSON.stringify(second);
    const sha256 = createHash('sha256').update(firstBytes).digest('hex');

    if (process.env.S22_AUDIT_PRINT === '1') {
      console.log(JSON.stringify({
        sha256,
        totals: {
          cities: first.length,
          gates: first.reduce((sum, row) => sum + row.gateIds.length, 0),
          transitLines: first.reduce((sum, row) => sum + row.transitLineCount, 0),
          transitStopReferences: first.reduce(
            (sum, row) => sum + row.transitStopReferenceCount,
            0,
          ),
          arrivals: first.reduce((sum, row) => sum + row.arrivals.length, 0),
          relocated: first.reduce(
            (sum, row) => sum + row.arrivals.filter((arrival) => arrival.relocated).length,
            0,
          ),
        },
        cities: first.map((row) => ({
          id: row.id,
          gateIds: row.gateIds,
          entrance: row.entrance,
          transitLineCount: row.transitLineCount,
          transitStopReferenceCount: row.transitStopReferenceCount,
          transitModes: row.transitModes,
          arrivals: row.arrivals.length,
          relocated: row.arrivals.filter((arrival) => arrival.relocated).length,
        })),
      }, null, 2));
    }

    expect(first.map(({ id }) => id)).toEqual(CITY_MANIFEST.map(({ id }) => id));
    expect(first).toHaveLength(26);
    expect(first.filter((row) => !(
      row.gateIds.length === 1
      && row.districtVersion === 'district-v1'
      && row.entranceOpen
      && row.entranceWalkable
      && sameTile(row.entrance, row.entranceRespawn)
      && row.arrivals.every((arrival) => (
        arrival.exactMatches === 1
        && arrival.authoredOpen
        && arrival.resolvedOpen
        && arrival.resolvedWalkable
      ))
    ))).toEqual([]);
    expect(firstBytes).toBe(secondBytes);
    expect(sha256).toBe(EXPECTED_MANIFEST_SHA256);
  }, 60_000);
});
