export function cityBeachTextureKey(city) {
  return city?.tileSkins?.beach === 'mudflat' ? 'ct_beach_mudflat' : 'ct_beach';
}
