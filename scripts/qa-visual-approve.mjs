// Explicit local review only. Hash binds the approval to the inspected pixels.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../e2e/visual-quality.mjs';

export function approveVisual(file, expectedHash, review, destination = fileURLToPath(new URL('../e2e/visual-baselines/', import.meta.url))) {
  if (process.env.CI) throw Error('ci_cannot_approve_visuals');
  if (!/^[a-f0-9]{64}$/.test(expectedHash) || !review?.trim()) throw Error('review_and_exact_hash_required');
  const row = JSON.parse(fs.readFileSync(file));
  if (!/^(darwin|linux)-(arm64|x64)-(chromium|webkit)-[\d.]+$/.test(row.key) || !/^[a-z0-9-]+$/.test(row.name)) throw Error('invalid_case');
  if (!row.stable || row.a11y.violations.length) throw Error('cannot_approve_failed_accessibility_or_unstable_image');
  const source = path.join(path.dirname(file), row.name + '.png');
  const bytes = fs.readFileSync(source);
  if (sha256(bytes) !== expectedHash || row.sha256 !== expectedHash) throw Error('image_changed_since_review');
  const dir = path.join(destination, row.key);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir, row.name + '.png'), bytes);
  fs.writeFileSync(path.join(dir, row.name + '.json'), JSON.stringify({name:row.name,key:row.key,sha256:expectedHash,review,viewport:row.viewport,osRelease:row.osRelease,fontScope:'synthetic harness fonts; production-font/device review remains separate'},null,2)+'\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  approveVisual(...process.argv.slice(2));
}
