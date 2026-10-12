#!/usr/bin/env node
// Google Fonts 응답을 저장소(vendor/google-fonts/)에 내려받아 두는 저작 도구 — 배포 빌드는 이 사본만 읽는다.
//
// 왜(2026-10-13 실측): `next/font/google`은 빌드마다 10패밀리의 CSS 11개와 woff2 조각 약 830개(약 35MB)를
// Google에서 받는다. 하나만 실패해도 배포 전체가 죽는다(10-10 #1402, 10-13 #1419 Preview ERROR —
// `Failed to fetch Noto Serif KR`, 확장자 없는 주소로 loader.js:122 null). 같은 바이트를 저장소에 두면
// 빌드는 네트워크를 쓰지 않고, next/font가 만드는 결과물(파일 이름·CSS·대체 글꼴 보정)은 그대로다.
//
// 사용:
//   node scripts/fonts/vendor-google-fonts.mjs '<css2 URL>' ...   # 새 글꼴 호출을 추가했을 때(빌드 오류가 URL을 알려 준다)
//   node scripts/fonts/vendor-google-fonts.mjs --refresh           # manifest의 모든 URL을 다시 받는다(글꼴 판 갱신)
//   node scripts/fonts/vendor-google-fonts.mjs --prune             # 어떤 CSS도 가리키지 않는 woff2를 지운다
// 실행에는 네트워크가 필요하다. 결과는 git diff로 검토한 뒤 커밋한다.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VENDOR = path.join(ROOT, 'vendor/google-fonts');
const MANIFEST = path.join(VENDOR, 'manifest.json');
const require = createRequire(import.meta.url);
const { cssFileName, fontFileName, fontUrlsInCss } = require(path.join(VENDOR, 'paths.cjs'));

// next 15 `google/fetch-resource.js`와 같은 User-Agent — Google은 UA에 따라 다른 CSS를 준다.
export const NEXT_FONT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
  + 'AppleWebKit/537.36 (KHTML, like Gecko) '
  + 'Chrome/104.0.0.0 Safari/537.36';

async function get(url) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': NEXT_FONT_USER_AGENT } });
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt >= 4) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
}

function readManifest() {
  if (!fs.existsSync(MANIFEST)) return { responses: {}, files: {} };
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function writeManifest(manifest) {
  const sorted = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(MANIFEST, `${JSON.stringify({
    note: manifest.note,
    userAgent: NEXT_FONT_USER_AGENT,
    responses: sorted(manifest.responses),
    files: sorted(manifest.files),
  }, null, 2)}\n`);
}

async function vendorCss(url, manifest) {
  if (!url.startsWith('https://fonts.googleapis.com/css2?')) throw new Error(`css2 URL이 아니다: ${url}`);
  const css = (await get(url)).toString('utf8');
  const fontUrls = fontUrlsInCss(css);
  if (!fontUrls.length) throw new Error(`글꼴 파일이 없는 응답: ${url}`);
  for (const fontUrl of fontUrls) {
    // next loader가 확장자로 형식을 정한다 — 확장자 없는 주소(10-10 실측)는 사본에 들이지 않는다.
    if (!/\.(woff|woff2|eot|ttf|otf)$/.test(fontUrl)) throw new Error(`확장자 없는 글꼴 주소: ${fontUrl}`);
  }
  fs.mkdirSync(path.join(VENDOR, 'css'), { recursive: true });
  fs.writeFileSync(path.join(VENDOR, 'css', cssFileName(url)), css);
  manifest.responses[url] = cssFileName(url);

  let downloaded = 0;
  const queue = [...fontUrls];
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const fontUrl = queue.shift();
      const rel = fontFileName(fontUrl);
      const dest = path.join(VENDOR, 'files', rel);
      if (manifest.files[rel] && fs.existsSync(dest) && sha256(fs.readFileSync(dest)) === manifest.files[rel]) continue;
      const body = await get(fontUrl);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, body);
      manifest.files[rel] = sha256(body);
      downloaded += 1;
    }
  }));
  console.log(`${url}\n  글꼴 ${fontUrls.length}개(새로 받음 ${downloaded})`);
}

function prune(manifest) {
  const used = new Set();
  for (const name of Object.values(manifest.responses)) {
    for (const fontUrl of fontUrlsInCss(fs.readFileSync(path.join(VENDOR, 'css', name), 'utf8'))) used.add(fontFileName(fontUrl));
  }
  let removed = 0;
  for (const rel of Object.keys(manifest.files)) {
    if (used.has(rel)) continue;
    fs.rmSync(path.join(VENDOR, 'files', rel), { force: true });
    delete manifest.files[rel];
    removed += 1;
  }
  console.log(`쓰이지 않는 글꼴 ${removed}개를 지웠다.`);
}

async function main(args) {
  const manifest = readManifest();
  manifest.note ||= 'next/font/google 응답 사본. 갱신: node scripts/fonts/vendor-google-fonts.mjs --refresh (README.md 참고)';
  const urls = args.includes('--refresh') ? Object.keys(manifest.responses) : args.filter((a) => !a.startsWith('--'));
  for (const url of urls) await vendorCss(url, manifest);
  if (args.includes('--prune') || args.includes('--refresh')) prune(manifest);
  writeManifest(manifest);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
