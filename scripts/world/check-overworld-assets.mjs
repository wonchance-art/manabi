import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OVERWORLD_REGION_LIST } from '../../src/lib/world/overworldRegions.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '../..');
const ASSET_ROOT = path.join(ROOT, 'public/assets/overworld');
const SHA256_HEX = /^[0-9a-f]{64}$/;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
  );
}

const canonicalJson = (value) => JSON.stringify(canonicalValue(value));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safePath(root, relative, label) {
  assert(typeof relative === 'string' && relative.length > 0, `${label} must be a path`);
  assert(!path.isAbsolute(relative), `${label} must be relative`);
  const resolved = path.resolve(root, relative);
  assert(resolved.startsWith(`${root}${path.sep}`), `${label} escapes its asset directory`);
  return resolved;
}

async function checkedFile(filePath, expected, label) {
  assert(Number.isSafeInteger(expected.bytes) && expected.bytes >= 0, `${label}.bytes is invalid`);
  assert(SHA256_HEX.test(expected.sha256), `${label}.sha256 is invalid`);
  const info = await stat(filePath);
  assert(info.isFile(), `${label} is not a file`);
  assert(info.size === expected.bytes, `${label} bytes mismatch: ${info.size} !== ${expected.bytes}`);
  const bytes = await readFile(filePath);
  assert(sha256(bytes) === expected.sha256, `${label} sha256 mismatch`);
  return bytes;
}

function artifactEntries(manifest) {
  return [
    ...(manifest.report ? [manifest.report] : []),
    ...(Array.isArray(manifest.chunks) ? manifest.chunks : []),
    ...(Array.isArray(manifest.overlays) ? manifest.overlays : []),
    ...(Array.isArray(manifest.nodes) ? manifest.nodes : []),
  ];
}

function dependencyEntries(manifest) {
  return ['baseSurface', 'baseTerrain', 'baseRegion']
    .map((key) => [key, manifest[key]])
    .filter(([, value]) => value);
}

function assertManifestFrame(manifest, region, expected, label) {
  assert(manifest.regionId === expected.regionId, `${label}.regionId drifted`);
  assert(manifest.regionHash === expected.regionHash, `${label}.regionHash drifted`);
  assert(manifest.projectionManifestHash === expected.projectionManifestHash,
    `${label}.projectionManifestHash drifted`);
  assert(manifest.width === region.width && manifest.height === region.height,
    `${label} dimensions drifted`);
  assert(canonicalJson(manifest.projection) === canonicalJson(region.projection),
    `${label}.projection drifted from the runtime registry`);
  assert(manifest.projectionManifestHash === sha256(`${JSON.stringify(manifest.projection)}\n`),
    `${label}.projectionManifestHash does not match its projection`);
  assert(manifest.releaseEligible === false, `${label} generated assets must remain releaseEligible=false`);
}

async function verifyPreviewPng(region) {
  const label = `${region.id} map preview`;
  const bytes = await readFile(path.join(ASSET_ROOT, 'map-previews', `${region.id}.png`));
  assert(bytes.length >= 24, `${label} is truncated`);
  assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    `${label} is not a PNG`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert(width === 1200, `${label} width must be 1200`);
  assert(height === Math.round((region.height / region.width) * width),
    `${label} aspect ratio drifted`);
}

async function auditManifest(region, directory, expected, visited, counters) {
  const absoluteDirectory = path.resolve(ROOT, directory);
  assert(absoluteDirectory.startsWith(`${ASSET_ROOT}${path.sep}`),
    `${region.id} manifest directory must stay inside public/assets/overworld`);
  const visitKey = `${region.id}:${absoluteDirectory}`;
  if (visited.has(visitKey)) return;
  visited.add(visitKey);

  const manifestPath = path.join(absoluteDirectory, 'content-manifest.json');
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const label = `${region.id}:${manifest.regionId || path.basename(absoluteDirectory)}`;
  assertManifestFrame(manifest, region, expected, label);
  counters.manifests += 1;

  const seenPaths = new Set();
  for (const entry of artifactEntries(manifest)) {
    assert(!seenPaths.has(entry.path), `${label} repeats artifact ${entry.path}`);
    seenPaths.add(entry.path);
    await checkedFile(safePath(absoluteDirectory, entry.path, `${label} artifact path`), entry,
      `${label}:${entry.path}`);
    counters.artifacts += 1;
    counters.bytes += entry.bytes;
  }

  for (const [kind, dependency] of dependencyEntries(manifest)) {
    assert(dependency.contentManifest === 'content-manifest.json',
      `${label}.${kind}.contentManifest must be content-manifest.json`);
    const dependencyDirectory = path.resolve(ROOT, dependency.directory);
    assert(dependencyDirectory.startsWith(`${ASSET_ROOT}${path.sep}`),
      `${label}.${kind}.directory escapes public/assets/overworld`);
    const dependencyManifestPath = path.join(dependencyDirectory, dependency.contentManifest);
    const dependencyBytes = await checkedFile(dependencyManifestPath, {
      bytes: dependency.contentManifestBytes,
      sha256: dependency.contentManifestSha256,
    }, `${label}.${kind}.contentManifest`);
    const dependencyManifest = JSON.parse(dependencyBytes.toString('utf8'));
    await auditManifest(region, dependency.directory, {
      regionId: dependencyManifest.regionId,
      regionHash: dependencyManifest.regionHash,
      projectionManifestHash: dependencyManifest.projectionManifestHash,
    }, visited, counters);
  }
}

export async function checkOverworldAssets(regions = OVERWORLD_REGION_LIST) {
  const visited = new Set();
  const counters = { regions: 0, manifests: 0, artifacts: 0, bytes: 0 };
  for (const region of regions) {
    counters.regions += 1;
    const sources = [region.manifest, region.nodeSource, ...region.overlaySources];
    for (const source of sources) {
      await auditManifest(region, `public/assets/overworld/${source.regionId}`, source, visited, counters);
    }
    await verifyPreviewPng(region);
  }
  return Object.freeze({ ...counters });
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  const counters = await checkOverworldAssets();
  process.stdout.write(
    `오버월드 자산 검증 완료: ${counters.regions}지역, ${counters.manifests} manifest, `
    + `${counters.artifacts}파일, ${counters.bytes}바이트\n`,
  );
}
