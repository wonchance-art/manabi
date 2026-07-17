import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITY_TILE, isCityBlocked } from '../src/components/world/cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const DEFAULT_METERS_PER_TILE = 20;
const BUILDING_TEXTURE_CONTRACT = Object.freeze({
  method: 'deterministic-road-block-infill',
  version: 2,
  targetLandRatio: 0.10,
  blockFillRatioMin: 0.70,
  blockFillRatioMax: 0.85,
  blockMinTiles: 12,
  blockMaxTiles: 2_000,
  seedNamespace: 'manabi-korean-city-buildings-v2',
  minorRoadClasses: Object.freeze(['service', 'footway', 'path', 'steps', 'cycleway', 'track']),
  publicDatasetProbe: Object.freeze({
    provider: 'MOLIT VWorld',
    datasetId: '30162',
    checkedAt: '2026-07-16',
    outcome: 'login-and-desktop-downloader-required',
  }),
});
const CITY_CONFIG = Object.freeze({
  'grand-paris': Object.freeze({
    bbox: Object.freeze([2.10, 48.78, 2.47, 48.94]),
    snapshot: new URL('./data/grand-paris-osm-v21.json', import.meta.url),
    mainStationId: 'gare-du-nord',
    contentLocale: 'fr',
    nameField: 'nameFr',
    finalBuildingRatioRange: Object.freeze([0.14, 0.17]),
    buildingDatasetProbe: Object.freeze({
      provider: 'OpenStreetMap', datasetId: 'building=*', checkedAt: '2026-07-16',
      outcome: 'fixed-offline-snapshot',
    }),
    pois: Object.freeze([
      { id: 'eiffel-tower', nameFr: 'Tour Eiffel', lat: 48.8584, lon: 2.2945, kind: 'landmark' },
      { id: 'louvre', nameFr: 'Musée du Louvre', lat: 48.8606, lon: 2.3364, kind: 'museum' },
      { id: 'notre-dame', nameFr: 'Cathédrale Notre-Dame', lat: 48.8530, lon: 2.3499, kind: 'historic' },
      { id: 'arc-de-triomphe', nameFr: 'Arc de Triomphe', lat: 48.8738, lon: 2.2950, kind: 'landmark' },
      { id: 'champs-elysees', nameFr: 'Champs-Élysées', lat: 48.8698, lon: 2.3077, kind: 'district' },
      { id: 'sacre-coeur', nameFr: 'Sacré-Cœur', lat: 48.8867, lon: 2.3431, kind: 'historic' },
      { id: 'musee-orsay', nameFr: "Musée d'Orsay", lat: 48.8600, lon: 2.3266, kind: 'museum' },
      { id: 'pompidou', nameFr: 'Centre Pompidou', lat: 48.8607, lon: 2.3522, kind: 'museum' },
      { id: 'luxembourg', nameFr: 'Jardin du Luxembourg', lat: 48.8462, lon: 2.3372, kind: 'park' },
      { id: 'pantheon', nameFr: 'Panthéon', lat: 48.8462, lon: 2.3462, kind: 'historic' },
      { id: 'invalides', nameFr: 'Les Invalides', lat: 48.8560, lon: 2.3126, kind: 'historic' },
      { id: 'concorde', nameFr: 'Place de la Concorde', lat: 48.8656, lon: 2.3212, kind: 'plaza' },
      { id: 'opera-garnier', nameFr: 'Opéra Garnier', lat: 48.8720, lon: 2.3316, kind: 'landmark' },
      { id: 'pont-neuf', nameFr: 'Pont Neuf', lat: 48.8567, lon: 2.3413, kind: 'bridge-landmark' },
      { id: 'marais', nameFr: 'Le Marais', lat: 48.8575, lon: 2.3610, kind: 'district' },
      { id: 'quartier-latin', nameFr: 'Quartier Latin', lat: 48.8500, lon: 2.3430, kind: 'district' },
      { id: 'montparnasse-tower', nameFr: 'Tour Montparnasse', lat: 48.8422, lon: 2.3219, kind: 'landmark' },
      { id: 'versailles', nameFr: 'Château de Versailles', lat: 48.8049, lon: 2.1204, kind: 'historic' },
      { id: 'grande-arche', nameFr: 'Grande Arche', lat: 48.8925, lon: 2.2360, kind: 'landmark' },
      { id: 'saint-denis-basilica', nameFr: 'Basilique Saint-Denis', lat: 48.9354, lon: 2.3599, kind: 'historic' },
      { id: 'bois-de-boulogne', nameFr: 'Bois de Boulogne', lat: 48.8620, lon: 2.2530, kind: 'park' },
      { id: 'vincennes', nameFr: 'Château de Vincennes', lat: 48.8420, lon: 2.4358, kind: 'historic' },
    ]),
    stations: Object.freeze([
      { id: 'gare-du-nord', nameFr: 'Gare du Nord', lat: 48.8809, lon: 2.3553, line: 'RER B·D · Transilien' },
      { id: 'gare-de-lyon', nameFr: 'Gare de Lyon', lat: 48.8443, lon: 2.3734, line: 'RER A·D · Transilien' },
      { id: 'montparnasse', nameFr: 'Gare Montparnasse', lat: 48.8404, lon: 2.3219, line: 'Transilien' },
      { id: 'saint-lazare', nameFr: 'Gare Saint-Lazare', lat: 48.8764, lon: 2.3254, line: 'Transilien' },
      { id: 'gare-de-l-est', nameFr: "Gare de l'Est", lat: 48.8768, lon: 2.3590, line: 'Transilien' },
      { id: 'chatelet', nameFr: 'Châtelet–Les Halles', lat: 48.8586, lon: 2.3467, line: 'RER A·B·D' },
      { id: 'la-defense', nameFr: 'La Défense', lat: 48.8918, lon: 2.2380, line: 'RER A · Transilien' },
      { id: 'versailles-rive-gauche', nameFr: 'Versailles Château Rive Gauche', lat: 48.7996, lon: 2.1290, line: 'RER C' },
    ]),
  }),
  'cote-dazur': Object.freeze({
    bbox: Object.freeze([7.06, 43.54, 7.45, 43.75]),
    snapshot: new URL('./data/cote-dazur-osm-v21.json', import.meta.url),
    mainStationId: 'nice-ville',
    contentLocale: 'fr',
    nameField: 'nameFr',
    preserveExistingBuildings: true,
    finalBuildingRatioRange: Object.freeze([0.07, 0.08]),
    buildingDatasetProbe: Object.freeze({
      provider: 'OpenStreetMap', datasetId: 'building=*', checkedAt: '2026-07-17',
      outcome: 'fixed-offline-snapshot',
    }),
    pois: Object.freeze([
      { id: 'promenade-des-anglais', nameFr: 'Promenade des Anglais', lat: 43.6950, lon: 7.2620, kind: 'promenade' },
      { id: 'place-massena', nameFr: 'Place Masséna', lat: 43.6975, lon: 7.2700, kind: 'plaza' },
      { id: 'vieux-nice', nameFr: 'Vieux Nice', lat: 43.6955, lon: 7.2755, kind: 'district' },
      { id: 'castle-hill', nameFr: 'Colline du Château', lat: 43.6945, lon: 7.2800, kind: 'landmark' },
      { id: 'musee-chagall', nameFr: 'Musée Marc Chagall', lat: 43.7095, lon: 7.2700, kind: 'museum' },
      { id: 'musee-matisse', nameFr: 'Musée Matisse', lat: 43.7195, lon: 7.2755, kind: 'museum' },
      { id: 'nice-airport', nameFr: "Aéroport Nice Côte d'Azur", lat: 43.6650, lon: 7.2150, kind: 'airport' },
      { id: 'antibes-picasso', nameFr: 'Musée Picasso (Château Grimaldi)', lat: 43.5805, lon: 7.1290, kind: 'museum' },
      { id: 'fort-carre', nameFr: 'Fort Carré', lat: 43.5900, lon: 7.1230, kind: 'historic' },
      { id: 'saint-paul-de-vence', nameFr: 'Saint-Paul-de-Vence', lat: 43.6970, lon: 7.1225, kind: 'village' },
      { id: 'fondation-maeght', nameFr: 'Fondation Maeght', lat: 43.7010, lon: 7.1205, kind: 'museum' },
      { id: 'cagnes-renoir', nameFr: 'Musée Renoir (Les Collettes)', lat: 43.6620, lon: 7.1560, kind: 'museum' },
      { id: 'villefranche-sur-mer', nameFr: 'Villefranche-sur-Mer', lat: 43.7040, lon: 7.3070, kind: 'village' },
      { id: 'eze-village', nameFr: 'Èze', lat: 43.7275, lon: 7.3615, kind: 'village' },
      { id: 'monaco-palace', nameFr: 'Palais Princier', lat: 43.7315, lon: 7.4200, kind: 'historic' },
      { id: 'oceanographic-museum', nameFr: 'Musée Océanographique', lat: 43.7305, lon: 7.4255, kind: 'museum' },
      { id: 'port-hercule', nameFr: 'Port Hercule', lat: 43.7350, lon: 7.4240, kind: 'port' },
      { id: 'monte-carlo-casino', nameFr: 'Casino de Monte-Carlo', lat: 43.7395, lon: 7.4280, kind: 'landmark' },
    ]),
    stations: Object.freeze([
      { id: 'antibes', nameFr: 'Antibes', lat: 43.5860, lon: 7.1230, line: "TER Côte d'Azur", routeId: 'ter-cote-dazur' },
      { id: 'cagnes-sur-mer', nameFr: 'Cagnes-sur-Mer', lat: 43.6585, lon: 7.1490, line: "TER Côte d'Azur", routeId: 'ter-cote-dazur' },
      { id: 'nice-ville', nameFr: 'Nice-Ville', lat: 43.7045, lon: 7.2620, line: "TER Côte d'Azur", routeId: 'ter-cote-dazur' },
      { id: 'villefranche-sur-mer', nameFr: 'Villefranche-sur-Mer', lat: 43.7060, lon: 7.3105, line: "TER Côte d'Azur", routeId: 'ter-cote-dazur' },
      { id: 'eze-sur-mer', nameFr: 'Èze-sur-Mer', lat: 43.7180, lon: 7.3555, line: "TER Côte d'Azur", routeId: 'ter-cote-dazur' },
      { id: 'monaco-monte-carlo', nameFr: 'Monaco–Monte-Carlo', lat: 43.7385, lon: 7.4195, line: "TER Côte d'Azur", routeId: 'ter-cote-dazur' },
    ]),
  }),
  london: Object.freeze({
    bbox: Object.freeze([-0.30, 51.42, 0.05, 51.60]),
    snapshot: new URL('./data/london-osm-v21.json', import.meta.url),
    mainStationId: 'st-pancras',
    contentLocale: 'en',
    nameField: 'nameEn',
    preserveExistingBuildings: true,
    finalBuildingRatioRange: Object.freeze([0.10, 0.12]),
    buildingDatasetProbe: Object.freeze({
      provider: 'OpenStreetMap', datasetId: 'building=*', checkedAt: '2026-07-17',
      outcome: 'fixed-offline-snapshot',
    }),
    pois: Object.freeze([
      { id: 'westminster-abbey', nameEn: 'Westminster Abbey', nameKo: '웨스트민스터 사원', lat: 51.4993, lon: -0.1275, kind: 'world-heritage' },
      { id: 'houses-of-parliament', nameEn: 'Houses of Parliament', nameKo: '국회의사당(빅벤)', lat: 51.4995, lon: -0.1246, kind: 'world-heritage' },
      { id: 'buckingham-palace', nameEn: 'Buckingham Palace', nameKo: '버킹엄궁', lat: 51.5014, lon: -0.1419, kind: 'landmark' },
      { id: 'tower-of-london', nameEn: 'Tower of London', nameKo: '런던탑', lat: 51.5081, lon: -0.0761, kind: 'world-heritage' },
      { id: 'tower-bridge', nameEn: 'Tower Bridge', nameKo: '타워브리지', lat: 51.5055, lon: -0.0754, kind: 'bridge-landmark' },
      { id: 'st-pauls', nameEn: "St Paul's Cathedral", nameKo: '세인트폴 대성당', lat: 51.5138, lon: -0.0984, kind: 'historic' },
      { id: 'british-museum', nameEn: 'British Museum', nameKo: '대영박물관', lat: 51.5194, lon: -0.1269, kind: 'museum' },
      { id: 'trafalgar-square', nameEn: 'Trafalgar Square', nameKo: '트래펄가 광장', lat: 51.5080, lon: -0.1281, kind: 'plaza' },
      { id: 'covent-garden', nameEn: 'Covent Garden', nameKo: '코번트가든', lat: 51.5119, lon: -0.1226, kind: 'district' },
      { id: 'piccadilly-circus', nameEn: 'Piccadilly Circus', nameKo: '피커딜리 서커스', lat: 51.5101, lon: -0.1347, kind: 'plaza' },
      { id: 'london-eye', nameEn: 'London Eye', nameKo: '런던아이', lat: 51.5033, lon: -0.1196, kind: 'landmark' },
      { id: 'tate-modern', nameEn: 'Tate Modern', nameKo: '테이트모던', lat: 51.5076, lon: -0.0994, kind: 'museum' },
      { id: 'borough-market', nameEn: 'Borough Market', nameKo: '버러마켓', lat: 51.5055, lon: -0.0910, kind: 'market' },
      { id: 'the-shard', nameEn: 'The Shard', nameKo: '더 샤드', lat: 51.5045, lon: -0.0865, kind: 'landmark' },
      { id: 'camden-town', nameEn: 'Camden Town', nameKo: '캠든타운', lat: 51.5390, lon: -0.1426, kind: 'district' },
      { id: 'notting-hill', nameEn: 'Notting Hill', nameKo: '노팅힐', lat: 51.5173, lon: -0.2058, kind: 'district' },
      { id: 'hyde-park', nameEn: 'Hyde Park', nameKo: '하이드파크', lat: 51.5073, lon: -0.1657, kind: 'park' },
      { id: 'natural-history-museum', nameEn: 'Natural History Museum', nameKo: '자연사박물관', lat: 51.4966, lon: -0.1764, kind: 'museum' },
      { id: 'greenwich', nameEn: 'Maritime Greenwich', nameKo: '그리니치', lat: 51.4820, lon: -0.0077, kind: 'world-heritage' },
      { id: 'kew-gardens', nameEn: 'Kew Gardens', nameKo: '큐 왕립식물원', lat: 51.4787, lon: -0.2956, kind: 'world-heritage' },
      { id: 'wimbledon', nameEn: 'Wimbledon', nameKo: '윔블던', lat: 51.4342, lon: -0.2143, kind: 'landmark' },
      { id: 'hampstead-heath', nameEn: 'Hampstead Heath', nameKo: '햄스테드 히스', lat: 51.5608, lon: -0.1650, kind: 'park' },
      { id: 'wembley', nameEn: 'Wembley Stadium', nameKo: '웸블리', lat: 51.5560, lon: -0.2795, kind: 'landmark' },
      { id: 'olympic-park', nameEn: 'Queen Elizabeth Olympic Park', nameKo: '올림픽공원', lat: 51.5432, lon: -0.0166, kind: 'park' },
    ]),
    stations: Object.freeze([
      { id: 'st-pancras', nameEn: 'St Pancras International', lat: 51.5316, lon: -0.1258, line: 'Eurostar · National Rail', routeId: 'london-international', routeIds: Object.freeze(['london-international']) },
      { id: 'kings-cross', nameEn: "King's Cross", lat: 51.5308, lon: -0.1238, line: 'National Rail · Underground', routeId: 'london-core', routeIds: Object.freeze(['london-core']) },
      { id: 'paddington', nameEn: 'London Paddington', lat: 51.5160, lon: -0.1760, line: 'Circle · District', routeId: 'circle-district', routeIds: Object.freeze(['circle-district']) },
      { id: 'victoria', nameEn: 'London Victoria', lat: 51.4952, lon: -0.1439, line: 'Circle · District', routeId: 'circle-district', routeIds: Object.freeze(['circle-district']) },
      { id: 'waterloo', nameEn: 'London Waterloo', lat: 51.5033, lon: -0.1132, line: 'Jubilee', routeId: 'jubilee', routeIds: Object.freeze(['jubilee']) },
      { id: 'liverpool-street', nameEn: 'Liverpool Street', lat: 51.5178, lon: -0.0823, line: 'Circle · District', routeId: 'circle-district', routeIds: Object.freeze(['circle-district']) },
      { id: 'london-bridge', nameEn: 'London Bridge', lat: 51.5052, lon: -0.0861, line: 'Jubilee · Thameslink', routeId: 'jubilee', routeIds: Object.freeze(['circle-district', 'jubilee']) },
      { id: 'westminster', nameEn: 'Westminster', lat: 51.5010, lon: -0.1247, line: 'Circle · District · Jubilee', routeId: 'circle-district', routeIds: Object.freeze(['circle-district', 'jubilee']) },
      { id: 'greenwich-station', nameEn: 'Greenwich', lat: 51.4779, lon: -0.0141, line: 'DLR · National Rail', routeId: 'dlr', routeIds: Object.freeze(['dlr']) },
    ]),
  }),
  brussels: Object.freeze({
    bbox: Object.freeze([4.32, 50.79, 4.42, 50.90]),
    snapshot: new URL('./data/brussels-osm-v21.json', import.meta.url),
    mainStationId: 'bruxelles-midi',
    contentLocale: 'fr',
    nameField: 'nameFr',
    localeAnchors: Object.freeze(['fr', 'nl']),
    preserveExistingBuildings: true,
    buildingRatioReportOnly: true,
    buildingDatasetProbe: Object.freeze({
      provider: 'OpenStreetMap', datasetId: 'building=*', checkedAt: '2026-07-17',
      outcome: 'fixed-offline-snapshot',
    }),
    pois: Object.freeze([
      { id: 'grand-place', nameFr: 'Grand-Place', nameNl: 'Grote Markt', lat: 50.8467, lon: 4.3525, kind: 'world-heritage' },
      { id: 'manneken-pis', nameFr: 'Manneken-Pis', nameNl: 'Manneken Pis', lat: 50.8450, lon: 4.3500, kind: 'landmark' },
      { id: 'galeries-royales', nameFr: 'Galeries Royales Saint-Hubert', nameNl: 'Koninklijke Sint-Hubertusgalerijen', lat: 50.8474, lon: 4.3548, kind: 'landmark' },
      { id: 'cathedral', nameFr: 'Cathédrale Saints-Michel-et-Gudule', nameNl: 'Sint-Michiels- en Sint-Goedelekathedraal', lat: 50.8477, lon: 4.3603, kind: 'historic' },
      { id: 'mont-des-arts', nameFr: 'Mont des Arts', nameNl: 'Kunstberg', lat: 50.8440, lon: 4.3565, kind: 'district' },
      { id: 'magritte-museum', nameFr: 'Musée Magritte', nameNl: 'Magritte Museum', lat: 50.8420, lon: 4.3598, kind: 'museum' },
      { id: 'sablon', nameFr: 'Place du Grand Sablon', nameNl: 'Grote Zavel', lat: 50.8400, lon: 4.3560, kind: 'plaza' },
      { id: 'royal-palace', nameFr: 'Palais royal de Bruxelles', nameNl: 'Koninklijk Paleis van Brussel', lat: 50.8419, lon: 4.3622, kind: 'historic' },
      { id: 'parc-cinquantenaire', nameFr: 'Parc du Cinquantenaire', nameNl: 'Jubelpark', lat: 50.8400, lon: 4.3910, kind: 'park' },
      { id: 'eu-quarter', nameFr: 'Quartier européen', nameNl: 'Europese Wijk', lat: 50.8435, lon: 4.3830, kind: 'district' },
      { id: 'comics-museum', nameFr: 'Centre belge de la Bande dessinée', nameNl: 'Belgisch Stripcentrum', lat: 50.8508, lon: 4.3600, kind: 'museum' },
      { id: 'atomium', nameFr: 'Atomium', nameNl: 'Atomium', lat: 50.8949, lon: 4.3415, kind: 'landmark', renderPolicy: 'marker-only' },
    ]),
    stations: Object.freeze([
      { id: 'bruxelles-midi', nameFr: 'Bruxelles-Midi', nameNl: 'Brussel-Zuid', lat: 50.8358, lon: 4.3355, line: 'Eurostar · TGV · axe Nord-Midi', routeId: 'brussels-north-south-axis', routeIds: Object.freeze(['brussels-north-south-axis']) },
      { id: 'bruxelles-central', nameFr: 'Bruxelles-Central', nameNl: 'Brussel-Centraal', lat: 50.8455, lon: 4.3571, line: 'axe Nord-Midi', routeId: 'brussels-north-south-axis', routeIds: Object.freeze(['brussels-north-south-axis']) },
      { id: 'bruxelles-nord', nameFr: 'Bruxelles-Nord', nameNl: 'Brussel-Noord', lat: 50.8605, lon: 4.3603, line: 'axe Nord-Midi', routeId: 'brussels-north-south-axis', routeIds: Object.freeze(['brussels-north-south-axis']) },
      { id: 'schuman', nameFr: 'Bruxelles-Schuman', nameNl: 'Brussel-Schuman', lat: 50.8430, lon: 4.3820, line: 'train S · métro 1·5' },
    ]),
  }),
});

function webMercatorMeters(lon, lat) {
  const limitedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  return {
    x: EARTH_RADIUS * lon * DEG,
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + limitedLat * DEG / 2)),
  };
}

function projectionMetrics(bbox, metersPerTile = DEFAULT_METERS_PER_TILE) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const southWest = webMercatorMeters(minLon, minLat);
  const northEast = webMercatorMeters(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return {
    southWest, northEast, correction,
    grid: {
      w: Math.ceil(((northEast.x - southWest.x) * correction) / metersPerTile),
      h: Math.ceil(((northEast.y - southWest.y) * correction) / metersPerTile),
    },
  };
}

function projectLatLonToTile(lat, lon, meta, metrics) {
  const point = webMercatorMeters(lon, lat);
  return [
    Math.max(0, Math.min(meta.grid.w - 1, Math.floor(((point.x - metrics.southWest.x) * metrics.correction) / meta.metersPerTile))),
    Math.max(0, Math.min(meta.grid.h - 1, Math.floor(((metrics.northEast.y - point.y) * metrics.correction) / meta.metersPerTile))),
  ];
}

export function encodeTerrainRle(terrain) {
  if (terrain.length === 0) return [];
  const runs = [];
  let code = terrain[0];
  let count = 1;
  for (let index = 1; index < terrain.length; index += 1) {
    if (terrain[index] === code) count += 1;
    else {
      runs.push([code, count]);
      code = terrain[index];
      count = 1;
    }
  }
  runs.push([code, count]);
  return runs;
}

export function decodeTerrainRle(runs, length) {
  const terrain = new Uint8Array(length);
  let offset = 0;
  for (const [code, count] of runs) {
    terrain.fill(code, offset, offset + count);
    offset += count;
  }
  if (offset !== length) throw new Error(`terrain RLE length mismatch: ${offset} !== ${length}`);
  return terrain;
}

function ensureWalkableAnchor(grid, tile, meta) {
  const [x, y] = tile;
  const index = y * meta.grid.w + x;
  if (isCityBlocked(grid[index])) grid[index] = CITY_TILE.PLAZA;
  if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < meta.grid.w && ny < meta.grid.h && !isCityBlocked(grid[ny * meta.grid.w + nx]);
  })) return;
  const nx = x > 0 ? x - 1 : x + 1;
  grid[y * meta.grid.w + nx] = CITY_TILE.PLAZA;
}

function reachableFrom(grid, start, meta) {
  const { w, h } = meta.grid;
  const seen = new Uint8Array(grid.length);
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const index = queue[head++];
    const x = index % w;
    const y = Math.floor(index / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      if (seen[next] || isCityBlocked(grid[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function collectComponent(grid, start, visited, meta) {
  const { w, h } = meta.grid;
  const queue = [start];
  const component = [];
  visited[start] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    component.push(index);
    const x = index % w;
    const y = Math.floor(index / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      if (visited[next] || isCityBlocked(grid[next])) continue;
      visited[next] = 1;
      queue.push(next);
    }
  }
  return component;
}

function connectToMain(grid, start, mainSeen, meta, city) {
  const { w, h } = meta.grid;
  const parent = new Int32Array(grid.length).fill(-1);
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
  let target = -1;
  queue[tail++] = start;
  parent[start] = start;
  while (head < tail && target < 0) {
    const index = queue[head++];
    const x = index % w;
    const y = Math.floor(index / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      if (parent[next] >= 0) continue;
      parent[next] = index;
      if (mainSeen[next]) {
        target = next;
        break;
      }
      queue[tail++] = next;
    }
  }
  if (target < 0) throw new Error(`Unable to connect ${city} walkable component`);
  for (let index = target; index !== start; index = parent[index]) {
    if (!isCityBlocked(grid[index])) continue;
    grid[index] = grid[index] === CITY_TILE.WATER || grid[index] === CITY_TILE.RIVER
      ? CITY_TILE.BRIDGE
      : CITY_TILE.ROAD;
  }
}

function normalizeWalkableComponents(grid, protectedTiles, mainTile, meta, city) {
  const mainStart = mainTile[1] * meta.grid.w + mainTile[0];
  const protectedIndexes = new Set(protectedTiles.map(([x, y]) => y * meta.grid.w + x));
  let mainSeen = reachableFrom(grid, mainStart, meta);
  const visited = mainSeen.slice();
  for (let index = 0; index < grid.length; index += 1) {
    if (visited[index] || isCityBlocked(grid[index])) continue;
    const component = collectComponent(grid, index, visited, meta);
    const protectedComponent = component.some((tileIndex) => protectedIndexes.has(tileIndex));
    if (component.length < 40 && !protectedComponent) {
      for (const tileIndex of component) grid[tileIndex] = CITY_TILE.BUILDING;
      continue;
    }
    connectToMain(grid, component[0], mainSeen, meta, city);
    mainSeen = reachableFrom(grid, mainStart, meta);
    for (let tileIndex = 0; tileIndex < visited.length; tileIndex += 1) {
      if (mainSeen[tileIndex]) visited[tileIndex] = 1;
    }
  }
  const finalSeen = reachableFrom(grid, mainStart, meta);
  for (let index = 0; index < grid.length; index += 1) {
    if (!isCityBlocked(grid[index]) && !finalSeen[index]) {
      throw new Error(`Disconnected ${city} walkable tile at ${index % meta.grid.w},${Math.floor(index / meta.grid.w)}`);
    }
  }
}

function applySnapshotMasks(grid, snapshot, meta) {
  const length = grid.length;
  const masks = {
    building: decodeTerrainRle(snapshot.buildingRle, length),
    road: decodeTerrainRle(snapshot.roadRle, length),
    water: decodeTerrainRle(snapshot.waterRle, length),
    river: decodeTerrainRle(snapshot.riverRle, length),
    park: decodeTerrainRle(snapshot.parkRle, length),
    mountain: decodeTerrainRle(snapshot.mountainRle, length),
  };
  for (let index = 0; index < length; index += 1) if (masks.water[index]) grid[index] = CITY_TILE.WATER;
  for (let index = 0; index < length; index += 1) if (masks.river[index]) grid[index] = CITY_TILE.RIVER;
  for (let index = 0; index < length; index += 1) {
    if (masks.mountain[index] && grid[index] !== CITY_TILE.WATER && grid[index] !== CITY_TILE.RIVER) grid[index] = CITY_TILE.MOUNTAIN;
  }
  for (let index = 0; index < length; index += 1) {
    if (masks.park[index] && grid[index] !== CITY_TILE.WATER && grid[index] !== CITY_TILE.RIVER) grid[index] = CITY_TILE.PARK;
  }
  for (let index = 0; index < length; index += 1) {
    if (masks.building[index] && grid[index] !== CITY_TILE.WATER && grid[index] !== CITY_TILE.RIVER) grid[index] = CITY_TILE.BUILDING;
  }
  for (let index = 0; index < length; index += 1) {
    const roadClass = masks.road[index];
    if (!roadClass) continue;
    if (grid[index] === CITY_TILE.WATER || grid[index] === CITY_TILE.RIVER) {
      if (roadClass >= 3) grid[index] = CITY_TILE.BRIDGE;
    }
    else if (roadClass >= 2) grid[index] = CITY_TILE.ROAD;
    else if (grid[index] !== CITY_TILE.BUILDING) grid[index] = CITY_TILE.SIDEWALK;
  }
  for (const [x, y] of snapshot.crossings) {
    const index = y * meta.grid.w + x;
    if (masks.road[index] >= 2 && grid[index] === CITY_TILE.ROAD) grid[index] = CITY_TILE.CROSSWALK;
  }
  return masks;
}

function hashString32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function tileHash32(seed, x, y) {
  let hash = seed ^ Math.imul(x + 1, 0x9e3779b1) ^ Math.imul(y + 1, 0x85ebca6b);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function terrainBuildingStats(terrain) {
  let landTileCount = 0;
  let buildingTileCount = 0;
  for (const code of terrain) {
    if (code === CITY_TILE.WATER || code === CITY_TILE.RIVER) continue;
    landTileCount += 1;
    if (code === CITY_TILE.BUILDING) buildingTileCount += 1;
  }
  return {
    landTileCount,
    buildingTileCount,
    landBuildingRatio: Number((buildingTileCount / landTileCount).toFixed(6)),
  };
}

function collectClosedRoadBlocks(roadMask, meta, seed) {
  const { w, h } = meta.grid;
  const seen = new Uint8Array(roadMask.length);
  const queue = new Int32Array(roadMask.length);
  const blocks = [];
  for (let start = 0; start < roadMask.length; start += 1) {
    if (roadMask[start] || seen[start]) continue;
    let head = 0;
    let tail = 0;
    let touchesBoundary = false;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const index = queue[head++];
      const x = index % w;
      const y = Math.floor(index / w);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBoundary = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const next = ny * w + nx;
        if (roadMask[next] || seen[next]) continue;
        seen[next] = 1;
        queue[tail++] = next;
      }
    }
    if (touchesBoundary || tail < BUILDING_TEXTURE_CONTRACT.blockMinTiles
      || tail > BUILDING_TEXTURE_CONTRACT.blockMaxTiles) continue;
    blocks.push({
      indexes: Array.from(queue.subarray(0, tail)),
      minX, minY, maxX, maxY,
      score: (tileHash32(seed, minX, minY) ^ tileHash32(seed, maxX, maxY)) >>> 0,
    });
  }
  blocks.sort((left, right) => left.score - right.score
    || left.minY - right.minY || left.minX - right.minX);
  return blocks;
}

function touchesRoad(roadMask, meta, index) {
  const { w, h } = meta.grid;
  const x = index % w;
  const y = Math.floor(index / w);
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && roadMask[ny * w + nx]) return true;
    }
  }
  return false;
}

function blockFillCandidates(terrain, roadMask, meta, block) {
  const { w } = meta.grid;
  const width = block.maxX - block.minX + 1;
  const height = block.maxY - block.minY + 1;
  const alleyX = block.minX + 2 + (block.score % Math.max(1, width - 4));
  const alleyY = block.minY + 2 + ((block.score >>> 8) % Math.max(1, height - 4));
  const preserveVerticalAlley = width >= 8 && (width >= height || block.indexes.length >= 240);
  const preserveHorizontalAlley = height >= 8 && (height > width || block.indexes.length >= 240);
  const candidates = [];
  let preservedAlleyTileCount = 0;
  for (const index of block.indexes) {
    if (terrain[index] !== CITY_TILE.SIDEWALK || roadMask[index] || touchesRoad(roadMask, meta, index)) continue;
    const x = index % w;
    const y = Math.floor(index / w);
    if ((preserveVerticalAlley && x === alleyX) || (preserveHorizontalAlley && y === alleyY)) {
      preservedAlleyTileCount += 1;
      continue;
    }
    candidates.push(index);
  }
  const corner = block.score & 3;
  const anchorX = corner & 1 ? block.maxX : block.minX;
  const anchorY = corner & 2 ? block.maxY : block.minY;
  candidates.sort((left, right) => {
    const leftX = left % w;
    const leftY = Math.floor(left / w);
    const rightX = right % w;
    const rightY = Math.floor(right / w);
    const leftDistance = Math.abs(leftX - anchorX) + Math.abs(leftY - anchorY);
    const rightDistance = Math.abs(rightX - anchorX) + Math.abs(rightY - anchorY);
    return leftDistance - rightDistance || leftY - rightY || leftX - rightX;
  });
  return { candidates, preservedAlleyTileCount };
}

function augmentBuildingTexture(terrain, masks, meta, city, targetBuildingTileCount) {
  const initial = terrainBuildingStats(terrain);
  if (initial.buildingTileCount >= targetBuildingTileCount) {
    return {
      ...initial, targetBuildingTileCount, generatedTileCount: 0,
      candidateBlockCount: 0, selectedBlockCount: 0, preservedAlleyTileCount: 0,
      selectedBlockFillRatioMin: 0, selectedBlockFillRatioMax: 0,
    };
  }

  const seed = hashString32(`${BUILDING_TEXTURE_CONTRACT.seedNamespace}:${city}`);
  const blocks = collectClosedRoadBlocks(masks.road, meta, seed);
  let buildingTileCount = initial.buildingTileCount;
  let selectedBlockCount = 0;
  let preservedAlleyTileCount = 0;
  let selectedBlockFillRatioMin = 1;
  let selectedBlockFillRatioMax = 0;
  for (const block of blocks) {
    if (buildingTileCount >= targetBuildingTileCount) break;
    const { candidates, preservedAlleyTileCount: blockAlleyTileCount } = blockFillCandidates(
      terrain, masks.road, meta, block,
    );
    if (candidates.length === 0) continue;
    const minimumFill = Math.ceil(candidates.length * BUILDING_TEXTURE_CONTRACT.blockFillRatioMin);
    const maximumFill = Math.floor(candidates.length * BUILDING_TEXTURE_CONTRACT.blockFillRatioMax);
    if (minimumFill > maximumFill) continue;
    const fillCount = minimumFill + ((block.score >>> 16) % (maximumFill - minimumFill + 1));
    for (let index = 0; index < fillCount; index += 1) {
      terrain[candidates[index]] = CITY_TILE.BUILDING;
      buildingTileCount += 1;
    }
    const fillRatio = fillCount / candidates.length;
    selectedBlockFillRatioMin = Math.min(selectedBlockFillRatioMin, fillRatio);
    selectedBlockFillRatioMax = Math.max(selectedBlockFillRatioMax, fillRatio);
    preservedAlleyTileCount += blockAlleyTileCount;
    selectedBlockCount += 1;
  }
  if (buildingTileCount < targetBuildingTileCount) {
    throw new Error(`${city} building infill candidates exhausted: ${buildingTileCount} < ${targetBuildingTileCount}`);
  }
  return {
    ...initial,
    targetBuildingTileCount,
    generatedTileCount: buildingTileCount - initial.buildingTileCount,
    candidateBlockCount: blocks.length,
    selectedBlockCount,
    preservedAlleyTileCount,
    selectedBlockFillRatioMin: Number(selectedBlockFillRatioMin.toFixed(6)),
    selectedBlockFillRatioMax: Number(selectedBlockFillRatioMax.toFixed(6)),
  };
}

export function buildTerrainFromSnapshot(snapshot) {
  const meta = { grid: snapshot.grid };
  const terrain = new Uint8Array(meta.grid.w * meta.grid.h).fill(CITY_TILE.SIDEWALK);
  applySnapshotMasks(terrain, snapshot, meta);
  return terrain;
}

function withTile(entry, meta, metrics) {
  return {
    ...entry,
    contentLocale: meta.contentLocale,
    lat: Number(entry.lat.toFixed(7)),
    lon: Number(entry.lon.toFixed(7)),
    tile: projectLatLonToTile(entry.lat, entry.lon, meta, metrics),
  };
}

function separateMarkerTiles(entries, meta, minDistance = 3) {
  const claimed = [];
  for (const entry of entries) {
    const [originX, originY] = entry.tile;
    const available = ([x, y]) => claimed.every(([claimedX, claimedY]) => (
      Math.max(Math.abs(x - claimedX), Math.abs(y - claimedY)) >= minDistance
    ));
    if (available(entry.tile)) {
      claimed.push(entry.tile);
      continue;
    }
    let snapped = null;
    for (let radius = 1; radius <= 8 && !snapped; radius += 1) {
      for (let dy = -radius; dy <= radius && !snapped; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const candidate = [originX + dx, originY + dy];
          if (candidate[0] < 0 || candidate[1] < 0 || candidate[0] >= meta.grid.w || candidate[1] >= meta.grid.h) continue;
          if (available(candidate)) {
            snapped = candidate;
            break;
          }
        }
      }
    }
    if (!snapped) throw new Error(`Unable to separate marker ${entry.id}`);
    entry.tile = snapped;
    claimed.push(snapped);
  }
}

function normalizeCityTerrain(terrain, protectedEntries, mainStation, entrance, exitTiles, meta, city) {
  for (const entry of protectedEntries) ensureWalkableAnchor(terrain, entry.tile, meta);
  for (let y = exitTiles[0][1]; y <= entrance.y; y += 1) terrain[y * meta.grid.w + entrance.x] = CITY_TILE.ROAD;
  normalizeWalkableComponents(terrain, protectedEntries.map((entry) => entry.tile), mainStation.tile, meta, city);
  for (const entry of protectedEntries) ensureWalkableAnchor(terrain, entry.tile, meta);
}

export function buildFrenchCityGeoBase(city) {
  const config = CITY_CONFIG[city];
  if (!config) throw new Error(`Unknown city: ${city}`);
  const snapshot = JSON.parse(fs.readFileSync(config.snapshot, 'utf8'));
  const metersPerTile = config.metersPerTile ?? DEFAULT_METERS_PER_TILE;
  const contentLocale = config.contentLocale ?? 'ko';
  const nameField = config.nameField ?? 'nameKo';
  const metrics = projectionMetrics(config.bbox, metersPerTile);
  const baseMeta = Object.freeze({
    city,
    bbox: config.bbox,
    grid: Object.freeze(metrics.grid),
    metersPerTile,
    projection: 'webmercator',
    aspectCorrection: Number(metrics.correction.toFixed(12)),
    contentLocale,
    schema: Object.freeze({ nameField, localeSlots: 'central-lookup-expandable' }),
    ...(config.localeAnchors ? { localeAnchors: Object.freeze([...config.localeAnchors]) } : {}),
    source: Object.freeze({ ...snapshot.source }),
  });
  if (JSON.stringify(snapshot.bbox) !== JSON.stringify(baseMeta.bbox) || snapshot.grid.w !== baseMeta.grid.w || snapshot.grid.h !== baseMeta.grid.h) {
    throw new Error(`${city} OSM snapshot projection contract mismatch`);
  }
  const pois = config.pois.map((entry) => withTile(entry, baseMeta, metrics));
  const stations = config.stations.map((entry) => withTile(entry, baseMeta, metrics));
  separateMarkerTiles([...pois, ...stations], baseMeta);
  const mainStation = stations.find((entry) => entry.id === config.mainStationId);
  const entrance = { x: mainStation.tile[0], y: mainStation.tile[1], facing: 'down' };
  const exitTiles = [[entrance.x, entrance.y - 10], [entrance.x, entrance.y - 9]];
  const terrain = new Uint8Array(baseMeta.grid.w * baseMeta.grid.h).fill(CITY_TILE.SIDEWALK);
  const masks = applySnapshotMasks(terrain, snapshot, baseMeta);
  const protectedEntries = [...pois, ...stations];
  const baselineTerrain = terrain.slice();
  normalizeCityTerrain(baselineTerrain, protectedEntries, mainStation, entrance, exitTiles, baseMeta, city);
  const initialBuildingStats = terrainBuildingStats(terrain);
  const baselineBuildingStats = terrainBuildingStats(baselineTerrain);
  const baselineNormalizationBuildingTiles = baselineBuildingStats.buildingTileCount - initialBuildingStats.buildingTileCount;
  const finalTargetBuildingTileCount = config.preserveExistingBuildings
    ? baselineBuildingStats.buildingTileCount
    : Math.ceil(baselineBuildingStats.landTileCount * BUILDING_TEXTURE_CONTRACT.targetLandRatio);
  const preNormalizationTargetBuildingTileCount = Math.max(
    initialBuildingStats.buildingTileCount,
    finalTargetBuildingTileCount - baselineNormalizationBuildingTiles,
  );
  const buildingTexture = augmentBuildingTexture(
    terrain, masks, baseMeta, city, preNormalizationTargetBuildingTileCount,
  );
  normalizeCityTerrain(terrain, protectedEntries, mainStation, entrance, exitTiles, baseMeta, city);
  const finalBuildingStats = terrainBuildingStats(terrain);
  const finalBuildingRatioRange = config.buildingRatioReportOnly
    ? null
    : (config.finalBuildingRatioRange ?? [0.09, 0.11]);
  if (finalBuildingRatioRange && (finalBuildingStats.landBuildingRatio < finalBuildingRatioRange[0]
    || finalBuildingStats.landBuildingRatio > finalBuildingRatioRange[1])) {
    throw new Error(`${city} final land/building ratio outside ${finalBuildingRatioRange.join('..')} gate: ${finalBuildingStats.landBuildingRatio}`);
  }
  const meta = Object.freeze({
    ...baseMeta,
    buildingTexture: Object.freeze({
      ...BUILDING_TEXTURE_CONTRACT,
      ...(config.buildingDatasetProbe ? { publicDatasetProbe: config.buildingDatasetProbe } : {}),
      ...(finalBuildingRatioRange ? { finalRatioRange: finalBuildingRatioRange } : {}),
      seed: `${BUILDING_TEXTURE_CONTRACT.seedNamespace}:${city}`,
      initialLandBuildingRatio: buildingTexture.landBuildingRatio,
      baselineNormalizationBuildingTiles,
      finalTargetBuildingTileCount,
      preNormalizationTargetBuildingTileCount: buildingTexture.targetBuildingTileCount,
      generatedTileCount: buildingTexture.generatedTileCount,
      candidateBlockCount: buildingTexture.candidateBlockCount,
      selectedBlockCount: buildingTexture.selectedBlockCount,
      preservedAlleyTileCount: buildingTexture.preservedAlleyTileCount,
      selectedBlockFillRatioMin: buildingTexture.selectedBlockFillRatioMin,
      selectedBlockFillRatioMax: buildingTexture.selectedBlockFillRatioMax,
      finalLandTileCount: finalBuildingStats.landTileCount,
      finalBuildingTileCount: finalBuildingStats.buildingTileCount,
      finalLandBuildingRatio: finalBuildingStats.landBuildingRatio,
    }),
  });
  const railwayMask = decodeTerrainRle(snapshot.railwayRle, terrain.length);
  return {
    meta, terrain, pois, stations, entrance, exitTiles,
    railways: { mask: railwayMask, tileCount: railwayMask.reduce((sum, code) => sum + Number(Boolean(code)), 0) },
  };
}
