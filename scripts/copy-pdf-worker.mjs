#!/usr/bin/env node
// pdfjs-dist worker를 public/에 복사
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs');
const dst = join(__dirname, '..', 'public', 'pdf.worker.min.mjs');

if (!existsSync(src)) {
  console.error('[copy-pdf-worker] source not found:', src);
  process.exit(1);
}

copyFileSync(src, dst);
console.log('[copy-pdf-worker] copied pdf.worker.min.mjs to public/');
