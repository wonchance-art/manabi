const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export const PROJECTION_IDS = Object.freeze(['equirectangular', 'sinusoidal', 'laea']);

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeLon(lon, lon0 = 0) {
  let out = lon;
  while (out - lon0 > 180) out -= 360;
  while (out - lon0 < -180) out += 360;
  return out;
}

export function roundHalfAwayFromZero(value) {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function buildProjection(id, anchor, earthRadiusMeters) {
  if (!PROJECTION_IDS.includes(id)) throw new Error(`Unknown projection: ${id}`);
  const radius = earthRadiusMeters;
  const lon0 = anchor.lon0 * DEG;
  const lat0 = anchor.lat0 * DEG;
  const standardLat = anchor.standardLat * DEG;

  const forward = (lonDeg, latDeg) => {
    const lon = normalizeLon(lonDeg, anchor.lon0) * DEG;
    const lat = clamp(latDeg, -89.999999, 89.999999) * DEG;
    const dLon = lon - lon0;
    if (id === 'equirectangular') {
      return { x: radius * dLon * Math.cos(standardLat), y: radius * lat };
    }
    if (id === 'sinusoidal') {
      return { x: radius * dLon * Math.cos(lat), y: radius * lat };
    }
    const denom = 1 + Math.sin(lat0) * Math.sin(lat)
      + Math.cos(lat0) * Math.cos(lat) * Math.cos(dLon);
    const k = Math.sqrt(2 / Math.max(1e-15, denom));
    return {
      x: radius * k * Math.cos(lat) * Math.sin(dLon),
      y: radius * k * (Math.cos(lat0) * Math.sin(lat)
        - Math.sin(lat0) * Math.cos(lat) * Math.cos(dLon)),
    };
  };

  const inverse = (x, y) => {
    if (id === 'equirectangular') {
      return {
        lon: normalizeLon((x / (radius * Math.cos(standardLat)) + lon0) * RAD, anchor.lon0),
        lat: (y / radius) * RAD,
      };
    }
    if (id === 'sinusoidal') {
      const lat = y / radius;
      const cosLat = Math.cos(lat);
      const lon = Math.abs(cosLat) < 1e-12 ? lon0 : lon0 + x / (radius * cosLat);
      return { lon: normalizeLon(lon * RAD, anchor.lon0), lat: lat * RAD };
    }
    const rho = Math.hypot(x, y);
    if (rho < 1e-9) return { lon: anchor.lon0, lat: anchor.lat0 };
    const c = 2 * Math.asin(clamp(rho / (2 * radius), -1, 1));
    const sinC = Math.sin(c);
    const cosC = Math.cos(c);
    const lat = Math.asin(clamp(cosC * Math.sin(lat0)
      + (y * sinC * Math.cos(lat0)) / rho, -1, 1));
    const lon = lon0 + Math.atan2(x * sinC,
      rho * Math.cos(lat0) * cosC - y * Math.sin(lat0) * sinC);
    return { lon: normalizeLon(lon * RAD, anchor.lon0), lat: lat * RAD };
  };

  return Object.freeze({ id, anchor: Object.freeze({ ...anchor }), forward, inverse });
}

export function localJacobian(projection, lon, lat, earthRadiusMeters, deltaMeters = 10) {
  const safeCos = Math.max(1e-8, Math.cos(lat * DEG));
  const dLon = (deltaMeters / (earthRadiusMeters * safeCos)) * RAD;
  const dLat = (deltaMeters / earthRadiusMeters) * RAD;
  const e0 = projection.forward(lon - dLon, lat);
  const e1 = projection.forward(lon + dLon, lat);
  const n0 = projection.forward(lon, lat - dLat);
  const n1 = projection.forward(lon, lat + dLat);
  return {
    east: { x: (e1.x - e0.x) / (2 * deltaMeters), y: (e1.y - e0.y) / (2 * deltaMeters) },
    north: { x: (n1.x - n0.x) / (2 * deltaMeters), y: (n1.y - n0.y) / (2 * deltaMeters) },
  };
}

function angleBetween(a, b) {
  const denom = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  if (denom < 1e-15) return 0;
  return Math.acos(clamp((a.x * b.x + a.y * b.y) / denom, -1, 1)) * RAD;
}

function singularValues(jacobian) {
  const { east: e, north: n } = jacobian;
  const a = e.x * e.x + e.y * e.y;
  const b = e.x * n.x + e.y * n.y;
  const d = n.x * n.x + n.y * n.y;
  const trace = a + d;
  const root = Math.sqrt(Math.max(0, (a - d) ** 2 + 4 * b * b));
  return [Math.sqrt(Math.max(0, (trace + root) / 2)), Math.sqrt(Math.max(0, (trace - root) / 2))];
}

export function pointMetrics(projection, lon, lat, earthRadiusMeters) {
  const jacobian = localJacobian(projection, lon, lat, earthRadiusMeters);
  const e = jacobian.east;
  const n = jacobian.north;
  const eastScale = Math.hypot(e.x, e.y);
  const northScale = Math.hypot(n.x, n.y);
  const northDeviationDeg = Math.abs(Math.atan2(n.x, n.y) * RAD);
  const shearDeg = Math.abs(angleBetween(e, n) - 90);
  const [major, minor] = singularValues(jacobian);
  const determinant = Math.abs(e.x * n.y - e.y * n.x);
  const det = e.x * n.y - e.y * n.x;
  const inverseEast = det === 0 ? Infinity : -n.x / det;
  const inverseNorth = det === 0 ? Infinity : e.x / det;
  const screenNorthErrorDeg = Math.abs(Math.atan2(inverseEast, inverseNorth) * RAD);
  const geoAxisHorizontalShare = Math.abs(n.x) / Math.max(1e-15, Math.abs(n.x) + Math.abs(n.y));
  return {
    eastScaleErrorPct: Math.abs(eastScale - 1) * 100,
    northScaleErrorPct: Math.abs(northScale - 1) * 100,
    northDeviationDeg,
    shearDeg,
    shapeDistortionPct: minor < 1e-15 ? Infinity : (major / minor - 1) * 100,
    areaErrorPct: Math.abs(determinant - 1) * 100,
    screenNorthErrorDeg,
    geoAxisHorizontalShare,
    northVector: n,
  };
}

export function sampleGrid(bbox, columns = 21, rows = 21, offset = 0.5) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const out = [];
  for (let y = 0; y < rows; y += 1) {
    const fy = (y + offset) / rows;
    const lat = minLat + (maxLat - minLat) * fy;
    for (let x = 0; x < columns; x += 1) {
      const fx = (x + offset) / columns;
      out.push({ lon: minLon + (maxLon - minLon) * fx, lat });
    }
  }
  return out;
}

export function percentile(values, probability) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

export function summarizeValues(values) {
  return {
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    max: values.length ? Math.max(...values) : null,
  };
}

export function summarizePointMetrics(rows) {
  const keys = [
    'eastScaleErrorPct', 'northScaleErrorPct', 'northDeviationDeg', 'shearDeg',
    'shapeDistortionPct', 'areaErrorPct', 'screenNorthErrorDeg', 'geoAxisHorizontalShare',
  ];
  return Object.fromEntries(keys.map((key) => [key, summarizeValues(rows.map((row) => row[key]))]));
}

export function haversineMeters(a, b, earthRadiusMeters) {
  const lat1 = a.lat * DEG;
  const lat2 = b.lat * DEG;
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (normalizeLon(b.lon, a.lon) - a.lon) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function projectionBounds(projection, bbox, samplesPerEdge = 128) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const points = [];
  for (let i = 0; i <= samplesPerEdge; i += 1) {
    const t = i / samplesPerEdge;
    const lon = minLon + (maxLon - minLon) * t;
    const lat = minLat + (maxLat - minLat) * t;
    points.push(projection.forward(lon, minLat), projection.forward(lon, maxLat));
    points.push(projection.forward(minLon, lat), projection.forward(maxLon, lat));
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function tileFrame(projection, bbox, metersPerTile) {
  const bounds = projectionBounds(projection, bbox);
  return {
    bounds,
    project(lon, lat) {
      const point = projection.forward(lon, lat);
      return { x: (point.x - bounds.minX) / metersPerTile, y: (bounds.maxY - point.y) / metersPerTile };
    },
    unproject(x, y) {
      return projection.inverse(bounds.minX + x * metersPerTile, bounds.maxY - y * metersPerTile);
    },
  };
}

export function roundTripStats(projection, bbox, points, metersPerTile, earthRadiusMeters) {
  const frame = tileFrame(projection, bbox, metersPerTile);
  const errors = points.map((point) => {
    const tile = frame.project(point.lon, point.lat);
    const restored = frame.unproject(tile.x, tile.y);
    return haversineMeters(point, restored, earthRadiusMeters) / metersPerTile;
  });
  return summarizeValues(errors);
}

function unitVector(lon, lat) {
  const lambda = lon * DEG;
  const phi = lat * DEG;
  const cosPhi = Math.cos(phi);
  return [cosPhi * Math.cos(lambda), cosPhi * Math.sin(lambda), Math.sin(phi)];
}

export function greatCircleInterpolate(a, b, t) {
  const va = unitVector(a.lon, a.lat);
  const vb = unitVector(b.lon, b.lat);
  const dot = clamp(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1, 1);
  const omega = Math.acos(dot);
  if (omega < 1e-12) return { lon: a.lon, lat: a.lat };
  const sinOmega = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / sinOmega;
  const wb = Math.sin(t * omega) / sinOmega;
  const x = wa * va[0] + wb * vb[0];
  const y = wa * va[1] + wb * vb[1];
  const z = wa * va[2] + wb * vb[2];
  return { lon: Math.atan2(y, x) * RAD, lat: Math.atan2(z, Math.hypot(x, y)) * RAD };
}

export function densifyRoute(controlPoints, stepsPerLeg = 24) {
  const out = [];
  for (let i = 0; i < controlPoints.length - 1; i += 1) {
    for (let step = 0; step < stepsPerLeg; step += 1) {
      out.push(greatCircleInterpolate(controlPoints[i], controlPoints[i + 1], step / stepsPerLeg));
    }
  }
  out.push({ ...controlPoints.at(-1) });
  return out;
}

function initialBearing(a, b) {
  const phi1 = a.lat * DEG;
  const phi2 = b.lat * DEG;
  const dLon = (normalizeLon(b.lon, a.lon) - a.lon) * DEG;
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return Math.atan2(y, x) * RAD;
}

function wrapAngle(angle) {
  let out = angle;
  while (out > 180) out -= 360;
  while (out <= -180) out += 360;
  return out;
}

export function projectionInducedCurvature(projection, route) {
  const headingErrors = [];
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i];
    const b = route[i + 1];
    const pa = projection.forward(a.lon, a.lat);
    const pb = projection.forward(b.lon, b.lat);
    const projectedBearing = Math.atan2(pb.x - pa.x, pb.y - pa.y) * RAD;
    headingErrors.push(wrapAngle(projectedBearing - initialBearing(a, b)));
  }
  const deltas = [];
  for (let i = 1; i < headingErrors.length; i += 1) {
    deltas.push(Math.abs(wrapAngle(headingErrors[i] - headingErrors[i - 1])));
  }
  return { totalDeg: deltas.reduce((sum, value) => sum + value, 0), maxStepDeg: deltas.length ? Math.max(...deltas) : 0 };
}

export function chunkContinuityStats(frame, polylines, chunkTiles) {
  let crossings = 0;
  let cracks = 0;
  let maxErrorTile = 0;
  const epsilon = 1e-9;
  for (const polyline of polylines) {
    const tiles = polyline.map((point) => frame.project(point.lon, point.lat));
    for (let i = 0; i < tiles.length - 1; i += 1) {
      const a = tiles[i];
      const b = tiles[i + 1];
      for (const axis of ['x', 'y']) {
        const lo = Math.min(a[axis], b[axis]);
        const hi = Math.max(a[axis], b[axis]);
        const first = Math.ceil(lo / chunkTiles) * chunkTiles;
        for (let boundary = first; boundary < hi; boundary += chunkTiles) {
          const denominator = b[axis] - a[axis];
          if (Math.abs(denominator) < 1e-15) continue;
          const t = (boundary - a[axis]) / denominator;
          const otherAxis = axis === 'x' ? 'y' : 'x';
          const other = a[otherAxis] + (b[otherAxis] - a[otherAxis]) * t;
          const global = axis === 'x' ? { x: boundary, y: other } : { x: other, y: boundary };
          const leftChunk = Math.floor((boundary - epsilon) / chunkTiles);
          const rightChunk = Math.floor((boundary + epsilon) / chunkTiles);
          const leftLocal = boundary - leftChunk * chunkTiles;
          const rightLocal = boundary - rightChunk * chunkTiles;
          const reconstructedLeft = leftChunk * chunkTiles + leftLocal;
          const reconstructedRight = rightChunk * chunkTiles + rightLocal;
          const error = Math.max(Math.abs(reconstructedLeft - global[axis]), Math.abs(reconstructedRight - global[axis]));
          crossings += 1;
          maxErrorTile = Math.max(maxErrorTile, error);
          if (error > 1e-9 || rightChunk !== leftChunk + 1) cracks += 1;
        }
      }
    }
  }
  return { crossings, cracks, maxErrorTile };
}

export function anchorChunkAssignments(frame, anchors, chunkTiles) {
  return anchors.map((anchor) => {
    const tile = frame.project(anchor.lon, anchor.lat);
    const tx = roundHalfAwayFromZero(tile.x);
    const ty = roundHalfAwayFromZero(tile.y);
    return {
      id: anchor.id,
      tile: [tx, ty],
      chunk: [Math.floor(tx / chunkTiles), Math.floor(ty / chunkTiles)],
    };
  }).sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

export function scoreSummary(summary, weights) {
  const scale = (summary.eastScaleErrorPct.p95 + summary.northScaleErrorPct.p95) / 2;
  return scale * weights.scaleP95
    + summary.northDeviationDeg.p95 * weights.northDeviationP95
    + summary.shearDeg.p95 * weights.shearP95
    + summary.shapeDistortionPct.p95 * weights.shapeDistortionP95
    + summary.screenNorthErrorDeg.p95 * weights.screenNorthErrorP95;
}

export function weightedAverage(values, weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return values.reduce((sum, value, index) => sum + value * weights[index], 0) / total;
}

export function fixed(value, digits = 6) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : value;
}
