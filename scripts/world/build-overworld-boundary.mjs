import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyBoundaryFeature,
  normalizeOverworldBoundaryManifest,
} from '../../src/lib/world/overworldBoundary.js';
import { createEquirectangularTileFrame } from '../../src/lib/world/overworldGeo.js';
import {
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

function geometryLines(geometry, sourceKind, sourceFeatureIndex) {
  if (geometry?.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    return [geometry.coordinates];
  }
  if (geometry?.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates;
  }
  throw new Error(`unsupported ${sourceKind} boundary geometry at feature ${sourceFeatureIndex}`);
}

function segmentIntersects(bounds, region) {
  return bounds.x1 >= region.x0 && bounds.x0 <= region.x1
    && bounds.y1 >= region.y0 && bounds.y0 <= region.y1;
}

export function buildBoundaryOverlayArtifacts({ frame, sources, rules, policy }) {
  const chunkQ = frame.manifest.chunkTiles * rules.quantization;
  const haloQ = rules.haloTiles * rules.quantization;
  const regionQ = Object.freeze({
    x0: 0,
    y0: 0,
    x1: frame.width * rules.quantization,
    y1: frame.height * rules.quantization,
  });
  const chunks = new Map();
  const featureCounts = { 'de-facto': 0, 'neutral-disputed': 0 };
  const segmentCounts = { 'de-facto': 0, 'neutral-disputed': 0 };

  for (const { sourceKind, geojson } of sources) {
    if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
      throw new TypeError(`${sourceKind} boundary input must be a GeoJSON FeatureCollection`);
    }
    geojson.features.forEach((feature, sourceFeatureIndex) => {
      const featureClass = feature?.properties?.FEATURECLA;
      const boundaryClass = classifyBoundaryFeature(sourceKind, featureClass, policy);
      const scaleRank = Number.isSafeInteger(feature?.properties?.SCALERANK)
        ? feature.properties.SCALERANK
        : rules.defaultScaleRank;
      if (scaleRank < 0) throw new RangeError(`negative boundary scale rank at feature ${sourceFeatureIndex}`);
      let featureKept = false;
      geometryLines(feature.geometry, sourceKind, sourceFeatureIndex).forEach((line, partIndex) => {
        if (!Array.isArray(line) || line.length < 2) return;
        const routeId = `ne-boundary-${sourceKind}-${String(sourceFeatureIndex).padStart(4, '0')}-${String(partIndex).padStart(3, '0')}`;
        const pointsQ = unwrapLineLongitudes(line, frame.manifest.projection.lon0).map(([lon, lat]) => {
          const projected = frame.projectUnwrapped(lon, lat);
          return Object.freeze([
            quantizeTerrainOverlay(projected.x, rules.quantization),
            quantizeTerrainOverlay(projected.y, rules.quantization),
          ]);
        });
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
            sourceKind,
            sourceFeatureIndex,
            partIndex,
            segmentIndex,
            scaleRank,
            boundaryClass,
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
          segmentCounts[boundaryClass] += 1;
          featureKept = true;
        }
      });
      if (featureKept) featureCounts[boundaryClass] += 1;
    });
  }

  const artifacts = [];
  for (const key of [...chunks.keys()].sort(compareCodePoint)) {
    const [cx, cy] = key.split('/').map(Number);
    const segments = chunks.get(key).sort((left, right) => compareCodePoint(left.id, right.id));
    artifacts.push(Object.freeze({
      path: `boundaries/${key}.json`,
      bytes: canonicalJson(Object.freeze({
        formatVersion: 1,
        kind: 'boundary-segments',
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
    featureCounts: Object.freeze(featureCounts),
    segmentCounts: Object.freeze(segmentCounts),
  });
}

export function buildBoundaryArtifacts({
  manifestBytes,
  manifest: manifestInput,
  baseRegionManifest,
  sourceGeojson,
}) {
  const manifest = normalizeOverworldBoundaryManifest(manifestInput);
  const frame = createEquirectangularTileFrame(baseRegionManifest);
  const boundaries = buildBoundaryOverlayArtifacts({
    frame,
    sources: manifest.boundarySources.map(({ sourceKind }) => ({
      sourceKind,
      geojson: sourceGeojson[sourceKind],
    })),
    rules: manifest.boundaryRules,
    policy: manifest.policy,
  });
  const overlays = boundaries.artifacts.map((artifact) => Object.freeze({
    path: artifact.path,
    bytes: artifact.bytes.byteLength,
    sha256: sha256(artifact.bytes),
    role: 'boundary-overlay',
  }));
  const report = Object.freeze({
    releaseEligible: false,
    policyId: manifest.policy.id,
    boundaryFeatureCounts: boundaries.featureCounts,
    boundarySegmentCounts: boundaries.segmentCounts,
    boundaryOverlayFileCount: overlays.length,
    sourcePropertiesEmitted: false,
    countryFill: false,
  });
  const reportBytes = canonicalJson(report);
  const contentManifest = Object.freeze({
    formatVersion: 1,
    schemaVersion: manifest.schemaVersion,
    releaseEligible: false,
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
    boundaryRules: manifest.boundaryRules,
    policy: manifest.policy,
    sources: manifest.boundarySources,
    report: {
      path: 'build-report.json',
      bytes: reportBytes.byteLength,
      sha256: sha256(reportBytes),
      role: 'build-report',
    },
    overlays,
  });
  return Object.freeze([
    ...boundaries.artifacts,
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

export async function runBoundaryBuild({ manifestPath, inputDir, outputDir, check = false, rootDir = process.cwd() }) {
  const manifestBytes = await readFile(manifestPath);
  const manifest = normalizeOverworldBoundaryManifest(JSON.parse(manifestBytes.toString('utf8')));
  const sourceGeojson = {};
  for (const source of manifest.boundarySources) {
    const sourcePath = path.join(inputDir, source.cacheFile);
    await verifyFile(sourcePath, source, source.id);
    sourceGeojson[source.sourceKind] = JSON.parse(await readFile(sourcePath, 'utf8'));
  }

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
  const frame = createEquirectangularTileFrame(baseManifest);
  if (baseContent.width !== frame.width || baseContent.height !== frame.height
    || baseContent.chunkColumns !== frame.chunkColumns || baseContent.chunkRows !== frame.chunkRows) {
    throw new Error('base terrain dimensions do not match the projection manifest');
  }

  const artifacts = buildBoundaryArtifacts({
    manifestBytes,
    manifest,
    baseRegionManifest: baseManifest,
    sourceGeojson,
  });
  if (check) {
    for (const artifact of artifacts) {
      const current = await readFile(path.join(outputDir, artifact.path));
      if (!current.equals(Buffer.from(artifact.bytes))) throw new Error(`stale boundary artifact: ${artifact.path}`);
    }
    const expected = artifacts.map(({ path: artifactPath }) => artifactPath).sort(compareCodePoint);
    const actual = await listOutputPaths(outputDir);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`boundary artifact file list drifted: ${actual.join(', ')}`);
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
  await runBoundaryBuild(parseArgs(process.argv.slice(2)));
}
