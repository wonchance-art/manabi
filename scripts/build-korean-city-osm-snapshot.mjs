import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITY_SCALE_TIERS, cityScaleTier } from '../src/components/world/cities/scale.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const DEFAULT_METERS_PER_TILE = CITY_SCALE_TIERS.standard.metersPerTile;
const MOUNTAIN_NATURAL_TAGS = new Set(['wood', 'scrub', 'heath', 'grassland']);
const CITY_CONFIG = Object.freeze({
  busan: Object.freeze({
    bbox: Object.freeze([128.89, 35.04, 129.18, 35.24]),
    oceanSeeds: Object.freeze([
      { lon: 128.895, lat: 35.045 },
      { lon: 129.175, lat: 35.05 },
    ]),
    output: 'scripts/data/busan-osm-v21.json',
    sourceDetails: Object.freeze({
      providers: Object.freeze(['overpass-api.de', 'overpass.kumi.systems']),
    }),
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
  'grand-paris': Object.freeze({
    bbox: Object.freeze([2.10, 48.78, 2.47, 48.94]),
    metersPerTile: 20,
    forestLayer: 'park',
    oceanSeeds: Object.freeze([]),
    output: 'scripts/data/grand-paris-osm-v21.json',
    sourceDetails: Object.freeze({
      providers: Object.freeze(['overpass-api.de']),
      partitionCount: 16,
      queryCount: 48,
      mergeStrategy: 'type-id-largest-geometry-compact-v1',
    }),
  }),
  'mont-saint-michel': Object.freeze({
    bbox: Object.freeze([-1.527, 48.605, -1.503, 48.642]),
    metersPerTile: 4,
    forestLayer: 'park',
    parkLanduse: Object.freeze(['grass', 'recreation_ground', 'meadow', 'farmland']),
    coastlineMainland: Object.freeze({ side: 'south', minYFraction: 0.5 }),
    oceanSeeds: Object.freeze([
      { lon: -1.5265, lat: 48.6415 },
      { lon: -1.5035, lat: 48.6415 },
      { lon: -1.5265, lat: 48.6250 },
    ]),
    output: 'scripts/data/mont-saint-michel-osm-v21.json',
    sourceDetails: Object.freeze({
      providers: Object.freeze(['api.openstreetmap.org']),
      queryCount: 1,
      mergeStrategy: 'official-osm-xml-conversion-v1',
      sourceUrl: 'https://api.openstreetmap.org/api/0.6/map?bbox=-1.527,48.605,-1.503,48.642',
      sourceArtifactSha256: 'f0ca5b97cdebeb8e7fad99e3826d18776b9a33291c923a1ef47dc69645477c68',
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
    throw new Error('Usage: node scripts/build-korean-city-osm-snapshot.mjs --city <busan|seoul|grand-paris|mont-saint-michel> --input <overpass.json> [--output <snapshot.json>]');
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

export function projectionMetrics(bbox, metersPerTile = DEFAULT_METERS_PER_TILE) {
  const tileMeters = cityScaleTier(metersPerTile).metersPerTile;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const southWest = webMercatorMeters(minLon, minLat);
  const northEast = webMercatorMeters(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return {
    southWest,
    northEast,
    correction,
    metersPerTile: tileMeters,
    grid: {
      w: Math.ceil(((northEast.x - southWest.x) * correction) / tileMeters),
      h: Math.ceil(((northEast.y - southWest.y) * correction) / tileMeters),
    },
  };
}

export function project(lat, lon, metrics) {
  const point = webMercatorMeters(lon, lat);
  return {
    x: ((point.x - metrics.southWest.x) * metrics.correction) / metrics.metersPerTile,
    y: ((metrics.northEast.y - point.y) * metrics.correction) / metrics.metersPerTile,
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
  return polygons.outer.filter((ring) => ring.length >= 3).length;
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

function hydrologyCoverage(elements, masks, metrics, name, sampleCount) {
  const segments = [];
  for (const element of elements) {
    if (element.tags?.name !== name || !/^(river|canal|stream)$/.test(element.tags?.waterway ?? '')) continue;
    const geometry = element.geometry ?? [];
    for (let index = 1; index < geometry.length; index += 1) {
      const a = project(geometry[index - 1].lat, geometry[index - 1].lon, metrics);
      const b = project(geometry[index].lat, geometry[index].lon, metrics);
      if ([a, b].some((point) => point.x < 0 || point.y < 0 || point.x >= metrics.grid.w || point.y >= metrics.grid.h)) continue;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length > 0) segments.push({ a, b, length });
    }
  }
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (totalLength === 0) return null;
  let coveredSamples = 0;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    let distance = ((sample + 0.5) / sampleCount) * totalLength;
    let segment = segments.at(-1);
    for (const candidate of segments) {
      if (distance <= candidate.length) {
        segment = candidate;
        break;
      }
      distance -= candidate.length;
    }
    const ratio = Math.min(1, distance / segment.length);
    const x = Math.round(segment.a.x + (segment.b.x - segment.a.x) * ratio);
    const y = Math.round(segment.a.y + (segment.b.y - segment.a.y) * ratio);
    const index = y * metrics.grid.w + x;
    if (masks.water[index] || masks.river[index]) coveredSamples += 1;
  }
  return {
    name,
    sampleCount,
    coveredSamples,
    coverage: Number((coveredSamples / sampleCount).toFixed(6)),
  };
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function roadStyle(highway) {
  if (/^(motorway|trunk)$/.test(highway)) return { radius: 2, value: 2 };
  if (/^(primary|secondary)$/.test(highway)) return { radius: 1, value: 2 };
  if (/^(motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$/.test(highway)) return { radius: 0, value: 2 };
  if (highway === 'tertiary') return { radius: 1, value: 2 };
  if (/^(residential|living_street|unclassified)$/.test(highway)) return { radius: 0, value: 2 };
  if (highway === 'service') return { radius: 0, value: 2 };
  if (highway === 'pedestrian') return { radius: 1, value: 1 };
  if (/^(footway|path|steps|cycleway|track)$/.test(highway)) return { radius: 0, value: 1 };
  return { radius: 0, value: 1 };
}

export function isMountainTags(tags = {}) {
  return tags.landuse === 'forest'
    || MOUNTAIN_NATURAL_TAGS.has(tags.natural)
    || tags.landcover === 'trees';
}

function mountainClass(tags) {
  if (tags.landuse === 'forest') return 'landuse=forest';
  if (MOUNTAIN_NATURAL_TAGS.has(tags.natural)) return `natural=${tags.natural}`;
  if (tags.landcover === 'trees') return 'landcover=trees';
  return null;
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

function recoverCoastalMainland(waterMask, coastlineMask, metrics, contract) {
  if (!contract) return null;
  const { w, h } = metrics.grid;
  const boundary = new Int32Array(w).fill(-1);
  const minY = Math.floor(h * contract.minYFraction);
  for (let y = minY; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!coastlineMask[y * w + x]) continue;
      boundary[x] = contract.side === 'south'
        ? Math.max(boundary[x], y)
        : boundary[x] < 0 ? y : Math.min(boundary[x], y);
    }
  }
  const known = [];
  for (let x = 0; x < w; x += 1) if (boundary[x] >= 0) known.push(x);
  if (known.length < 2) throw new Error('Coastline mainland recovery requires a cross-bbox coastline');
  for (let x = 0; x < w; x += 1) {
    if (boundary[x] >= 0) continue;
    let left = x - 1;
    let right = x + 1;
    while (left >= 0 && boundary[left] < 0) left -= 1;
    while (right < w && boundary[right] < 0) right += 1;
    if (left < 0) boundary[x] = boundary[right];
    else if (right >= w) boundary[x] = boundary[left];
    else {
      const ratio = (x - left) / (right - left);
      boundary[x] = Math.round(boundary[left] + (boundary[right] - boundary[left]) * ratio);
    }
  }
  let recoveredTileCount = 0;
  for (let x = 0; x < w; x += 1) {
    const startY = contract.side === 'south' ? boundary[x] + 1 : 0;
    const endY = contract.side === 'south' ? h : boundary[x];
    for (let y = startY; y < endY; y += 1) {
      const index = y * w + x;
      if (!waterMask[index]) continue;
      waterMask[index] = 0;
      recoveredTileCount += 1;
    }
  }
  return Object.freeze({
    method: 'coastline-mainland-side-v1',
    side: contract.side,
    minYFraction: contract.minYFraction,
    recoveredTileCount,
    boundaryMinY: Math.min(...boundary),
    boundaryMaxY: Math.max(...boundary),
  });
}

export function buildSnapshot(city, rawText) {
  const config = CITY_CONFIG[city];
  if (!config) throw new Error(`Unknown city: ${city}`);
  const raw = JSON.parse(rawText);
  const metersPerTile = cityScaleTier(config.metersPerTile ?? DEFAULT_METERS_PER_TILE).metersPerTile;
  const metrics = projectionMetrics(config.bbox, metersPerTile);
  const length = metrics.grid.w * metrics.grid.h;
  const masks = {
    building: new Uint8Array(length), road: new Uint8Array(length), water: new Uint8Array(length),
    river: new Uint8Array(length), park: new Uint8Array(length), mountain: new Uint8Array(length),
    tidalFlat: new Uint8Array(length),
    railway: new Uint8Array(length),
    coastline: new Uint8Array(length),
  };
  const counts = {
    buildingWays: 0, roadWays: 0, waterAreas: 0, riverWays: 0, parkAreas: 0,
    mountainAreas: 0, railwayWays: 0, coastlineWays: 0, bridgeWays: 0, tidalFlatAreas: 0,
    excludedCoveredWaterways: 0,
  };
  const roadWaysByClass = {};
  const mountainAreasByClass = {};
  let mountainRelations = 0;
  let mountainRelationsWithGeometry = 0;
  const crossings = [];
  const parkLanduse = new Set(config.parkLanduse ?? ['grass', 'recreation_ground']);
  const elements = [...(raw.elements ?? [])].sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`));
  const elementByKey = new Map(elements.map((element) => [`${element.type}:${element.id}`, element]));
  for (const rawElement of elements) {
    const element = rawElement.type === 'relation'
      ? {
          ...rawElement,
          members: (rawElement.members ?? []).map((member) => {
            if (Array.isArray(member.geometry)) return member;
            const referenced = elementByKey.get(`${member.type}:${member.ref}`);
            return Array.isArray(referenced?.geometry) ? { ...member, geometry: referenced.geometry } : member;
          }),
        }
      : rawElement;
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
      const bridge = tags.bridge && tags.bridge !== 'no';
      drawPolyline(masks.road, element.geometry, metrics, style.radius, bridge ? 3 : style.value);
      counts.roadWays += 1;
      if (bridge) counts.bridgeWays += 1;
      roadWaysByClass[tags.highway] = (roadWaysByClass[tags.highway] || 0) + 1;
    }
    if (tags.natural === 'water') {
      paintPolygonElement(masks.water, element, metrics);
      counts.waterAreas += 1;
    }
    if (tags.natural === 'wetland' && tags.wetland === 'tidalflat') {
      const paintedOuterRings = paintPolygonElement(masks.tidalFlat, element, metrics);
      if (paintedOuterRings > 0) counts.tidalFlatAreas += 1;
    }
    if (/^(river|canal|stream)$/.test(tags.waterway ?? '') && Array.isArray(element.geometry)) {
      if (tags.tunnel === 'culvert' || tags.covered === 'yes') counts.excludedCoveredWaterways += 1;
      else {
        drawPolyline(masks.river, element.geometry, metrics, tags.waterway === 'river' ? 1 : 0, 1);
        counts.riverWays += 1;
      }
    }
    if (tags.leisure === 'park' || parkLanduse.has(tags.landuse)) {
      paintPolygonElement(masks.park, element, metrics);
      counts.parkAreas += 1;
    }
    if (isMountainTags(tags)) {
      const forestLayer = config.forestLayer === 'park' ? 'park' : 'mountain';
      const paintedOuterRings = paintPolygonElement(masks[forestLayer], element, metrics);
      if (paintedOuterRings > 0) {
        if (forestLayer === 'park') counts.parkAreas += 1;
        else {
          counts.mountainAreas += 1;
          const key = mountainClass(tags);
          mountainAreasByClass[key] = (mountainAreasByClass[key] || 0) + 1;
        }
      }
      if (forestLayer === 'mountain' && element.type === 'relation') {
        mountainRelations += 1;
        if (paintedOuterRings > 0) mountainRelationsWithGeometry += 1;
      }
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
  const coastlineMainland = recoverCoastalMainland(
    masks.water, masks.coastline, metrics, config.coastlineMainland,
  );
  for (let index = 0; index < masks.coastline.length; index += 1) {
    if (masks.coastline[index]) masks.water[index] = 1;
  }
  const hydrologyQuality = city === 'busan'
    ? hydrologyCoverage(elements, masks, metrics, '온천천', 105)
    : null;
  const uniqueCrossings = [...new Map(crossings.map((tile) => [tile.join(','), tile])).values()]
    .sort(([ax, ay], [bx, by]) => ay - by || ax - bx);
  const rles = Object.fromEntries(Object.entries(masks)
    .filter(([name, values]) => name !== 'coastline' && (name !== 'tidalFlat' || values.some(Boolean)))
    .map(([name, values]) => [`${name}Rle`, encodeRle(values)]));
  return {
    version: 2,
    city,
    bbox: config.bbox,
    metersPerTile,
    grid: metrics.grid,
    source: {
      geometry: 'OpenStreetMap', license: 'ODbL 1.0', snapshot: '2026-07-16',
      providers: config.sourceDetails?.providers ?? ['overpass.kumi.systems'], rawOverpassSha256: hash(rawText),
      ...(config.sourceDetails?.partitionCount ? { partitionCount: config.sourceDetails.partitionCount } : {}),
      ...(config.sourceDetails?.queryCount ? { queryCount: config.sourceDetails.queryCount } : {}),
      ...(config.sourceDetails?.mergeStrategy ? { mergeStrategy: config.sourceDetails.mergeStrategy } : {}),
      ...(config.sourceDetails?.sourceUrl ? { sourceUrl: config.sourceDetails.sourceUrl } : {}),
      ...(config.sourceDetails?.sourceArtifactSha256 ? {
        sourceArtifactSha256: config.sourceDetails.sourceArtifactSha256,
      } : {}),
      roadSelection: 'all-highway-tagged-ways',
      roadWaysByClass: Object.fromEntries(Object.entries(roadWaysByClass).sort(([left], [right]) => left.localeCompare(right))),
      mountainSelection: 'landuse=forest|natural=wood,scrub,heath,grassland|landcover=trees',
      ...(config.parkLanduse ? {
        parkSelection: `leisure=park|landuse=${[...parkLanduse].sort().join(',')}`,
      } : {}),
      ...(coastlineMainland ? { coastlineMainland } : {}),
      mountainAreasByClass: Object.fromEntries(Object.entries(mountainAreasByClass).sort(([left], [right]) => left.localeCompare(right))),
      mountainRelations,
      mountainRelationsWithGeometry,
      ...(hydrologyQuality ? { hydrologyQuality } : {}),
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
