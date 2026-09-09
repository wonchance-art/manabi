#!/usr/bin/env node
// Read-only release gate. Expected SHA comes from reviewed Git, not from the endpoint.
import { readFileSync } from 'node:fs';
import { releaseVerificationErrors } from '../src/lib/releaseVersion.js';

const [base, commit, environment = 'preview'] = process.argv.slice(2);
try {
  const url = new URL('/api/version', base);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('https_release_url_required');
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`version_http_${response.status}`);
  if (!response.headers.get('cache-control')?.includes('no-store')) throw new Error('version_must_not_cache');
  const version = await response.json();
  const bundledEditionId = JSON.parse(readFileSync(new URL('../src/content/textbookEditions/index.json', import.meta.url))).current;
  const errors = releaseVerificationErrors(version, { commit, environment, bundledEditionId });
  if (errors.length) throw new Error(`release_mismatch: ${errors.join(', ')}`);
  console.log(JSON.stringify({ verified: true, ...version }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
