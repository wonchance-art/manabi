#!/usr/bin/env node
// 빌드 시 배포 콘텐츠의 SHA-256으로 sw.js 캐시 버전을 결정적으로 갱신한다.
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, readlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = resolve(SCRIPT_DIR, '..');
const CACHE_PREFIX = 'anatomy-studio-v';
const CACHE_LINE = /^const CACHE_NAME = ['"`][^'"`]+['"`];/m;
const CACHE_PLACEHOLDER = "const CACHE_NAME = 'anatomy-studio-vCONTENT_HASH';";
const CONTENT_INPUTS = ['package.json', 'package-lock.json', 'next.config.mjs', 'src', 'public'];

function normalizedRelative(repoRoot, filePath) {
  return relative(repoRoot, filePath).split(sep).join('/');
}

async function collectEntries(repoRoot, targetPath, entries) {
  const stat = await lstat(targetPath);
  const rel = normalizedRelative(repoRoot, targetPath);

  if (stat.isSymbolicLink()) {
    entries.push({ rel, kind: 'link', bytes: Buffer.from(await readlink(targetPath), 'utf8') });
    return;
  }
  if (stat.isDirectory()) {
    const names = (await readdir(targetPath)).sort((a, b) => a.localeCompare(b, 'en'));
    for (const name of names) await collectEntries(repoRoot, join(targetPath, name), entries);
    return;
  }
  if (!stat.isFile()) return;

  let bytes = await readFile(targetPath);
  if (rel === 'public/sw.js') {
    const source = bytes.toString('utf8');
    if (!CACHE_LINE.test(source)) throw new Error('CACHE_NAME line not found in public/sw.js');
    bytes = Buffer.from(source.replace(CACHE_LINE, CACHE_PLACEHOLDER), 'utf8');
  }
  entries.push({ rel, kind: 'file', bytes });
}

export async function computeContentHash(repoRoot = DEFAULT_REPO_ROOT) {
  const root = resolve(repoRoot);
  const entries = [];
  for (const input of CONTENT_INPUTS) await collectEntries(root, join(root, input), entries);
  entries.sort((a, b) => a.rel.localeCompare(b.rel, 'en'));

  const hash = createHash('sha256');
  for (const entry of entries) {
    hash.update(`${entry.kind}\0${entry.rel}\0${entry.bytes.length}\0`, 'utf8');
    hash.update(entry.bytes);
    hash.update('\0', 'utf8');
  }
  return hash.digest('hex');
}

export async function updateServiceWorkerVersion(repoRoot = DEFAULT_REPO_ROOT) {
  const root = resolve(repoRoot);
  const swPath = join(root, 'public', 'sw.js');
  const src = await readFile(swPath, 'utf8');
  if (!CACHE_LINE.test(src)) throw new Error('CACHE_NAME line not found in public/sw.js');

  const contentHash = await computeContentHash(root);
  const version = `${CACHE_PREFIX}${contentHash.slice(0, 16)}`;
  const updated = src.replace(CACHE_LINE, `const CACHE_NAME = '${version}';`);
  if (src !== updated) await writeFile(swPath, updated);
  return { changed: src !== updated, contentHash, version };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  try {
    const result = await updateServiceWorkerVersion();
    console.log(`[update-sw-version] CACHE_NAME ${result.changed ? '→' : 'already current →'} ${result.version}`);
    console.log(`[update-sw-version] content sha256 ${result.contentHash}`);
  } catch (error) {
    console.error(`[update-sw-version] ${error.message}`);
    process.exit(1);
  }
}
