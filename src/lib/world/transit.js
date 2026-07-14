const DAY_MINUTES = 24 * 60;

const byId = (items) => new Map((items || []).map((item) => [item.id, item]));
const sum = (values) => values.reduce((total, value) => total + value, 0);

export function lineSegmentMinutes(line, stopCount = line?.stopIds?.length || 0) {
  const expected = Math.max(0, stopCount - 1);
  if (Array.isArray(line?.segmentMinutes) && line.segmentMinutes.length === expected) {
    return line.segmentMinutes.map((value) => Math.max(1, Number(value) || 1));
  }
  const fallback = Math.max(1, Number(line?.minutesPerSegment) || 3);
  return Array.from({ length: expected }, () => fallback);
}

export function lineServiceWindows(line) {
  if (Array.isArray(line?.serviceWindows) && line.serviceWindows.length) return line.serviceWindows;
  return [{ startMinute: 0, endMinute: DAY_MINUTES, headwayMinutes: Math.max(1, line?.headwayMinutes || 10) }];
}

function departuresForDay(line, day, direction) {
  const starts = [];
  const directionOffset = direction === -1 ? 0.5 : 0;
  for (const window of lineServiceWindows(line)) {
    const start = Math.max(0, Number(window.startMinute) || 0);
    const end = Math.min(DAY_MINUTES, Number(window.endMinute) || DAY_MINUTES);
    const headway = Math.max(1, Number(window.headwayMinutes) || line.headwayMinutes || 10);
    for (let minute = start + headway * directionOffset; minute < end; minute += headway) {
      starts.push(day * DAY_MINUTES + minute);
    }
  }
  return starts;
}

function orderedRun(line, direction, startMinute) {
  const stopIds = direction === 1 ? [...line.stopIds] : [...line.stopIds].reverse();
  const baseSegments = lineSegmentMinutes(line);
  const segmentMinutes = direction === 1 ? baseSegments : [...baseSegments].reverse();
  const dwell = Math.max(0, Number(line.dwellMinutes) || 0);
  const offsets = [0];
  for (let index = 0; index < segmentMinutes.length; index += 1) {
    offsets.push(offsets[index] + segmentMinutes[index] + (index < segmentMinutes.length - 1 ? dwell : 0));
  }
  return {
    lineId: line.id,
    direction,
    stopIds,
    segmentMinutes,
    offsets,
    startMinute,
    endMinute: startMinute + offsets[offsets.length - 1],
    runId: `${line.id}:${direction}:${Math.round(startMinute * 1000)}`,
  };
}

function candidateRuns(line, totalGameMinutes, dayRadius = 2) {
  const day = Math.floor(totalGameMinutes / DAY_MINUTES);
  const runs = [];
  for (let offset = -1; offset <= dayRadius; offset += 1) {
    for (const direction of [1, -1]) {
      for (const start of departuresForDay(line, day + offset, direction)) {
        runs.push(orderedRun(line, direction, start));
      }
    }
  }
  return runs;
}

export function directTransitDestinations(lines, stations, fromId) {
  const stationMap = byId(stations);
  const ids = new Set();
  for (const line of lines || []) {
    if (!line.stopIds?.includes(fromId)) continue;
    for (const id of line.stopIds) if (id !== fromId && stationMap.has(id)) ids.add(id);
  }
  return [...ids].map((id) => stationMap.get(id));
}

export function planTransitTrip(lines, stations, fromId, toId, totalGameMinutes) {
  const stationMap = byId(stations);
  if (!stationMap.has(fromId) || !stationMap.has(toId) || fromId === toId) return null;
  let best = null;
  for (const line of lines || []) {
    if (!line.stopIds?.includes(fromId) || !line.stopIds?.includes(toId)) continue;
    for (const run of candidateRuns(line, totalGameMinutes)) {
      const fromIndex = run.stopIds.indexOf(fromId);
      const toIndex = run.stopIds.indexOf(toId);
      if (fromIndex < 0 || toIndex <= fromIndex) continue;
      const departureMinute = run.startMinute + run.offsets[fromIndex];
      if (departureMinute + 1e-6 < totalGameMinutes) continue;
      // offsets는 각 중간역의 다음 출발 시각(도착+정차)이다. 목적지가 종착역이 아니면
      // 그 역의 정차시간을 빼 실제 도착 순간에 플레이어가 내리도록 한다.
      const destinationDwell = toIndex < run.stopIds.length - 1
        ? Math.max(0, Number(line.dwellMinutes) || 0) : 0;
      const arrivalMinute = run.startMinute + run.offsets[toIndex] - destinationDwell;
      const candidate = {
        ...run,
        fromId,
        toId,
        departureMinute,
        arrivalMinute,
        waitGameMinutes: departureMinute - totalGameMinutes,
        durationGameMinutes: arrivalMinute - departureMinute,
        origin: stationMap.get(fromId),
        destination: stationMap.get(toId),
        line,
      };
      if (!best || candidate.arrivalMinute < best.arrivalMinute) best = candidate;
    }
  }
  return best;
}

function tileForStop(stationMap, stopId) {
  const tile = stationMap.get(stopId)?.tile;
  return Array.isArray(tile) ? tile : null;
}

function interpolateTile(from, to, progress) {
  return [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress];
}

export function activeVehiclesAt(lines, stations, totalGameMinutes) {
  const stationMap = byId(stations);
  const active = [];
  for (const line of lines || []) {
    for (const run of candidateRuns(line, totalGameMinutes, 0)) {
      if (totalGameMinutes < run.startMinute || totalGameMinutes >= run.endMinute) continue;
      let segmentIndex = run.offsets.length - 2;
      for (let index = 0; index < run.offsets.length - 1; index += 1) {
        if (totalGameMinutes < run.startMinute + run.offsets[index + 1]) { segmentIndex = index; break; }
      }
      const from = tileForStop(stationMap, run.stopIds[segmentIndex]);
      const to = tileForStop(stationMap, run.stopIds[segmentIndex + 1]);
      if (!from || !to) continue;
      const segmentStart = run.startMinute + run.offsets[segmentIndex];
      const travelMinutes = run.segmentMinutes[segmentIndex];
      const progress = Math.max(0, Math.min(1, (totalGameMinutes - segmentStart) / travelMinutes));
      active.push({
        ...run,
        line,
        segmentIndex,
        fromId: run.stopIds[segmentIndex],
        toId: run.stopIds[segmentIndex + 1],
        progress,
        tile: interpolateTile(from, to, progress),
      });
    }
  }
  return active;
}

export function tripStateAt(trip, totalGameMinutes) {
  if (!trip) return 'none';
  if (totalGameMinutes < trip.departureMinute) return 'waiting';
  if (totalGameMinutes < trip.arrivalMinute) return 'riding';
  return 'arrived';
}
