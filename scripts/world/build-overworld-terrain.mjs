import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeOverworldChunkV1 } from '../../src/lib/world/overworldChunk.js';
import { encodeOverworldChunkV1 } from '../../src/lib/world/overworldChunkEncoder.js';
import { createEquirectangularTileFrame, roundHalfAwayFromZero } from '../../src/lib/world/overworldGeo.js';
import {
  classifyTerrainElevation,
  normalizeOverworldTerrainManifest,
  quantizeTerrainOverlay,
  unwrapLineLongitudes,
} from '../../src/lib/world/overworldTerrain.js';

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function compareCodePoint(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalJson(value) {
  return new TextEncoder().encode(`${JSON.stringify(value)}\n`);
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function verifyFile(filePath, expected, label) {
  const metadata = await stat(filePath);
  if (metadata.size !== expected.bytes) {
    throw new Error(`${label} byte length mismatch: ${metadata.size} !== ${expected.bytes}`);
  }
  const actualHash = await sha256File(filePath);
  if (actualHash !== expected.sha256) {
    throw new Error(`${label} SHA-256 mismatch: ${actualHash} !== ${expected.sha256}`);
  }
}

function geometryLines(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  throw new Error(`unsupported river geometry: ${geometry.type}`);
}

function segmentIntersects(bounds, region) {
  return bounds.x1 >= region.x0 && bounds.x0 <= region.x1
    && bounds.y1 >= region.y0 && bounds.y0 <= region.y1;
}

export function buildRiverOverlayArtifacts({ frame, geojson, rules }) {
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new TypeError('river input must be a GeoJSON FeatureCollection');
  }
  const quantization = rules.quantization;
  const chunkQ = frame.manifest.chunkTiles * quantization;
  const haloQ = rules.haloTiles * quantization;
  const regionQ = Object.freeze({
    x0: 0,
    y0: 0,
    x1: frame.width * quantization,
    y1: frame.height * quantization,
  });
  const chunks = new Map();
  let featureCount = 0;
  let routeCount = 0;
  let segmentCount = 0;

  geojson.features.forEach((feature, sourceFeatureIndex) => {
    const scaleRank = feature?.properties?.scalerank;
    if (!Number.isSafeInteger(scaleRank) || scaleRank < 0 || scaleRank > rules.maxScaleRank) return;
    let featureKept = false;
    geometryLines(feature.geometry).forEach((line, partIndex) => {
      const routeId = `ne-river-${String(sourceFeatureIndex).padStart(4, '0')}-${String(partIndex).padStart(3, '0')}`;
      const pointsQ = unwrapLineLongitudes(line, frame.manifest.projection.lon0).map(([lon, lat]) => {
        const projected = frame.projectUnwrapped(lon, lat);
        return Object.freeze([
          quantizeTerrainOverlay(projected.x, quantization),
          quantizeTerrainOverlay(projected.y, quantization),
        ]);
      });
      let routeKept = false;
      for (let segmentIndex = 0; segmentIndex < pointsQ.length - 1; segmentIndex += 1) {
        const start = pointsQ[segmentIndex];
        const end = pointsQ[segmentIndex + 1];
        if (start[0] === end[0] && start[1] === end[1]) continue;
        const bounds = Object.freeze({
          x0: Math.min(start[0], end[0]),
          y0: Math.min(start[1], end[1]),
          x1: Math.max(start[0], end[0]),
          y1: Math.max(start[1], end[1]),
        });
        if (!segmentIntersects(bounds, regionQ)) continue;
        const segment = Object.freeze({
          id: `${routeId}-${String(segmentIndex).padStart(5, '0')}`,
          routeId,
          sourceFeatureIndex,
          partIndex,
          segmentIndex,
          scaleRank,
          start,
          end,
        });
        const minCx = Math.max(0, Math.floor((bounds.x0 - haloQ) / chunkQ));
        const maxCx = Math.min(frame.chunkColumns - 1, Math.floor((bounds.x1 + haloQ) / chunkQ));
        const minCy = Math.max(0, Math.floor((bounds.y0 - haloQ) / chunkQ));
        const maxCy = Math.min(frame.chunkRows - 1, Math.floor((bounds.y1 + haloQ) / chunkQ));
        for (let cx = minCx; cx <= maxCx; cx += 1) {
          for (let cy = minCy; cy <= maxCy; cy += 1) {
            const key = `${cx}/${cy}`;
            const bucket = chunks.get(key);
            if (bucket) bucket.push(segment);
            else chunks.set(key, [segment]);
          }
        }
        segmentCount += 1;
        routeKept = true;
        featureKept = true;
      }
      if (routeKept) routeCount += 1;
    });
    if (featureKept) featureCount += 1;
  });

  const artifacts = [];
  for (const key of [...chunks.keys()].sort(compareCodePoint)) {
    const [cx, cy] = key.split('/').map(Number);
    const segments = chunks.get(key).sort((left, right) => compareCodePoint(left.id, right.id));
    artifacts.push(Object.freeze({
      path: `rivers/${key}.json`,
      bytes: canonicalJson(Object.freeze({
        formatVersion: 1,
        kind: 'river-segments',
        quantization,
        haloTiles: rules.haloTiles,
        cx,
        cy,
        segments,
      })),
    }));
  }
  return Object.freeze({
    artifacts: Object.freeze(artifacts),
    featureCount,
    routeCount,
    segmentCount,
  });
}

export function buildTerrainSurfaces({ frame, baseSurfaceAt, meanElevationAtTile, manifest }) {
  const surfaces = new Uint8Array(frame.width * frame.height);
  const counts = Object.fromEntries(Object.keys(manifest.terrainClasses).map((key) => [key, 0]));
  let elevationMinMeters = Infinity;
  let elevationMaxMeters = -Infinity;
  const classNames = new Map(Object.entries(manifest.terrainClasses).map(([name, value]) => [value, name]));
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const index = y * frame.width + x;
      let surface = manifest.terrainClasses.sea;
      if (baseSurfaceAt(x, y) !== frame.manifest.surfaceClasses.sea) {
        const elevationMeters = meanElevationAtTile(x, y);
        if (!Number.isFinite(elevationMeters)) throw new Error(`non-finite elevation at tile ${x},${y}`);
        elevationMinMeters = Math.min(elevationMinMeters, elevationMeters);
        elevationMaxMeters = Math.max(elevationMaxMeters, elevationMeters);
        surface = classifyTerrainElevation(
          elevationMeters,
          manifest.terrainClasses,
          manifest.terrainThresholdsMeters,
        );
      }
      surfaces[index] = surface;
      counts[classNames.get(surface)] += 1;
    }
  }
  return Object.freeze({
    surfaces,
    counts: Object.freeze(counts),
    elevationMinMeters: roundHalfAwayFromZero(elevationMinMeters),
    elevationMaxMeters: roundHalfAwayFromZero(elevationMaxMeters),
  });
}

export function buildTerrainArtifacts({
  manifestBytes,
  manifest: manifestInput,
  baseManifest,
  baseContentManifestBytes,
  baseSurfaceAt,
  meanElevationAtTile,
  riverGeojson,
}) {
  const manifest = normalizeOverworldTerrainManifest(manifestInput);
  const frame = createEquirectangularTileFrame(baseManifest);
  if (baseContentManifestBytes.byteLength !== manifest.baseSurface.contentManifestBytes
    || sha256(baseContentManifestBytes) !== manifest.baseSurface.contentManifestSha256) {
    throw new Error('base surface content manifest does not match the terrain contract');
  }
  const terrain = buildTerrainSurfaces({ frame, baseSurfaceAt, meanElevationAtTile, manifest });
  const rivers = buildRiverOverlayArtifacts({ frame, geojson: riverGeojson, rules: manifest.riverRules });
  const regionHash = sha256(manifest.regionId);
  const projectionManifestHash = sha256(canonicalJson(frame.manifest.projection));
  const inputManifestHash = sha256(manifestBytes);
  const artifacts = [];
  const chunks = [];

  for (let cx = 0; cx < frame.chunkColumns; cx += 1) {
    for (let cy = 0; cy < frame.chunkRows; cy += 1) {
      const originX = cx * frame.manifest.chunkTiles;
      const originY = cy * frame.manifest.chunkTiles;
      const validBounds = Object.freeze({
        x0: 0,
        y0: 0,
        x1: Math.min(frame.manifest.chunkTiles, frame.width - originX),
        y1: Math.min(frame.manifest.chunkTiles, frame.height - originY),
      });
      const bytes = encodeOverworldChunkV1({
        schemaVersion: manifest.schemaVersion,
        cx,
        cy,
        validBounds,
        regionHash,
        projectionManifestHash,
        seaSurface: manifest.terrainClasses.sea,
        surfaceAt: (x, y) => terrain.surfaces[(originY + y) * frame.width + originX + x],
        collisionAt: () => 1,
        viewOnlyAt: () => 1,
      });
      const artifactPath = `${cx}/${cy}.owc`;
      const entry = Object.freeze({
        path: artifactPath,
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
        role: 'terrain-preview',
        cx,
        cy,
        validBounds,
      });
      chunks.push(entry);
      artifacts.push({ path: artifactPath, bytes });
    }
  }
  chunks.sort((left, right) => compareCodePoint(left.path, right.path));
  artifacts.push(...rivers.artifacts);
  artifacts.sort((left, right) => compareCodePoint(left.path, right.path));

  const overlays = rivers.artifacts.map((artifact) => Object.freeze({
    path: artifact.path,
    bytes: artifact.bytes.byteLength,
    sha256: sha256(artifact.bytes),
    role: 'river-overlay',
  }));
  const report = Object.freeze({
    releaseEligible: false,
    terrainTileCounts: terrain.counts,
    elevationMinMeters: terrain.elevationMinMeters,
    elevationMaxMeters: terrain.elevationMaxMeters,
    riverFeatureCount: rivers.featureCount,
    riverRouteCount: rivers.routeCount,
    riverSegmentCount: rivers.segmentCount,
    riverOverlayFileCount: overlays.length,
    totalTileCount: terrain.surfaces.length,
  });
  const reportBytes = canonicalJson(report);
  artifacts.push({ path: 'build-report.json', bytes: reportBytes });
  const contentManifest = Object.freeze({
    formatVersion: 1,
    schemaVersion: manifest.schemaVersion,
    releaseEligible: false,
    regionId: manifest.regionId,
    regionHash,
    inputManifestHash,
    baseSurface: manifest.baseSurface,
    projection: frame.manifest.projection,
    projectionManifestHash,
    bbox: frame.manifest.bbox,
    width: frame.width,
    height: frame.height,
    chunkColumns: frame.chunkColumns,
    chunkRows: frame.chunkRows,
    chunkBytes: chunks[0]?.bytes ?? 0,
    terrainClasses: manifest.terrainClasses,
    terrainThresholdsMeters: manifest.terrainThresholdsMeters,
    elevationSampling: manifest.elevationSampling,
    riverRules: manifest.riverRules,
    previewMasks: manifest.previewMasks,
    sources: [manifest.elevationSource, manifest.riverSource],
    report: {
      path: 'build-report.json',
      bytes: reportBytes.byteLength,
      sha256: sha256(reportBytes),
      role: 'build-report',
    },
    chunks,
    overlays,
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

async function loadBaseSurface(manifest, rootDir) {
  const baseManifestPath = path.resolve(rootDir, manifest.baseSurface.manifestPath);
  const baseDirectory = path.resolve(rootDir, manifest.baseSurface.directory);
  const baseManifestBytes = await readFile(baseManifestPath);
  const baseManifest = JSON.parse(baseManifestBytes.toString('utf8'));
  const frame = createEquirectangularTileFrame(baseManifest);
  const contentPath = path.join(baseDirectory, manifest.baseSurface.contentManifest);
  const contentBytes = await readFile(contentPath);
  if (contentBytes.byteLength !== manifest.baseSurface.contentManifestBytes
    || sha256(contentBytes) !== manifest.baseSurface.contentManifestSha256) {
    throw new Error('checked-in base surface content manifest drifted');
  }
  const content = JSON.parse(contentBytes.toString('utf8'));
  if (content.width !== frame.width || content.height !== frame.height
    || content.chunkColumns !== frame.chunkColumns || content.chunkRows !== frame.chunkRows) {
    throw new Error('base surface dimensions do not match its projection manifest');
  }
  const decoded = new Map();
  for (const entry of content.chunks) {
    const bytes = await readFile(path.join(baseDirectory, entry.path));
    if (bytes.byteLength !== entry.bytes || sha256(bytes) !== entry.sha256) {
      throw new Error(`base surface chunk drifted: ${entry.path}`);
    }
    decoded.set(`${entry.cx}/${entry.cy}`, decodeOverworldChunkV1(bytes, {
      expected: {
        schemaVersion: baseManifest.schemaVersion,
        cx: entry.cx,
        cy: entry.cy,
        regionHash: content.regionHash,
        projectionManifestHash: content.projectionManifestHash,
      },
    }));
  }
  const baseSurfaceAt = (x, y) => {
    const cx = Math.floor(x / baseManifest.chunkTiles);
    const cy = Math.floor(y / baseManifest.chunkTiles);
    const chunk = decoded.get(`${cx}/${cy}`);
    if (!chunk) throw new Error(`missing base surface chunk ${cx}/${cy}`);
    return chunk.surfaceAt(x - cx * baseManifest.chunkTiles, y - cy * baseManifest.chunkTiles);
  };
  return Object.freeze({ baseManifest, frame, contentBytes, baseSurfaceAt });
}

async function loadElevationMeanAtTile({ filePath, source, frame, offsets }) {
  const { default: sharp } = await import('sharp');
  const metadata = await sharp(filePath, { failOn: 'none', limitInputPixels: false }).metadata();
  if (metadata.width !== source.width || metadata.height !== source.height
    || metadata.depth !== 'float' || metadata.channels !== 1) {
    throw new Error(`ETOPO raster metadata drifted: ${JSON.stringify(metadata)}`);
  }
  const output = await sharp(filePath, { failOn: 'none', limitInputPixels: false })
    .extract(source.crop)
    .extractChannel(0)
    .raw({ depth: 'float' })
    .toBuffer({ resolveWithObject: true });
  if (output.info.width !== source.crop.width || output.info.height !== source.crop.height
    || output.info.channels !== 1 || output.info.depth !== 'float') {
    throw new Error('ETOPO crop decoder returned unexpected metadata');
  }
  const values = new Float32Array(
    output.data.buffer,
    output.data.byteOffset,
    output.data.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );
  const columns = Array.from({ length: frame.width }, () => new Int32Array(offsets.length));
  const rows = Array.from({ length: frame.height }, () => new Int32Array(offsets.length));
  for (let x = 0; x < frame.width; x += 1) {
    for (let index = 0; index < offsets.length; index += 1) {
      const { lon } = frame.unproject(x + offsets[index], 0);
      const globalColumn = Math.max(0, Math.min(
        source.width - 1,
        roundHalfAwayFromZero((lon - source.originCenterLon) / source.pixelSizeDegrees),
      ));
      columns[x][index] = globalColumn - source.crop.left;
    }
  }
  for (let y = 0; y < frame.height; y += 1) {
    for (let index = 0; index < offsets.length; index += 1) {
      const { lat } = frame.unproject(0, y + offsets[index]);
      const globalRow = Math.max(0, Math.min(
        source.height - 1,
        roundHalfAwayFromZero((source.originCenterLat - lat) / source.pixelSizeDegrees),
      ));
      rows[y][index] = globalRow - source.crop.top;
    }
  }
  for (const row of rows) {
    for (const value of row) {
      if (value < 0 || value >= source.crop.height) throw new RangeError('ETOPO row sample escapes the locked crop');
    }
  }
  for (const column of columns) {
    for (const value of column) {
      if (value < 0 || value >= source.crop.width) throw new RangeError('ETOPO column sample escapes the locked crop');
    }
  }
  return (x, y) => {
    let total = 0;
    for (const row of rows[y]) {
      const offset = row * source.crop.width;
      for (const column of columns[x]) total += values[offset + column];
    }
    return roundHalfAwayFromZero(total / 16);
  };
}

export async function runTerrainBuild({ manifestPath, inputDir, outputDir, check = false, rootDir = process.cwd() }) {
  const manifestBytes = await readFile(manifestPath);
  const manifest = normalizeOverworldTerrainManifest(JSON.parse(manifestBytes.toString('utf8')));
  const elevationPath = path.join(inputDir, manifest.elevationSource.cacheFile);
  const riverPath = path.join(inputDir, manifest.riverSource.cacheFile);
  await verifyFile(elevationPath, manifest.elevationSource, manifest.elevationSource.id);
  await verifyFile(riverPath, manifest.riverSource, manifest.riverSource.id);
  const base = await loadBaseSurface(manifest, rootDir);
  const meanElevationAtTile = await loadElevationMeanAtTile({
    filePath: elevationPath,
    source: manifest.elevationSource,
    frame: base.frame,
    offsets: manifest.elevationSampling.offsets,
  });
  const riverGeojson = JSON.parse((await readFile(riverPath)).toString('utf8'));
  const artifacts = buildTerrainArtifacts({
    manifestBytes,
    manifest,
    baseManifest: base.baseManifest,
    baseContentManifestBytes: base.contentBytes,
    baseSurfaceAt: base.baseSurfaceAt,
    meanElevationAtTile,
    riverGeojson,
  });

  if (check) {
    for (const artifact of artifacts) {
      const current = await readFile(path.join(outputDir, artifact.path));
      if (!current.equals(Buffer.from(artifact.bytes))) {
        throw new Error(`stale terrain artifact: ${artifact.path}`);
      }
    }
    const expected = artifacts.map(({ path: artifactPath }) => artifactPath).sort(compareCodePoint);
    const actual = await listOutputPaths(outputDir);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`terrain artifact file list drifted: ${actual.join(', ')}`);
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
    if (!parsed[key]) throw new Error(`${key} is required`);
  }
  return parsed;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await runTerrainBuild(parseArgs(process.argv.slice(2)));
