import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeOverworldChunkV1 } from '../../src/lib/world/overworldChunk.js';
import { createEquirectangularTileFrame, roundHalfAwayFromZero } from '../../src/lib/world/overworldGeo.js';
import {
  normalizeOverworldTransportNodeDocument,
  normalizeOverworldTransportNodeManifest,
} from '../../src/lib/world/overworldTransportNodes.js';

const compareCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const canonicalJson = (value) => new TextEncoder().encode(`${JSON.stringify(value)}\n`);
const sha256 = (input) => createHash('sha256').update(input).digest('hex');

async function verifyFile(filePath, expected, label) {
  const metadata = await stat(filePath);
  if (metadata.size !== expected.bytes) {
    throw new Error(`${label} byte length mismatch: ${metadata.size} !== ${expected.bytes}`);
  }
  const bytes = await readFile(filePath);
  if (sha256(bytes) !== expected.sha256) throw new Error(`${label} SHA-256 mismatch`);
  return bytes;
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

function projectedNodes(manifest, frame) {
  return manifest.nodes.map((node) => {
    const projected = frame.project(node.lon, node.lat);
    const tile = [roundHalfAwayFromZero(projected.x), roundHalfAwayFromZero(projected.y)];
    if (tile[0] < 0 || tile[1] < 0 || tile[0] >= frame.width || tile[1] >= frame.height) {
      throw new Error(`transport node projects outside region: ${node.id}`);
    }
    return Object.freeze({
      id: node.id,
      type: node.type,
      label: node.label,
      contentLocale: node.contentLocale,
      ...(node.type === 'transsib-gate'
        ? { corridorStopId: node.corridorStopId }
        : { airportCode: node.airportCode }),
      tile: Object.freeze(tile),
    });
  }).sort((left, right) => compareCodePoint(left.id, right.id));
}

export function buildTransportNodeArtifacts({
  manifestBytes,
  manifest: manifestInput,
  baseRegionManifest,
  baseContent,
  checkedInChunks,
}) {
  const manifest = normalizeOverworldTransportNodeManifest(manifestInput);
  const frame = createEquirectangularTileFrame(baseRegionManifest);
  if (baseContent.width !== frame.width || baseContent.height !== frame.height
    || baseContent.chunkColumns !== frame.chunkColumns || baseContent.chunkRows !== frame.chunkRows
    || baseContent.projectionManifestHash !== sha256(canonicalJson(frame.manifest.projection))) {
    throw new Error('base playability content does not match the projection frame');
  }
  const nodes = projectedNodes(manifest, frame);
  const buckets = new Map();
  for (const node of nodes) {
    const [x, y] = node.tile;
    const cx = Math.floor(x / frame.manifest.chunkTiles);
    const cy = Math.floor(y / frame.manifest.chunkTiles);
    const chunk = checkedInChunks.get(`${cx}/${cy}`);
    if (!chunk?.isWalkableAt(x % frame.manifest.chunkTiles, y % frame.manifest.chunkTiles)) {
      throw new Error(`transport node is not on a checked-in walkable tile: ${node.id}`);
    }
    const key = `${cx}/${cy}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(node);
    else buckets.set(key, [node]);
  }

  const artifacts = [];
  const nodeEntries = [];
  for (const key of [...buckets.keys()].sort(compareCodePoint)) {
    const [cx, cy] = key.split('/').map(Number);
    const document = normalizeOverworldTransportNodeDocument({
      formatVersion: 2,
      kind: 'transport-nodes',
      cx,
      cy,
      nodes: buckets.get(key).sort((left, right) => compareCodePoint(left.id, right.id)),
    }, { cx, cy, width: frame.width, height: frame.height });
    const bytes = canonicalJson(document);
    const artifactPath = `nodes/${key}.json`;
    artifacts.push(Object.freeze({ path: artifactPath, bytes }));
    nodeEntries.push(Object.freeze({
      path: artifactPath,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
      role: 'transport-node-index',
      cx,
      cy,
      count: document.nodes.length,
    }));
  }

  const report = Object.freeze({
    releaseEligible: false,
    nodeCount: nodes.length,
    chunkCount: nodeEntries.length,
    nodeTypes: Object.freeze([...new Set(nodes.map(({ type }) => type))].sort(compareCodePoint)),
  });
  const reportBytes = canonicalJson(report);
  const contentManifest = Object.freeze({
    formatVersion: 1,
    schemaVersion: manifest.schemaVersion,
    releaseEligible: false,
    regionId: manifest.regionId,
    regionHash: sha256(manifest.regionId),
    inputManifestHash: sha256(manifestBytes),
    baseRegion: manifest.baseRegion,
    projection: frame.manifest.projection,
    projectionManifestHash: sha256(canonicalJson(frame.manifest.projection)),
    bbox: frame.manifest.bbox,
    width: frame.width,
    height: frame.height,
    chunkColumns: frame.chunkColumns,
    chunkRows: frame.chunkRows,
    nodeRules: manifest.nodeRules,
    report: Object.freeze({
      path: 'build-report.json',
      bytes: reportBytes.byteLength,
      sha256: sha256(reportBytes),
      role: 'build-report',
    }),
    nodes: Object.freeze(nodeEntries),
  });
  return Object.freeze([
    ...artifacts,
    { path: 'build-report.json', bytes: reportBytes },
    { path: 'content-manifest.json', bytes: canonicalJson(contentManifest) },
  ].sort((left, right) => compareCodePoint(left.path, right.path)));
}

async function loadBase(manifest, rootDir) {
  const baseManifest = JSON.parse(await readFile(path.resolve(rootDir, manifest.baseRegion.manifestPath), 'utf8'));
  const contentPath = path.resolve(
    rootDir,
    manifest.baseRegion.directory,
    manifest.baseRegion.contentManifest,
  );
  const contentBytes = await verifyFile(contentPath, {
    bytes: manifest.baseRegion.contentManifestBytes,
    sha256: manifest.baseRegion.contentManifestSha256,
  }, 'base playability content manifest');
  const content = JSON.parse(contentBytes.toString('utf8'));
  const chunks = new Map();
  for (const entry of content.chunks || []) {
    const bytes = await verifyFile(path.resolve(
      rootDir,
      manifest.baseRegion.directory,
      entry.path,
    ), entry, `base playability chunk ${entry.path}`);
    const chunk = decodeOverworldChunkV1(bytes, {
      expected: {
        schemaVersion: content.schemaVersion,
        cx: entry.cx,
        cy: entry.cy,
        regionHash: content.regionHash,
        projectionManifestHash: content.projectionManifestHash,
      },
    });
    chunks.set(`${entry.cx}/${entry.cy}`, chunk);
  }
  return Object.freeze({ baseManifest, content, chunks });
}

export async function runTransportNodeBuild({ manifestPath, outputDir, check = false, rootDir = process.cwd() }) {
  const manifestBytes = await readFile(manifestPath);
  const manifest = normalizeOverworldTransportNodeManifest(JSON.parse(manifestBytes.toString('utf8')));
  const base = await loadBase(manifest, rootDir);
  const artifacts = buildTransportNodeArtifacts({
    manifestBytes,
    manifest,
    baseRegionManifest: base.baseManifest,
    baseContent: base.content,
    checkedInChunks: base.chunks,
  });
  if (check) {
    for (const artifact of artifacts) {
      const current = await readFile(path.join(outputDir, artifact.path));
      if (!current.equals(Buffer.from(artifact.bytes))) {
        throw new Error(`stale transport node artifact: ${artifact.path}`);
      }
    }
    const expected = artifacts.map(({ path: artifactPath }) => artifactPath).sort(compareCodePoint);
    const actual = await listOutputPaths(outputDir);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`transport node artifact file list drifted: ${actual.join(', ')}`);
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runTransportNodeBuild(parseArgs(process.argv.slice(2)));
}
