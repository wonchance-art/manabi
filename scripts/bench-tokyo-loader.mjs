import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { loadCity } from '../src/components/world/cities/manifest.js';
import { TOKYO_GEO } from '../src/components/world/cities/tokyo.geo.js';
import { OVERWORLD_CHUNK_FILE_BYTES } from '../src/lib/world/overworldChunk.js';

const source = await readFile(
  new URL('../src/components/world/cities/tokyo.geo.js', import.meta.url),
  'utf8',
);
const packed = [...source.matchAll(/(?:terrain|railway)Packed = "([A-Za-z0-9+/=]+)"/g)]
  .map((match) => Buffer.from(match[1], 'base64').byteLength);
const city = await loadCity('tokyo');
const grid = city.buildGrid();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const visits = 100;
const loaderEntries = 32;

process.stdout.write(`${JSON.stringify({
  schema: 'tokyo-loader-one-shot-v1',
  city: {
    id: city.id,
    cells: city.cols * city.rows,
    terrainBytes: TOKYO_GEO.terrain.byteLength,
    railwayBytes: city.railways.mask.byteLength,
    gridBytes: grid.byteLength,
    terrainSha256: sha256(TOKYO_GEO.terrain),
    railwaySha256: sha256(city.railways.mask),
    gridSha256: sha256(grid),
  },
  packedGeo: {
    moduleBytes: Buffer.byteLength(source),
    moduleSha256: sha256(source),
    terrainContainerBytes: packed[0],
    railwayContainerBytes: packed[1],
    containerBytes: packed[0] + packed[1],
  },
  overworldCache: {
    visits,
    loaderEntries,
    chunkBytes: OVERWORLD_CHUNK_FILE_BYTES,
    beforeResidentBytes: visits * OVERWORLD_CHUNK_FILE_BYTES,
    afterResidentBytes: loaderEntries * OVERWORLD_CHUNK_FILE_BYTES,
  },
})}\n`);
