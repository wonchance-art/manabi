/**
 * Q1-v2 타일 정합 확장 스캔(E~I, report-only).
 *
 * 판정 기준(좌표는 0-based [x,y], 도시와 타일은 manifest/row-major 순회):
 * - 공통: road-like = ROAD|CROSSWALK|BRIDGE|EXIT, water = WATER|RIVER.
 * - (E) 도로 폭 널뛰기: 서로 4방 인접한 같은 road-like 성분의 진행축 단면을 비교한다.
 *   수평 진행은 수직 연속 폭, 수직 진행은 수평 연속 폭을 사용한다. 양쪽 단면이 각각
 *   진행축으로 3칸 이상 같은 시작·끝을 유지하고, 경계에서 폭이 정확히 1 ↔ 3+로
 *   바뀌면 넓은 쪽 경계 타일을 1건으로 센다. 이 3칸 안정화로 교차로 1~2칸 돌출은 제외한다.
 * - (F) 횡단보도 길이 불일치: CROSSWALK 4방 성분마다 성분 바깥 road-like가 양방향
 *   2칸 이상 이어지는 유일한 도로 진행축을 고른다(동률/불명은 제외). 그 수직축의 최장
 *   CROSSWALK 런과 같은 위치 road-like 폭을 비교하되, 도로 폭 단면이 진행축 전후 1칸
 *   (합계 3단면)에서 같은 시작·끝일 때만 런 길이 !== 도로 폭을 1건으로 센다.
 * - (G) 교량-물 어긋남: BRIDGE의 8방에 water가 0이면 dry-bridge. 일반 ROAD의 8방
 *   대향쌍(N/S, E/W, NE/SW, NW/SE) 중 하나가 모두 water면 road-over-water로 센다.
 * - (H) 광장·공원 파편: PLAZA|PARK 합집합의 4방 연결 성분 크기가 정확히 1인 건수만 센다.
 * - (I) 기능 타일 지형 부적합: 학습 도어(kind=spot+track+chapter), NPC(kind=npc),
 *   역(stations)의 각 저작 좌표 아래 코드가 정확히 ROAD|WATER|RIVER인 엔티티 건수만 센다.
 *
 * 출력은 입력 데이터 외 시각·locale·파일 열거 순서에 의존하지 않는 결정적 Markdown이다.
 */

import { CITY_MANIFEST, loadCity } from '../src/components/world/cities/manifest.js';
import { CITY_TILE } from '../src/components/world/cities/terrain.js';

const STABLE_SECTION_LENGTH = 3;
const MIN_TRAVEL_CONTINUATION = 2;

const ROAD_LIKE = new Set([
  CITY_TILE.ROAD,
  CITY_TILE.CROSSWALK,
  CITY_TILE.BRIDGE,
  CITY_TILE.EXIT,
]);
const WATER = new Set([CITY_TILE.WATER, CITY_TILE.RIVER]);
const PLAZA_GREEN = new Set([CITY_TILE.PLAZA, CITY_TILE.PARK]);
const INVALID_FUNCTIONAL_TERRAIN = new Set([
  CITY_TILE.ROAD,
  CITY_TILE.WATER,
  CITY_TILE.RIVER,
]);

const TILE_GLYPHS = Object.freeze({
  [CITY_TILE.ROAD]: 'R',
  [CITY_TILE.SIDEWALK]: '.',
  [CITY_TILE.CROSSWALK]: 'X',
  [CITY_TILE.PLAZA]: 'P',
  [CITY_TILE.PARK]: 'G',
  [CITY_TILE.BRIDGE]: 'B',
  [CITY_TILE.DOCK]: 'D',
  [CITY_TILE.EXIT]: 'E',
  [CITY_TILE.WATER]: 'W',
  [CITY_TILE.BUILDING]: '#',
  [CITY_TILE.ISLAND]: 'I',
  [CITY_TILE.RIVER]: '~',
  [CITY_TILE.BEACH]: 'S',
  [CITY_TILE.MOUNTAIN]: 'M',
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function compareAnomalies(first, second) {
  const firstKind = String(first.axis ?? first.subtype ?? '');
  const secondKind = String(second.axis ?? second.subtype ?? '');
  return first.y - second.y
    || first.x - second.x
    || (firstKind < secondKind ? -1 : firstKind > secondKind ? 1 : 0);
}

function buildRoadSpans(grid, cols, rows) {
  const horizontalStart = new Int32Array(grid.length);
  const horizontalEnd = new Int32Array(grid.length);
  const verticalStart = new Int32Array(grid.length);
  const verticalEnd = new Int32Array(grid.length);
  horizontalStart.fill(-1);
  horizontalEnd.fill(-1);
  verticalStart.fill(-1);
  verticalEnd.fill(-1);

  for (let y = 0; y < rows; y += 1) {
    let x = 0;
    while (x < cols) {
      if (!ROAD_LIKE.has(grid[y * cols + x])) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < cols && ROAD_LIKE.has(grid[y * cols + x])) x += 1;
      const end = x - 1;
      for (let cursor = start; cursor <= end; cursor += 1) {
        const index = y * cols + cursor;
        horizontalStart[index] = start;
        horizontalEnd[index] = end;
      }
    }
  }

  for (let x = 0; x < cols; x += 1) {
    let y = 0;
    while (y < rows) {
      if (!ROAD_LIKE.has(grid[y * cols + x])) {
        y += 1;
        continue;
      }
      const start = y;
      while (y < rows && ROAD_LIKE.has(grid[y * cols + x])) y += 1;
      const end = y - 1;
      for (let cursor = start; cursor <= end; cursor += 1) {
        const index = cursor * cols + x;
        verticalStart[index] = start;
        verticalEnd[index] = end;
      }
    }
  }

  return {
    horizontalStart,
    horizontalEnd,
    verticalStart,
    verticalEnd,
  };
}

function spanWidth(starts, ends, index) {
  return starts[index] < 0 ? 0 : ends[index] - starts[index] + 1;
}

function sameSpan(starts, ends, firstIndex, secondIndex) {
  return starts[firstIndex] >= 0
    && starts[firstIndex] === starts[secondIndex]
    && ends[firstIndex] === ends[secondIndex];
}

function dump3x3(grid, cols, rows, centerX, centerY) {
  const lines = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    let line = '';
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = centerX + dx;
      const y = centerY + dy;
      line += x < 0 || y < 0 || x >= cols || y >= rows
        ? '?'
        : (TILE_GLYPHS[grid[y * cols + x]] ?? '!');
    }
    lines.push(line);
  }
  return lines.join('/');
}

function scanWidthJumps(grid, cols, rows, spans) {
  const anomalies = [];
  const support = STABLE_SECTION_LENGTH - 1;
  const {
    horizontalStart,
    horizontalEnd,
    verticalStart,
    verticalEnd,
  } = spans;

  for (let y = 0; y < rows; y += 1) {
    for (let x = support; x + 1 + support < cols; x += 1) {
      const left = y * cols + x;
      const right = left + 1;
      const leftWidth = spanWidth(verticalStart, verticalEnd, left);
      const rightWidth = spanWidth(verticalStart, verticalEnd, right);
      const isJump = (leftWidth === 1 && rightWidth >= 3)
        || (leftWidth >= 3 && rightWidth === 1);
      if (!isJump) continue;

      let stable = true;
      for (let offset = 1; offset <= support && stable; offset += 1) {
        stable = sameSpan(verticalStart, verticalEnd, left, left - offset)
          && sameSpan(verticalStart, verticalEnd, right, right + offset);
      }
      if (!stable) continue;
      const xAt = leftWidth >= 3 ? x : x + 1;
      anomalies.push({
        x: xAt,
        y,
        axis: 'H',
        fromWidth: leftWidth,
        toWidth: rightWidth,
        dump: dump3x3(grid, cols, rows, xAt, y),
      });
    }
  }

  for (let y = support; y + 1 + support < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const above = y * cols + x;
      const below = above + cols;
      const aboveWidth = spanWidth(horizontalStart, horizontalEnd, above);
      const belowWidth = spanWidth(horizontalStart, horizontalEnd, below);
      const isJump = (aboveWidth === 1 && belowWidth >= 3)
        || (aboveWidth >= 3 && belowWidth === 1);
      if (!isJump) continue;

      let stable = true;
      for (let offset = 1; offset <= support && stable; offset += 1) {
        stable = sameSpan(horizontalStart, horizontalEnd, above, above - offset * cols)
          && sameSpan(horizontalStart, horizontalEnd, below, below + offset * cols);
      }
      if (!stable) continue;
      const yAt = aboveWidth >= 3 ? y : y + 1;
      anomalies.push({
        x,
        y: yAt,
        axis: 'V',
        fromWidth: aboveWidth,
        toWidth: belowWidth,
        dump: dump3x3(grid, cols, rows, x, yAt),
      });
    }
  }

  return anomalies.sort(compareAnomalies);
}

function collectCrosswalkComponents(grid, cols, rows) {
  const seen = new Uint8Array(grid.length);
  const components = [];

  for (let start = 0; start < grid.length; start += 1) {
    if (grid[start] !== CITY_TILE.CROSSWALK || seen[start]) continue;
    const queue = [start];
    const cells = [];
    seen[start] = 1;

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      const x = index % cols;
      const y = (index - x) / cols;
      cells.push(index);
      const neighbors = [];
      if (x > 0) neighbors.push(index - 1);
      if (x + 1 < cols) neighbors.push(index + 1);
      if (y > 0) neighbors.push(index - cols);
      if (y + 1 < rows) neighbors.push(index + cols);
      for (const neighbor of neighbors) {
        if (seen[neighbor] || grid[neighbor] !== CITY_TILE.CROSSWALK) continue;
        seen[neighbor] = 1;
        queue.push(neighbor);
      }
    }
    components.push(cells);
  }
  return components;
}

function outsideContinuation(grid, cols, rows, x, y, dx, dy) {
  let count = 0;
  for (
    let cursorX = x + dx, cursorY = y + dy;
    cursorX >= 0 && cursorY >= 0 && cursorX < cols && cursorY < rows;
    cursorX += dx, cursorY += dy
  ) {
    if (!ROAD_LIKE.has(grid[cursorY * cols + cursorX])) break;
    count += 1;
  }
  return count;
}

function componentTravelScores(component, grid, cols, rows) {
  const rowsToXs = new Map();
  const colsToYs = new Map();
  for (const index of component) {
    const x = index % cols;
    const y = (index - x) / cols;
    if (!rowsToXs.has(y)) rowsToXs.set(y, []);
    if (!colsToYs.has(x)) colsToYs.set(x, []);
    rowsToXs.get(y).push(x);
    colsToYs.get(x).push(y);
  }

  let horizontal = 0;
  for (const [y, xs] of rowsToXs) {
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    horizontal = Math.max(
      horizontal,
      Math.min(
        outsideContinuation(grid, cols, rows, minX, y, -1, 0),
        outsideContinuation(grid, cols, rows, maxX, y, 1, 0),
      ),
    );
  }

  let vertical = 0;
  for (const [x, ys] of colsToYs) {
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    vertical = Math.max(
      vertical,
      Math.min(
        outsideContinuation(grid, cols, rows, x, minY, 0, -1),
        outsideContinuation(grid, cols, rows, x, maxY, 0, 1),
      ),
    );
  }

  return { horizontal, vertical, rowsToXs, colsToYs };
}

function longestRun(values) {
  const sorted = [...values].sort((first, second) => first - second);
  let best = null;
  for (let start = 0; start < sorted.length;) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1;
    const candidate = {
      start: sorted[start],
      end: sorted[end],
      length: end - start + 1,
      midpoint: sorted[Math.floor((start + end) / 2)],
    };
    if (!best || candidate.length > best.length) best = candidate;
    start = end + 1;
  }
  return best;
}

function scanCrosswalkLengths(grid, cols, rows, spans) {
  const anomalies = [];
  const {
    horizontalStart,
    horizontalEnd,
    verticalStart,
    verticalEnd,
  } = spans;

  for (const component of collectCrosswalkComponents(grid, cols, rows)) {
    const {
      horizontal: travelHorizontal,
      vertical: travelVertical,
      rowsToXs,
      colsToYs,
    } = componentTravelScores(component, grid, cols, rows);
    const strongest = Math.max(travelHorizontal, travelVertical);
    if (
      strongest < MIN_TRAVEL_CONTINUATION
      || travelHorizontal === travelVertical
    ) {
      continue;
    }

    const crossingAxis = travelVertical > travelHorizontal ? 'H' : 'V';
    let best = null;
    if (crossingAxis === 'H') {
      for (const [y, xs] of [...rowsToXs].sort((first, second) => first[0] - second[0])) {
        const run = longestRun(xs);
        const candidate = { x: run.midpoint, y, ...run };
        if (
          !best
          || candidate.length > best.length
          || (
            candidate.length === best.length
            && (candidate.y < best.y || (candidate.y === best.y && candidate.x < best.x))
          )
        ) {
          best = candidate;
        }
      }
      if (best.y < 1 || best.y + 1 >= rows) continue;
      const center = best.y * cols + best.x;
      if (
        !sameSpan(horizontalStart, horizontalEnd, center, center - cols)
        || !sameSpan(horizontalStart, horizontalEnd, center, center + cols)
      ) {
        continue;
      }
      best.roadWidth = spanWidth(horizontalStart, horizontalEnd, center);
    } else {
      for (const [x, ys] of [...colsToYs].sort((first, second) => first[0] - second[0])) {
        const run = longestRun(ys);
        const candidate = { x, y: run.midpoint, ...run };
        if (
          !best
          || candidate.length > best.length
          || (
            candidate.length === best.length
            && (candidate.y < best.y || (candidate.y === best.y && candidate.x < best.x))
          )
        ) {
          best = candidate;
        }
      }
      if (best.x < 1 || best.x + 1 >= cols) continue;
      const center = best.y * cols + best.x;
      if (
        !sameSpan(verticalStart, verticalEnd, center, center - 1)
        || !sameSpan(verticalStart, verticalEnd, center, center + 1)
      ) {
        continue;
      }
      best.roadWidth = spanWidth(verticalStart, verticalEnd, center);
    }

    if (best.length === best.roadWidth) continue;
    anomalies.push({
      x: best.x,
      y: best.y,
      axis: crossingAxis,
      runLength: best.length,
      roadWidth: best.roadWidth,
      dump: dump3x3(grid, cols, rows, best.x, best.y),
    });
  }

  return anomalies.sort(compareAnomalies);
}

function isWaterAt(grid, cols, rows, x, y) {
  return x >= 0
    && y >= 0
    && x < cols
    && y < rows
    && WATER.has(grid[y * cols + x]);
}

function scanBridgeWaterAlignment(grid, cols, rows) {
  const anomalies = [];
  const opposingPairs = [
    [[0, -1], [0, 1]],
    [[-1, 0], [1, 0]],
    [[-1, -1], [1, 1]],
    [[1, -1], [-1, 1]],
  ];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const code = grid[y * cols + x];
      let subtype = null;
      if (code === CITY_TILE.BRIDGE) {
        let waterNeighbors = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if ((dx !== 0 || dy !== 0) && isWaterAt(grid, cols, rows, x + dx, y + dy)) {
              waterNeighbors += 1;
            }
          }
        }
        if (waterNeighbors === 0) subtype = 'dry-bridge';
      } else if (code === CITY_TILE.ROAD) {
        const crossesWater = opposingPairs.some(([first, second]) => (
          isWaterAt(grid, cols, rows, x + first[0], y + first[1])
          && isWaterAt(grid, cols, rows, x + second[0], y + second[1])
        ));
        if (crossesWater) subtype = 'road-over-water';
      }
      if (!subtype) continue;
      anomalies.push({
        x,
        y,
        subtype,
        dump: dump3x3(grid, cols, rows, x, y),
      });
    }
  }

  return anomalies.sort(compareAnomalies);
}

function countPlazaGreenSingletons(grid, cols, rows) {
  const seen = new Uint8Array(grid.length);
  let singletons = 0;

  for (let start = 0; start < grid.length; start += 1) {
    if (!PLAZA_GREEN.has(grid[start]) || seen[start]) continue;
    const queue = [start];
    seen[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      const x = index % cols;
      const y = (index - x) / cols;
      const neighbors = [];
      if (x > 0) neighbors.push(index - 1);
      if (x + 1 < cols) neighbors.push(index + 1);
      if (y > 0) neighbors.push(index - cols);
      if (y + 1 < rows) neighbors.push(index + cols);
      for (const neighbor of neighbors) {
        if (seen[neighbor] || !PLAZA_GREEN.has(grid[neighbor])) continue;
        seen[neighbor] = 1;
        queue.push(neighbor);
      }
    }
    if (queue.length === 1) singletons += 1;
  }
  return singletons;
}

function countInvalidFunctionalTiles(city, grid) {
  const categories = {
    door: city.nodes.filter((node) => (
      node?.kind === 'spot'
      && typeof node.track === 'string'
      && node.track.length > 0
      && typeof node.chapter === 'string'
      && node.chapter.length > 0
    )),
    npc: city.nodes.filter((node) => node?.kind === 'npc'),
    station: city.stations,
  };
  const counts = { door: 0, npc: 0, station: 0 };

  for (const [category, entries] of Object.entries(categories)) {
    invariant(Array.isArray(entries), `${city.id}: ${category} entries must be an array`);
    for (const entry of entries) {
      invariant(
        Array.isArray(entry.tile)
          && entry.tile.length === 2
          && Number.isInteger(entry.tile[0])
          && Number.isInteger(entry.tile[1]),
        `${city.id}:${entry?.id ?? category} has an invalid tile`,
      );
      const [x, y] = entry.tile;
      invariant(
        x >= 0 && y >= 0 && x < city.cols && y < city.rows,
        `${city.id}:${entry.id} tile is out of bounds: ${x},${y}`,
      );
      if (INVALID_FUNCTIONAL_TERRAIN.has(grid[y * city.cols + x])) {
        counts[category] += 1;
      }
    }
  }

  return {
    total: counts.door + counts.npc + counts.station,
    counts,
  };
}

async function scanCities() {
  const results = [];
  for (const metadata of CITY_MANIFEST) {
    const city = await loadCity(metadata.id);
    const grid = city.buildGrid();
    invariant(
      grid instanceof Uint8Array && grid.length === city.cols * city.rows,
      `${city.id}: buildGrid() length mismatch`,
    );
    const spans = buildRoadSpans(grid, city.cols, city.rows);
    const E = scanWidthJumps(grid, city.cols, city.rows, spans);
    const F = scanCrosswalkLengths(grid, city.cols, city.rows, spans);
    const G = scanBridgeWaterAlignment(grid, city.cols, city.rows);
    const H = countPlazaGreenSingletons(grid, city.cols, city.rows);
    const I = countInvalidFunctionalTiles(city, grid);
    results.push({
      id: city.id,
      name: city.name,
      E,
      F,
      G,
      H,
      I,
    });
  }
  return results;
}

function selectRepresentatives(results, type, limit = 10) {
  const buckets = results.map((city) => [
    ...city[type].filter((anomaly) => !anomaly.dump.includes('?')),
    ...city[type].filter((anomaly) => anomaly.dump.includes('?')),
  ]);
  const representatives = [];
  let depth = 0;
  while (representatives.length < limit) {
    let added = false;
    for (let cityIndex = 0; cityIndex < results.length; cityIndex += 1) {
      const city = results[cityIndex];
      const anomaly = buckets[cityIndex][depth];
      if (!anomaly) continue;
      representatives.push({ city, anomaly });
      added = true;
      if (representatives.length === limit) break;
    }
    if (!added) break;
    depth += 1;
  }
  return representatives;
}

function anomalyDetail(type, anomaly) {
  if (type === 'E') {
    return `진행 ${anomaly.axis}, 폭 ${anomaly.fromWidth}→${anomaly.toWidth}`;
  }
  if (type === 'F') {
    return `런 ${anomaly.axis}, CROSSWALK ${anomaly.runLength} / 도로 ${anomaly.roadWidth}`;
  }
  return anomaly.subtype;
}

function renderRepresentativeSection(lines, results, type, title) {
  const representatives = selectRepresentatives(results, type);
  lines.push(`### ${type}. ${title} — 대표 ${representatives.length}건`);
  lines.push('');
  lines.push('| # | 도시 | 좌표 | 판정 | 3×3 |');
  lines.push('|---:|---|---:|---|---|');
  representatives.forEach(({ city, anomaly }, index) => {
    lines.push(
      `| ${index + 1} | ${city.id} | [${anomaly.x},${anomaly.y}] | `
      + `${anomalyDetail(type, anomaly)} | \`${anomaly.dump}\` |`,
    );
  });
  lines.push('');
}

function renderLyonDetail(lines, lyon, type, title) {
  lines.push(`### ${type}. ${title} (${lyon[type].length}건)`);
  lines.push('');
  if (lyon[type].length === 0) {
    lines.push('없음.');
    lines.push('');
    return;
  }
  lines.push('| # | 좌표 | 판정 |');
  lines.push('|---:|---:|---|');
  lyon[type].forEach((anomaly, index) => {
    lines.push(
      `| ${index + 1} | [${anomaly.x},${anomaly.y}] | ${anomalyDetail(type, anomaly)} |`,
    );
  });
  lines.push('');
}

function renderMarkdown(results) {
  const totals = Object.fromEntries(['E', 'F', 'G', 'H', 'I'].map((type) => [
    type,
    results.reduce((sum, city) => (
      sum + (Array.isArray(city[type]) ? city[type].length : city[type].total ?? city[type])
    ), 0),
  ]));
  const lines = [
    '# Q1-v2 타일 정합 확장 스캔 E~I',
    '',
    '`scripts/scan-tile-integrity-extra.mjs`의 결정적 출력이다. 좌표는 0-based `[x,y]`이며,',
    '26도시는 `CITY_MANIFEST`, 타일은 row-major 순서로 순회했다. 이 감사는 report-only이고',
    '게임 데이터·엔진을 변경하지 않는다.',
    '',
    '## 판정 기준',
    '',
    `- E: road-like(ROAD·CROSSWALK·BRIDGE·EXIT) 단면이 양쪽에서 각각 ${STABLE_SECTION_LENGTH}칸 이상 `
      + '같게 유지되면서 폭이 `1 ↔ 3+`로 바뀌는 경계.',
    `- F: CROSSWALK 성분 밖 도로가 양방향 ${MIN_TRAVEL_CONTINUATION}칸 이상 이어지는 유일 진행축에서, `
      + '전후 1칸을 포함한 3단면 도로 폭이 안정적이지만 CROSSWALK 최장 런 길이가 폭과 다른 곳.',
    '- G: BRIDGE 8방에 WATER·RIVER가 없거나, 일반 ROAD의 8방 대향쌍에 WATER·RIVER가 모두 있는 곳.',
    '- H: PLAZA·PARK 합집합의 4방 연결 성분이 정확히 1타일인 건수.',
    '- I: 학습 도어(`spot+track+chapter`)·NPC·역 하부가 정확히 ROAD·WATER·RIVER인 엔티티 건수.',
    '',
    '3×3 덤프는 `/`로 행을 나눈다. 범례: `R` ROAD, `.` SIDEWALK, `X` CROSSWALK,',
    '`P` PLAZA, `G` PARK, `B` BRIDGE, `D` DOCK, `E` EXIT, `W` WATER, `~` RIVER,',
    '`#` BUILDING, `I` ISLAND, `S` BEACH, `M` MOUNTAIN, `?` 범위 밖.',
    '',
    '## 26도시 전수 통계',
    '',
    '| 도시 | E | F | G | H | I |',
    '|---|---:|---:|---:|---:|---:|',
  ];

  for (const city of results) {
    lines.push(
      `| ${city.id} (${city.name}) | ${city.E.length} | ${city.F.length} | `
      + `${city.G.length} | ${city.H} | ${city.I.total} |`,
    );
  }
  lines.push(
    `| **합계** | **${totals.E}** | **${totals.F}** | **${totals.G}** | `
    + `**${totals.H}** | **${totals.I}** |`,
  );
  lines.push('');
  lines.push('I 합계의 기능별 내역(좌표 미출력):');
  lines.push('');
  lines.push('| 기능 | 건수 |');
  lines.push('|---|---:|');
  for (const category of ['door', 'npc', 'station']) {
    const count = results.reduce((sum, city) => sum + city.I.counts[category], 0);
    lines.push(`| ${category} | ${count} |`);
  }
  lines.push('');
  lines.push('## E·F·G 대표 좌표와 3×3 덤프');
  lines.push('');
  lines.push('대표 표본은 manifest 도시 순서에서 도시별 n번째 건을 round-robin으로 뽑았다.');
  lines.push('');
  renderRepresentativeSection(lines, results, 'E', '도로 폭 널뛰기');
  renderRepresentativeSection(lines, results, 'F', '횡단보도 길이 불일치');
  renderRepresentativeSection(lines, results, 'G', '교량-물 어긋남');

  const lyon = results.find((city) => city.id === 'lyon');
  invariant(lyon, 'lyon must exist in CITY_MANIFEST');
  lines.push('## 리옹 상세 — E·F·G 전 건');
  lines.push('');
  renderLyonDetail(lines, lyon, 'E', '도로 폭 널뛰기');
  renderLyonDetail(lines, lyon, 'F', '횡단보도 길이 불일치');
  renderLyonDetail(lines, lyon, 'G', '교량-물 어긋남');
  lines.push('H·I는 요청 범위에 따라 건수만 위 통계표에 기록했다.');

  return `${lines.join('\n')}\n`;
}

const results = await scanCities();
process.stdout.write(renderMarkdown(results));
