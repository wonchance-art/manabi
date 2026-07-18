import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshotFromConfig } from './build-korean-city-osm-snapshot.mjs';

const CITY_CONFIG = Object.freeze({
  kawaguchiko: Object.freeze({
    bbox: Object.freeze([138.725, 35.395, 138.85, 35.55]),
    metersPerTile: 20,
    forestLayer: 'mountain',
    oceanSeeds: Object.freeze([]),
    output: 'scripts/data/kawaguchiko-osm-v21.json',
    snapshotDate: '2026-07-18',
    sourceDetails: Object.freeze({
      providers: Object.freeze(['overpass-api.de', 'maps.mail.ru']),
      partitionCount: 16,
      queryCount: 48,
      mergeStrategy: 'type-id-largest-geometry-compact-v1',
    }),
  }),
});

function parseArgs(argv) {
  const read = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : null;
  };
  const city = read('--city');
  const input = read('--input');
  const config = CITY_CONFIG[city];
  if (!config || !input) {
    throw new Error('Usage: node scripts/build-japanese-city-osm-snapshot.mjs --city <kawaguchiko> --input <overpass.json> [--output <snapshot.json>]');
  }
  return { city, input, output: read('--output') || config.output };
}

export function buildJapaneseCitySnapshot(city, rawText) {
  return buildSnapshotFromConfig(city, CITY_CONFIG[city], rawText);
}

export function writeJapaneseCitySnapshot({ city, input, output }) {
  const rawText = fs.readFileSync(input, 'utf8');
  const snapshot = buildJapaneseCitySnapshot(city, rawText);
  const outputPath = path.resolve(output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot)}\n`);
  return {
    outputPath,
    grid: snapshot.grid,
    source: snapshot.source,
    bytes: fs.statSync(outputPath).size,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(writeJapaneseCitySnapshot(parseArgs(process.argv.slice(2)))));
}
