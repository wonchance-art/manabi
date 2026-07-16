import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const METERS_PER_TILE = 20;
const CITY_CONFIG = Object.freeze({
  busan: Object.freeze({
    bbox: Object.freeze([128.89, 35.04, 129.18, 35.24]),
    oceanSeeds: Object.freeze([
      { lon: 128.895, lat: 35.045 },
      { lon: 129.175, lat: 35.05 },
    ]),
    output: 'scripts/data/busan-osm-v21.json',
  }),
  seoul: Object.freeze({
    bbox: Object.freeze([126.79, 37.43, 127.18, 37.69]),
    oceanSeeds: Object.freeze([]),
    output: 'scripts/data/seoul-osm-v21.json',
    sourceDetails: Object.freeze({
      providers: Object.freeze(['overpass-api.de']),
      partitionCount: 16,
      queryCount: 48,
      mergeStrategy: 'type-id-largest-geometry-v1',
    }),
  }),
});

function parseArgs(argv) {
  const read = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : null;
  };
  const city = read('--city');
  const input = read('--input');
  const config = CITY_CONFIG[city];
  if (!config || !input) {
    throw new Error('Usage: node scripts/build-korean-city-osm-snapshot.mjs --city <busan|seoul> --input <overpass.json> [--output <snapshot.json>]');
  }
  return { city, input, output: read('--output') || config.output, config };
}

function webMercatorMeters(lon, lat) {
  const limitedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  return {
    x: EARTH_RADIUS * lon * DEG,
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + limitedLat * DEG / 2)),
  };
}

function projectionMetrics(bbox) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const southWest = webMercatorMeters(minLon, minLat);
  const northEast = webMercatorMeters(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return {
    southWest,
    northEast,
    correction,
    grid: {
      w: Math.ceil(((northEast.x - southWest.x) * correction) / METERS_PER_TILE),
      h: Math.ceil(((northEast.y - southWest.y) * correction) / METERS_PER_TILE),
    },
  };
}

function project(lat, lon, metrics) {
  const point = webMercatorMeters(lon, lat);
  return {
    x: ((point.x - metrics.southWest.x) * metrics.correction) / METERS_PER_TILE,
    y: ((metrics.northEast.y - point.y) * metrics.correction) / METERS_PER_TILE,
  };
}

function pointKey(point) {
  return `${Number(point.lat).toFixed(7)},${Number(point.lon).toFixed(7)}`;
}

function samePoint(a, b) {
  return pointKey(a) === pointKey(b);
}

function relationRings(relation, role) {
  const pending = (relation.members ?? [])
    .filter((member) => (member.role || 'outer') === role && Array.isArray(member.geometry) && member.geometry.length > 1)
    .map((member) => member.geometry.map(({ lat, lon }) => ({ lat, lon })));
  const rings = [];
  while (pending.length > 0) {
    const chain = pending.shift();
    let changed = true;
    while (changed && !samePoint(chain[0], chain.at(-1))) {
      changed = false;
      for (let index = 0; index < pending.length; index += 1) {
        const segment = pending[index];
        const first = chain[0];
        const last = chain.at(-1);
        if (samePoint(last, segment[0])) chain.push(...segment.slice(1));
        else if (samePoint(last, segment.at(-1))) chain.push(...segment.slice(0, -1).reverse());
        else if (samePoint(first, segment.at(-1))) chain.unshift(...segment.slice(0, -1));
        else if (samePoint(first, segment[0])) chain.unshift(...segment.slice(1).reverse());
        else continue;
        pending.splice(index, 1);
        changed = true;
        break;
      }
    }
    rings.push(chain);
  }
  return rings;
}

function polygonsFor(element) {
  if (element.type === 'way' && Array.isArray(element.geometry) && element.geometry.length > 2) {
    return { outer: [element.geometry], inner: [] };
  }
  if (element.type === 'relation') {
    return { outer: relationRings(element, 'outer'), inner: relationRings(element, 'inner') };
  }
  return { outer: [], inner: [] };
}

function fillPolygon(mask, geometry, metrics, value) {
  if (geometry.length < 3) return;
  const points = geometry.map(({ lat, lon }) => project(lat, lon, metrics));
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point.y))));
  const maxY = Math.min(metrics.grid.h - 1, Math.ceil(Math.max(...points.map((point) => point.y))));
  for (let y = minY; y <= maxY; y += 1) {
    const scanY = y + 0.5;
    const intersections = [];
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      if ((a.y > scanY) === (b.y > scanY) || a.y === b.y) continue;
      intersections.push(a.x + ((scanY - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    intersections.sort((a, b) => a - b);
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      const minX = Math.max(0, Math.ceil(intersections[index]));
      const maxX = Math.min(metrics.grid.w - 1, Math.floor(intersections[index + 1]));
      if (maxX >= minX) mask.fill(value, y * metrics.grid.w + minX, y * metrics.grid.w + maxX + 1);
    }
  }
}

function paintPolygonElement(mask, element, metrics, value = 1) {
  const polygons = polygonsFor(element);
  for (const outer of polygons.outer) fillPolygon(mask, outer, metrics, value);
  for (const inner of polygons.inner) fillPolygon(mask, inner, metrics, 0);
}

function paintPoint(mask, x, y, radius, value) {
  const { w, h } = mask.metrics.grid;
  for (let dy = -radius; dy <= radius; dy += 1) {
    const ny = y + dy;
    if (ny < 0 || ny >= h) continue;
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx;
      if (nx < 0 || nx >= w || dx * dx + dy * dy > radius * radius + 0.5) continue;
      const index = ny * w + nx;
      mask.data[index] = Math.max(mask.data[index], value);
    }
  }
}

function drawPolyline(mask, geometry, metrics, radius, value = 1) {
  if (!Array.isArray(geometry) || geometry.length < 2) return;
  const wrapped = { data: mask, metrics };
  const points = geometry.map(({ lat, lon }) => project(lat, lon, metrics));
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps;
      paintPoint(wrapped, Math.round(a.x + (b.x - a.x) * ratio), Math.round(a.y + (b.y - a.y) * ratio), radius, value);
    }
  }
}

function encodeRle(values) {
  if (values.length === 0) return [];
  const runs = [];
  let code = values[0];
  let count = 1;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] === code) count += 1;
    else {
      runs.push([code, count]);
      code = values[index];
      count = 1;
    }
  }
  runs.push([code, count]);
  return runs;
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function roadStyle(highway) {
  if (/^(motorway|trunk)$/.test(highway)) return { radius: 2, value: 2 };
  if (/^(primary|secondary)$/.test(highway)) return { radius: 1, value: 2 };
  if (/^(tertiary|residential|living_street|unclassified|pedestrian)$/.test(highway)) return { radius: 1, value: 1 };
  if (/^(service|footway|path|steps|cycleway|track)$/.test(highway)) return { radius: 0, value: 1 };
  return { radius: 0, value: 1 };
}

function floodOcean(waterMask, coastlineMask, metrics, seeds) {
  const { w, h } = metrics.grid;
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  for (const seed of seeds) {
    const point = project(seed.lat, seed.lon, metrics);
    const x = Math.max(0, Math.min(w - 1, Math.floor(point.x)));
    const y = Math.max(0, Math.min(h - 1, Math.floor(point.y)));
    const index = y * w + x;
    if (!coastlineMask[index] && !seen[index]) {
      seen[index] = 1;
      queue[tail++] = index;
    }
  }
  while (head < tail) {
    const index = queue[head++];
    waterMask[index] = 1;
    const x = index % w;
    const y = Math.floor(index / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      if (seen[next] || coastlineMask[next]) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
}

export function buildSnapshot(city, rawText) {
  const config = CITY_CONFIG[city];
  if (!config) throw new Error(`Unknown city: ${city}`);
  const raw = JSON.parse(rawText);
  const metrics = projectionMetrics(config.bbox);
  const length = metrics.grid.w * metrics.grid.h;
  const masks = {
    building: new Uint8Array(length), road: new Uint8Array(length), water: new Uint8Array(length),
    river: new Uint8Array(length), park: new Uint8Array(length), mountain: new Uint8Array(length),
    railway: new Uint8Array(length),
    coastline: new Uint8Array(length),
  };
  const counts = {
    buildingWays: 0, roadWays: 0, waterAreas: 0, riverWays: 0, parkAreas: 0,
    mountainAreas: 0, railwayWays: 0, coastlineWays: 0,
  };
  const crossings = [];
  const elements = [...(raw.elements ?? [])].sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`));
  for (const element of elements) {
    const tags = element.tags ?? {};
    if (element.type === 'node' && tags.highway === 'crossing' && Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
      const point = project(element.lat, element.lon, metrics);
      crossings.push([Math.max(0, Math.min(metrics.grid.w - 1, Math.floor(point.x))), Math.max(0, Math.min(metrics.grid.h - 1, Math.floor(point.y)))]);
      continue;
    }
    if (tags.building) {
      paintPolygonElement(masks.building, element, metrics);
      counts.buildingWays += 1;
    }
    if (tags.highway && Array.isArray(element.geometry)) {
      const style = roadStyle(tags.highway);
      drawPolyline(masks.road, element.geometry, metrics, style.radius, style.value);
      counts.roadWays += 1;
    }
    if (tags.natural === 'water') {
      paintPolygonElement(masks.water, element, metrics);
      counts.waterAreas += 1;
    }
    if (/^(river|canal|stream)$/.test(tags.waterway ?? '') && Array.isArray(element.geometry)) {
      drawPolyline(masks.river, element.geometry, metrics, tags.waterway === 'river' ? 2 : 1, 1);
      counts.riverWays += 1;
    }
    if (tags.leisure === 'park' || /^(grass|recreation_ground)$/.test(tags.landuse ?? '')) {
      paintPolygonElement(masks.park, element, metrics);
      counts.parkAreas += 1;
    }
    if (tags.landuse === 'forest' || tags.natural === 'wood') {
      paintPolygonElement(masks.mountain, element, metrics);
      counts.mountainAreas += 1;
    }
    if (/^(rail|subway|light_rail|tram)$/.test(tags.railway ?? '') && Array.isArray(element.geometry)) {
      drawPolyline(masks.railway, element.geometry, metrics, 0, 1);
      counts.railwayWays += 1;
    }
    if (tags.natural === 'coastline' && Array.isArray(element.geometry)) {
      drawPolyline(masks.coastline, element.geometry, metrics, 1, 1);
      counts.coastlineWays += 1;
    }
  }
  floodOcean(masks.water, masks.coastline, metrics, config.oceanSeeds);
  const uniqueCrossings = [...new Map(crossings.map((tile) => [tile.join(','), tile])).values()]
    .sort(([ax, ay], [bx, by]) => ay - by || ax - bx);
  const rles = Object.fromEntries(Object.entries(masks)
    .filter(([name]) => name !== 'coastline')
    .map(([name, values]) => [`${name}Rle`, encodeRle(values)]));
  return {
    version: 1,
    city,
    bbox: config.bbox,
    grid: metrics.grid,
    source: {
      geometry: 'OpenStreetMap', license: 'ODbL 1.0', snapshot: '2026-07-16',
      providers: config.sourceDetails?.providers ?? ['overpass.kumi.systems'], rawOverpassSha256: hash(rawText),
      ...(config.sourceDetails?.partitionCount ? {
        partitionCount: config.sourceDetails.partitionCount,
        queryCount: config.sourceDetails.queryCount,
        mergeStrategy: config.sourceDetails.mergeStrategy,
      } : {}),
      ...counts, crossingNodes: uniqueCrossings.length, crossingTiles: uniqueCrossings.length,
    },
    hashes: Object.fromEntries(Object.entries(rles).map(([name, value]) => [name, hash(JSON.stringify(value))])),
    ...rles,
    crossings: uniqueCrossings,
  };
}

export function writeSnapshot({ city, input, output }) {
  const rawText = fs.readFileSync(input, 'utf8');
  const snapshot = buildSnapshot(city, rawText);
  const outputPath = path.resolve(output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot)}\n`);
  return { outputPath, grid: snapshot.grid, source: snapshot.source, bytes: fs.statSync(outputPath).size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(writeSnapshot(parseArgs(process.argv.slice(2)))));
}
