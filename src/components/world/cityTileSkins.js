export function cityBeachTextureKey(city) {
  return city?.tileSkins?.beach === 'mudflat' ? 'ct_beach_mudflat' : 'ct_beach';
}

export function cityBuildingTextureKey(city, mask) {
  const skin = city?.tileSkins?.building;
  return skin ? `ct_bldg_${skin}_${mask}` : `ct_bldg_${mask}`;
}

export function cityWaterTextureKey(city, frame) {
  const skin = city?.tileSkins?.water;
  return skin ? `ct_water_${skin}${frame}` : `ct_water${frame}`;
}
