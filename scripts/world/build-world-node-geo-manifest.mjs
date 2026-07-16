import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD_NODES } from '../../src/components/world/worldNodes.js';
import { worldNodeGeoManifest } from '../../src/lib/world/worldNodeGeo.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_OUTPUT = path.join(
  ROOT,
  'public/assets/overworld/world-node-geo-migration-v1.json',
);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function buildWorldNodeGeoDocument(nodes = WORLD_NODES) {
  const migrated = worldNodeGeoManifest(nodes);
  const legacyIdentity = migrated
    .map(({ id, legacyTile }) => `${id}:${legacyTile[0]},${legacyTile[1]}`)
    .sort()
    .join('\n');
  const geoSourceCounts = migrated.reduce((counts, node) => ({
    ...counts,
    [node.geoSource]: (counts[node.geoSource] || 0) + 1,
  }), {});
  return {
    schemaVersion: 1,
    regionId: 'asia-pacific',
    source: 'WORLD_NODES',
    releaseEligible: false,
    legacyIdTileSha256: sha256(legacyIdentity),
    nodeCount: migrated.length,
    geoSourceCounts,
    nodes: migrated,
  };
}

export function serializeWorldNodeGeoDocument(nodes = WORLD_NODES) {
  return `${JSON.stringify(buildWorldNodeGeoDocument(nodes), null, 2)}\n`;
}

async function main() {
  const check = process.argv.includes('--check');
  const outputIndex = process.argv.indexOf('--output');
  const output = outputIndex >= 0
    ? path.resolve(ROOT, process.argv[outputIndex + 1])
    : DEFAULT_OUTPUT;
  const expected = serializeWorldNodeGeoDocument();
  if (check) {
    const actual = await readFile(output, 'utf8');
    if (actual !== expected) throw new Error(`stale world node geo manifest: ${output}`);
    return;
  }
  await writeFile(output, expected, 'utf8');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
