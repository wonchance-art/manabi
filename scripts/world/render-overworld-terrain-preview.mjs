import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { decodeOverworldChunkV1, OVERWORLD_STORAGE_CHUNK_TILES } from '../../src/lib/world/overworldChunk.js';

const COLORS = Object.freeze([
  [51, 103, 145],
  [114, 158, 95],
  [161, 156, 91],
  [139, 103, 71],
  [224, 226, 218],
]);

export async function renderTerrainPreview({ inputDir, outputFile, targetWidth = 1200 }) {
  const manifest = JSON.parse(await readFile(path.join(inputDir, 'content-manifest.json'), 'utf8'));
  const raw = Buffer.alloc(manifest.width * manifest.height * 3);
  for (const entry of manifest.chunks) {
    const chunk = decodeOverworldChunkV1(await readFile(path.join(inputDir, entry.path)));
    const originX = entry.cx * OVERWORLD_STORAGE_CHUNK_TILES;
    const originY = entry.cy * OVERWORLD_STORAGE_CHUNK_TILES;
    for (let y = 0; y < entry.validBounds.y1; y += 1) {
      for (let x = 0; x < entry.validBounds.x1; x += 1) {
        const surface = chunk.surfaceAt(x, y);
        const color = COLORS[surface];
        if (!color) throw new Error(`unknown terrain class ${surface}`);
        const offset = ((originY + y) * manifest.width + originX + x) * 3;
        raw[offset] = color[0];
        raw[offset + 1] = color[1];
        raw[offset + 2] = color[2];
      }
    }
  }

  const uniqueSegments = new Map();
  for (const entry of manifest.overlays) {
    const overlay = JSON.parse(await readFile(path.join(inputDir, entry.path), 'utf8'));
    for (const segment of overlay.segments) uniqueSegments.set(segment.id, segment);
  }
  const targetHeight = Math.max(1, Math.round(targetWidth * manifest.height / manifest.width));
  const scaleX = targetWidth / manifest.width;
  const scaleY = targetHeight / manifest.height;
  const quantization = manifest.riverRules.quantization;
  const lines = [...uniqueSegments.values()].map((segment) => {
    const x1 = segment.start[0] / quantization * scaleX;
    const y1 = segment.start[1] / quantization * scaleY;
    const x2 = segment.end[0] / quantization * scaleX;
    const y2 = segment.end[1] / quantization * scaleY;
    const width = Math.max(0.35, (6 - segment.scaleRank) * 0.14);
    return `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}" stroke="#72b8d5" stroke-width="${width.toFixed(2)}"/>`;
  }).join('');
  const riverSvg = Buffer.from(`<svg width="${targetWidth}" height="${targetHeight}" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke-linecap="round">${lines}</g></svg>`);

  await sharp(raw, { raw: { width: manifest.width, height: manifest.height, channels: 3 } })
    .resize(targetWidth, targetHeight, { kernel: sharp.kernel.nearest })
    .composite([{ input: riverSvg }])
    .png()
    .toFile(outputFile);
  return Object.freeze({ width: targetWidth, height: targetHeight, riverSegmentCount: uniqueSegments.size });
}

async function main() {
  const [inputDir, outputFile, widthInput] = process.argv.slice(2);
  if (!inputDir || !outputFile) {
    throw new Error('usage: node scripts/world/render-overworld-terrain-preview.mjs <input-dir> <output.png> [width]');
  }
  const result = await renderTerrainPreview({
    inputDir: path.resolve(inputDir),
    outputFile: path.resolve(outputFile),
    targetWidth: widthInput === undefined ? 1200 : Number(widthInput),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
