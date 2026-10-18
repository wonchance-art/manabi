#!/usr/bin/env node
// 퍼블릭 도메인 전자책 사이트 판 받기·고정(LIT-SRC-PD-1) — Faded Page(캐나다) · Project Gutenberg Australia.
//
//   NODE_USE_ENV_PROXY=1 node scripts/literature/pd-add-work.mjs --site fp --id 20141070 --key pd-fp-ernest-hemingway_the-old-man-and-the-sea
//   NODE_USE_ENV_PROXY=1 node scripts/literature/pd-add-work.mjs --site gau --path ebooks01/0100011h.html --key pd-gau-george-orwell_animal-farm
//
// 사이트 HTML 한 파일을 바이트 그대로 source/에 두고 SHA-256 · 글자 인코딩 · 받은 날을 entry.json file에 적는다(원문이 바뀌면 빌드가 실패).
// Faded Page는 책 쪽(showbook)을 먼저 열어 세션을 받아야 내려받기 고리가 열린다. 제목·작가·권리·표기·본문 경계(parse)는 사람이 적는다.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'src/content/literature/pdsite';
const UA = 'Mozilla/5.0 (compatible; manabi-literature/1.0; non-commercial language-learning reader; https://manabi.co.kr)';
const KEY = /^pd-(fp|gau)-[a-z0-9]+(?:-[a-z0-9]+)*_[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const args = process.argv.slice(2);
const flag = (name) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : null; };
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function fetchFadedPage(id) {
  const book = `https://www.fadedpage.com/showbook.php?pid=${encodeURIComponent(id)}`;
  const first = await fetch(book, { headers: { 'user-agent': UA } });
  if (!first.ok) throw new Error(`${first.status} ${book}`);
  const cookie = (first.headers.getSetCookie?.() || []).map((value) => value.split(';')[0]).join('; ');
  const file = await fetch(`https://www.fadedpage.com/link.php?file=${encodeURIComponent(id)}.html`, { headers: { 'user-agent': UA, cookie, referer: book } });
  if (!file.ok || !new URL(file.url).pathname.startsWith(`/books/${id}/`)) throw new Error(`내려받지 못했다(${file.status} ${file.url})`);
  return { url: book, fileUrl: file.url, bytes: Buffer.from(await file.arrayBuffer()), encoding: 'utf-8', name: `${id}.html` };
}

async function fetchGutenbergAustralia(rel) {
  if (!/^ebooks\d*\/[0-9a-z]+h\.html$/u.test(rel)) throw new Error('--path ebooksNN/NNNNNNNh.html');
  const url = `https://gutenberg.net.au/${rel}`;
  const response = await fetch(url, { headers: { 'user-agent': UA } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  // 사이트 HTML에 글자 인코딩 표시가 없다 — UTF-8로 읽히지 않으면 Windows-1252(라틴 1 확장)
  const bytes = Buffer.from(await response.arrayBuffer());
  let encoding = 'utf-8';
  try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { encoding = 'windows-1252'; }
  return { url, fileUrl: url, bytes, encoding, name: path.basename(rel) };
}

async function main() {
  const site = flag('site');
  const key = flag('key');
  if (!['fp', 'gau'].includes(site) || !KEY.test(key ?? '') || !key.startsWith(`pd-${site}-`)) throw new Error('--site fp|gau --key pd-<site>-<작가>_<작품> (--id <Faded Page 번호> | --path <PGA 경로>)');
  const got = site === 'fp' ? await fetchFadedPage(flag('id')) : await fetchGutenbergAustralia(flag('path'));
  const out = path.join(ROOT, key);
  mkdirSync(path.join(out, 'source'), { recursive: true });
  writeFileSync(path.join(out, 'source', got.name), got.bytes);
  const entryPath = path.join(out, 'entry.json');
  const previous = existsSync(entryPath) ? JSON.parse(readFileSync(entryPath, 'utf8')) : {};
  const entry = {
    schemaVersion: 1, provider: 'pdsite', site, key, url: got.url,
    title: previous.title ?? '', author: previous.author ?? '', language: previous.language ?? '', level: previous.level ?? '',
    publishedYear: previous.publishedYear ?? null, authorDeathYear: previous.authorDeathYear ?? null,
    countryOfOrigin: previous.countryOfOrigin ?? null, ...(previous.mortPourLaFrance !== undefined ? { mortPourLaFrance: previous.mortPourLaFrance } : {}),
    rights: previous.rights ?? { status: 'pending', basis: 'public-domain', reviewedJurisdictions: [], reviewer: null, reviewedAt: null },
    display: previous.display ?? {},
    parse: previous.parse ?? { stop: '' },
    file: { path: got.name, url: got.fileUrl, encoding: got.encoding, sha256: sha256(got.bytes), fetchedAt: new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10) },
  };
  writeFileSync(entryPath, `${JSON.stringify(entry, null, 2)}\n`);
  process.stdout.write(`✓ ${key}: ${got.name} (${got.bytes.length} bytes · ${got.encoding}) — ${entryPath}에 제목·작가·권리·표기·parse를 적는다\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { process.stderr.write(`✗ ${error.message}\n`); process.exit(1); });
}
