// 剣ヶ峯の先を同じ直線（金鳥居→剣ヶ峯 の緯度経度線形補間を t>1 に延長）で 20 m 間隔・1.5 km 取得し data.json に追加する。
// 판면 오른쪽 재단 여유 x213까지 잇기 위함(07-refine 지시 ⑤-2ⓒ). 표본에는 ext:true, 열람 시각은 accessedExtend(KST).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const file = new URL('./data.json', import.meta.url);
const data = JSON.parse(readFileSync(file, 'utf8'));
if (data.samples.some((p) => p.ext)) throw new Error('already extended');
const a = data.points.kanadorii, b = data.points.kengamine;
const L = data.segLengths_m[1], base = data.segLengths_m[0];
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const add = [];
for (let e = 20; e <= 1500 + 0.5; e += 20) {
  const t = (L + e) / L, d = +(base + L + e).toFixed(1);
  const p = { seg: 2, lat: +(a.lat + (b.lat - a.lat) * t).toFixed(7), lon: +(a.lon + (b.lon - a.lon) * t).toFixed(7), d, ext: true };
  const url = `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${p.lon}&lat=${p.lat}&outtype=JSON`;
  for (let k = 0; k < 4; k++) {
    try { const j = JSON.parse(execFileSync('curl', ['-sS', '--max-time', '20', url], { encoding: 'utf8' })); p.h = typeof j.elevation === 'number' ? j.elevation : null; p.hsrc = j.hsrc ?? String(j.elevation); break; }
    catch { sleep(2000); }
  }
  if (p.h === undefined) throw new Error('fetch failed ' + url);
  add.push(p); process.stdout.write('.'); sleep(350);
}
data.samples = [...data.samples, ...add].sort((x, y) => x.d - y.d);
data.accessedExtend = new Date(Date.now() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 19) + ' KST';
data.method += ' 剣ヶ峯の先は同じ直線（金鳥居→剣ヶ峯の延長）を20 m間隔で1.5 km（fetch-extend.mjs、ext:true）。';
writeFileSync(file, JSON.stringify(data, null, 1));
console.log('\n+', add.length, data.accessedExtend);
