// 정밀화 v1 비교 시트 — 전/후, 사용 크기, 반전·주홍, 조합판. 사용(리포 루트): node docs/japanology/magazine/brand/ai-gen/refine/sheet.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../../../..');
const { chromium } = createRequire(path.join(ROOT, 'package.json'))('playwright');
const V = (f) => readFileSync(path.join(HERE, 'v1', f), 'utf8').replace(/<!--.*?-->/, '');
const T = (f) => readFileSync(path.join(HERE, '..', 'out', 'svg', f), 'utf8').replace(/ data-src="[^"]*"/, '');
const R = JSON.parse(readFileSync(path.join(HERE, 'v1', 'report.json'), 'utf8'));
const h = (s, px) => s.replace('<svg ', `<svg style="height:${px}px;width:auto;display:block" `);
const row = (title, before, after, rb, ra) => `<section><h2>${title}</h2><div class="pair">
<figure>${h(before, 120)}<figcaption>받은 그대로 · 틈 ${rb['gap%H'].join(' / ')} %H · 속공간 ${rb['hole%H'].join(' / ') || '—'} · 획 ${rb['stroke%H']}</figcaption></figure>
<figure>${h(after, 120)}<figcaption>v1 · 틈 ${ra['gap%H'].join(' / ')} %H · 속공간 ${ra['hole%H'].join(' / ') || '—'} · 획 ${ra['stroke%H']}</figcaption></figure></div></section>`;
const sizes = (label, s) => `<div class="sizes"><b>${label}</b>${[96, 48, 24, 16].map((px) => `<div>${h(s, px)}<i>${px}px</i></div>`).join('')}</div>`;
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>마크 정밀화 v1</title><style>
body{margin:0;padding:28px;background:#e9e6df;color:#151b2c;font:13px/1.5 system-ui,sans-serif}
h1{font-size:19px;margin:0 0 4px}p.lead{margin:0 0 18px;color:#444}
section{background:#f7f5f0;border-radius:6px;padding:16px;margin-bottom:16px}h2{font-size:14px;margin:0 0 10px}
.pair{display:flex;gap:32px;align-items:flex-start}figure{margin:0}figcaption{font-size:11px;color:#555;margin-top:6px;max-width:520px}
.sizes{display:flex;gap:22px;align-items:flex-end;margin:8px 0}.sizes b{width:110px;font-size:12px}.sizes i{display:block;font-size:10px;color:#777;font-style:normal}
.tiles{display:flex;gap:12px}.tile{padding:22px 28px;border-radius:4px}.night{background:#151b2c;color:#eef0f4}.verm{background:#d4462a;color:#fff}.snow{background:#eef0f4;color:#151b2c}
</style></head><body><h1>마크 정밀화 v1 — 받은 그대로 vs 정리</h1><p class="lead">%H = 잉크 높이 대비. 결정적 빌드(refine/build.py). 히라가나는 첫 업로드본(と 첫 획 분리) 기준 — 정정본 파일을 받으면 다시 만든다.</p>
${row('TONARI 원판 — 틈 균일·가장자리 정리', T('TONARI-gpt-01c.svg'), V('TONARI-master.svg'), R.TONARI_before, R.TONARI_master)}
${row('TONARI 소형판 — 48px 이하 전용', V('TONARI-master.svg'), V('TONARI-small.svg'), R.TONARI_master, R.TONARI_small)}
${row('となり — 획 굵게·간격 조임', T('hira-gpt-01c.svg'), V('hira-v1.svg'), R.hira_before, R.hira_v1)}
${row('トナリ — 획 굵게·간격 조임', T('kata-gpt-01c.svg'), V('kata-v1.svg'), R.kata_before, R.kata_v1)}
<section><h2>작은 크기 — 원판 vs 소형판</h2>${sizes('원판', V('TONARI-master.svg'))}${sizes('소형판', V('TONARI-small.svg'))}</section>
<section><h2>조합판·색</h2><div class="tiles"><div class="tile snow">${h(V('lockup-center.svg'), 150)}</div><div class="tile night">${h(V('lockup-center.svg'), 150)}</div><div class="tile verm">${h(V('lockup-center.svg'), 150)}</div></div></section>
</body></html>`;
writeFileSync(path.join(HERE, 'v1', 'sheet.html'), html);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto('file://' + path.join(HERE, 'v1', 'sheet.html'));
await p.screenshot({ path: path.join(HERE, 'v1', 'sheet.png'), fullPage: true }); await b.close();
console.log('v1/sheet.png');
