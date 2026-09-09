#!/usr/bin/env node
// Dry run by default. Only committed, clean source can acquire a release identity.
// No credentials are read or printed; the Vercel CLI uses its existing login.
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { buildReleaseVersion } from '../src/lib/releaseVersion.js';

export function releaseDeployArgs({ commit, ref, at, staged = false }) {
  if (staged && ref !== 'main') throw new Error('staged_production_requires_main');
  const target = staged ? 'production' : 'preview';
  const vars = { MANABI_RELEASE_SHA: commit, MANABI_RELEASE_REF: ref, MANABI_RELEASE_AT: at };
  buildReleaseVersion({ ...vars, VERCEL_ENV: target });
  const args = ['deploy', '--yes', '--force', '--archive=tgz', '--scope', 'wonchance-arts-projects'];
  if (staged) args.push('--prod', '--skip-domain');
  for (const [key, value] of Object.entries(vars)) args.push('--build-env', `${key}=${value}`, '--env', `${key}=${value}`);
  args.push('--meta', `manabiCommit=${commit}`);
  return args;
}

export function deployWebRelease(argv = process.argv.slice(2)) {
  if (argv.some(arg => !['--deploy', '--production-staged'].includes(arg))) throw new Error('unknown_release_option');
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  if (git('status', '--porcelain', '--untracked-files=all')) throw new Error('release_requires_clean_worktree');
  const commit = git('rev-parse', 'HEAD'), ref = git('branch', '--show-current');
  const staged = argv.includes('--production-staged');
  if (staged) {
    const remote = git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0];
    if (commit !== remote) throw new Error('staged_production_requires_remote_main_head');
  }
  const args = releaseDeployArgs({ commit, ref, at: new Date().toISOString(), staged });
  if (!argv.includes('--deploy')) { console.log(JSON.stringify({ command: 'vercel', args }, null, 2)); return; }
  const result = spawnSync('vercel', args, { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`vercel_deploy_failed_${result.status}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { deployWebRelease(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
