// preview.html 생성: node make-preview.mjs (02-map 폴더에서)
import fs from 'node:fs';
const rd = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const line = rd('./line.svg.txt'), ridgeB = rd('./ridge.svg.txt'), ridgeA = rd('./ridge-alt.svg.txt');
const torii = JSON.parse(rd('./torii-bar.json'));
const m = JSON.parse(rd('./metrics.json'));
const top = m.lineTopEnd.page;
const bar = torii.bar.svg;
const ext = (() => { const t = { x: 126, y: 200 }; const k = (46 - t.y) / (top.y - t.y); return { x: t.x + k * (top.x - t.x), y: 46 }; })();
const bg = '<rect x="-3" y="-3" width="216" height="303" fill="#eef0f4"/>';
const zones = [
  ['제호', 13, 13, 60, 16], ['호 표기', 13, 33.5, 60, 6], ['제목', 150, 124, 14, 60], ['부제', 102, 182, 16, 102], ['크레딧', 136, 272, 64, 15],
].map(([t, x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#7a8296" stroke-width=".3" stroke-dasharray="1 1"/><text x="${x + 1}" y="${y + 3.2}" font-size="3" fill="#7a8296">${t}</text>`).join('');
const guides = `
<line x1="126" y1="-3" x2="126" y2="300" stroke="#151b2c" stroke-width=".25" stroke-dasharray="2 1.5"/>
<text x="127.5" y="290" font-size="3" fill="#151b2c">剣ヶ峰 방위 ${m.summitBearingDeg}°</text>
<line x1="126" y1="200" x2="${ext.x.toFixed(2)}" y2="46" stroke="#d4462a" stroke-width=".3" stroke-dasharray="1 1"/>
<circle cx="126" cy="46" r="1" fill="none" stroke="#151b2c" stroke-width=".3"/>
<circle cx="${ext.x.toFixed(2)}" cy="46" r=".8" fill="#d4462a"/>
<text x="${(ext.x + 1.5).toFixed(2)}" y="44" font-size="3" fill="#d4462a">金鳥居→끝 연장: y46에서 +${m.apexMiss.extend_toriiToTop_atY46}mm · 능선과 ${m.ridge.B.lineExtensionHitsRidge.x},${m.ridge.B.lineExtensionHitsRidge.y}</text>
<text x="${(top.x + 2).toFixed(2)}" y="${(top.y + 1).toFixed(2)}" font-size="3" fill="#d4462a">끝 ${top.x},${top.y} (上宿)</text>
<text x="131" y="205" font-size="3" fill="#d4462a">金鳥居 126,200 · 막대 ${torii.bar.rotateDeg}°</text>
<circle cx="${m.kitaguchiPin.page.x}" cy="${m.kitaguchiPin.page.y}" r=".8" fill="none" stroke="#d4462a" stroke-width=".3"/>
<text x="${m.kitaguchiPin.page.x - 1}" y="${m.kitaguchiPin.page.y - 2}" font-size="3" fill="#d4462a" text-anchor="end">北口本宮(參考)</text>
<g opacity=".45">${ridgeA.replace('#151b2c', '#5b6a8f').replace('stroke-width="1"', 'stroke-width=".5" stroke-dasharray="1.5 1"')}</g>
<text x="2" y="${(m.ridge.A.leftBleed.y + 4).toFixed(1)}" font-size="3" fill="#5b6a8f">A안 능선(좌 재단 y104)</text>
<text x="127" y="42" font-size="3" fill="#151b2c">剣ヶ峰(평탄 ${m.ridge.B.flat.join('–')})</text>
${zones}`;
const svg = (inner) => `<svg viewBox="0 0 210 297" xmlns="http://www.w3.org/2000/svg" style="overflow:hidden">${bg}${inner}</svg>`;
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>一本の線 지도 미리보기</title>
<style>
body{margin:0;padding:16px;background:#d9dce3;font:12px/1.5 system-ui,sans-serif;color:#151b2c}
.cover{width:390px;aspect-ratio:210/297;container-type:inline-size;background:#eef0f4;margin:0 0 8px;box-shadow:0 1px 4px rgba(0,0,0,.2)}
.cover svg{display:block;width:100%;height:100%}
h2{font-size:12px;margin:16px 0 6px;font-weight:600}
</style></head><body>
<h2>1 · 권장(능선 B: p=1, 좌 재단 y${m.ridge.B.leftBleed.y}, 우 y${m.ridge.B.rightBleed.y})</h2>
<div class="cover">${svg(ridgeB + line + bar)}</div>
<h2>2 · 검증 주석(점선=剣ヶ峰 방위·연장선·AD 글자 구역, 회색 점선=능선 A)</h2>
<div class="cover">${svg(ridgeB + line + bar + guides)}</div>
<h2>3 · 대안(능선 A: AD 수치, 좌 y${m.ridge.A.leftBleed.y}, 우 y${m.ridge.A.rightBleed.y})</h2>
<div class="cover">${svg(ridgeA + line + bar)}</div>
<p>© OpenStreetMap contributors（ODbL）· osm_base 2026-07-28 11:16 KST · 1mm=${m.scale.mPerMm}m · 山は略図</p>
</body></html>`;
fs.writeFileSync(new URL('./preview.html', import.meta.url), html);
