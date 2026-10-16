// 国土地理院 標高API から 下吉田駅→金鳥居→剣ヶ峯 の直線2区間上の標高を取得し data.json に保存。
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const P = {
  shimoyoshida: { name: '下吉田駅', lat: 35.49773, lon: 138.80353 },
  kanadorii: { name: '金鳥居', lat: 35.4832112, lon: 138.7979629 },
  kengamine: { name: '剣ヶ峯', lat: 35.360738, lon: 138.727373 },
};
const R = 6371008.8, rad = d => d * Math.PI / 180;
function dist(a, b) { // haversine (m)
  const dφ = rad(b.lat - a.lat), dλ = rad(b.lon - a.lon);
  const h = Math.sin(dφ/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dλ/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const segs = [[P.shimoyoshida, P.kanadorii, 50], [P.kanadorii, P.kengamine, 100]];
const pts = []; let base = 0;
segs.forEach(([a, b, step], si) => {
  const L = dist(a, b), n = Math.max(1, Math.round(L / step));
  for (let i = (si === 0 ? 0 : 1); i <= n; i++) {
    const t = i / n; // 直線（緯度経度の線形補間。区間長 ≤15 km で大円との差は無視できる）
    pts.push({ seg: si, lat: +(a.lat + (b.lat - a.lat) * t).toFixed(7), lon: +(a.lon + (b.lon - a.lon) * t).toFixed(7), d: +(base + L * t).toFixed(1),
      mark: (si === 0 && i === 0) ? 'shimoyoshida' : (i === n ? (si === 0 ? 'kanadorii' : 'kengamine') : undefined) });
  }
  base += L;
});
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
for (const p of pts) {
  const url = `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${p.lon}&lat=${p.lat}&outtype=JSON`;
  let ok = false;
  for (let k = 0; k < 4 && !ok; k++) {
    try {
      const out = execFileSync('curl', ['-sS', '--max-time', '20', url], { encoding: 'utf8' });
      const j = JSON.parse(out);
      if (typeof j.elevation === 'number') { p.h = j.elevation; p.hsrc = j.hsrc; ok = true; }
      else { p.h = null; p.hsrc = String(j.elevation); ok = true; }
    } catch (e) { sleep(2000); }
  }
  if (!ok) throw new Error('fetch failed ' + url);
  process.stdout.write('.');
  sleep(350);
}
const kst = new Date(Date.now() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 19) + ' KST';
writeFileSync(new URL('./data.json', import.meta.url), JSON.stringify({
  source: '国土地理院 標高API（getelevation.php）https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php',
  sourceDoc: 'https://maps.gsi.go.jp/development/elevation_s.html',
  accessed: kst,
  method: '下吉田駅→金鳥居（50 m間隔）→剣ヶ峯（100 m間隔）の直線2区間。緯度経度を線形補間した点の標高。距離はハバーサイン（球半径6371008.8 m）。',
  points: P, segLengths_m: segs.map(([a, b]) => +dist(a, b).toFixed(1)), samples: pts,
}, null, 1));
console.log('\n', pts.length, kst);
