export const CITY_MINI_SCALE = 3;

const LARGE_CITY_THRESHOLD = 1_000_000;
const LARGE_CITY_SOURCE_TARGET = 500_000;

const TILE_PRIORITY = Object.freeze({
  0: 7,
  1: 0,
  2: 8,
  3: 7,
  4: 3,
  5: 9,
  6: 9,
  7: 10,
  8: 5,
  9: 2,
  10: 4,
  11: 6,
  12: 4,
  13: 4,
});

export function cityMinimapLayout(cols, rows) {
  const cells = cols * rows;
  const factor = cells > LARGE_CITY_THRESHOLD
    ? Math.ceil(Math.sqrt(cells / LARGE_CITY_SOURCE_TARGET))
    : 1;
  const sourceWidth = Math.ceil(cols / factor);
  const sourceHeight = Math.ceil(rows / factor);
  const width = sourceWidth * CITY_MINI_SCALE;
  const height = sourceHeight * CITY_MINI_SCALE;
  return {
    factor,
    sourceWidth,
    sourceHeight,
    width,
    height,
    backingBytes: width * height * 4,
  };
}

export function downsampleCityGrid(grid, cols, rows, factor) {
  if (factor === 1) return { codes: grid, width: cols, height: rows };
  const width = Math.ceil(cols / factor);
  const height = Math.ceil(rows / factor);
  const codes = new Uint8Array(width * height);
  const priorities = new Int8Array(width * height);
  priorities.fill(-1);
  for (let y = 0; y < rows; y += 1) {
    const targetY = Math.floor(y / factor);
    for (let x = 0; x < cols; x += 1) {
      const code = grid[y * cols + x];
      const target = targetY * width + Math.floor(x / factor);
      const priority = TILE_PRIORITY[code] ?? 0;
      if (priority < priorities[target]) continue;
      codes[target] = code;
      priorities[target] = priority;
    }
  }
  return { codes, width, height };
}
