import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildTerrainFromSnapshot,
  decodeTerrainRle,
} from '../build-korean-city-geo.mjs';
import { renderCityPng } from './render-city-map.mjs';

export function renderCitySnapshotPng(snapshot) {
  const { w: cols, h: rows } = snapshot.grid;
  const terrain = buildTerrainFromSnapshot(snapshot);
  const railway = decodeTerrainRle(snapshot.railwayRle, terrain.length);
  return renderCityPng({
    cols,
    rows,
    buildGrid: () => terrain,
    railways: { mask: railway },
    stations: [],
    nodes: [],
    entrance: { x: -10, y: -10 },
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [snapshotPath, outputPath] = process.argv.slice(2);
  if (!snapshotPath || !outputPath) {
    throw new Error('Usage: node scripts/world/render-city-snapshot.mjs <snapshot.json> <output.png>');
  }
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const png = renderCitySnapshotPng(snapshot);
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, png);
  console.log(JSON.stringify({
    city: snapshot.city,
    grid: snapshot.grid,
    outputPath: path.resolve(outputPath),
    bytes: png.length,
  }));
}
