import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFrenchCityGeoBase, encodeTerrainRle } from './build-french-city-geo-core.mjs';
import { CITY_TILE } from '../src/components/world/cities/terrain.js';

const CARDINAL = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);
const FRENCH_BRIDGE_CONTRACT = Object.freeze({
  method: 'france-bridge-three-way-v1',
  roadRule: 'two-land-contact-components-or-road-contact',
  absorptionRule: 'river-before-water',
});

const FRENCH_CITY_CONFIG = Object.freeze({
  'grand-paris': Object.freeze({
    output: '../src/components/world/cities/grand-paris.geo.js',
    exportName: 'GRAND_PARIS_GEO',
    poiNames: Object.freeze({
      'eiffel-tower': 'Tour Eiffel',
      louvre: 'Musée du Louvre',
      'notre-dame': 'Cathédrale Notre-Dame',
      'arc-de-triomphe': 'Arc de Triomphe',
      'champs-elysees': 'Champs-Élysées',
      'sacre-coeur': 'Sacré-Cœur',
      'musee-orsay': "Musée d'Orsay",
      pompidou: 'Centre Pompidou',
      luxembourg: 'Jardin du Luxembourg',
      pantheon: 'Panthéon',
      invalides: 'Les Invalides',
      concorde: 'Place de la Concorde',
      'opera-garnier': 'Opéra Garnier',
      'pont-neuf': 'Pont Neuf',
      marais: 'Le Marais',
      'quartier-latin': 'Quartier Latin',
      'montparnasse-tower': 'Tour Montparnasse',
      versailles: 'Château de Versailles',
      'grande-arche': 'Grande Arche',
      'saint-denis-basilica': 'Basilique Saint-Denis',
      'bois-de-boulogne': 'Bois de Boulogne',
      vincennes: 'Château de Vincennes',
    }),
  }),
  'cote-dazur': Object.freeze({
    output: '../src/components/world/cities/cote-dazur.geo.js',
    exportName: 'COTE_DAZUR_GEO',
    poiNames: Object.freeze({
      'promenade-des-anglais': 'Promenade des Anglais',
      'place-massena': 'Place Masséna',
      'vieux-nice': 'Vieux Nice',
      'castle-hill': 'Colline du Château',
      'musee-chagall': 'Musée Marc Chagall',
      'musee-matisse': 'Musée Matisse',
      'nice-airport': "Aéroport Nice Côte d'Azur",
      'antibes-picasso': 'Musée Picasso (Château Grimaldi)',
      'fort-carre': 'Fort Carré',
      'saint-paul-de-vence': 'Saint-Paul-de-Vence',
      'fondation-maeght': 'Fondation Maeght',
      'cagnes-renoir': 'Musée Renoir (Les Collettes)',
      'villefranche-sur-mer': 'Villefranche-sur-Mer',
      'eze-village': 'Èze',
      'monaco-palace': 'Palais Princier',
      'oceanographic-museum': 'Musée Océanographique',
      'port-hercule': 'Port Hercule',
      'monte-carlo-casino': 'Casino de Monte-Carlo',
    }),
  }),
  london: Object.freeze({
    output: '../src/components/world/cities/london.geo.js',
    exportName: 'LONDON_GEO',
    nameField: 'nameEn',
    bridgeContract: Object.freeze({
      method: 'korean-bridge-three-way-mirror-v1',
      roadRule: 'two-land-contact-components-or-road-contact',
      absorptionRule: 'river-before-water',
    }),
    poiNames: Object.freeze({
      'westminster-abbey': 'Westminster Abbey',
      'houses-of-parliament': 'Houses of Parliament',
      'buckingham-palace': 'Buckingham Palace',
      'tower-of-london': 'Tower of London',
      'tower-bridge': 'Tower Bridge',
      'st-pauls': "St Paul's Cathedral",
      'british-museum': 'British Museum',
      'trafalgar-square': 'Trafalgar Square',
      'covent-garden': 'Covent Garden',
      'piccadilly-circus': 'Piccadilly Circus',
      'london-eye': 'London Eye',
      'tate-modern': 'Tate Modern',
      'borough-market': 'Borough Market',
      'the-shard': 'The Shard',
      'camden-town': 'Camden Town',
      'notting-hill': 'Notting Hill',
      'hyde-park': 'Hyde Park',
      'natural-history-museum': 'Natural History Museum',
      greenwich: 'Maritime Greenwich',
      'kew-gardens': 'Kew Gardens',
      wimbledon: 'Wimbledon',
      'hampstead-heath': 'Hampstead Heath',
      wembley: 'Wembley Stadium',
      'olympic-park': 'Queen Elizabeth Olympic Park',
    }),
  }),
  brussels: Object.freeze({
    output: '../src/components/world/cities/brussels.geo.js',
    exportName: 'BRUSSELS_GEO',
    requiredLocaleFields: Object.freeze(['nameNl']),
    poiNames: Object.freeze({
      'grand-place': 'Grand-Place',
      'manneken-pis': 'Manneken-Pis',
      'galeries-royales': 'Galeries Royales Saint-Hubert',
      cathedral: 'Cathédrale Saints-Michel-et-Gudule',
      'mont-des-arts': 'Mont des Arts',
      'magritte-museum': 'Musée Magritte',
      sablon: 'Place du Grand Sablon',
      'royal-palace': 'Palais royal de Bruxelles',
      'parc-cinquantenaire': 'Parc du Cinquantenaire',
      'eu-quarter': 'Quartier européen',
      'comics-museum': 'Centre belge de la Bande dessinée',
      atomium: 'Atomium',
    }),
  }),
});

function isLandContact(code) {
  return code !== CITY_TILE.WATER
    && code !== CITY_TILE.RIVER
    && code !== CITY_TILE.BUILDING
    && code !== CITY_TILE.ISLAND
    && code !== CITY_TILE.MOUNTAIN
    && code !== CITY_TILE.BRIDGE;
}

function contactComponentCount(contacts, width, height) {
  const remaining = new Set(contacts);
  let components = 0;
  while (remaining.size > 0) {
    components += 1;
    const start = remaining.values().next().value;
    remaining.delete(start);
    const queue = [start];
    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head];
      const x = index % width;
      const y = Math.floor(index / width);
      for (const [dx, dy] of CARDINAL) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (!remaining.delete(next)) continue;
        queue.push(next);
      }
    }
  }
  return components;
}

export function normalizeFrenchBridgeTerrain(sourceTerrain, meta, contract = FRENCH_BRIDGE_CONTRACT) {
  const terrain = sourceTerrain.slice();
  const { w: width, h: height } = meta.grid;
  const seen = new Uint8Array(terrain.length);
  const report = {
    ...contract,
    sourceBridgeTileCount: 0,
    componentCount: 0,
    roadComponentCount: 0,
    absorbedComponentCount: 0,
    roadTileCount: 0,
    absorbedWaterTileCount: 0,
    absorbedRiverTileCount: 0,
    finalBridgeTileCount: 0,
  };

  for (let start = 0; start < terrain.length; start += 1) {
    if (terrain[start] !== CITY_TILE.BRIDGE || seen[start]) continue;
    report.componentCount += 1;
    const component = [start];
    const landContacts = new Set();
    seen[start] = 1;
    let roadContacts = 0;
    let riverContacts = 0;
    for (let head = 0; head < component.length; head += 1) {
      const index = component[head];
      const x = index % width;
      const y = Math.floor(index / width);
      for (const [dx, dy] of CARDINAL) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        const code = terrain[next];
        if (code === CITY_TILE.BRIDGE) {
          if (!seen[next]) {
            seen[next] = 1;
            component.push(next);
          }
          continue;
        }
        if (isLandContact(code)) landContacts.add(next);
        if (code === CITY_TILE.ROAD || code === CITY_TILE.CROSSWALK) roadContacts += 1;
        if (code === CITY_TILE.RIVER) riverContacts += 1;
      }
    }

    report.sourceBridgeTileCount += component.length;
    const landSides = contactComponentCount(landContacts, width, height);
    if (landSides >= 2 || roadContacts > 0) {
      report.roadComponentCount += 1;
      report.roadTileCount += component.length;
      for (const index of component) terrain[index] = CITY_TILE.ROAD;
      continue;
    }

    report.absorbedComponentCount += 1;
    const replacement = riverContacts > 0 ? CITY_TILE.RIVER : CITY_TILE.WATER;
    if (replacement === CITY_TILE.RIVER) report.absorbedRiverTileCount += component.length;
    else report.absorbedWaterTileCount += component.length;
    for (const index of component) terrain[index] = replacement;
  }

  for (const code of terrain) {
    if (code === CITY_TILE.BRIDGE) report.finalBridgeTileCount += 1;
  }
  if (report.finalBridgeTileCount > 0) {
    throw new Error(`City bridge normalization left ${report.finalBridgeTileCount} bridge tiles`);
  }
  return { terrain, report: Object.freeze(report) };
}

export function buildFrenchCityGeo(city) {
  const config = FRENCH_CITY_CONFIG[city];
  if (!config) throw new Error(`Unknown French city: ${city}`);
  const geo = buildFrenchCityGeoBase(city);
  const poiNames = config.poiNames;
  const nameField = config.nameField ?? 'nameFr';
  const pois = geo.pois.map((poi) => {
    const localizedName = poiNames[poi.id];
    if (!localizedName) throw new Error(`${city} missing ${nameField} for POI ${poi.id}`);
    return { ...poi, [nameField]: localizedName };
  });
  const configuredIds = Object.keys(poiNames);
  if (configuredIds.length !== pois.length || configuredIds.some((id) => !pois.some((poi) => poi.id === id))) {
    throw new Error(`${city} POI name contract does not match generated POIs`);
  }
  for (const field of config.requiredLocaleFields ?? []) {
    for (const entry of [...pois, ...geo.stations]) {
      if (typeof entry[field] !== 'string' || entry[field].length === 0) {
        throw new Error(`${city} missing ${field} for ${entry.id}`);
      }
    }
  }
  const bridges = normalizeFrenchBridgeTerrain(geo.terrain, geo.meta, config.bridgeContract);
  return {
    ...geo,
    meta: Object.freeze({ ...geo.meta, bridgeNormalization: bridges.report }),
    terrain: bridges.terrain,
    pois,
  };
}

function generatedModule(config, geo) {
  const terrainRuns = encodeTerrainRle(geo.terrain);
  const railwayRuns = encodeTerrainRle(geo.railways.mask);
  return `// Generated by scripts/build-french-city-geo.mjs. Do not edit by hand.
// Geometry: © OpenStreetMap contributors, ODbL 1.0 (snapshot ${geo.meta.source.snapshot}).
// Locale schema: ${geo.meta.schema.nameField}/contentLocale are exact keys; reading and additional locale slots may be appended without renaming.

const META = Object.freeze(${JSON.stringify(geo.meta, null, 2)});
const TERRAIN_RLE = ${JSON.stringify(terrainRuns)};
const RAILWAY_RLE = ${JSON.stringify(railwayRuns)};

function decodeTerrain(runs, length) {
  const terrain = new Uint8Array(length);
  let offset = 0;
  for (const [code, count] of runs) {
    terrain.fill(code, offset, offset + count);
    offset += count;
  }
  if (offset !== length) throw new Error(\`terrain RLE length mismatch: \${offset} !== \${length}\`);
  return terrain;
}

const LENGTH = META.grid.w * META.grid.h;

export const ${config.exportName} = Object.freeze({
  meta: META,
  terrain: decodeTerrain(TERRAIN_RLE, LENGTH),
  pois: Object.freeze(${JSON.stringify(geo.pois, null, 2)}),
  stations: Object.freeze(${JSON.stringify(geo.stations, null, 2)}),
  entrance: Object.freeze(${JSON.stringify(geo.entrance)}),
  exitTiles: Object.freeze(${JSON.stringify(geo.exitTiles)}),
  railways: Object.freeze({
    mask: decodeTerrain(RAILWAY_RLE, LENGTH),
    tileCount: ${geo.railways.tileCount},
  }),
});
`;
}

export function writeFrenchCityGeo(city) {
  const config = FRENCH_CITY_CONFIG[city];
  if (!config) throw new Error(`Unknown French city: ${city}`);
  const geo = buildFrenchCityGeo(city);
  const outputPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), config.output);
  fs.writeFileSync(outputPath, generatedModule(config, geo));
  return {
    outputPath,
    grid: geo.meta.grid,
    cells: geo.terrain.length,
    terrainRuns: encodeTerrainRle(geo.terrain).length,
    railwayRuns: encodeTerrainRle(geo.railways.mask).length,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cityIndex = process.argv.indexOf('--city');
  if (cityIndex < 0 || !process.argv[cityIndex + 1]) {
    throw new Error('Usage: node scripts/build-french-city-geo.mjs --city <grand-paris|cote-dazur|london|brussels>');
  }
  console.log(JSON.stringify(writeFrenchCityGeo(process.argv[cityIndex + 1])));
}
