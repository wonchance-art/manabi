#!/usr/bin/env node
// 빌드 시 sw.js의 캐시 버전을 타임스탬프 기반으로 갱신
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = join(__dirname, '..', 'public', 'sw.js');

const version = `anatomy-studio-v${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)}`;
const src = readFileSync(swPath, 'utf8');
const updated = src.replace(/^const CACHE_NAME = ['"`][^'"`]+['"`];/m, `const CACHE_NAME = '${version}';`);

if (src === updated) {
  console.error('[update-sw-version] CACHE_NAME line not found in sw.js');
  process.exit(1);
}

writeFileSync(swPath, updated);
console.log(`[update-sw-version] CACHE_NAME → ${version}`);
