// 도시 미니맵 factor 복귀안 A/B 크롭 렌더러.
// 같은 252×252 world-tile 범위를 504×504 PNG로 정규화해 factor만 비교한다.
// 구역 텍스트는 OS 글꼴에 따른 hash 변동을 피하려고 제외하고, 지형·철도·역만 그린다.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { downsampleCityGrid } from '../../src/components/world/cityMinimap.js';
import { TOKYO } from '../../src/components/world/cities/tokyo.js';
import { COTE_DAZUR } from '../../src/components/world/cities/cote-dazur.js';

const CITY_MINI_SCALE = 3;
const CROP_TILES = 252;
const PREVIEW_SCALE = 2;
const PREVIEW_SIZE = CROP_TILES * PREVIEW_SCALE;

const CITY_MINI_COLORS = Object.freeze({
  0: [55, 60, 70],
  1: [213, 203, 181],
  2: [230, 224, 210],
  3: [216, 196, 140],
  4: [120, 180, 90],
  5: [150, 120, 80],
  6: [140, 100, 60],
  7: [90, 200, 90],
  8: [60, 130, 170],
  9: [82, 78, 74],
  10: [110, 165, 80],
  11: [63, 122, 106],
  12: [232, 214, 166],
  13: [58, 92, 76],
});

const RAIL_COLOR = [61, 48, 40];
const STATION_BORDER = [246, 237, 207];
const STATION_FILL = [47, 154, 208];

const CASES = Object.freeze([
  {
    city: TOKYO,
    label: 'Tokyo',
    crop: { left: 354, top: 198 },
    variants: [
      { name: 'current', factor: 1 },
      { name: 'proposed', factor: 2 },
    ],
  },
  {
    city: COTE_DAZUR,
    label: "Cote d'Azur",
    crop: { left: 684, top: 126 },
    variants: [
      { name: 'current', factor: 2 },
      { name: 'proposed', factor: 3 },
    ],
  },
]);

const crcTable = (() => {
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const value of buffer) c = crcTable[(c ^ value) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodeRgbPng(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1);
    raw[row] = 0;
    pixels.copy(raw, row + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function sampledRailMask(city, factor, width, height) {
  const sampled = new Uint8Array(width * height);
  const rail = city.railways?.mask;
  if (!rail) return sampled;
  for (let index = 0; index < rail.length; index += 1) {
    if (!rail[index]) continue;
    const x = index % city.cols;
    const y = Math.floor(index / city.cols);
    sampled[Math.floor(y / factor) * width + Math.floor(x / factor)] = 1;
  }
  return sampled;
}

function layoutForFactor(city, factor) {
  const sourceWidth = Math.ceil(city.cols / factor);
  const sourceHeight = Math.ceil(city.rows / factor);
  const width = sourceWidth * CITY_MINI_SCALE;
  const height = sourceHeight * CITY_MINI_SCALE;
  return {
    factor,
    sourceWidth,
    sourceHeight,
    sourcePixels: sourceWidth * sourceHeight,
    width,
    height,
    backingBytes: width * height * 4,
  };
}

function putPixel(pixels, x, y, color) {
  if (x < 0 || y < 0 || x >= PREVIEW_SIZE || y >= PREVIEW_SIZE) return;
  const offset = (y * PREVIEW_SIZE + x) * 3;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
}

function fillRect(pixels, x, y, width, height, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) putPixel(pixels, px, py, color);
  }
}

function renderCrop(city, factor, crop) {
  if (crop.left < 0 || crop.top < 0
      || crop.left + CROP_TILES > city.cols || crop.top + CROP_TILES > city.rows) {
    throw new Error(`${city.id}: crop is outside ${city.cols}x${city.rows}`);
  }

  const grid = city.buildGrid();
  const sampled = downsampleCityGrid(grid, city.cols, city.rows, factor);
  const railway = sampledRailMask(city, factor, sampled.width, sampled.height);
  const pixels = Buffer.alloc(PREVIEW_SIZE * PREVIEW_SIZE * 3);
  const visibleCodes = new Set();
  const visibleRailCells = new Set();
  let terrainTransitions = 0;

  const sampledCodeAt = (tileX, tileY) => {
    const sx = Math.floor(tileX / factor);
    const sy = Math.floor(tileY / factor);
    return sampled.codes[sy * sampled.width + sx];
  };

  for (let tileY = 0; tileY < CROP_TILES; tileY += 1) {
    for (let tileX = 0; tileX < CROP_TILES; tileX += 1) {
      const worldX = crop.left + tileX;
      const worldY = crop.top + tileY;
      const sx = Math.floor(worldX / factor);
      const sy = Math.floor(worldY / factor);
      const sampledIndex = sy * sampled.width + sx;
      const code = sampled.codes[sampledIndex];
      const hasRail = railway[sampledIndex] === 1;
      visibleCodes.add(code);
      if (hasRail) visibleRailCells.add(sampledIndex);
      const color = hasRail ? RAIL_COLOR : (CITY_MINI_COLORS[code] ?? CITY_MINI_COLORS[1]);
      fillRect(
        pixels,
        tileX * PREVIEW_SCALE,
        tileY * PREVIEW_SCALE,
        PREVIEW_SCALE,
        PREVIEW_SCALE,
        color,
      );
      if (tileX > 0 && code !== sampledCodeAt(worldX - 1, worldY)) terrainTransitions += 1;
      if (tileY > 0 && code !== sampledCodeAt(worldX, worldY - 1)) terrainTransitions += 1;
    }
  }

  let stationCount = 0;
  for (const station of city.stations ?? []) {
    const localX = (station.tile[0] - crop.left) * PREVIEW_SCALE;
    const localY = (station.tile[1] - crop.top) * PREVIEW_SCALE;
    if (localX < 0 || localY < 0 || localX >= PREVIEW_SIZE || localY >= PREVIEW_SIZE) continue;
    stationCount += 1;
    fillRect(pixels, Math.round(localX) - 2, Math.round(localY) - 2, 5, 5, STATION_BORDER);
    fillRect(pixels, Math.round(localX) - 1, Math.round(localY) - 1, 3, 3, STATION_FILL);
  }

  return {
    png: encodeRgbPng(PREVIEW_SIZE, PREVIEW_SIZE, pixels),
    metrics: {
      cropTiles: `${CROP_TILES}x${CROP_TILES}`,
      previewPixels: `${PREVIEW_SIZE}x${PREVIEW_SIZE}`,
      visibleSampleCells: (CROP_TILES / factor) ** 2,
      visibleTerrainCodes: [...visibleCodes].sort((a, b) => a - b),
      terrainTransitions,
      railwaySampleCells: visibleRailCells.size,
      stationCount,
    },
  };
}

export function renderFactorAb(outputDirectory) {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const manifest = [];
  for (const entry of CASES) {
    for (const variant of entry.variants) {
      const { png, metrics } = renderCrop(entry.city, variant.factor, entry.crop);
      const filename = `minimap-factor-ab-${entry.city.id}-${variant.name}.png`;
      const outputPath = path.join(outputDirectory, filename);
      fs.writeFileSync(outputPath, png);
      manifest.push({
        city: entry.city.id,
        label: entry.label,
        variant: variant.name,
        crop: { ...entry.crop, width: CROP_TILES, height: CROP_TILES },
        layout: layoutForFactor(entry.city, variant.factor),
        metrics,
        filename,
        bytes: png.length,
        sha256: crypto.createHash('sha256').update(png).digest('hex'),
      });
    }
  }
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const outputDirectory = path.resolve(process.argv[2] ?? 'docs/img');
  console.log(JSON.stringify(renderFactorAb(outputDirectory), null, 2));
}
