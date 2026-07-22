export function cityBeachTextureKey(city) {
  return city?.tileSkins?.beach === 'mudflat' ? 'ct_beach_mudflat' : 'ct_beach';
}

function zoneBuildingSkin(city, tx, ty) {
  if (!Number.isInteger(tx) || !Number.isInteger(ty)) return undefined;
  const zones = Array.isArray(city?.zoneSkins) ? city.zoneSkins : [];
  for (const zone of zones) {
    const bounds = zone?.bounds;
    if (!Array.isArray(bounds) || bounds.length !== 4) continue;
    const [minX, minY, maxX, maxY] = bounds;
    if (tx < minX || tx > maxX || ty < minY || ty > maxY) continue;
    const skins = Array.isArray(zone.building) ? zone.building : [];
    if (skins.length === 0) return undefined;
    const hash = (Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663)) >>> 0;
    return skins[hash % skins.length];
  }
  return undefined;
}

export function cityBuildingSkinAt(city, tx, ty) {
  return zoneBuildingSkin(city, tx, ty) ?? city?.tileSkins?.building;
}

export function cityBuildingTextureKey(city, mask, tx, ty) {
  const skin = cityBuildingSkinAt(city, tx, ty);
  return skin ? `ct_bldg_${skin}_${mask}` : `ct_bldg_${mask}`;
}

export function cityWaterTextureKey(city, frame) {
  const skin = city?.tileSkins?.water;
  return skin ? `ct_water_${skin}${frame}` : `ct_water${frame}`;
}
