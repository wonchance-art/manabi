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

async function readUniqueSegments(directory, content) {
  const unique = new Map();
  for (const entry of content.overlays) {
    const overlay = JSON.parse(await readFile(path.join(directory, entry.path), 'utf8'));
    for (const segment of overlay.segments) unique.set(segment.id, segment);
  }
  return unique;
}

function segmentPaths({ segments, quantization, scaleX, scaleY, color, widthAtRank }) {
  return [...segments.values()].map((segment) => {
    const x1 = segment.start[0] / quantization * scaleX;
    const y1 = segment.start[1] / quantization * scaleY;
    const x2 = segment.end[0] / quantization * scaleX;
    const y2 = segment.end[1] / quantization * scaleY;
    return `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}" stroke="${color}" stroke-width="${widthAtRank(segment.scaleRank).toFixed(2)}"/>`;
  }).join('');
}

function boundaryPaths({ segments, quantization, scaleX, scaleY }) {
  return [...segments.values()].map((segment) => {
    const x1 = segment.start[0] / quantization * scaleX;
    const y1 = segment.start[1] / quantization * scaleY;
    const x2 = segment.end[0] / quantization * scaleX;
    const y2 = segment.end[1] / quantization * scaleY;
    const disputed = segment.boundaryClass === 'neutral-disputed';
    const dash = disputed ? ' stroke-dasharray="2.4 2"' : '';
    const color = disputed ? '#8a817a' : '#6f665f';
    return `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}" stroke="${color}" stroke-width="${disputed ? '0.75' : '0.6'}"${dash}/>`;
  }).join('');
}

export async function renderTerrainPreview({
  inputDir,
  outputFile,
  targetWidth = 1200,
  transportDir = null,
  playabilityDir = null,
  boundaryDir = null,
}) {
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

  let viewOnlyLandTileCount = 0;
  if (playabilityDir) {
    const playability = JSON.parse(await readFile(path.join(playabilityDir, 'content-manifest.json'), 'utf8'));
    if (playability.width !== manifest.width || playability.height !== manifest.height) {
      throw new Error('playability preview dimensions do not match terrain');
    }
    for (const entry of playability.chunks) {
      const chunk = decodeOverworldChunkV1(await readFile(path.join(playabilityDir, entry.path)));
      const originX = entry.cx * OVERWORLD_STORAGE_CHUNK_TILES;
      const originY = entry.cy * OVERWORLD_STORAGE_CHUNK_TILES;
      for (let y = 0; y < entry.validBounds.y1; y += 1) {
        for (let x = 0; x < entry.validBounds.x1; x += 1) {
          if (chunk.surfaceAt(x, y) === 0 || chunk.viewOnlyAt(x, y) !== 1) continue;
          viewOnlyLandTileCount += 1;
          const offset = ((originY + y) * manifest.width + originX + x) * 3;
          raw[offset] = 184;
          raw[offset + 1] = 98;
          raw[offset + 2] = 150;
        }
      }
    }
  }

  const uniqueSegments = await readUniqueSegments(inputDir, manifest);
  const targetHeight = Math.max(1, Math.round(targetWidth * manifest.height / manifest.width));
  const scaleX = targetWidth / manifest.width;
  const scaleY = targetHeight / manifest.height;
  const quantization = manifest.riverRules.quantization;
  const lines = segmentPaths({
    segments: uniqueSegments,
    quantization,
    scaleX,
    scaleY,
    color: '#72b8d5',
    widthAtRank: (scaleRank) => Math.max(0.35, (6 - scaleRank) * 0.14),
  });
  let railSegmentCount = 0;
  let railLines = '';
  if (transportDir) {
    const transport = JSON.parse(await readFile(path.join(transportDir, 'content-manifest.json'), 'utf8'));
    if (transport.width !== manifest.width || transport.height !== manifest.height) {
      throw new Error('transport preview dimensions do not match terrain');
    }
    const railSegments = await readUniqueSegments(transportDir, transport);
    railSegmentCount = railSegments.size;
    railLines = segmentPaths({
      segments: railSegments,
      quantization: transport.railRules.quantization,
      scaleX,
      scaleY,
      color: '#493d34',
      widthAtRank: (scaleRank) => Math.max(0.45, (7 - scaleRank) * 0.18),
    });
  }
  let boundarySegmentCount = 0;
  let boundaryLines = '';
  if (boundaryDir) {
    const boundary = JSON.parse(await readFile(path.join(boundaryDir, 'content-manifest.json'), 'utf8'));
    if (boundary.width !== manifest.width || boundary.height !== manifest.height) {
      throw new Error('boundary preview dimensions do not match terrain');
    }
    const boundarySegments = await readUniqueSegments(boundaryDir, boundary);
    boundarySegmentCount = boundarySegments.size;
    boundaryLines = boundaryPaths({
      segments: boundarySegments,
      quantization: boundary.boundaryRules.quantization,
      scaleX,
      scaleY,
    });
  }
  const riverSvg = Buffer.from(`<svg width="${targetWidth}" height="${targetHeight}" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke-linecap="round">${lines}${boundaryLines}${railLines}</g></svg>`);

  await sharp(raw, { raw: { width: manifest.width, height: manifest.height, channels: 3 } })
    .resize(targetWidth, targetHeight, { kernel: sharp.kernel.nearest })
    .composite([{ input: riverSvg }])
    .png()
    .toFile(outputFile);
  return Object.freeze({
    width: targetWidth,
    height: targetHeight,
    riverSegmentCount: uniqueSegments.size,
    railSegmentCount,
    boundarySegmentCount,
    viewOnlyLandTileCount,
  });
}

async function main() {
  const [inputDir, outputFile, widthInput, transportDir, playabilityDir, boundaryDir] = process.argv.slice(2);
  if (!inputDir || !outputFile) {
    throw new Error('usage: node scripts/world/render-overworld-terrain-preview.mjs <input-dir> <output.png> [width] [transport-dir] [playability-dir] [boundary-dir]');
  }
  const result = await renderTerrainPreview({
    inputDir: path.resolve(inputDir),
    outputFile: path.resolve(outputFile),
    targetWidth: widthInput === undefined ? 1200 : Number(widthInput),
    transportDir: transportDir ? path.resolve(transportDir) : null,
    playabilityDir: playabilityDir ? path.resolve(playabilityDir) : null,
    boundaryDir: boundaryDir ? path.resolve(boundaryDir) : null,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
