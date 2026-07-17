export const CITY_SCALE_TIERS = Object.freeze({
  standard: Object.freeze({ id: 'city-standard-20m-v1', metersPerTile: 20 }),
  precision: Object.freeze({ id: 'city-precision-4m-v1', metersPerTile: 4 }),
});

const TIERS_BY_METERS = new Map(
  Object.values(CITY_SCALE_TIERS).map((tier) => [tier.metersPerTile, tier]),
);

export function cityScaleTier(metersPerTile = CITY_SCALE_TIERS.standard.metersPerTile) {
  if (typeof metersPerTile !== 'number' || !Number.isFinite(metersPerTile)) {
    throw new TypeError(`city metersPerTile must be a finite number: ${String(metersPerTile)}`);
  }
  const tier = TIERS_BY_METERS.get(metersPerTile);
  if (!tier) throw new RangeError(`unsupported city metersPerTile: ${metersPerTile}`);
  return tier;
}

export function cityMetersPerTile(source) {
  if (typeof source === 'number') return cityScaleTier(source).metersPerTile;
  const metersPerTile = source?.metersPerTile
    ?? source?.meta?.metersPerTile
    ?? CITY_SCALE_TIERS.standard.metersPerTile;
  return cityScaleTier(metersPerTile).metersPerTile;
}
