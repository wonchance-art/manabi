// 山頂部(剣ヶ峯 手前 1.0 km)를 20 m 간격으로 보강 — 100 m 간격으로는 火口(お鉢)의 바닥을 놓친다.
// data.json에 표본을 더하고(같은 직선 위, 같은 보간), 보강 열람 시각을 따로 남긴다.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const file = new URL('./data.json', import.meta.url);
const data = JSON.parse(readFileSync(file, 'utf8'));
const a = data.points.kanadorii, b = data.points.kengamine;
const L = data.segLengths_m[1], base = data.segLengths_m[0];
const have = new Set(data.samples.map((p) => p.d.toFixed(1)));
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const add = [];
for (let s = L - 1000; s < L - 0.5; s += 20) {
  const t = s / L, d = +(base + s).toFixed(1);
  if (have.has(d.toFixed(1))) continue;
  const p = { seg: 1, lat: +(a.lat + (b.lat - a.lat) * t).toFixed(7), lon: +(a.lon + (b.lon - a.lon) * t).toFixed(7), d, dense: true };
  const url = `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${p.lon}&lat=${p.lat}&outtype=JSON`;
  for (let k = 0; k < 4; k++) {
    try { const j = JSON.parse(execFileSync('curl', ['-sS', '--max-time', '20', url], { encoding: 'utf8' })); p.h = typeof j.elevation === 'number' ? j.elevation : null; p.hsrc = j.hsrc ?? String(j.elevation); break; }
    catch { sleep(2000); }
  }
  if (p.h === undefined) throw new Error('fetch failed ' + url);
  add.push(p); process.stdout.write('.'); sleep(350);
}
data.samples = [...data.samples, ...add].sort((x, y) => x.d - y.d);
data.accessedCraterRefine = new Date(Date.now() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 19) + ' KST';
data.method += ' 山頂手前1.0 kmは20 m間隔で補強（fetch-crater.mjs）。';
writeFileSync(file, JSON.stringify(data, null, 1));
console.log('\n+', add.length, data.accessedCraterRefine);
