#!/usr/bin/env node
// 화면 벽 페이지 만들기(2판 1단계) — wall-capture.mjs의 manifest.json + 설계 등록부 + 상태 · 알림 재고로 화면 벽 HTML 한 장을 만든다.
//
//   node scripts/wall-page.mjs                   # 최신 wall-out/<sha 8자>/ → 같은 폴더의 wall.html + thumbs/*.jpg
//   node scripts/wall-page.mjs --dir wall-out/4989f455
//
// 결과물은 claude.ai 아티팩트 「manabi 화면 벽」(https://claude.ai/artifact/DJdKQhDsdd9qzu6uJaaHhb)에 올린다 — wall.html을 페이지로,
// shots/ · thumbs/를 files로. 캡처는 저장소에 커밋하지 않는다(wall-rules.md §9). 판정 기록(reviews) · 갱신 기록(runs)은 아티팩트 db가 정본이다.
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

function latestDir() {
  const base = join(root, 'wall-out');
  const dirs = readdirSync(base).map(name => join(base, name)).filter(dir => { try { return statSync(join(dir, 'manifest.json')).isFile(); } catch { return false; } });
  if (!dirs.length) throw new Error('wall-out/에 캡처가 없어요 — 먼저 `npm run wall:capture`.');
  return dirs.sort((a, b) => statSync(join(b, 'manifest.json')).mtimeMs - statSync(join(a, 'manifest.json')).mtimeMs)[0];
}

/** 타일 그림 — 데스크톱 첫 화면 위에 휴대폰 첫 화면을 겹친 한 장(640×400). 원본(shots/)은 장면 창에서 연다. */
async function thumb(dir, scene) {
  const out = `thumbs/${scene.id}.jpg`;
  const d = scene.shots.desktop && join(dir, scene.shots.desktop), m = scene.shots.mobile && join(dir, scene.shots.mobile);
  if (!d && !m) return null;
  const W = 640, H = 400;
  let base;
  if (d) base = await sharp(d).extract({ left: 0, top: 0, width: 1280, height: Math.min(800, scene.checks.desktop.shotHeight) }).resize(W, H, { fit: 'cover', position: 'top' }).toBuffer();
  else base = await sharp({ create: { width: W, height: H, channels: 3, background: '#eeece5' } }).jpeg().toBuffer();
  const layers = [];
  if (m) {
    const ph = await sharp(m).extract({ left: 0, top: 0, width: 390, height: Math.min(844, scene.checks.mobile.shotHeight) }).resize(150, 325, { fit: 'cover', position: 'top' })
      .extend({ top: 3, bottom: 3, left: 3, right: 3, background: '#fffefb' }).toBuffer();
    layers.push({ input: ph, left: d ? W - 156 - 12 : Math.round((W - 156) / 2), top: d ? H - 331 - 10 : 30 });
  }
  await sharp(base).composite(layers).jpeg({ quality: 70 }).toFile(join(dir, out));
  return out;
}

const esc = s => String(s).replace(/</g, '\\u003c');

async function main() {
  const dir = opt('--dir') ? join(root, opt('--dir')) : latestDir();
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const registry = JSON.parse(readFileSync(join(root, 'docs', 'design', 'registry.json'), 'utf8'));
  const scenesReg = JSON.parse(readFileSync(join(root, 'docs', 'design', 'scenes.json'), 'utf8'));
  const states = JSON.parse(readFileSync(join(root, 'docs', 'design', 'states-inventory.json'), 'utf8'));
  mkdirSync(join(dir, 'thumbs'), { recursive: true });
  for (const scene of manifest.scenes) scene.thumb = await thumb(dir, scene);
  const laneOf = Object.fromEntries(scenesReg.routes.flatMap(entry => (entry.scenes || []).map(s => [entry.route, s.lane])));
  const data = {
    run: { sha: manifest.sha, short: manifest.short, capturedAt: manifest.capturedAt, capturedIso: manifest.capturedIso, captureSec: manifest.captureSec,
      build: manifest.build, counts: manifest.counts, viewports: manifest.viewports },
    personas: manifest.personas, lanes: manifest.lanes, routesTotal: manifest.routesTotal,
    scenes: manifest.scenes.map(({ checks, ...s }) => ({ ...s, checks: Object.fromEntries(Object.entries(checks).map(([k, c]) => [k, {
      url: c.url, status: c.status, h1: c.h1, fontKR: c.fontKR, scrollHeight: c.scrollHeight, failed: c.failedResponses || [], console: c.consoleErrors || [],
      textHash: c.textHash, lmHash: c.lmHash, error: c.error || null, ms: c.ms }])) })),
    components: manifest.components || null,
    offToken: manifest.offToken ? { paletteSize: manifest.offToken.paletteSize, colors: manifest.offToken.colors.slice(0, 40) } : null,
    coverage: { stale: manifest.coverage.stale, rows: manifest.coverage.rows.map(r => ({ ...r, lane: laneOf[r.route] || laneOf[r.via] || null })) },
    designs: registry,
    states: { snapshot: states.snapshot, counts: states.counts, issues: states.issues, copyGroups: states.copyGroups, items: states.items },
  };
  const template = readFileSync(join(root, 'scripts', 'wall-page.html'), 'utf8');
  const html = template.replace('/*__WALL_DATA__*/null', esc(JSON.stringify(data)));
  writeFileSync(join(dir, 'wall.html'), html);
  console.log(`화면 벽 페이지: ${join(dir, 'wall.html')} (${Math.round(html.length / 1024)}KB) · 타일 ${manifest.scenes.filter(s => s.thumb).length}장`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
