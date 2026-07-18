import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshotFromConfig } from './build-korean-city-osm-snapshot.mjs';

const CITY_CONFIG = Object.freeze({
  brisbane: Object.freeze({
    bbox: Object.freeze([152.98, -27.52, 153.09, -27.42]),
    metersPerTile: 20,
    forestLayer: 'park',
    oceanSeeds: Object.freeze([]),
    output: 'scripts/data/brisbane-osm-v21.json',
    snapshotDate: '2026-07-17',
    sourceDetails: Object.freeze({
      providers: Object.freeze(['overpass-api.de', 'maps.mail.ru']),
      partitionCount: 16,
      queryCount: 48,
      mergeStrategy: 'type-id-largest-geometry-compact-v1',
    }),
  }),
  canberra: Object.freeze({
    bbox: Object.freeze([149.06, -35.33, 149.18, -35.24]),
    metersPerTile: 20,
    forestLayer: 'park',
    oceanSeeds: Object.freeze([]),
    output: 'scripts/data/canberra-osm-v21.json',
    snapshotDate: '2026-07-17',
    sourceDetails: Object.freeze({
      providers: Object.freeze(['overpass-api.de', 'maps.mail.ru']),
      partitionCount: 16,
      queryCount: 48,
      mergeStrategy: 'type-id-largest-geometry-compact-v1',
    }),
  }),
  melbourne: Object.freeze({
    bbox: Object.freeze([144.90, -37.88, 145.01, -37.78]),
    metersPerTile: 20,
    forestLayer: 'park',
    oceanSeeds: Object.freeze([
      Object.freeze({ lon: 144.905, lat: -37.87 }),
    ]),
    output: 'scripts/data/melbourne-osm-v21.json',
    snapshotDate: '2026-07-18',
    sourceDetails: Object.freeze({
      providers: Object.freeze(['overpass-api.de', 'maps.mail.ru']),
      partitionCount: 16,
      queryCount: 48,
      mergeStrategy: 'type-id-largest-geometry-compact-v1',
    }),
  }),
  sydney: Object.freeze({
    bbox: Object.freeze([151.17, -33.93, 151.31, -33.79]),
    metersPerTile: 20,
    forestLayer: 'park',
    oceanSeeds: Object.freeze([
      Object.freeze({ lon: 151.305, lat: -33.915 }),
      Object.freeze({ lon: 151.305, lat: -33.805 }),
    ]),
    output: 'scripts/data/sydney-osm-v21.json',
    snapshotDate: '2026-07-17',
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
    throw new Error('Usage: node scripts/build-english-city-osm-snapshot.mjs --city <brisbane|canberra|melbourne|sydney> --input <overpass.json> [--output <snapshot.json>]');
  }
  return { city, input, output: read('--output') || config.output };
}

export function buildEnglishCitySnapshot(city, rawText) {
  return buildSnapshotFromConfig(city, CITY_CONFIG[city], rawText);
}

export function writeEnglishCitySnapshot({ city, input, output }) {
  const rawText = fs.readFileSync(input, 'utf8');
  const snapshot = buildEnglishCitySnapshot(city, rawText);
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
  console.log(JSON.stringify(writeEnglishCitySnapshot(parseArgs(process.argv.slice(2)))));
}
