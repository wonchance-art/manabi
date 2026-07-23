export const TILE_FIX_MANIFEST_VERSION = 1;

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

function assertInteger(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new TypeError(`${field} must be an integer from ${min} to ${max}`);
  }
}

function validateManifest(grid, manifest) {
  if ((!Array.isArray(grid) && !ArrayBuffer.isView(grid))
    || typeof grid.length !== 'number' || typeof grid.slice !== 'function') {
    throw new TypeError('grid must be an array or typed array');
  }
  if (!manifest || typeof manifest !== 'object') {
    throw new TypeError('manifest must be an object');
  }
  if (manifest.version !== TILE_FIX_MANIFEST_VERSION) {
    throw new Error(`Unsupported tile fix manifest version: ${manifest.version}`);
  }
  assertNonEmptyString(manifest.city, 'manifest.city');
  assertNonEmptyString(manifest.scannerVersion, 'manifest.scannerVersion');
  if (!manifest.grid || typeof manifest.grid !== 'object') {
    throw new TypeError('manifest.grid must be an object');
  }
  assertInteger(manifest.grid.w, 'manifest.grid.w', { min: 1 });
  assertInteger(manifest.grid.h, 'manifest.grid.h', { min: 1 });
  if (manifest.grid.w * manifest.grid.h !== grid.length) {
    throw new Error(
      `Tile fix grid length mismatch: ${grid.length} !== ${manifest.grid.w}x${manifest.grid.h}`,
    );
  }
  if (!Array.isArray(manifest.fixes)) {
    throw new TypeError('manifest.fixes must be an array');
  }
}

function validateFix(fix, manifest, index) {
  const prefix = `manifest.fixes[${index}]`;
  if (!fix || typeof fix !== 'object') {
    throw new TypeError(`${prefix} must be an object`);
  }
  assertNonEmptyString(fix.findingId, `${prefix}.findingId`);
  assertNonEmptyString(fix.city, `${prefix}.city`);
  assertNonEmptyString(fix.ruleId, `${prefix}.ruleId`);
  assertNonEmptyString(fix.scannerVersion, `${prefix}.scannerVersion`);
  assertInteger(fix.x, `${prefix}.x`, { max: manifest.grid.w - 1 });
  assertInteger(fix.y, `${prefix}.y`, { max: manifest.grid.h - 1 });
  assertInteger(fix.before, `${prefix}.before`, { max: 255 });
  assertInteger(fix.after, `${prefix}.after`, { max: 255 });
  if (fix.city !== manifest.city) {
    throw new Error(`${prefix}.city must match manifest.city`);
  }
  if (fix.scannerVersion !== manifest.scannerVersion) {
    throw new Error(`${prefix}.scannerVersion must match manifest.scannerVersion`);
  }
  if (fix.before === fix.after) {
    throw new Error(`${prefix} must change the tile code`);
  }
}

function canonicalFixOrder(left, right) {
  return left.fix.y - right.fix.y
    || left.fix.x - right.fix.x
    || (left.fix.findingId < right.fix.findingId ? -1
      : Number(left.fix.findingId > right.fix.findingId));
}

export function applyTileFixes(grid, manifest) {
  validateManifest(grid, manifest);
  if (manifest.fixes.length === 0) return grid;

  const fixes = manifest.fixes.map((fix, index) => {
    validateFix(fix, manifest, index);
    return { fix, index };
  }).sort(canonicalFixOrder);
  const occupied = new Set();
  for (const { fix } of fixes) {
    const tileIndex = fix.y * manifest.grid.w + fix.x;
    if (occupied.has(tileIndex)) {
      throw new Error(`Duplicate tile fix coordinate: ${fix.x},${fix.y}`);
    }
    occupied.add(tileIndex);
    if (grid[tileIndex] !== fix.before) {
      throw new Error(
        `Tile fix ${fix.findingId} expected ${fix.before} at ${fix.x},${fix.y}, `
          + `received ${grid[tileIndex]}`,
      );
    }
  }

  const fixedGrid = grid.slice();
  for (const { fix } of fixes) {
    fixedGrid[fix.y * manifest.grid.w + fix.x] = fix.after;
  }
  return fixedGrid;
}
