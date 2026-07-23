import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { STAMP_ALBUM_NODES } from '../../../lib/world/stampUniverse.js';
import { buildCityScene } from '../CityScene.js';
import {
  CITY_DISTRICT_BOUNDARY_SIGN_MIN_SPACING,
  planCityDistrictBoundarySigns,
} from '../cityDistrictBoundarySigns.js';
import {
  CITY_DISTRICT_LOCK_DURATION_MS,
  cityDistrictOpenAt,
  resolveCityDistricts,
} from '../cityDistricts.js';
import { resolveCityMainRoute } from '../cityMainRoute.js';
import { CITY_MINI_SCALE, cityMinimapLayout } from '../cityMinimap.js';
import { CITY_DATA, CITY_MAPS } from '../cities/index.js';
import { CITY_TILE, isCityWalkable } from '../cities/terrain.js';
import { stampAlbumDistrictPresentation } from '../stampAlbumDistrictPresentation.js';

vi.mock('../QuestReview', () => ({
  GBC: { cream: '#f6edcf', ink: '#2a2118', font: 'monospace' },
}));

const LOCK_LINE = '이 동네는 아직 준비 중이에요 — 다음 여행에서 만나요.';
const T19_CITY_IDS = Object.freeze([
  'grand-paris', 'brussels', 'london', 'mont-saint-michel', 'geneva',
  'taipei', 'hong-kong', 'shanghai', 'beijing',
  'brisbane', 'sydney', 'canberra', 'melbourne',
]);
const DISTRICT_CITY_IDS = Object.freeze([
  'fukuoka', 'tokyo', 'osaka', 'kyoto', 'busan', 'seoul',
  'grand-paris', 'mont-saint-michel', 'cote-dazur', 'brussels',
  'taipei', 'hong-kong', 'london', 'shanghai', 'beijing',
  'brisbane', 'sydney', 'canberra', 'melbourne',
  'marseille', 'kawaguchiko', 'geneva',
  'leman-riviera', 'lyon', 'bordeaux', 'strasbourg',
]);
const EXPECTED_SIGN_COUNTS = Object.freeze([
  ['fukuoka', 113], ['tokyo', 519], ['osaka', 293], ['kyoto', 356],
  ['busan', 233], ['seoul', 429], ['grand-paris', 316],
  ['mont-saint-michel', 161], ['cote-dazur', 232], ['brussels', 96],
  ['taipei', 184], ['hong-kong', 85], ['london', 343], ['shanghai', 93],
  ['beijing', 102], ['brisbane', 65], ['sydney', 161], ['canberra', 157],
  ['melbourne', 119],
  ['marseille', 78], ['kawaguchiko', 108], ['geneva', 66], ['leman-riviera', 146], ['lyon', 61],
  ['bordeaux', 75], ['strasbourg', 63],
]);

const GAME_CANVAS_SOURCE = readFileSync(new URL('../GameCanvas.jsx', import.meta.url), 'utf8');
const POLICY_SOURCE = GAME_CANVAS_SOURCE.match(
  /export const cityMinimapLayoutForCity = ([\s\S]*?\n};)/,
)?.[1];

if (!POLICY_SOURCE) throw new Error('GameCanvas cityMinimapLayoutForCity policy not found');

const cityMinimapLayoutForCity = vm.runInNewContext(`(${POLICY_SOURCE.replace(/;$/, '')})`, {
  CITY_MINI_SCALE,
  cityMinimapLayout,
});

function chebyshev(first, second) {
  return Math.max(Math.abs(first[0] - second[0]), Math.abs(first[1] - second[1]));
}

function boundaryAdjacent(resolved, grid, signs) {
  return signs.length > 0 && signs.every(({ tile: [x, y] }) => (
    cityDistrictOpenAt(resolved, x, y)
    && isCityWalkable(grid[y * resolved.cols + x])
    && grid[y * resolved.cols + x] !== CITY_TILE.EXIT
    && [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]].some(([nx, ny]) => (
      nx >= 0 && ny >= 0 && nx < resolved.cols && ny < resolved.rows
      && !cityDistrictOpenAt(resolved, nx, ny)
    ))
  ));
}

function spacingValid(signs) {
  for (let first = 0; first < signs.length; first += 1) {
    for (let second = first + 1; second < signs.length; second += 1) {
      if (chebyshev(signs[first].tile, signs[second].tile)
        < CITY_DISTRICT_BOUNDARY_SIGN_MIN_SPACING) return false;
    }
  }
  return true;
}

function softWallLineExposed(city, resolved) {
  class FakeScene {
    constructor() {}
  }
  const Scene = buildCityScene({ Scene: FakeScene }, city, {});
  const scene = new Scene();
  const textCalls = [];
  const delayCalls = [];
  const toast = {
    setOrigin: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
  scene.districts = resolved;
  scene.districtLockNoticeShown = false;
  scene.scale = { width: 480 };
  scene.add = { text: vi.fn((...args) => { textCalls.push(args); return toast; }) };
  scene.time = {
    delayedCall: vi.fn((...args) => {
      delayCalls.push(args);
      return { remove: vi.fn() };
    }),
  };

  const first = scene.showDistrictLocked();
  const second = scene.showDistrictLocked();
  return first === true
    && second === false
    && textCalls.length === 1
    && textCalls[0][2] === resolved.locked.line
    && delayCalls.length === 1
    && delayCalls[0][0] === CITY_DISTRICT_LOCK_DURATION_MS;
}

function minimapLockSamples(city, resolved) {
  const layout = cityMinimapLayoutForCity(city.id, city.cols, city.rows);
  let open = 0;
  let locked = 0;
  for (let sy = 0; sy < layout.sourceHeight; sy += 1) {
    for (let sx = 0; sx < layout.sourceWidth; sx += 1) {
      const tx = Math.min(city.cols - 1, sx * layout.factor);
      const ty = Math.min(city.rows - 1, sy * layout.factor);
      if (cityDistrictOpenAt(resolved, tx, ty)) open += 1;
      else locked += 1;
    }
  }
  return { factor: layout.factor, open, locked };
}

function buildAuditManifest() {
  const cityNodeById = new Map(STAMP_ALBUM_NODES
    .filter((node) => node.gate?.type === 'city')
    .map((node) => [node.gate.to, node]));

  return CITY_MAPS.filter((city) => city.districts != null).map((city) => {
    const grid = city.buildGrid();
    const resolved = resolveCityDistricts(
      city,
      grid,
      resolveCityMainRoute(city, grid),
    );
    const signs = planCityDistrictBoundarySigns(resolved, grid);
    const minimap = minimapLockSamples(city, resolved);
    const album = stampAlbumDistrictPresentation(cityNodeById.get(city.id), CITY_DATA);
    const labels = resolved.open.map((district) => district.label);

    return {
      id: city.id,
      t19: T19_CITY_IDS.includes(city.id),
      signCount: signs.length,
      boundaryAdjacent: boundaryAdjacent(resolved, grid, signs),
      spacingValid: spacingValid(signs),
      lockLine: resolved.locked.line === LOCK_LINE && softWallLineExposed(city, resolved),
      minimap: minimap.open > 0 && minimap.locked > 0,
      minimapFactor: minimap.factor,
      minimapOpenSamples: minimap.open,
      minimapLockedSamples: minimap.locked,
      album: album?.countLabel === `개방 ${labels.length} 동네`
        && JSON.stringify(album.labels) === JSON.stringify(labels),
      albumLabelCount: album?.labels.length ?? 0,
    };
  });
}

describe('S18 지구제 24도시 팻말·표면 정합 read-only 감사', () => {
  it('팻말 경계·soft wall·미니맵 잠금 베이크·수첩 라벨을 24도시 전수 재현한다', () => {
    expect(GAME_CANVAS_SOURCE).toContain('if (city.districts) {');
    expect(GAME_CANVAS_SOURCE)
      .toContain('if (!cityDistrictOpenAt(resolved, tx, ty)) {');
    expect(GAME_CANVAS_SOURCE)
      .toContain("lctx.fillStyle = ((sx + sy) % 6 < 3)");
    expect(GAME_CANVAS_SOURCE)
      .toContain('if (showDistricts && lockOff) ctx.drawImage(lockOff, 0, 0, W, H);');

    const first = buildAuditManifest();
    const second = buildAuditManifest();
    const firstBytes = JSON.stringify(first);
    const secondBytes = JSON.stringify(second);

    expect(first.map(({ id }) => id)).toEqual(DISTRICT_CITY_IDS);
    expect(first.filter(({ t19 }) => t19).map(({ id }) => id).sort())
      .toEqual([...T19_CITY_IDS].sort());
    expect(first.map(({ id, signCount }) => [id, signCount]))
      .toEqual(EXPECTED_SIGN_COUNTS);
    expect(first.filter((row) => !(
      row.boundaryAdjacent
      && row.spacingValid
      && row.lockLine
      && row.minimap
      && row.album
    ))).toEqual([]);
    expect(firstBytes).toBe(secondBytes);
    expect(createHash('sha256').update(firstBytes).digest('hex'))
      .toBe('e2a090364454707e17e93c867926c19dce18bb19f8818378998743db0ac011e2');
  }, 30_000);
});
