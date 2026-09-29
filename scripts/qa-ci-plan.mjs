import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isRecordOnly } from './qa-profiles.mjs';
const base = process.env.QA_DIFF_BASE;
let files = [];
if (base && /^[a-f0-9]{40}$/.test(base) && !/^0+$/.test(base)) {
  try { files = execFileSync('git', ['diff', '--name-only', '-z', base, 'HEAD'], { encoding: 'utf8' }).split('\0').filter(Boolean); }
  catch { /* unavailable comparison means full verification */ }
}
const full = !isRecordOnly(files);
console.log(full ? 'Full verification required' : 'Archival verification records only; runtime unchanged');
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `full=${full}\n`);
