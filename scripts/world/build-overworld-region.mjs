import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeOverworldChunkV1 } from '../../src/lib/world/overworldChunkEncoder.js';
import { createEquirectangularTileFrame } from '../../src/lib/world/overworldGeo.js';

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function compareCodePoint(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalJson(value) {
  return new TextEncoder().encode(`${JSON.stringify(value)}\n`);
}

function geometryPolygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  throw new Error(`unsupported Natural Earth land geometry: ${geometry.type}`);
}

function unwrapRing(ring, center) {
  let previous;
  return ring.map(([lon, lat], index) => {
    let unwrapped = lon;
    if (index === 0) {
      while (unwrapped - center > 180) unwrapped -= 360;
      while (unwrapped - center < -180) unwrapped += 360;
    } else {
      while (unwrapped - previous > 180) unwrapped -= 360;
      while (unwrapped - previous < -180) unwrapped += 360;
    }
    previous = unwrapped;
    return [unwrapped, lat];
  });
}

function addPolygonIntervals({ rings, frame, sampleScale, sampleWidth, sampleHeight, rowIntervals }) {
  const starts = new Map();
  let firstRow = sampleHeight;
  let lastRow = 0;
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 4) throw new Error('land polygon ring must have at least four vertices');
    const [firstLon, firstLat] = ring[0];
    const [lastLon, lastLat] = ring.at(-1);
    if (firstLon !== lastLon || firstLat !== lastLat) {
      throw new Error('land polygon ring must be closed');
    }
    const projected = unwrapRing(ring, frame.manifest.projection.lon0).map(([lon, lat]) => {
      const tile = frame.projectUnwrapped(lon, lat);
      return { x: tile.x * sampleScale, y: tile.y * sampleScale };
    });
    for (let index = 0; index < projected.length - 1; index += 1) {
      const a = projected[index];
      const b = projected[index + 1];
      if (a.y === b.y) continue;
      const yMin = Math.min(a.y, b.y);
      const yMax = Math.max(a.y, b.y);
      const start = Math.max(0, Math.ceil(yMin - 0.5));
      const end = Math.min(sampleHeight, Math.ceil(yMax - 0.5));
      if (start >= end) continue;
      const dx = (b.x - a.x) / (b.y - a.y);
      const edge = Object.freeze({
        start,
        end,
        x: a.x + (start + 0.5 - a.y) * dx,
        dx,
      });
      const bucket = starts.get(start);
      if (bucket) bucket.push(edge);
      else starts.set(start, [edge]);
      firstRow = Math.min(firstRow, start);
      lastRow = Math.max(lastRow, end);
    }
  }
  if (firstRow >= lastRow) return;

  let active = [];
  for (let row = firstRow; row < lastRow; row += 1) {
    const additions = starts.get(row);
    if (additions) active.push(...additions);
    active = active.filter((edge) => edge.end > row);
    const intersections = active
      .map((edge) => edge.x + (row - edge.start) * edge.dx)
      .sort((left, right) => left - right);
    if ((intersections.length & 1) !== 0) {
      throw new Error(`land polygon produced an odd intersection count at supersample row ${row}`);
    }
    for (let index = 0; index < intersections.length; index += 2) {
      const start = Math.max(0, Math.ceil(intersections[index] - 0.5));
      const end = Math.min(sampleWidth, Math.ceil(intersections[index + 1] - 0.5));
      if (start < end) rowIntervals[row].push([start, end]);
    }
  }
}

function mergeIntervals(intervals) {
  if (intervals.length < 2) return intervals;
  intervals.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const merged = [intervals[0].slice()];
  for (let index = 1; index < intervals.length; index += 1) {
    const current = intervals[index];
    const previous = merged.at(-1);
    if (current[0] <= previous[1]) previous[1] = Math.max(previous[1], current[1]);
    else merged.push(current.slice());
  }
  return merged;
}

export function rasterizeNaturalEarthLand({ manifest, geojson }) {
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new TypeError('Natural Earth land input must be a GeoJSON FeatureCollection');
  }
  const frame = createEquirectangularTileFrame(manifest);
  const sampleScale = manifest.supersampling.width;
  const sampleWidth = frame.width * sampleScale;
  const sampleHeight = frame.height * sampleScale;
  const rowIntervals = Array.from({ length: sampleHeight }, () => []);
  let polygonCount = 0;

  for (const feature of geojson.features) {
    for (const rings of geometryPolygons(feature.geometry)) {
      polygonCount += 1;
      addPolygonIntervals({ rings, frame, sampleScale, sampleWidth, sampleHeight, rowIntervals });
    }
  }

  const landSamples = new Uint8Array(frame.width * frame.height);
  let landSampleCount = 0;
  for (let sampleY = 0; sampleY < sampleHeight; sampleY += 1) {
    const tileY = sampleY >> 2;
    for (const [start, end] of mergeIntervals(rowIntervals[sampleY])) {
      landSampleCount += end - start;
      const firstTile = start >> 2;
      const lastTile = (end - 1) >> 2;
      for (let tileX = firstTile; tileX <= lastTile; tileX += 1) {
        const count = Math.min(end, (tileX + 1) * sampleScale) - Math.max(start, tileX * sampleScale);
        landSamples[tileY * frame.width + tileX] += count;
      }
    }
  }

  const surfaces = new Uint8Array(frame.width * frame.height);
  const tieThreshold = (manifest.supersampling.width * manifest.supersampling.height) / 2;
  let landTileCount = 0;
  for (let index = 0; index < surfaces.length; index += 1) {
    const land = landSamples[index] >= tieThreshold;
    surfaces[index] = land ? manifest.surfaceClasses.land : manifest.surfaceClasses.sea;
    if (land) landTileCount += 1;
  }
  return Object.freeze({ frame, surfaces, polygonCount, landSampleCount, landTileCount });
}

export function buildRegionArtifacts({ manifestBytes, manifest, geojson }) {
  const { frame, surfaces, polygonCount, landSampleCount, landTileCount } = rasterizeNaturalEarthLand({
    manifest,
    geojson,
  });
  const regionHash = sha256(manifest.regionId);
  const projectionManifestHash = sha256(canonicalJson(manifest.projection));
  const inputManifestHash = sha256(manifestBytes);
  const artifacts = [];
  const chunks = [];

  for (let cx = 0; cx < frame.chunkColumns; cx += 1) {
    for (let cy = 0; cy < frame.chunkRows; cy += 1) {
      const originX = cx * manifest.chunkTiles;
      const originY = cy * manifest.chunkTiles;
      const validBounds = Object.freeze({
        x0: 0,
        y0: 0,
        x1: Math.min(manifest.chunkTiles, frame.width - originX),
        y1: Math.min(manifest.chunkTiles, frame.height - originY),
      });
      const bytes = encodeOverworldChunkV1({
        schemaVersion: manifest.schemaVersion,
        cx,
        cy,
        validBounds,
        regionHash,
        projectionManifestHash,
        seaSurface: manifest.surfaceClasses.sea,
        surfaceAt: (x, y) => surfaces[(originY + y) * frame.width + originX + x],
        collisionAt: () => 1,
        viewOnlyAt: () => 1,
      });
      const artifactPath = `${cx}/${cy}.owc`;
      const entry = Object.freeze({
        path: artifactPath,
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
        role: 'surface-preview',
        cx,
        cy,
        validBounds,
      });
      chunks.push(entry);
      artifacts.push({ path: artifactPath, bytes });
    }
  }
  chunks.sort((left, right) => compareCodePoint(left.path, right.path));
  artifacts.sort((left, right) => compareCodePoint(left.path, right.path));

  const report = Object.freeze({
    releaseEligible: manifest.releaseEligible,
    polygonCount,
    landSampleCount,
    landTileCount,
    seaTileCount: surfaces.length - landTileCount,
    totalTileCount: surfaces.length,
  });
  const reportBytes = canonicalJson(report);
  artifacts.push({ path: 'build-report.json', bytes: reportBytes });
  const contentManifest = Object.freeze({
    formatVersion: 1,
    schemaVersion: manifest.schemaVersion,
    releaseEligible: manifest.releaseEligible,
    regionId: manifest.regionId,
    regionHash,
    inputManifestHash,
    projection: manifest.projection,
    projectionManifestHash,
    bbox: manifest.bbox,
    width: frame.width,
    height: frame.height,
    chunkColumns: frame.chunkColumns,
    chunkRows: frame.chunkRows,
    chunkBytes: chunks[0]?.bytes ?? 0,
    surfaceClasses: manifest.surfaceClasses,
    previewMasks: manifest.previewMasks,
    sources: manifest.sources,
    report: {
      path: 'build-report.json',
      bytes: reportBytes.byteLength,
      sha256: sha256(reportBytes),
      role: 'build-report',
    },
    chunks,
  });
  artifacts.push({ path: 'content-manifest.json', bytes: canonicalJson(contentManifest) });
  return Object.freeze(artifacts);
}

async function listOutputPaths(directory, prefix = '') {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const output = [];
  for (const entry of entries.sort((left, right) => compareCodePoint(left.name, right.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...await listOutputPaths(path.join(directory, entry.name), relative));
    else output.push(relative);
  }
  return output;
}

async function verifySource(inputDir, source) {
  const bytes = await readFile(path.join(inputDir, source.cacheFile));
  if (bytes.byteLength !== source.bytes) {
    throw new Error(`${source.id} byte length mismatch: ${bytes.byteLength} !== ${source.bytes}`);
  }
  const actualHash = sha256(bytes);
  if (actualHash !== source.sha256) {
    throw new Error(`${source.id} SHA-256 mismatch: ${actualHash} !== ${source.sha256}`);
  }
  return bytes;
}

export async function runRegionBuild({ manifestPath, inputDir, outputDir, check = false }) {
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const frame = createEquirectangularTileFrame(manifest);
  const sourceBytes = await verifySource(inputDir, frame.manifest.sources[0]);
  const geojson = JSON.parse(sourceBytes.toString('utf8'));
  const artifacts = buildRegionArtifacts({ manifestBytes, manifest: frame.manifest, geojson });

  if (check) {
    for (const artifact of artifacts) {
      const current = await readFile(path.join(outputDir, artifact.path));
      if (!current.equals(Buffer.from(artifact.bytes))) {
        throw new Error(`stale region artifact: ${artifact.path}`);
      }
    }
    const expected = artifacts.map(({ path: artifactPath }) => artifactPath).sort(compareCodePoint);
    const actual = await listOutputPaths(outputDir);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`region artifact file list drifted: ${actual.join(', ')}`);
    }
    return artifacts;
  }

  await Promise.all(artifacts.map(async (artifact) => {
    const destination = path.join(outputDir, artifact.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, artifact.bytes);
  }));
  return artifacts;
}

function parseArgs(argv) {
  const parsed = { check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--check') parsed.check = true;
    else if (value === '--manifest') parsed.manifestPath = argv[++index];
    else if (value === '--input-dir') parsed.inputDir = argv[++index];
    else if (value === '--output-dir') parsed.outputDir = argv[++index];
    else throw new Error(`unknown argument: ${value}`);
  }
  for (const key of ['manifestPath', 'inputDir', 'outputDir']) {
    if (!parsed[key]) throw new Error(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required`);
  }
  return parsed;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await runRegionBuild(parseArgs(process.argv.slice(2)));
