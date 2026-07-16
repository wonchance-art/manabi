import { describe, expect, it } from 'vitest';
import { COTE_DAZUR_GEO } from '../cities/cote-dazur.geo.js';
import { createFrenchCityRuntimeAdapter } from '../cities/frenchCityRuntimeAdapter.js';
import { CITY_TILE } from '../cities/terrain.js';

function multilingualFixture() {
  return {
    meta: {
      city: 'brussels-fixture',
      grid: { w: 4, h: 3 },
      contentLocale: 'fr',
      schema: { nameField: 'nameFr', localeSlots: 'central-lookup-expandable' },
    },
    terrain: Uint8Array.from([
      CITY_TILE.SIDEWALK, CITY_TILE.ROAD, CITY_TILE.BUILDING, CITY_TILE.SIDEWALK,
      CITY_TILE.SIDEWALK, CITY_TILE.SIDEWALK, CITY_TILE.ROAD, CITY_TILE.SIDEWALK,
      CITY_TILE.WATER, CITY_TILE.SIDEWALK, CITY_TILE.SIDEWALK, CITY_TILE.SIDEWALK,
    ]),
    pois: [
      {
        id: 'central-square', nameFr: 'Place Centrale', nameNl: 'Centraal Plein',
        kind: 'plaza', contentLocale: 'fr', tile: [1, 1],
      },
      {
        id: 'city-museum', nameFr: 'Musée de la Ville', nameNl: 'Stadsmuseum',
        kind: 'museum', contentLocale: 'fr', tile: [2, 1],
      },
    ],
    stations: [
      {
        id: 'central-station', nameFr: 'Gare Centrale', nameNl: 'Centraal Station',
        nameJa: 'must-not-win', line: 'SNCB/NMBS', routeId: 'brussels-rail-fixture',
        contentLocale: 'fr', tile: [0, 1],
      },
    ],
    entrance: { x: 0, y: 1, facing: 'down' },
    exitTiles: [[0, 0]],
    railways: { mask: new Uint8Array(12), tileCount: 0 },
  };
}

function createFixture(options = {}) {
  return createFrenchCityRuntimeAdapter({
    id: 'brussels-fixture',
    displayName: 'Brussels fixture',
    geo: multilingualFixture(),
    returnNode: 'brussels-return-fixture',
    ...options,
  });
}

describe('French city runtime adapter', () => {
  it('현재 Côte geo를 공유 CityScene 데이터 계약으로 무손실 변환한다', () => {
    const city = createFrenchCityRuntimeAdapter({
      id: 'cote-dazur',
      displayName: "Côte d'Azur",
      geo: COTE_DAZUR_GEO,
      returnNode: 'cote-dazur-return-fixture',
    });

    expect(city).toMatchObject({
      id: 'cote-dazur', name: "Côte d'Azur", cols: 1571, rows: 1169,
      entrance: COTE_DAZUR_GEO.entrance, returnNode: 'cote-dazur-return-fixture',
    });
    expect(city.nodes).toHaveLength(18);
    expect(city.stations).toHaveLength(6);
    expect(city.nodes.find(({ id }) => id === 'place-massena')).toMatchObject({
      name: 'Place Masséna', nameFr: 'Place Masséna', contentLocale: 'fr', poiKind: 'plaza',
    });
    expect(city.stations.find(({ id }) => id === 'nice-ville')).toMatchObject({
      nameJa: 'Nice-Ville', nameFr: 'Nice-Ville', routeId: 'ter-cote-dazur', contentLocale: 'fr',
    });

    const sourceExit = COTE_DAZUR_GEO.exitTiles[0][1] * city.cols + COTE_DAZUR_GEO.exitTiles[0][0];
    const sourceValue = COTE_DAZUR_GEO.terrain[sourceExit];
    const first = city.buildGrid();
    const second = city.buildGrid();
    expect(first[sourceExit]).toBe(CITY_TILE.EXIT);
    expect(Buffer.from(second).equals(Buffer.from(first))).toBe(true);
    expect(COTE_DAZUR_GEO.terrain[sourceExit]).toBe(sourceValue);
    expect(first).not.toBe(COTE_DAZUR_GEO.terrain);
  });

  it('명시한 Dutch runtime label을 nameJa alias로 쓰면서 FR/NL 슬롯을 보존한다', () => {
    const city = createFixture({
      runtimeNameField: 'nameNl',
      displayLocale: 'nl',
      fallbackLocales: ['fr'],
      copyByLocale: {
        nl: {
          'central-square': { name: 'Centraal Plein · copy' },
        },
        fr: {
          'central-square': { desc: 'Description française de secours.' },
          'city-museum': { name: 'Musée de la Ville · copie', desc: 'Contenu français.' },
        },
      },
    });

    expect(city.nodes[0]).toMatchObject({
      name: 'Centraal Plein · copy', nameFr: 'Place Centrale', nameNl: 'Centraal Plein',
      contentLocale: 'fr', desc: 'Description française de secours.',
    });
    expect(city.nodes[1]).toMatchObject({
      name: 'Musée de la Ville · copie', nameFr: 'Musée de la Ville', nameNl: 'Stadsmuseum',
      desc: 'Contenu français.',
    });
    expect(city.stations[0]).toMatchObject({
      nameJa: 'Centraal Station', nameFr: 'Gare Centrale', nameNl: 'Centraal Station',
      routeId: 'brussels-rail-fixture',
    });
  });

  it('copy가 없으면 canonical nameField를 쓰되 임의 desc를 만들지 않는다', () => {
    const city = createFixture();
    expect(city.nodes[0]).toMatchObject({
      name: 'Place Centrale', nameFr: 'Place Centrale', nameNl: 'Centraal Plein',
    });
    expect(city.nodes[0]).not.toHaveProperty('desc');
    expect(city.stations[0].nameJa).toBe('Gare Centrale');
  });

  it('transit stop은 실제 station id만 참조하도록 고정한다', () => {
    const valid = createFixture({
      transit: [{ id: 'brussels-rail', stopIds: ['central-station'] }],
    });
    expect(valid.transit[0].stopIds).toEqual(['central-station']);
    expect(() => createFixture({
      transit: [{ id: 'broken-line', stopIds: ['missing-station'] }],
    })).toThrow('transit broken-line references unknown station missing-station');
  });

  it('city·locale name·marker·exit 계약 오류를 조기에 거부한다', () => {
    expect(() => createFrenchCityRuntimeAdapter({
      id: 'brussels-fixture', displayName: 'Brussels', geo: multilingualFixture(), returnNode: '',
    })).toThrow('returnNode is required');

    const wrongCity = multilingualFixture();
    wrongCity.meta.city = 'other-city';
    expect(() => createFrenchCityRuntimeAdapter({
      id: 'brussels-fixture', displayName: 'Brussels', geo: wrongCity, returnNode: 'return',
    })).toThrow('geo city other-city does not match brussels-fixture');

    const missingDutch = multilingualFixture();
    delete missingDutch.pois[0].nameNl;
    expect(() => createFrenchCityRuntimeAdapter({
      id: 'brussels-fixture', displayName: 'Brussels', geo: missingDutch,
      returnNode: 'return', runtimeNameField: 'nameNl',
    })).toThrow('central-square is missing nameNl');

    const duplicatePoi = multilingualFixture();
    duplicatePoi.pois[1].id = duplicatePoi.pois[0].id;
    expect(() => createFrenchCityRuntimeAdapter({
      id: 'brussels-fixture', displayName: 'Brussels', geo: duplicatePoi, returnNode: 'return',
    })).toThrow('duplicate POI id central-square');

    const badExit = multilingualFixture();
    badExit.exitTiles = [[4, 0]];
    expect(() => createFrenchCityRuntimeAdapter({
      id: 'brussels-fixture', displayName: 'Brussels', geo: badExit, returnNode: 'return',
    })).toThrow('exit 0 tile is outside the grid');

    expect(() => createFixture({ runtimeNameField: 'line' }))
      .toThrow('runtimeNameField must be a localized name field');
    expect(() => createFixture({ fallbackLocales: [null] }))
      .toThrow('fallbackLocales must contain locale strings');
  });
});
