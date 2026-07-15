#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROJECTION_IDS,
  anchorChunkAssignments,
  buildProjection,
  chunkContinuityStats,
  densifyRoute,
  fixed,
  pointMetrics,
  projectionBounds,
  projectionInducedCurvature,
  roundTripStats,
  sampleGrid,
  scoreSummary,
  summarizePointMetrics,
  tileFrame,
  weightedAverage,
} from './projection-spike-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const MANIFEST_PATH = join(HERE, 'projection-spike-manifest.json');
const OUTPUT_DIR = resolve(argValue('--output-dir') || join(ROOT, 'docs', 'generated', 'world-projection-spike'));
const REPORT_PATH = resolve(argValue('--report-path') || join(ROOT, 'docs', 'world-projection-spike.md'));
const INPUT_DIR = resolve(argValue('--input-dir') || join(ROOT, '.cache', 'world-projection-spike'));
const VERIFY_ONLY = process.argv.includes('--verify');
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const scoreWeightTotal = Object.values(manifest.scoreWeights).reduce((sum, value) => sum + value, 0);
if (Math.abs(scoreWeightTotal - 1) > 1e-12) throw new Error(`scoreWeights must sum to 1, got ${scoreWeightTotal}`);

const PROJECTION_LABELS = Object.freeze({
  equirectangular: 'Equirectangular',
  sinusoidal: 'Sinusoidal',
  laea: 'LAEA',
});
const INVERSE_COST = Object.freeze({ equirectangular: 1, sinusoidal: 2, laea: 8 });

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readVerifiedSource(source) {
  mkdirSync(INPUT_DIR, { recursive: true });
  const path = join(INPUT_DIR, basename(new URL(source.url).pathname));
  if (!existsSync(path)) {
    if (VERIFY_ONLY) throw new Error(`Missing verified input in --verify mode: ${path}`);
    console.log(`download ${source.id}`);
    execFileSync('curl', ['-sSL', '--fail', '--max-time', '180', source.url, '-o', path], { stdio: 'inherit' });
  }
  const bytes = readFileSync(path);
  const got = sha256(bytes);
  if (got !== source.sha256) throw new Error(`${source.id} SHA-256 mismatch: ${got} != ${source.sha256}`);
  return JSON.parse(bytes.toString('utf8'));
}

function flattenLandRings(geojson) {
  const rings = [];
  const pushPolygon = (polygon, sourceIndex) => {
    for (let ringIndex = 0; ringIndex < polygon.length; ringIndex += 1) {
      rings.push({ sourceIndex, ringIndex, points: polygon[ringIndex] });
    }
  };
  geojson.features.forEach((feature, sourceIndex) => {
    const geometry = feature.geometry;
    if (!geometry) return;
    if (geometry.type === 'Polygon') pushPolygon(geometry.coordinates, sourceIndex);
    if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach((polygon) => pushPolygon(polygon, sourceIndex));
  });
  return rings.sort((a, b) => a.sourceIndex - b.sourceIndex || a.ringIndex - b.ringIndex);
}

function normalizeAround(lon, center) {
  let value = lon;
  while (value - center > 180) value -= 360;
  while (value - center < -180) value += 360;
  return value;
}

function normalizedRing(ring, bbox) {
  const center = (bbox[0] + bbox[2]) / 2;
  const out = [];
  for (const [rawLon, lat] of ring.points) {
    const reference = out.length ? out.at(-1).lon : center;
    out.push({ lon: normalizeAround(rawLon, reference), lat });
  }
  return out;
}

function clipSegment(a, b, bbox) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const dx = b.lon - a.lon;
  const dy = b.lat - a.lat;
  const p = [-dx, dx, -dy, dy];
  const q = [a.lon - minLon, maxLon - a.lon, a.lat - minLat, maxLat - a.lat];
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i += 1) {
    if (Math.abs(p[i]) < 1e-15) {
      if (q[i] < 0) return null;
      continue;
    }
    const ratio = q[i] / p[i];
    if (p[i] < 0) t0 = Math.max(t0, ratio);
    else t1 = Math.min(t1, ratio);
    if (t0 > t1) return null;
  }
  return [
    { lon: a.lon + dx * t0, lat: a.lat + dy * t0 },
    { lon: a.lon + dx * t1, lat: a.lat + dy * t1 },
  ];
}

function ringsForBbox(landRings, bbox) {
  const lines = [];
  for (const source of landRings) {
    const ring = normalizedRing(source, bbox);
    let current = [];
    for (let i = 0; i < ring.length - 1; i += 1) {
      const clipped = clipSegment(ring[i], ring[i + 1], bbox);
      if (!clipped) {
        if (current.length > 1) lines.push(current);
        current = [];
        continue;
      }
      const [start, end] = clipped;
      const tail = current.at(-1);
      if (!tail || Math.hypot(tail.lon - start.lon, tail.lat - start.lat) > 1e-9) {
        if (current.length > 1) lines.push(current);
        current = [start];
      }
      current.push(end);
    }
    if (current.length > 1) lines.push(current);
  }
  return lines;
}

function populatedPlaceLookup(geojson) {
  const lookup = new Map();
  for (const feature of geojson.features) {
    const properties = feature.properties || {};
    const names = [properties.NAME, properties.NAMEASCII, properties.NAME_EN].filter(Boolean);
    const [lon, lat] = feature.geometry?.coordinates || [];
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    for (const name of names) if (!lookup.has(name)) lookup.set(name, { lon, lat, id: name });
  }
  return lookup;
}

function fixturePoints(fixture, route) {
  if (fixture.id === 'transsib') return route;
  const config = manifest.sampleGrid;
  return sampleGrid(fixture.bbox, config.columns, config.rows, config.offset);
}

function rectanglePolyline(bbox) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const out = [];
  const steps = 64;
  for (let i = 0; i <= steps; i += 1) out.push({ lon: minLon + (maxLon - minLon) * i / steps, lat: minLat });
  for (let i = 1; i <= steps; i += 1) out.push({ lon: maxLon, lat: minLat + (maxLat - minLat) * i / steps });
  for (let i = 1; i <= steps; i += 1) out.push({ lon: maxLon - (maxLon - minLon) * i / steps, lat: maxLat });
  for (let i = 1; i <= steps; i += 1) out.push({ lon: minLon, lat: maxLat - (maxLat - minLat) * i / steps });
  return out;
}

function projectionSet(regionId) {
  const region = manifest.regions[regionId];
  return PROJECTION_IDS.map((id) => buildProjection(id, region.anchor, manifest.earthRadiusMeters));
}

function coreDirectionPass(regionId, summaries) {
  const limit = manifest.hardGates.coreDirectionContradictionDeg;
  const geoLimit = manifest.hardGates.geoAxisHorizontalShareMax;
  if (regionId === 'apac') {
    const core = summaries.filter((row) => row.fixture === 'japan' || row.fixture === 'korea');
    const maxScreen = Math.max(...core.map((row) => row.metrics.screenNorthErrorDeg.max));
    const maxGeoShare = Math.max(...core.map((row) => row.metrics.geoAxisHorizontalShare.max));
    return { screenAxis: maxScreen <= limit, geoAxis: maxGeoShare <= geoLimit, maxScreenDeg: maxScreen, maxGeoHorizontalShare: maxGeoShare };
  }
  const overview = summaries.find((row) => row.fixture === regionId);
  const maxScreen = overview.metrics.screenNorthErrorDeg.max;
  const maxGeoShare = overview.metrics.geoAxisHorizontalShare.max;
  return { screenAxis: maxScreen <= limit, geoAxis: maxGeoShare <= geoLimit, maxScreenDeg: maxScreen, maxGeoHorizontalShare: maxGeoShare };
}

function analyzeProjection(projection, regionId, fixtures, route, anchors) {
  const region = manifest.regions[regionId];
  const frame = tileFrame(projection, region.bbox, manifest.metersPerTile);
  const rows = [];
  const regionPoints = sampleGrid(region.bbox, manifest.sampleGrid.columns, manifest.sampleGrid.rows, manifest.sampleGrid.offset);
  const regionMetrics = summarizePointMetrics(regionPoints.map((point) => pointMetrics(
    projection, point.lon, point.lat, manifest.earthRadiusMeters,
  )));
  const regionRoundTrip = roundTripStats(
    projection, region.bbox, regionPoints, manifest.metersPerTile, manifest.earthRadiusMeters,
  );
  rows.push({ projection: projection.id, fixture: regionId, region: regionId, metrics: regionMetrics, roundTripTile: regionRoundTrip });

  for (const fixture of fixtures.filter((item) => item.region === regionId && !item.visualOnly)) {
    const points = fixturePoints(fixture, route);
    const metrics = summarizePointMetrics(points.map((point) => pointMetrics(
      projection, point.lon, point.lat, manifest.earthRadiusMeters,
    )));
    const roundTripTile = roundTripStats(
      projection, region.bbox, points, manifest.metersPerTile, manifest.earthRadiusMeters,
    );
    const curvature = fixture.id === 'transsib' ? projectionInducedCurvature(projection, route) : null;
    rows.push({ projection: projection.id, fixture: fixture.id, region: regionId, metrics, roundTripTile, curvature });
  }

  const seamPolylines = [rectanglePolyline(region.bbox), route];
  const seam = chunkContinuityStats(frame, seamPolylines, manifest.chunkTiles);
  const assignmentsA = anchorChunkAssignments(frame, anchors, manifest.chunkTiles);
  const assignmentsB = anchorChunkAssignments(frame, anchors, manifest.chunkTiles);
  const anchorStable = JSON.stringify(assignmentsA) === JSON.stringify(assignmentsB);
  const direction = coreDirectionPass(regionId, rows);
  const commonGates = {
    roundTrip: rows.every((row) => row.roundTripTile.p95 < manifest.hardGates.roundTripTileP95Max),
    chunkSeams: seam.cracks <= manifest.hardGates.chunkSeamCracksMax,
    deterministicAssignments: anchorStable,
  };
  commonGates.pass = Object.values(commonGates).every(Boolean);
  const hardGates = {
    common: commonGates,
    modes: {
      screenAxis: { direction: direction.screenAxis, pass: commonGates.pass && direction.screenAxis },
      geoAxis: { direction: direction.geoAxis, pass: commonGates.pass && direction.geoAxis },
    },
  };
  hardGates.pass = hardGates.modes.screenAxis.pass || hardGates.modes.geoAxis.pass;
  return { projection: projection.id, region: regionId, rows, seam, assignments: assignmentsA, direction, hardGates };
}

function aggregateFixtureScores(analyses, aggregateId) {
  const aggregate = manifest.metricAggregates[aggregateId];
  return analyses.map((analysis) => {
    const scores = aggregate.fixtures.map((fixture) => scoreSummary(
      analysis.rows.find((row) => row.fixture === fixture).metrics,
      manifest.scoreWeights,
    ));
    return { projection: analysis.projection, score: weightedAverage(scores, aggregate.weights) };
  }).sort((a, b) => a.score - b.score);
}

function aggregateRegionScores(analyses, regionId) {
  return analyses.map((analysis) => ({
    projection: analysis.projection,
    score: scoreSummary(analysis.rows.find((row) => row.fixture === regionId).metrics, manifest.scoreWeights),
  })).sort((a, b) => a.score - b.score);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function metricsCsv(rows) {
  const metricNames = [
    'eastScaleErrorPct', 'northScaleErrorPct', 'northDeviationDeg', 'shearDeg',
    'shapeDistortionPct', 'areaErrorPct', 'screenNorthErrorDeg', 'geoAxisHorizontalShare',
  ];
  const header = ['region', 'fixture', 'projection'];
  for (const metric of metricNames) for (const stat of ['p50', 'p95', 'max']) header.push(`${metric}.${stat}`);
  header.push('roundTripTile.p50', 'roundTripTile.p95', 'roundTripTile.max', 'curvature.totalDeg', 'curvature.maxStepDeg', 'inverseCostUnits');
  const lines = [header.join(',')];
  for (const row of rows) {
    const values = [row.region, row.fixture, row.projection];
    for (const metric of metricNames) for (const stat of ['p50', 'p95', 'max']) values.push(fixed(row.metrics[metric][stat], 8));
    values.push(fixed(row.roundTripTile.p50, 12), fixed(row.roundTripTile.p95, 12), fixed(row.roundTripTile.max, 12));
    values.push(row.curvature ? fixed(row.curvature.totalDeg, 8) : '', row.curvature ? fixed(row.curvature.maxStepDeg, 8) : '');
    values.push(INVERSE_COST[row.projection]);
    lines.push(values.map(csvEscape).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function panelTransform(projection, bbox, x, y, width, height) {
  const bounds = projectionBounds(projection, bbox);
  const pad = 18;
  const scale = Math.min((width - pad * 2) / Math.max(1, bounds.maxX - bounds.minX),
    (height - pad * 2) / Math.max(1, bounds.maxY - bounds.minY));
  const usedW = (bounds.maxX - bounds.minX) * scale;
  const usedH = (bounds.maxY - bounds.minY) * scale;
  const left = x + (width - usedW) / 2;
  const top = y + (height - usedH) / 2;
  return {
    point(lon, lat) {
      const projected = projection.forward(lon, lat);
      return { x: left + (projected.x - bounds.minX) * scale, y: top + (bounds.maxY - projected.y) * scale };
    },
  };
}

function pathForRings(rings, transform) {
  const paths = [];
  for (const ring of rings) {
    let previous = null;
    const points = [];
    for (let i = 0; i < ring.length; i += 1) {
      const point = transform.point(ring[i].lon, ring[i].lat);
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.7 || i === ring.length - 1) {
        points.push(point);
        previous = point;
      }
    }
    if (points.length < 2) continue;
    paths.push(`M${points.map((point) => `${fixed(point.x, 2)},${fixed(point.y, 2)}`).join('L')}`);
  }
  return paths.join('');
}

function polylinePath(points, transform) {
  return points.map((point, index) => {
    const projected = transform.point(point.lon, point.lat);
    return `${index ? 'L' : 'M'}${fixed(projected.x, 2)},${fixed(projected.y, 2)}`;
  }).join('');
}

function arrowSamples(bbox) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return [
    { lon: minLon + (maxLon - minLon) * 0.25, lat: minLat + (maxLat - minLat) * 0.35 },
    { lon: minLon + (maxLon - minLon) * 0.72, lat: minLat + (maxLat - minLat) * 0.68 },
  ];
}

function arrowsSvg(projection, bbox, transform) {
  return arrowSamples(bbox).map((sample) => {
    const origin = transform.point(sample.lon, sample.lat);
    const metrics = pointMetrics(projection, sample.lon, sample.lat, manifest.earthRadiusMeters);
    const north = metrics.northVector;
    const length = 24;
    const norm = Math.hypot(north.x, north.y) || 1;
    const trueX = origin.x + (north.x / norm) * length;
    const trueY = origin.y - (north.y / norm) * length;
    return `<path d="M${fixed(origin.x, 2)},${fixed(origin.y, 2)}L${fixed(origin.x, 2)},${fixed(origin.y - length, 2)}" class="screen-arrow" marker-end="url(#screen-arrow)"/>`
      + `<path d="M${fixed(origin.x, 2)},${fixed(origin.y, 2)}L${fixed(trueX, 2)},${fixed(trueY, 2)}" class="geo-arrow" marker-end="url(#geo-arrow)"/>`;
  }).join('');
}

function svgShell(width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
<style>
  .panel{fill:#edf3f3;stroke:#8b9494;stroke-width:1}.land{fill:none;stroke:#555f61;stroke-width:.8}.route{fill:none;stroke:#b54736;stroke-width:2.4}.screen-arrow{fill:none;stroke:#6b7280;stroke-width:1.5}.geo-arrow{fill:none;stroke:#156b8a;stroke-width:2}.label{font:600 15px system-ui,sans-serif;fill:#243033}.small{font:12px system-ui,sans-serif;fill:#465558}.legend{font:12px system-ui,sans-serif;fill:#243033}
</style>
<defs>
  <marker id="screen-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#6b7280"/></marker>
  <marker id="geo-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#156b8a"/></marker>
</defs>
<rect width="${width}" height="${height}" fill="#ffffff"/>
${body}
</svg>
`;
}

function focusSvg(fixture, landRings, route) {
  const width = 1200;
  const height = 430;
  const panelW = 380;
  const panelH = 340;
  const gap = 15;
  const rings = ringsForBbox(landRings, fixture.bbox);
  const projections = projectionSet(fixture.region);
  let body = `<text x="20" y="24" class="label">${escapeXml(fixture.label)}</text>`;
  projections.forEach((projection, index) => {
    const x = 15 + index * (panelW + gap);
    const y = 42;
    const transform = panelTransform(projection, fixture.bbox, x, y, panelW, panelH);
    const clipId = `clip-${fixture.id}-${projection.id}`;
    body += `<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${panelW}" height="${panelH}"/></clipPath>`;
    body += `<rect x="${x}" y="${y}" width="${panelW}" height="${panelH}" class="panel"/>`;
    body += `<g clip-path="url(#${clipId})"><path d="${pathForRings(rings, transform)}" class="land"/>`;
    if (fixture.id === 'transsib') body += `<path d="${polylinePath(route, transform)}" class="route"/>`;
    body += arrowsSvg(projection, fixture.bbox, transform);
    body += '</g>';
    body += `<text x="${x + 8}" y="${y + 20}" class="label">${PROJECTION_LABELS[projection.id]}</text>`;
  });
  body += `<path d="M20,408L20,388" class="screen-arrow" marker-end="url(#screen-arrow)"/><text x="30" y="402" class="legend">screen-axis up</text>`;
  body += `<path d="M170,408L178,389" class="geo-arrow" marker-end="url(#geo-arrow)"/><text x="190" y="402" class="legend">geo-axis true north</text>`;
  return svgShell(width, height, body);
}

function overviewSvg(landRings) {
  const width = 1200;
  const height = 780;
  const panelW = 380;
  const panelH = 320;
  const gap = 15;
  let body = '<text x="20" y="24" class="label">Regional overviews — identical geographic bboxes, viewport-normalized</text>';
  ['apac', 'emea'].forEach((regionId, rowIndex) => {
    const region = manifest.regions[regionId];
    const y = 48 + rowIndex * 360;
    const rings = ringsForBbox(landRings, region.bbox);
    projectionSet(regionId).forEach((projection, columnIndex) => {
      const x = 15 + columnIndex * (panelW + gap);
      const transform = panelTransform(projection, region.bbox, x, y, panelW, panelH);
      const clipId = `clip-${regionId}-${projection.id}`;
      body += `<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${panelW}" height="${panelH}"/></clipPath>`;
      body += `<rect x="${x}" y="${y}" width="${panelW}" height="${panelH}" class="panel"/>`;
      body += `<g clip-path="url(#${clipId})"><path d="${pathForRings(rings, transform)}" class="land"/>${arrowsSvg(projection, region.bbox, transform)}</g>`;
      body += `<text x="${x + 8}" y="${y + 20}" class="label">${escapeXml(region.label)} · ${PROJECTION_LABELS[projection.id]}</text>`;
    });
  });
  body += '<path d="M20,756L20,736" class="screen-arrow" marker-end="url(#screen-arrow)"/><text x="30" y="750" class="legend">screen-axis up</text>';
  body += '<path d="M170,756L178,737" class="geo-arrow" marker-end="url(#geo-arrow)"/><text x="190" y="750" class="legend">geo-axis true north</text>';
  return svgShell(width, height, body);
}

function summaryTable(analyses, regionId) {
  const header = '| 후보 | 동서 축척 P95 | 북쪽 이탈 P95 | 형상 왜곡 P95 | screen up P95 | geo stair P95 | 하드 게이트 |\n|---|---:|---:|---:|---:|---:|---|';
  const lines = analyses.map((analysis) => {
    const row = analysis.rows.find((item) => item.fixture === regionId);
    const m = row.metrics;
    const screen = analysis.hardGates.modes.screenAxis.pass ? 'PASS' : 'FAIL';
    const geo = analysis.hardGates.modes.geoAxis.pass ? 'PASS' : 'FAIL';
    return `| ${PROJECTION_LABELS[analysis.projection]} | ${fixed(m.eastScaleErrorPct.p95, 1)}% | ${fixed(m.northDeviationDeg.p95, 1)}° | ${fixed(m.shapeDistortionPct.p95, 1)}% | ${fixed(m.screenNorthErrorDeg.p95, 1)}° | ${fixed(m.geoAxisHorizontalShare.p95 * 100, 1)}% | screen ${screen} / geo ${geo} |`;
  });
  return [header, ...lines].join('\n');
}

function scoreTable(uniform, weighted) {
  const byProjection = new Map();
  for (const row of uniform) byProjection.set(row.projection, { uniform: row.score });
  for (const row of weighted) byProjection.get(row.projection).weighted = row.score;
  return ['| 후보 | 균등 평균 점수↓ | KR/JP 콘텐츠 가중 점수↓ |', '|---|---:|---:|',
    ...PROJECTION_IDS.map((id) => `| ${PROJECTION_LABELS[id]} | ${fixed(byProjection.get(id).uniform, 2)} | ${fixed(byProjection.get(id).weighted, 2)} |`),
  ].join('\n');
}

function buildReport(results) {
  const apacWinner = results.rankings.apacContentWeighted[0].projection;
  const emeaWinner = results.rankings.emea[0].projection;
  const emeaWinnerAnalysis = results.analyses.emea.find((analysis) => analysis.projection === emeaWinner);
  const transsib = Object.fromEntries(results.analyses.apac.map((analysis) => {
    const row = analysis.rows.find((item) => item.fixture === 'transsib');
    return [analysis.projection, row.curvature];
  }));
  return `# 오버월드 투영 스파이크 비교 보고서

> 생성 명령: \`node scripts/world/projection-spike.mjs --input-dir <verified-cache>\`
> 판정 범위: 헌장 §4의 3후보 × 7 시각 fixture × screen/geo-axis. 본생성·노드 마이그레이션·DB 변경 없음.

## 결론

- **① 아시아-태평양 권고: ${PROJECTION_LABELS[apacWinner]} + screen-axis.** KR/JP 콘텐츠 가중 점수와 그리드 의미론을 우선한다.
- **② 유럽-지중해-중동: 수치 1위는 ${PROJECTION_LABELS[emeaWinner]}지만 아직 잠그지 않는다.** ${emeaWinnerAnalysis.hardGates.modes.screenAxis.pass ? 'screen-axis 하드 게이트를 통과했다.' : 'screen-axis 방향 하드 게이트를 넘지 못했다.'} 수직 슬라이스 체감 검증과 Claude 의견 뒤 확정한다.
- LAEA와 geo-axis는 수치 비교군으로 유지하되, 4방향 이산 이동에서 축 회전 비용이 사라지지 않는다.

점수 가중치는 manifest의 \`scoreWeights\`로 고정한다(축척 25%, 북쪽 이탈 20%, 전단 15%, 형상 25%, screen-up 15%). 절대 품질값이 아니라 후보 순위용이며 원시 지표를 함께 공개한다.

## 입력과 결정성

- Natural Earth land 10m v5.1.2: \`${manifest.sources[0].sha256}\`
- Natural Earth populated places 10m v5.1.2: \`${manifest.sources[1].sha256}\`
- 지구 반경 ${manifest.earthRadiusMeters}m, 명목 ${manifest.metersPerTile}m/타일, 256타일/청크.
- 표본은 bbox 내부 ${manifest.sampleGrid.columns}×${manifest.sampleGrid.rows} 셀 중심, 피처는 source index 순, 반올림은 half-away-from-zero.
- 시각은 후보별 동일 지리 bbox를 viewport-normalize하고, 수치는 **정규화 전 원시 투영 미터**에서 계산했다.
- 역변환 비용 프록시(초월함수·분기 상대단위): 등장방형 1, Sinusoidal 2, LAEA 8. 환경 의존 wall-clock 수치는 결정성 산출물에서 제외했다.

## 지역 ① 원시 요약

${summaryTable(results.analyses.apac, 'apac')}

### 균등·콘텐츠 가중 평균

${scoreTable(results.rankings.apacUniform, results.rankings.apacContentWeighted)}

## 지역 ② 원시 요약

${summaryTable(results.analyses.emea, 'emea')}

## 입력 모드 판정

- **screen-axis**: 입력과 미니맵 축이 항상 일치한다. 실제 진북과의 차이는 \`screenNorthErrorDeg\`로 공개하며 22.5° 초과를 4방향 의미론 반전 위험으로 본다.
- **geo-axis**: 연속 벡터는 진북을 맞추지만 타일 이동에는 수평 스텝을 섞어야 한다. \`geoAxisHorizontalShare\`는 진북 1타일 진행에 필요한 수평 스텝 비율이다.
- 최종 입력 권고는 screen-axis다. geo-axis는 방향 보조선·미니맵 나침반용 계산에는 재사용할 수 있지만 플레이어 D-pad 기본값으로 쓰지 않는다.
- 방향 하드 게이트의 핵심 범위는 ① 일본+한반도, ② 전체 지역 bbox다. 원시 지역 P95와 핵심 범위 최대값은 서로 다른 질문이므로 표의 모드 판정은 후자를 사용한다.

## 철도·하드 게이트

- Trans-Siberian 대표 제어선의 투영 기인 추가 곡률(누적/최대 1스텝): 등장방형 ${fixed(transsib.equirectangular.totalDeg, 1)}°/${fixed(transsib.equirectangular.maxStepDeg, 2)}°, Sinusoidal ${fixed(transsib.sinusoidal.totalDeg, 1)}°/${fixed(transsib.sinusoidal.maxStepDeg, 2)}°, LAEA ${fixed(transsib.laea.totalDeg, 1)}°/${fixed(transsib.laea.maxStepDeg, 2)}°.
- 전 후보의 공통 게이트는 WGS84→float tile→WGS84 P95 <0.25타일, 256 청크 경계 재구성 균열 0, 앵커 청크 소속 반복 계산 byte-identical이다. 방향 게이트는 입력 모드별로 분리하며 표의 \`screen/geo\` 판정은 공통 게이트까지 포함한다.
- 정수 타일 반올림 오차는 별도 게임플레이 오차이며 역투영 게이트에 섞지 않았다. 실제 래스터 수직 슬라이스에서 supersampling·half-open ownership을 다시 검증한다.

## 7개 시각 fixture

1. [전역 축소도](generated/world-projection-spike/overview.svg)
2. [일본 열도](generated/world-projection-spike/japan.svg)
3. [한반도](generated/world-projection-spike/korea.svg)
4. [인도네시아](generated/world-projection-spike/indonesia.svg)
5. [뉴질랜드](generated/world-projection-spike/new-zealand.svg)
6. [시베리아 철도 제어선](generated/world-projection-spike/transsib.svg)
7. [호주 동해안](generated/world-projection-spike/australia-east.svg)

원시 수치는 [metrics.csv](generated/world-projection-spike/metrics.csv), 전체 판정 데이터는 [results.json](generated/world-projection-spike/results.json), 파일 해시는 [content-manifest.json](generated/world-projection-spike/content-manifest.json)에 있다.

## Codex 최종 의견(1p)

①은 **등장방형**을 지지한다. 일본·한반도에서 화면 위=북, 철도·도로 축, 미니맵 축이 정확히 일치하고, 현재 콘텐츠 가중치가 이 두 지역에 집중된다. 고위도 동서 팽창은 분명하지만 시베리아를 corridor 씬으로 분리하는 헌장 결정과 명목 4.5km/타일·시간표 기반 교통이 비용을 제한한다. 뉴질랜드의 형상 열화는 전단 30°보다 플레이 입력 일관성이 덜 위험하다.

②는 수치 점수 1위인 **${PROJECTION_LABELS[emeaWinner]}**를 다음 체감 비교 대상으로만 지지한다. ②는 스칸디나비아·영국 등 고위도 육지가 저밀도 빈칸이 아니므로 등장방형 팽창 비용이 크지만, ${emeaWinnerAnalysis.hardGates.modes.screenAxis.pass ? '현재 screen-axis 방향 게이트는 통과했다.' : '현재 screen-axis 방향 게이트는 실패했다.'} 현 스코프는 타 지역 콘텐츠를 만들지 않으므로 투영을 서둘러 잠그지 않고, 한일 수직 슬라이스에서 공통 청크 런타임을 먼저 검증한다. Claude 의견이 ② Sinusoidal을 유지하거나 방향 게이트 해석이 다르면 오너 판정으로 넘긴다.
`;
}

function writeDeterministic(path, content, verifyOnly) {
  if (verifyOnly) {
    if (!existsSync(path)) throw new Error(`Missing generated file: ${path}`);
    const existing = readFileSync(path);
    const expected = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (!existing.equals(expected)) throw new Error(`Generated output drift: ${path}`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

const land = readVerifiedSource(manifest.sources[0]);
const places = readVerifiedSource(manifest.sources[1]);
const landRings = flattenLandRings(land);
const placeLookup = populatedPlaceLookup(places);
const transsibFixture = manifest.fixtures.find((fixture) => fixture.id === 'transsib');
const routeControls = transsibFixture.controlPointNames.map((name) => {
  const point = placeLookup.get(name);
  if (!point) throw new Error(`Missing Natural Earth control point: ${name}`);
  return { ...point, id: name };
});
const route = densifyRoute(routeControls, 24);
const anchors = [...routeControls, ...manifest.chunkAssignmentControlPointNames.map((name) => {
  const point = placeLookup.get(name);
  if (!point) throw new Error(`Missing Natural Earth chunk assignment control point: ${name}`);
  return { ...point, id: name };
})];

const analyses = { apac: [], emea: [] };
for (const regionId of Object.keys(analyses)) {
  for (const projection of projectionSet(regionId)) {
    analyses[regionId].push(analyzeProjection(projection, regionId, manifest.fixtures, route, anchors));
  }
}
const rankings = {
  apacUniform: aggregateFixtureScores(analyses.apac, 'uniform'),
  apacContentWeighted: aggregateFixtureScores(analyses.apac, 'contentWeighted'),
  emea: aggregateRegionScores(analyses.emea, 'emea'),
};
const resultObject = {
  schemaVersion: 1,
  inputManifestSha256: sha256(readFileSync(MANIFEST_PATH)),
  projectionParameters: Object.fromEntries(Object.entries(manifest.regions).map(([id, region]) => [id, region.anchor])),
  inverseCostUnits: INVERSE_COST,
  rankings,
  analyses,
};

const allMetricRows = [...analyses.apac, ...analyses.emea].flatMap((analysis) => analysis.rows);
const outputs = new Map();
outputs.set('metrics.csv', metricsCsv(allMetricRows));
outputs.set('results.json', `${JSON.stringify(resultObject, (key, value) => typeof value === 'number' ? fixed(value, 12) : value, 2)}\n`);
outputs.set('overview.svg', overviewSvg(landRings));
for (const fixture of manifest.fixtures.filter((item) => !item.visualOnly)) {
  outputs.set(`${fixture.id}.svg`, focusSvg(fixture, landRings, route));
}

const contentManifest = {
  schemaVersion: 1,
  inputManifestSha256: resultObject.inputManifestSha256,
  files: [...outputs.entries()].map(([path, content]) => ({ path, sha256: sha256(content), bytes: Buffer.byteLength(content) }))
    .sort((a, b) => a.path.localeCompare(b.path, 'en')),
};
outputs.set('content-manifest.json', `${JSON.stringify(contentManifest, null, 2)}\n`);

for (const [path, content] of outputs) writeDeterministic(join(OUTPUT_DIR, path), content, VERIFY_ONLY);
writeDeterministic(REPORT_PATH, buildReport(resultObject), VERIFY_ONLY);

console.log(`${VERIFY_ONLY ? 'verified' : 'generated'} ${outputs.size + 1} deterministic outputs`);
console.log(`APAC content-weighted: ${rankings.apacContentWeighted.map((row) => `${row.projection}=${fixed(row.score, 2)}`).join(', ')}`);
console.log(`EMEA: ${rankings.emea.map((row) => `${row.projection}=${fixed(row.score, 2)}`).join(', ')}`);
