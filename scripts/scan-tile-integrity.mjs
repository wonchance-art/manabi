#!/usr/bin/env node
/**
 * Q1-r2 26-city geo terrain high-confidence integrity scanner (report-only).
 *
 * Finding contracts (all components use cardinal/4-neighbor connectivity; findings may overlap):
 *
 * A' — ISOLATED_BUILDING
 *   A building-like component means CITY_TILE.BUILDING only. Flag one component when it has
 *   exactly 1–2 tiles, does not touch the grid edge, and every in-grid tile in the component's
 *   one-cell Moore/8-neighbor outer ring is carriageway context only: ROAD, CROSSWALK, or BRIDGE.
 *   SIDEWALK, PLAZA, and DOCK explicitly do not qualify.
 *
 * B' — STRAY_CROSSWALK
 *   A crosswalk component means CITY_TILE.CROSSWALK only. Flag only when the entire component has
 *   zero direct cardinal ROAD/BRIDGE contacts. Unknown axes and incomplete endpoints do not qualify.
 *
 * C' — MISALIGNED_CROSSWALK
 *   The crosswalk long axis is horizontal when bbox width > height, vertical when height > width,
 *   and unknown on a tie. The local road axis comes from direct cardinal ROAD/BRIDGE contacts:
 *   vertical when N+S contacts exceed E+W, horizontal when E+W exceed N+S, and unknown on a tie.
 *   Flag only when both axes are known and parallel. Every unknown/tied axis is excluded.
 *
 * D' — BROKEN_LINEAR
 *   A road-like component contains ROAD, CROSSWALK, or BRIDGE tiles. Flag only maximal cardinal
 *   components of exactly one tile. Exclude a tile when at least four cells in its Moore/8-neighbor
 *   ring are SIDEWALK, treating it as an intentional alley stub. Two-tile components never qualify.
 *
 * Determinism:
 *   City ids are sorted lexicographically; every grid scan is row-major (y, then x); cardinal
 *   neighbors are N,E,S,W; findings are sorted by city id, anchor y, anchor x, then tile list.
 *   No clock, locale collation, filesystem enumeration, randomness, or network input is used.
 *
 * Usage:
 *   node scripts/scan-tile-integrity.mjs
 *   node scripts/scan-tile-integrity.mjs --format markdown
 *   node scripts/scan-tile-integrity.mjs --city lyon --format json
 *   node scripts/scan-tile-integrity.mjs --format markdown --output /tmp/tile-integrity-r2.md
 *   node scripts/scan-tile-integrity.mjs --update-report docs/audit-tile-integrity.md
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CITY_MANIFEST } from '../src/components/world/cities/manifest.js';
import { CITY_TILE } from '../src/components/world/cities/terrain.js';

const FINDING_TYPES = Object.freeze([
  Object.freeze({ id: 'A', key: 'isolatedBuilding', label: '차도 ring 고립 건물' }),
  Object.freeze({ id: 'B', key: 'strayCrosswalk', label: '완전 고립 횡단보도' }),
  Object.freeze({ id: 'C', key: 'misalignedCrosswalk', label: '명백 평행 횡단보도' }),
  Object.freeze({ id: 'D', key: 'brokenLinear', label: '1타일 고아 도로' }),
]);

const CARDINAL = Object.freeze([
  Object.freeze([0, -1]),
  Object.freeze([1, 0]),
  Object.freeze([0, 1]),
  Object.freeze([-1, 0]),
]);

const ROAD_LIKE = new Set([
  CITY_TILE.ROAD,
  CITY_TILE.CROSSWALK,
  CITY_TILE.BRIDGE,
]);
const ROAD_CONTEXT = new Set([CITY_TILE.ROAD, CITY_TILE.BRIDGE]);

const TILE_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(CITY_TILE).map(([name, code]) => [code, name])),
);
const TILE_ABBREVIATIONS = Object.freeze({
  [CITY_TILE.ROAD]: 'RD',
  [CITY_TILE.SIDEWALK]: 'SW',
  [CITY_TILE.CROSSWALK]: 'CW',
  [CITY_TILE.PLAZA]: 'PL',
  [CITY_TILE.PARK]: 'PK',
  [CITY_TILE.BRIDGE]: 'BR',
  [CITY_TILE.DOCK]: 'DK',
  [CITY_TILE.EXIT]: 'EX',
  [CITY_TILE.WATER]: 'WT',
  [CITY_TILE.BUILDING]: 'BL',
  [CITY_TILE.ISLAND]: 'IS',
  [CITY_TILE.RIVER]: 'RV',
  [CITY_TILE.BEACH]: 'BC',
  [CITY_TILE.MOUNTAIN]: 'MT',
});

function compareCoordinates(left, right) {
  return left[1] - right[1] || left[0] - right[0];
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareFindings(left, right) {
  return compareStrings(left.cityId, right.cityId)
    || compareCoordinates(left.anchor, right.anchor)
    || left.tiles.length - right.tiles.length
    || compareStrings(
      left.tiles.map((tile) => tile.join(',')).join(';'),
      right.tiles.map((tile) => tile.join(',')).join(';'),
    );
}

function inBounds(x, y, cols, rows) {
  return x >= 0 && y >= 0 && x < cols && y < rows;
}

function tileAt(grid, cols, rows, x, y) {
  return inBounds(x, y, cols, rows) ? grid[y * cols + x] : null;
}

function componentAnchor(tiles) {
  return [...tiles].sort(compareCoordinates)[0];
}

function componentAxis(tiles) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of tiles) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  return {
    axis: width > height ? 'horizontal' : height > width ? 'vertical' : 'unknown',
    bounds: [minX, minY, maxX, maxY],
  };
}

function roadAxisForCrosswalk(grid, cols, rows, tiles) {
  const contacts = { north: 0, east: 0, south: 0, west: 0 };
  for (const [x, y] of tiles) {
    const codes = [
      tileAt(grid, cols, rows, x, y - 1),
      tileAt(grid, cols, rows, x + 1, y),
      tileAt(grid, cols, rows, x, y + 1),
      tileAt(grid, cols, rows, x - 1, y),
    ];
    if (ROAD_CONTEXT.has(codes[0])) contacts.north += 1;
    if (ROAD_CONTEXT.has(codes[1])) contacts.east += 1;
    if (ROAD_CONTEXT.has(codes[2])) contacts.south += 1;
    if (ROAD_CONTEXT.has(codes[3])) contacts.west += 1;
  }
  const verticalContacts = contacts.north + contacts.south;
  const horizontalContacts = contacts.east + contacts.west;
  return {
    axis: verticalContacts > horizontalContacts
      ? 'vertical'
      : horizontalContacts > verticalContacts ? 'horizontal' : 'unknown',
    contacts,
    roadContactCount: verticalContacts + horizontalContacts,
  };
}

function collectComponents(grid, cols, rows, predicate) {
  const seen = new Uint8Array(grid.length);
  const queue = new Int32Array(grid.length);
  const components = [];
  for (let index = 0; index < grid.length; index += 1) {
    if (seen[index] || !predicate(grid[index])) continue;
    let read = 0;
    let write = 0;
    queue[write] = index;
    write += 1;
    seen[index] = 1;
    const tiles = [];
    while (read < write) {
      const current = queue[read];
      read += 1;
      const x = current % cols;
      const y = (current - x) / cols;
      tiles.push([x, y]);
      for (const [dx, dy] of CARDINAL) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, cols, rows)) continue;
        const next = ny * cols + nx;
        if (seen[next] || !predicate(grid[next])) continue;
        seen[next] = 1;
        queue[write] = next;
        write += 1;
      }
    }
    components.push(tiles);
  }
  return components;
}

function isolatedBuildingFindings(city, grid) {
  const { cols, rows } = city;
  const findings = [];
  const components = collectComponents(
    grid,
    cols,
    rows,
    (code) => code === CITY_TILE.BUILDING,
  );
  for (const tiles of components) {
    if (tiles.length < 1 || tiles.length > 2) continue;
    const componentIndexes = new Set(tiles.map(([x, y]) => y * cols + x));
    let touchesEdge = false;
    let ringIsCarriageway = true;
    const ring = new Set();
    for (const [x, y] of tiles) {
      if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) touchesEdge = true;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (!inBounds(nx, ny, cols, rows)) {
            ringIsCarriageway = false;
            continue;
          }
          const next = ny * cols + nx;
          if (componentIndexes.has(next)) continue;
          ring.add(next);
          if (!ROAD_LIKE.has(grid[next])) ringIsCarriageway = false;
        }
      }
    }
    if (!touchesEdge && ring.size > 0 && ringIsCarriageway) {
      findings.push({
        cityId: city.id,
        type: 'A',
        anchor: componentAnchor(tiles),
        tiles: [...tiles].sort(compareCoordinates),
        componentSize: tiles.length,
        ringSize: ring.size,
      });
    }
  }
  return findings;
}

function crosswalkFindings(city, grid) {
  const { cols, rows } = city;
  const stray = [];
  const misaligned = [];
  const components = collectComponents(
    grid,
    cols,
    rows,
    (code) => code === CITY_TILE.CROSSWALK,
  );
  for (const tiles of components) {
    const crosswalk = componentAxis(tiles);
    const road = roadAxisForCrosswalk(grid, cols, rows, tiles);
    const base = {
      cityId: city.id,
      anchor: componentAnchor(tiles),
      tiles: [...tiles].sort(compareCoordinates),
      componentSize: tiles.length,
      crosswalkAxis: crosswalk.axis,
      roadAxis: road.axis,
      roadContacts: road.contacts,
      roadContactCount: road.roadContactCount,
    };
    if (road.roadContactCount === 0) {
      stray.push({ ...base, type: 'B' });
    }
    if (
      crosswalk.axis !== 'unknown'
      && road.axis !== 'unknown'
      && crosswalk.axis === road.axis
    ) {
      misaligned.push({ ...base, type: 'C' });
    }
  }
  return { stray, misaligned };
}

function brokenLinearFindings(city, grid) {
  const findings = [];
  const components = collectComponents(
    grid,
    city.cols,
    city.rows,
    (code) => ROAD_LIKE.has(code),
  );
  for (const tiles of components) {
    if (tiles.length !== 1) continue;
    const [[x, y]] = tiles;
    let sidewalkNeighborCount = 0;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        if (tileAt(grid, city.cols, city.rows, x + dx, y + dy) === CITY_TILE.SIDEWALK) {
          sidewalkNeighborCount += 1;
        }
      }
    }
    if (sidewalkNeighborCount >= 4) continue;
    findings.push({
      cityId: city.id,
      type: 'D',
      anchor: componentAnchor(tiles),
      tiles: [...tiles].sort(compareCoordinates),
      componentSize: tiles.length,
      tileCodes: tiles.map(([x, y]) => grid[y * city.cols + x]),
      sidewalkNeighborCount,
    });
  }
  return findings;
}

function miniDump(grid, cols, rows, [centerX, centerY]) {
  const rowsOfCodes = [];
  for (let y = centerY - 1; y <= centerY + 1; y += 1) {
    const codes = [];
    for (let x = centerX - 1; x <= centerX + 1; x += 1) {
      const code = tileAt(grid, cols, rows, x, y);
      codes.push(code === null ? '##' : TILE_ABBREVIATIONS[code] ?? `?${code}`);
    }
    rowsOfCodes.push(codes.join(' '));
  }
  return rowsOfCodes.join(' / ');
}

async function loadGeo(city) {
  const moduleUrl = new URL(
    `../src/components/world/cities/${city.id}.geo.js`,
    import.meta.url,
  );
  const geoModule = await import(moduleUrl.href);
  const geo = Object.values(geoModule).find((value) => (
    value
    && typeof value === 'object'
    && value.meta?.grid?.w === city.cols
    && value.meta?.grid?.h === city.rows
    && value.terrain instanceof Uint8Array
  ));
  if (!geo) throw new Error(`Unable to resolve geo export for city: ${city.id}`);
  if (geo.terrain.length !== city.cols * city.rows) {
    throw new Error(`Geo terrain length mismatch for city: ${city.id}`);
  }
  return geo;
}

export async function scanTileIntegrity({ onlyCity = null } = {}) {
  const selected = CITY_MANIFEST
    .filter((city) => onlyCity === null || city.id === onlyCity)
    .map((city) => ({ ...city }))
    .sort((left, right) => compareStrings(left.id, right.id));
  if (onlyCity !== null && selected.length === 0) {
    throw new Error(`Unknown city id: ${onlyCity}`);
  }

  const cities = [];
  const grids = new Map();
  const allFindings = Object.fromEntries(FINDING_TYPES.map(({ id }) => [id, []]));
  for (const city of selected) {
    const geo = await loadGeo(city);
    const grid = geo.terrain;
    grids.set(city.id, grid);
    const isolatedBuilding = isolatedBuildingFindings(city, grid);
    const crosswalk = crosswalkFindings(city, grid);
    const brokenLinear = brokenLinearFindings(city, grid);
    const findings = {
      A: isolatedBuilding.sort(compareFindings),
      B: crosswalk.stray.sort(compareFindings),
      C: crosswalk.misaligned.sort(compareFindings),
      D: brokenLinear.sort(compareFindings),
    };
    for (const type of FINDING_TYPES) allFindings[type.id].push(...findings[type.id]);
    cities.push({
      id: city.id,
      name: city.name,
      cols: city.cols,
      rows: city.rows,
      cells: grid.length,
      counts: Object.fromEntries(
        FINDING_TYPES.map(({ id }) => [id, findings[id].length]),
      ),
      findings,
    });
  }
  for (const type of FINDING_TYPES) allFindings[type.id].sort(compareFindings);

  const cityById = new Map(cities.map((city) => [city.id, city]));
  const representativeSamples = (findings) => {
    const firstByCity = new Map();
    const firstInteriorByCity = new Map();
    for (const finding of findings) {
      if (!firstByCity.has(finding.cityId)) firstByCity.set(finding.cityId, finding);
      const city = cityById.get(finding.cityId);
      const [x, y] = finding.anchor;
      if (
        !firstInteriorByCity.has(finding.cityId)
        && x > 0
        && y > 0
        && x < city.cols - 1
        && y < city.rows - 1
      ) {
        firstInteriorByCity.set(finding.cityId, finding);
      }
    }
    const selected = cities
      .map((city) => firstInteriorByCity.get(city.id) ?? firstByCity.get(city.id))
      .filter(Boolean)
      .slice(0, 10);
    if (selected.length >= 10) return selected;
    const selectedSet = new Set(selected);
    for (const finding of findings) {
      if (selectedSet.has(finding)) continue;
      selected.push(finding);
      selectedSet.add(finding);
      if (selected.length >= 10) break;
    }
    return selected;
  };
  const samples = Object.fromEntries(FINDING_TYPES.map(({ id }) => [
    id,
    representativeSamples(allFindings[id]).map((finding) => {
      const city = cityById.get(finding.cityId);
      return {
        ...finding,
        miniDump: miniDump(
          grids.get(finding.cityId),
          city.cols,
          city.rows,
          finding.anchor,
        ),
      };
    }),
  ]));
  const totals = Object.fromEntries(
    FINDING_TYPES.map(({ id }) => [id, allFindings[id].length]),
  );
  const lyon = cityById.get('lyon');
  const lyonDetails = lyon
    ? Object.fromEntries(FINDING_TYPES.map(({ id }) => [
      id,
      lyon.findings[id].map((finding) => ({
        ...finding,
        miniDump: miniDump(grids.get('lyon'), lyon.cols, lyon.rows, finding.anchor),
      })),
    ]))
    : null;
  const canonical = {
    schemaVersion: 2,
    traversal: 'city-id-en-lexicographic_then_row-major-y-x_then-NESW',
    source: 'src/components/world/cities/<id>.geo.js terrain (runtime EXIT overlays excluded)',
    cityCount: cities.length,
    types: FINDING_TYPES,
    totals,
    cities,
    samples,
    lyonDetails,
  };
  const dataSha256 = createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
  return { ...canonical, dataSha256 };
}

function formatCoordinate([x, y]) {
  return `[${x},${y}]`;
}

function formatFindingCoordinate(finding) {
  const anchor = formatCoordinate(finding.anchor);
  if (finding.tiles.length === 1) return anchor;
  return `${anchor}{${finding.tiles.map(formatCoordinate).join(',')}}`;
}

function formatInteger(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function renderMarkdown(result) {
  const totalCells = result.cities.reduce((sum, city) => sum + city.cells, 0);
  const lines = [
    '## r2 고신뢰 기준',
    '',
    '- 상태: **report-only** — 도시 geo·게임 데이터·엔진 수정 없음',
    `- 입력: \`${result.source}\``,
    `- 범위: ${result.cityCount}도시, ${formatInteger(totalCells)} cells`,
    `- canonical data SHA-256: \`${result.dataSha256}\``,
    '- 좌표: `[x,y]`; 여러 타일 성분은 `anchor{전 타일}`로 표기; anchor는 성분의 row-major 최소 좌표',
    '- 주의: A′–D′는 명백한 이상만 남긴 고신뢰 수선 후보이며 서로 배타적이지 않다. 건수는 타일 수가 아니라 판정 성분 수다.',
    '',
    '### r2 판정 기준',
    '',
    '| 유형 | 정량 판정 |',
    '|---|---|',
    '| A′ 차도 ring 고립 건물 | `BUILDING` 4방 성분이 정확히 1–2타일이고 경계에 닿지 않으며, 성분 바깥 1칸 8방 ring 전부가 `ROAD·CROSSWALK·BRIDGE`일 때만 1건. `SIDEWALK·PLAZA·DOCK` ring은 제외한다. |',
    '| B′ 완전 고립 횡단보도 | `CROSSWALK` 4방 성분 전체의 cardinal `ROAD·BRIDGE` 직접 접촉이 정확히 0일 때만 1건. 축 불명·끝점 미달만으로는 잡지 않는다. |',
    '| C′ 명백 평행 횡단보도 | 횡단보도 bbox 장축과 주변 cardinal `ROAD·BRIDGE` 접촉 우세축이 둘 다 확정되고 서로 평행일 때만 1건. 어느 축이든 동률/불명이면 제외한다. |',
    '| D′ 1타일 고아 도로 | `ROAD·CROSSWALK·BRIDGE` maximal 4방 성분의 크기가 정확히 1타일일 때만 1건. 2타일 성분은 제외하고, 주변 8칸 중 `SIDEWALK`가 4칸 이상이면 골목 스텁으로 보아 제외한다. |',
    '',
    '도로축은 모든 CROSSWALK 성분 셀의 N+S `ROAD·BRIDGE` 직접 접촉 수와 E+W 접촉 수를 합산해 큰 쪽으로 정한다. 동률은 `불명`이다.',
    '',
    '### r2 26도시 × 유형 건수',
    '',
    '| 도시 | grid | A′ | B′ | C′ | D′ |',
    '|---|---:|---:|---:|---:|---:|',
  ];
  for (const city of result.cities) {
    lines.push(
      `| ${city.name} (\`${city.id}\`) | ${city.cols}×${city.rows} | ${formatInteger(city.counts.A)} | ${formatInteger(city.counts.B)} | ${formatInteger(city.counts.C)} | ${formatInteger(city.counts.D)} |`,
    );
  }
  lines.push(
    `| **합계** | **${formatInteger(totalCells)} cells** | **${formatInteger(result.totals.A)}** | **${formatInteger(result.totals.B)}** | **${formatInteger(result.totals.C)}** | **${formatInteger(result.totals.D)}** |`,
    '',
    '### r2 유형별 대표 좌표 샘플',
    '',
    '3×3 덤프는 `위 행 / 가운데 행 / 아래 행`이다. 코드: `RD` ROAD, `SW` SIDEWALK, `CW` CROSSWALK, `PL` PLAZA, `PK` PARK, `BR` BRIDGE, `DK` DOCK, `WT` WATER, `BL` BUILDING, `IS` ISLAND, `RV` RIVER, `BC` BEACH, `MT` MOUNTAIN, `##` grid 밖.',
  );
  const cityById = new Map(result.cities.map((city) => [city.id, city]));
  for (const type of FINDING_TYPES) {
    lines.push(
      '',
      `#### ${type.id}′. ${type.label} — 최대 10건`,
      '',
      '| 도시 | 좌표 | 성분 크기 | 주변 3×3 타일 코드 |',
      '|---|---:|---:|---|',
    );
    const samples = result.samples[type.id];
    if (samples.length === 0) {
      lines.push('| — | — | — | 해당 없음 |');
    } else {
      for (const sample of samples) {
        const city = cityById.get(sample.cityId);
        lines.push(
          `| ${city.name} (\`${city.id}\`) | \`${formatCoordinate(sample.anchor)}\` | ${sample.componentSize} | \`${sample.miniDump}\` |`,
        );
      }
    }
  }

  const lyon = cityById.get('lyon');
  lines.push(
    '',
    '### 리옹 상세 — r2 전 건 좌표 + 3×3 덤프',
    '',
  );
  if (!lyon) {
    lines.push('- 이번 실행 범위에 리옹이 포함되지 않음.');
  } else {
    lines.push(
      `리옹 ${lyon.cols}×${lyon.rows}에서 A′ ${formatInteger(lyon.counts.A)}, B′ ${formatInteger(lyon.counts.B)}, C′ ${formatInteger(lyon.counts.C)}, D′ ${formatInteger(lyon.counts.D)}건이다.`,
      '',
    );
    for (const type of FINDING_TYPES) {
      const details = result.lyonDetails?.[type.id] ?? [];
      lines.push(
        `#### ${type.id}′. ${type.label} (${formatInteger(lyon.counts[type.id])}건)`,
        '',
        '| 좌표 | 성분 크기 | 주변 3×3 타일 코드 |',
        '|---:|---:|---|',
      );
      if (details.length === 0) {
        lines.push('| — | — | 해당 없음 |', '');
      } else {
        for (const finding of details) {
          lines.push(
            `| \`${formatFindingCoordinate(finding)}\` | ${finding.componentSize} | \`${finding.miniDump}\` |`,
          );
        }
        lines.push('');
      }
    }
  }
  lines.push(
    '### r2 결정성·재현',
    '',
    '- 도시 id 영문 사전순 → 각 grid row-major `(y,x)` → 이웃 `N,E,S,W` 고정 순회.',
    '- 시간·로케일 정렬·파일 열거·난수·네트워크 입력 없음. runtime `EXIT` 덮어쓰기를 제외한 committed geo terrain만 읽음.',
    '- 동일 입력 2회 stdout byte 비교와 SHA-256 결과는 PR 검증 시 기록한다.',
    '',
    '```bash',
    'node scripts/scan-tile-integrity.mjs --format markdown > /tmp/tile-integrity-r2-a.md',
    'node scripts/scan-tile-integrity.mjs --format markdown > /tmp/tile-integrity-r2-b.md',
    'cmp /tmp/tile-integrity-r2-a.md /tmp/tile-integrity-r2-b.md',
    'shasum -a 256 /tmp/tile-integrity-r2-a.md /tmp/tile-integrity-r2-b.md',
    '```',
    '',
  );
  return `${lines.join('\n')}\n`;
}

function updateReport(existing, r2Section) {
  const heading = '## r2 고신뢰 기준';
  const marker = `\n${heading}\n`;
  const existingR2 = existing.indexOf(marker);
  const r1 = (existingR2 === -1 ? existing : existing.slice(0, existingR2)).trimEnd();
  return `${r1}\n\n${r2Section}`;
}

function parseArgs(argv) {
  const options = {
    format: 'json',
    output: null,
    updateReport: null,
    onlyCity: null,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (argument === '--format') {
      index += 1;
      options.format = argv[index];
    } else if (argument.startsWith('--format=')) {
      options.format = argument.slice('--format='.length);
    } else if (argument === '--output') {
      index += 1;
      options.output = argv[index];
    } else if (argument.startsWith('--output=')) {
      options.output = argument.slice('--output='.length);
    } else if (argument === '--update-report') {
      index += 1;
      options.updateReport = argv[index];
    } else if (argument.startsWith('--update-report=')) {
      options.updateReport = argument.slice('--update-report='.length);
    } else if (argument === '--city') {
      index += 1;
      options.onlyCity = argv[index];
    } else if (argument.startsWith('--city=')) {
      options.onlyCity = argument.slice('--city='.length);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!['json', 'markdown'].includes(options.format)) {
    throw new Error(`Unknown format: ${String(options.format)}`);
  }
  if (options.output !== null && (!options.output || options.output.startsWith('-'))) {
    throw new Error('Missing --output path');
  }
  if (
    options.updateReport !== null
    && (!options.updateReport || options.updateReport.startsWith('-'))
  ) {
    throw new Error('Missing --update-report path');
  }
  if (options.output !== null && options.updateReport !== null) {
    throw new Error('--output and --update-report are mutually exclusive');
  }
  if (options.updateReport !== null && options.onlyCity !== null) {
    throw new Error('--update-report requires the full city scan');
  }
  if (options.onlyCity !== null && !options.onlyCity) {
    throw new Error('Missing --city id');
  }
  return options;
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write([
      'Usage: node scripts/scan-tile-integrity.mjs [options]',
      '',
      'Options:',
      '  --format json|markdown  Output format (default: json)',
      '  --output PATH           Write output to PATH instead of stdout',
      '  --update-report PATH    Preserve r1 and replace/append the generated r2 section',
      '  --city ID               Scan one manifest city (default: all 26)',
      '  -h, --help              Show this help',
      '',
    ].join('\n'));
    return;
  }
  const result = await scanTileIntegrity({ onlyCity: options.onlyCity });
  const output = options.format === 'markdown' || options.updateReport
    ? renderMarkdown(result)
    : `${JSON.stringify(result, null, 2)}\n`;
  if (options.updateReport) {
    const reportPath = path.resolve(options.updateReport);
    const existing = fs.readFileSync(reportPath, 'utf8');
    fs.writeFileSync(reportPath, updateReport(existing, output), 'utf8');
  } else if (options.output) {
    fs.writeFileSync(path.resolve(options.output), output, 'utf8');
  } else {
    process.stdout.write(output);
  }
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await main(process.argv.slice(2));
}
