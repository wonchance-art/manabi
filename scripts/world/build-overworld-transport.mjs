import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEquirectangularTileFrame } from '../../src/lib/world/overworldGeo.js';
import {
  normalizeOverworldTransportManifest,
  projectAndSimplifyRailLine,
} from '../../src/lib/world/overworldTransport.js';

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

function segmentIntersects(bounds, region) {
  return bounds.x1 >= region.x0 && bounds.x0 <= region.x1
    && bounds.y1 >= region.y0 && bounds.y0 <= region.y1;
}

function optionalInteger(value) {
  return Number.isSafeInteger(value) ? value : null;
}

export function buildRailOverlayArtifacts({ frame, geojson, rules }) {
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new TypeError('rail input must be a GeoJSON FeatureCollection');
  }
  const chunkQ = frame.manifest.chunkTiles * rules.quantization;
  const haloQ = rules.haloTiles * rules.quantization;
  const regionQ = Object.freeze({
    x0: 0,
    y0: 0,
    x1: frame.width * rules.quantization,
    y1: frame.height * rules.quantization,
  });
  const chunks = new Map();
  let featureCount = 0;
  let sourcePointCount = 0;
  let simplifiedPointCount = 0;
  let segmentCount = 0;

  geojson.features.forEach((feature, sourceFeatureIndex) => {
    const scaleRank = feature?.properties?.scalerank;
    if (!Number.isSafeInteger(scaleRank) || scaleRank < 0 || scaleRank > rules.maxScaleRank) return;
    if (feature?.geometry?.type !== 'LineString' || !Array.isArray(feature.geometry.coordinates)) {
      throw new Error(`unsupported rail geometry at feature ${sourceFeatureIndex}`);
    }
    const coordinates = feature.geometry.coordinates;
    if (coordinates.length < 2) return;
    const points = projectAndSimplifyRailLine({ coordinates, frame, rules });
    if (points.length < 2) return;
    const routeId = `ne-rail-${String(sourceFeatureIndex).padStart(5, '0')}`;
    let routeKept = false;
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const bounds = Object.freeze({
        x0: Math.min(start[0], end[0]),
        y0: Math.min(start[1], end[1]),
        x1: Math.max(start[0], end[0]),
        y1: Math.max(start[1], end[1]),
      });
      if (!segmentIntersects(bounds, regionQ)) continue;
      const segment = Object.freeze({
        id: `${routeId}-${String(index).padStart(5, '0')}`,
        routeId,
        sourceFeatureIndex,
        segmentIndex: index,
        scaleRank,
        category: optionalInteger(feature.properties.category),
        electric: optionalInteger(feature.properties.electric),
        multiTrack: optionalInteger(feature.properties.mult_track),
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
      routeKept = true;
      segmentCount += 1;
    }
    if (routeKept) {
      featureCount += 1;
      sourcePointCount += coordinates.length;
      simplifiedPointCount += points.length;
    }
  });

  const artifacts = [];
  for (const key of [...chunks.keys()].sort(compareCodePoint)) {
    const [cx, cy] = key.split('/').map(Number);
    const segments = chunks.get(key).sort((left, right) => compareCodePoint(left.id, right.id));
    artifacts.push(Object.freeze({
      path: `rail/${key}.json`,
      bytes: canonicalJson(Object.freeze({
        formatVersion: 1,
        kind: 'rail-segments',
        quantization: rules.quantization,
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
    sourcePointCount,
    simplifiedPointCount,
    segmentCount,
  });
}

export function buildTransportArtifacts({ manifestBytes, manifest: manifestInput, baseRegionManifest, railGeojson }) {
  const manifest = normalizeOverworldTransportManifest(manifestInput);
  const frame = createEquirectangularTileFrame(baseRegionManifest);
  const rail = buildRailOverlayArtifacts({ frame, geojson: railGeojson, rules: manifest.railRules });
  const overlays = rail.artifacts.map((artifact) => Object.freeze({
    path: artifact.path,
    bytes: artifact.bytes.byteLength,
    sha256: sha256(artifact.bytes),
    role: 'rail-overlay',
  }));
  const report = Object.freeze({
    releaseEligible: manifest.releaseEligible,
    railFeatureCount: rail.featureCount,
    railSourcePointCount: rail.sourcePointCount,
    railSimplifiedPointCount: rail.simplifiedPointCount,
    railSegmentCount: rail.segmentCount,
    railOverlayFileCount: overlays.length,
  });
  const reportBytes = canonicalJson(report);
  const contentManifest = Object.freeze({
    formatVersion: 1,
    schemaVersion: manifest.schemaVersion,
    releaseEligible: manifest.releaseEligible,
    regionId: manifest.regionId,
    regionHash: sha256(manifest.regionId),
    inputManifestHash: sha256(manifestBytes),
    baseTerrain: manifest.baseTerrain,
    projection: frame.manifest.projection,
    projectionManifestHash: sha256(canonicalJson(frame.manifest.projection)),
    bbox: frame.manifest.bbox,
    width: frame.width,
    height: frame.height,
    chunkColumns: frame.chunkColumns,
    chunkRows: frame.chunkRows,
    railRules: manifest.railRules,
    sources: [manifest.railSource],
    report: {
      path: 'build-report.json',
      bytes: reportBytes.byteLength,
      sha256: sha256(reportBytes),
      role: 'build-report',
    },
    overlays,
  });
  return Object.freeze([
    ...rail.artifacts,
    { path: 'build-report.json', bytes: reportBytes },
    { path: 'content-manifest.json', bytes: canonicalJson(contentManifest) },
  ].sort((left, right) => compareCodePoint(left.path, right.path)));
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

export async function runTransportBuild({ manifestPath, inputDir, outputDir, check = false, rootDir = process.cwd() }) {
  const manifestBytes = await readFile(manifestPath);
  const manifest = normalizeOverworldTransportManifest(JSON.parse(manifestBytes.toString('utf8')));
  const sourcePath = path.join(inputDir, manifest.railSource.cacheFile);
  await verifyFile(sourcePath, manifest.railSource, manifest.railSource.id);

  const baseManifest = JSON.parse(await readFile(path.resolve(rootDir, manifest.baseTerrain.manifestPath), 'utf8'));
  const baseContentPath = path.resolve(
    rootDir,
    manifest.baseTerrain.directory,
    manifest.baseTerrain.contentManifest,
  );
  await verifyFile(baseContentPath, {
    bytes: manifest.baseTerrain.contentManifestBytes,
    sha256: manifest.baseTerrain.contentManifestSha256,
  }, 'base terrain content manifest');
  const baseContent = JSON.parse(await readFile(baseContentPath, 'utf8'));
  if (baseManifest.releaseEligible !== manifest.releaseEligible
    || baseContent.releaseEligible !== manifest.releaseEligible) {
    throw new Error('transport release eligibility must match its base terrain chain');
  }
  const frame = createEquirectangularTileFrame(baseManifest);
  if (baseContent.width !== frame.width || baseContent.height !== frame.height
    || baseContent.chunkColumns !== frame.chunkColumns || baseContent.chunkRows !== frame.chunkRows) {
    throw new Error('base terrain dimensions do not match the projection manifest');
  }

  const artifacts = buildTransportArtifacts({
    manifestBytes,
    manifest,
    baseRegionManifest: baseManifest,
    railGeojson: JSON.parse(await readFile(sourcePath, 'utf8')),
  });
  if (check) {
    for (const artifact of artifacts) {
      const current = await readFile(path.join(outputDir, artifact.path));
      if (!current.equals(Buffer.from(artifact.bytes))) throw new Error(`stale transport artifact: ${artifact.path}`);
    }
    const expected = artifacts.map(({ path: artifactPath }) => artifactPath).sort(compareCodePoint);
    const actual = await listOutputPaths(outputDir);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`transport artifact file list drifted: ${actual.join(', ')}`);
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runTransportBuild(parseArgs(process.argv.slice(2)));
}
