import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeOverworldChunkV1 } from '../../src/lib/world/overworldChunk.js';
import { encodeOverworldChunkV1 } from '../../src/lib/world/overworldChunkEncoder.js';
import { createEquirectangularTileFrame } from '../../src/lib/world/overworldGeo.js';
import {
  derivePlayability,
  normalizeOverworldPlayabilityManifest,
} from '../../src/lib/world/overworldPlayability.js';

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function compareCodePoint(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalJson(value) {
  return new TextEncoder().encode(`${JSON.stringify(value)}\n`);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function buildPlayabilityArtifacts({
  manifestBytes,
  manifest: manifestInput,
  baseManifest,
  baseContentManifestBytes,
  surfaces,
}) {
  const manifest = normalizeOverworldPlayabilityManifest(manifestInput);
  if (baseContentManifestBytes.byteLength !== manifest.baseTerrain.contentManifestBytes
    || sha256(baseContentManifestBytes) !== manifest.baseTerrain.contentManifestSha256) {
    throw new Error('base terrain content manifest does not match the playability contract');
  }
  const frame = createEquirectangularTileFrame(baseManifest);
  if (!(surfaces instanceof Uint8Array) || surfaces.length !== frame.width * frame.height) {
    throw new TypeError('base terrain surfaces do not match the projection frame');
  }
  const playability = derivePlayability({ frame, surfaces, manifest });
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
      const globalIndex = (x, y) => (originY + y) * frame.width + originX + x;
      const bytes = encodeOverworldChunkV1({
        schemaVersion: manifest.schemaVersion,
        cx,
        cy,
        validBounds,
        regionHash,
        projectionManifestHash,
        seaSurface: manifest.terrainClasses.sea,
        surfaceAt: (x, y) => surfaces[globalIndex(x, y)],
        collisionAt: (x, y) => playability.collisionAtIndex(globalIndex(x, y)),
        viewOnlyAt: (x, y) => playability.viewOnlyAtIndex(globalIndex(x, y)),
      });
      const artifactPath = `${cx}/${cy}.owc`;
      const entry = Object.freeze({
        path: artifactPath,
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
        role: 'playability-preview',
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
    ...playability.counts,
    componentRules: manifest.componentRules,
    resolvedAnchors: playability.resolvedAnchors,
    components: playability.components,
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
    baseTerrain: manifest.baseTerrain,
    projection: frame.manifest.projection,
    projectionManifestHash,
    bbox: frame.manifest.bbox,
    width: frame.width,
    height: frame.height,
    chunkColumns: frame.chunkColumns,
    chunkRows: frame.chunkRows,
    chunkBytes: chunks[0]?.bytes ?? 0,
    terrainClasses: manifest.terrainClasses,
    componentRules: manifest.componentRules,
    policyAnchors: manifest.policyAnchors,
    derivedMasks: Object.freeze({
      sea: Object.freeze({ collision: 'blocked', viewOnly: false }),
      walkableLand: Object.freeze({ collision: 'open', viewOnly: false }),
      viewOnlyLand: Object.freeze({ collision: 'blocked', viewOnly: true }),
      padding: Object.freeze({ collision: 'blocked', viewOnly: true }),
    }),
    report: Object.freeze({
      path: 'build-report.json',
      bytes: reportBytes.byteLength,
      sha256: sha256(reportBytes),
      role: 'build-report',
    }),
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

async function loadBaseTerrain(manifest, rootDir) {
  const baseManifest = JSON.parse((await readFile(path.resolve(
    rootDir,
    manifest.baseTerrain.manifestPath,
  ))).toString('utf8'));
  const frame = createEquirectangularTileFrame(baseManifest);
  const baseDirectory = path.resolve(rootDir, manifest.baseTerrain.directory);
  const contentPath = path.join(baseDirectory, manifest.baseTerrain.contentManifest);
  const contentBytes = await readFile(contentPath);
  if (contentBytes.byteLength !== manifest.baseTerrain.contentManifestBytes
    || sha256(contentBytes) !== manifest.baseTerrain.contentManifestSha256) {
    throw new Error('checked-in base terrain content manifest drifted');
  }
  const content = JSON.parse(contentBytes.toString('utf8'));
  if (baseManifest.releaseEligible !== manifest.releaseEligible
    || content.releaseEligible !== manifest.releaseEligible) {
    throw new Error('playability release eligibility must match its base terrain chain');
  }
  if (content.width !== frame.width || content.height !== frame.height
    || content.chunkColumns !== frame.chunkColumns || content.chunkRows !== frame.chunkRows
    || !sameJson(content.terrainClasses, manifest.terrainClasses)) {
    throw new Error('base terrain dimensions or classes do not match the playability manifest');
  }
  if (content.previewMasks?.collision !== 'all-blocked'
    || content.previewMasks?.viewOnly !== 'all-view-only') {
    throw new Error('base terrain must be the fail-closed terrain preview');
  }
  const surfaces = new Uint8Array(frame.width * frame.height);
  for (const entry of content.chunks) {
    const bytes = await readFile(path.join(baseDirectory, entry.path));
    if (bytes.byteLength !== entry.bytes || sha256(bytes) !== entry.sha256) {
      throw new Error(`base terrain chunk drifted: ${entry.path}`);
    }
    const chunk = decodeOverworldChunkV1(bytes, {
      expected: {
        schemaVersion: content.schemaVersion,
        cx: entry.cx,
        cy: entry.cy,
        regionHash: content.regionHash,
        projectionManifestHash: content.projectionManifestHash,
      },
    });
    const originX = entry.cx * baseManifest.chunkTiles;
    const originY = entry.cy * baseManifest.chunkTiles;
    for (let y = entry.validBounds.y0; y < entry.validBounds.y1; y += 1) {
      for (let x = entry.validBounds.x0; x < entry.validBounds.x1; x += 1) {
        if (chunk.collisionAt(x, y) !== 1 || chunk.viewOnlyAt(x, y) !== 1) {
          throw new Error(`base terrain masks are not fail-closed: ${entry.path}@${x},${y}`);
        }
        surfaces[(originY + y) * frame.width + originX + x] = chunk.surfaceAt(x, y);
      }
    }
  }
  return Object.freeze({ baseManifest, contentBytes, surfaces });
}

export async function runPlayabilityBuild({ manifestPath, outputDir, check = false, rootDir = process.cwd() }) {
  const manifestBytes = await readFile(manifestPath);
  const manifest = normalizeOverworldPlayabilityManifest(JSON.parse(manifestBytes.toString('utf8')));
  const base = await loadBaseTerrain(manifest, rootDir);
  const artifacts = buildPlayabilityArtifacts({
    manifestBytes,
    manifest,
    baseManifest: base.baseManifest,
    baseContentManifestBytes: base.contentBytes,
    surfaces: base.surfaces,
  });

  if (check) {
    for (const artifact of artifacts) {
      const current = await readFile(path.join(outputDir, artifact.path));
      if (!current.equals(Buffer.from(artifact.bytes))) {
        throw new Error(`stale playability artifact: ${artifact.path}`);
      }
    }
    const expected = artifacts.map(({ path: artifactPath }) => artifactPath).sort(compareCodePoint);
    const actual = await listOutputPaths(outputDir);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`playability artifact file list drifted: ${actual.join(', ')}`);
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
    else if (value === '--output-dir') parsed.outputDir = argv[++index];
    else throw new Error(`unknown argument: ${value}`);
  }
  for (const key of ['manifestPath', 'outputDir']) {
    if (!parsed[key]) throw new Error(`${key} is required`);
  }
  return parsed;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await runPlayabilityBuild(parseArgs(process.argv.slice(2)));
