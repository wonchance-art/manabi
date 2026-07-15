import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GEO,
  MAP_H,
  MAP_W,
  TERRAIN,
  decodeMap,
  isBlocked,
} from '../../src/components/world/mapData.js';
import { buildPlayableGrid } from '../../src/lib/world/mapGeo.js';
import {
  OVERWORLD_CHUNK_FILE_BYTES,
  OVERWORLD_CHUNK_FORMAT_VERSION,
  OVERWORLD_STORAGE_CHUNK_TILES,
} from '../../src/lib/world/overworldChunk.js';
import { encodeOverworldChunkV1 } from '../../src/lib/world/overworldChunkEncoder.js';
import {
  OVERWORLD_FIXTURE_MANIFEST,
  OVERWORLD_FIXTURE_PROJECTION,
} from '../../src/lib/world/overworldFixture.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUTPUT_ROOT = path.join(
  ROOT,
  'public',
  'assets',
  'overworld',
  OVERWORLD_FIXTURE_MANIFEST.regionId,
);

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function assertFixtureContract() {
  const projection = OVERWORLD_FIXTURE_PROJECTION;
  if (sha256(OVERWORLD_FIXTURE_MANIFEST.regionId) !== OVERWORLD_FIXTURE_MANIFEST.regionHash) {
    throw new Error('overworld fixture regionHash does not match the canonical region id');
  }
  if (sha256(JSON.stringify(projection)) !== OVERWORLD_FIXTURE_MANIFEST.projectionManifestHash) {
    throw new Error('overworld fixture projectionManifestHash does not match the canonical projection');
  }
  for (const [actual, expected, label] of [
    [GEO.LON0, projection.lon0, 'lon0'],
    [GEO.LAT0, projection.lat0, 'lat0'],
    [GEO.KX, projection.kx, 'kx'],
    [GEO.KY, projection.ky, 'ky'],
  ]) {
    if (actual !== expected) throw new Error(`overworld fixture projection ${label} drifted: ${actual} !== ${expected}`);
  }
}

export function buildOverworldFixtureArtifacts() {
  assertFixtureContract();
  const grid = buildPlayableGrid(decodeMap());
  const chunks = [];
  const artifacts = [];
  const chunkColumns = Math.ceil(MAP_W / OVERWORLD_STORAGE_CHUNK_TILES);
  const chunkRows = Math.ceil(MAP_H / OVERWORLD_STORAGE_CHUNK_TILES);

  for (let cx = 0; cx < chunkColumns; cx += 1) {
    for (let cy = 0; cy < chunkRows; cy += 1) {
      const originX = cx * OVERWORLD_STORAGE_CHUNK_TILES;
      const originY = cy * OVERWORLD_STORAGE_CHUNK_TILES;
      const validBounds = Object.freeze({
        x0: 0,
        y0: 0,
        x1: Math.min(OVERWORLD_STORAGE_CHUNK_TILES, MAP_W - originX),
        y1: Math.min(OVERWORLD_STORAGE_CHUNK_TILES, MAP_H - originY),
      });
      const surfaceAt = (x, y) => grid[(originY + y) * MAP_W + originX + x];
      const bytes = encodeOverworldChunkV1({
        ...OVERWORLD_FIXTURE_MANIFEST,
        cx,
        cy,
        validBounds,
        seaSurface: TERRAIN.SEA,
        surfaceAt,
        collisionAt: (x, y) => isBlocked(surfaceAt(x, y)),
      });
      const relativePath = `${cx}/${cy}.owc`;
      chunks.push({
        path: relativePath,
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
        role: 'terrain',
        cx,
        cy,
        validBounds,
      });
      artifacts.push({ path: relativePath, bytes });
    }
  }

  const manifest = {
    formatVersion: OVERWORLD_CHUNK_FORMAT_VERSION,
    schemaVersion: OVERWORLD_FIXTURE_MANIFEST.schemaVersion,
    regionId: OVERWORLD_FIXTURE_MANIFEST.regionId,
    regionHash: OVERWORLD_FIXTURE_MANIFEST.regionHash,
    projection: OVERWORLD_FIXTURE_PROJECTION,
    projectionManifestHash: OVERWORLD_FIXTURE_MANIFEST.projectionManifestHash,
    width: MAP_W,
    height: MAP_H,
    seaSurface: TERRAIN.SEA,
    chunkBytes: OVERWORLD_CHUNK_FILE_BYTES,
    chunks,
  };
  artifacts.push({
    path: 'content-manifest.json',
    bytes: new TextEncoder().encode(`${JSON.stringify(manifest)}\n`),
  });
  return Object.freeze(artifacts);
}

async function compareArtifact(artifact) {
  const destination = path.join(OUTPUT_ROOT, artifact.path);
  let current;
  try {
    current = await readFile(destination);
  } catch {
    throw new Error(`missing overworld fixture artifact: ${artifact.path}`);
  }
  if (!current.equals(Buffer.from(artifact.bytes))) {
    throw new Error(`stale overworld fixture artifact: ${artifact.path}`);
  }
}

async function listOutputPaths(directory = OUTPUT_ROOT, prefix = '') {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const paths = [];
  for (const entry of entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      paths.push(...await listOutputPaths(path.join(directory, entry.name), relativePath));
    } else {
      paths.push(relativePath);
    }
  }
  return paths;
}

async function writeArtifact(artifact) {
  const destination = path.join(OUTPUT_ROOT, artifact.path);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, artifact.bytes);
}

export async function runOverworldFixtureBuild({ check = false } = {}) {
  const artifacts = buildOverworldFixtureArtifacts();
  if (check) {
    await Promise.all(artifacts.map(compareArtifact));
    const expectedPaths = artifacts.map(({ path: artifactPath }) => artifactPath).sort();
    const actualPaths = await listOutputPaths();
    if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
      throw new Error(`overworld fixture file list drifted: ${actualPaths.join(', ')}`);
    }
    return artifacts;
  }
  await Promise.all(artifacts.map(writeArtifact));
  return artifacts;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const check = process.argv.slice(2).includes('--check');
  await runOverworldFixtureBuild({ check });
}
