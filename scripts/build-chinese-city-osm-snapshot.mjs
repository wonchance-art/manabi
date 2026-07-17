import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshotFromConfig } from './build-korean-city-osm-snapshot.mjs';

const CITY_CONFIG = Object.freeze({
  'hong-kong': Object.freeze({
    bbox: Object.freeze([114.10, 22.26, 114.22, 22.33]),
    metersPerTile: 20,
    forestLayer: 'mountain',
    oceanSeeds: Object.freeze([
      Object.freeze({ lon: 114.12, lat: 22.290 }),
      Object.freeze({ lon: 114.16, lat: 22.291 }),
      Object.freeze({ lon: 114.21, lat: 22.292 }),
    ]),
    output: 'scripts/data/hong-kong-osm-v21.json',
    snapshotDate: '2026-07-17',
    sourceDetails: Object.freeze({
      providers: Object.freeze(['overpass-api.de', 'maps.mail.ru']),
      partitionCount: 16,
      queryCount: 48,
      mergeStrategy: 'type-id-largest-geometry-compact-v1',
    }),
  }),
  shanghai: Object.freeze({
    bbox: Object.freeze([121.45, 31.19, 121.54, 31.26]),
    metersPerTile: 20,
    forestLayer: 'mountain',
    oceanSeeds: Object.freeze([]),
    output: 'scripts/data/shanghai-osm-v21.json',
    snapshotDate: '2026-07-17',
    sourceDetails: Object.freeze({
      providers: Object.freeze(['overpass-api.de', 'maps.mail.ru']),
      partitionCount: 16,
      queryCount: 48,
      mergeStrategy: 'type-id-largest-geometry-compact-v1',
    }),
  }),
  taipei: Object.freeze({
    bbox: Object.freeze([121.49, 25.02, 121.58, 25.11]),
    metersPerTile: 20,
    forestLayer: 'mountain',
    oceanSeeds: Object.freeze([]),
    output: 'scripts/data/taipei-osm-v21.json',
    snapshotDate: '2026-07-17',
    sourceDetails: Object.freeze({
      providers: Object.freeze(['overpass-api.de']),
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
    throw new Error('Usage: node scripts/build-chinese-city-osm-snapshot.mjs --city <hong-kong|shanghai|taipei> --input <overpass.json> [--output <snapshot.json>]');
  }
  return { city, input, output: read('--output') || config.output };
}

export function buildChineseCitySnapshot(city, rawText) {
  return buildSnapshotFromConfig(city, CITY_CONFIG[city], rawText);
}

export function writeChineseCitySnapshot({ city, input, output }) {
  const rawText = fs.readFileSync(input, 'utf8');
  const snapshot = buildChineseCitySnapshot(city, rawText);
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
  console.log(JSON.stringify(writeChineseCitySnapshot(parseArgs(process.argv.slice(2)))));
}
