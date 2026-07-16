import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTerrainPreview } from './render-overworld-terrain-preview.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const ASSET_ROOT = path.join(ROOT, 'public/assets/overworld');
const OUTPUT_ROOT = path.join(ASSET_ROOT, 'map-previews');

const REGIONS = Object.freeze([
  Object.freeze({
    id: 'asia-pacific',
    terrain: 'asia-pacific-terrain-preview-v1',
    transport: 'asia-pacific-transport-preview-v1',
    playability: 'asia-pacific-playability-preview-v1',
    boundary: null,
  }),
  Object.freeze({
    id: 'emea',
    terrain: 'europe-mediterranean-middle-east-terrain-preview-v1',
    transport: 'europe-mediterranean-middle-east-transport-preview-v1',
    playability: 'europe-mediterranean-middle-east-playability-preview-v1',
    boundary: 'europe-mediterranean-middle-east-boundary-preview-v1',
  }),
]);

await mkdir(OUTPUT_ROOT, { recursive: true });

const reports = [];
for (const region of REGIONS) {
  const report = await renderTerrainPreview({
    inputDir: path.join(ASSET_ROOT, region.terrain),
    outputFile: path.join(OUTPUT_ROOT, `${region.id}.png`),
    targetWidth: 1200,
    transportDir: path.join(ASSET_ROOT, region.transport),
    playabilityDir: path.join(ASSET_ROOT, region.playability),
    boundaryDir: region.boundary ? path.join(ASSET_ROOT, region.boundary) : null,
  });
  reports.push({ id: region.id, ...report });
}

process.stdout.write(`${JSON.stringify(reports)}\n`);
