import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildReleaseVersion, serverReleaseVersion, releaseVerificationErrors } from '../releaseVersion.js';
import { buildVersionView } from '../versionBadge.js';
import { releaseDeployArgs } from '../../../scripts/deploy-web-release.mjs';
import { GET } from '../../app/api/version/route.js';

const commit = 'a'.repeat(40), other = 'b'.repeat(40), ref = 'codex/web-v2-release';
const at = '2026-09-07T01:00:00.000Z', edition = 'c'.repeat(24);
const env = { MANABI_RELEASE_SHA: commit, MANABI_RELEASE_REF: ref, MANABI_RELEASE_AT: at, VERCEL_ENV: 'preview' };
const built = { ...buildReleaseVersion(env), bundledEditionId: edition };
afterEach(() => vi.unstubAllEnvs());

describe('release provenance', () => {
  it('CLI and Git builds identify the same exact commit', () => {
    expect(buildReleaseVersion(env)).toEqual(buildReleaseVersion({ VERCEL_GIT_COMMIT_SHA: commit, VERCEL_GIT_COMMIT_REF: ref, VERCEL_ENV: 'preview' }, at));
  });
  it('allows local development but fails deployments without source identity', () => {
    expect(buildReleaseVersion({}, at)).toMatchObject({ sha: 'dev', ref: 'local', releaseId: null });
    for (const VERCEL_ENV of ['preview', 'production']) expect(() => buildReleaseVersion({ VERCEL_ENV })).toThrow('release_commit_required');
    expect(() => buildReleaseVersion({ VERCEL: '1' })).toThrow('release_commit_required');
  });
  it.each(['dev', '1234567', 'a'.repeat(39), 'not-a-commit'])('rejects invalid SHA %s', sha => {
    expect(() => buildReleaseVersion({ ...env, MANABI_RELEASE_SHA: sha })).toThrow('release_commit_required');
  });
  it('rejects conflicting identities and invalid branch/time', () => {
    expect(() => buildReleaseVersion({ ...env, VERCEL_GIT_COMMIT_SHA: other })).toThrow('release_commit_mismatch');
    expect(() => buildReleaseVersion({ ...env, MANABI_RELEASE_REF: '' })).toThrow('release_ref_required');
    expect(() => buildReleaseVersion({ ...env, MANABI_RELEASE_AT: 'invalid' })).toThrow('release_time_required');
  });
  it('uses this server artifact if runtime Git metadata is unavailable', () => {
    expect(serverReleaseVersion({ VERCEL_ENV: 'preview', VERCEL_DEPLOYMENT_ID: 'dpl_Test' }, built)).toMatchObject({ commit, sha: 'aaaaaaa', at, deploymentId: 'dpl_Test', bundledEditionId: edition });
    expect(() => serverReleaseVersion({ VERCEL_GIT_COMMIT_SHA: other }, built)).toThrow('release_commit_mismatch');
  });
  it('rejects dev/local, wrong target and mismatched edition at release verification', () => {
    const version = serverReleaseVersion({ VERCEL_DEPLOYMENT_ID: 'dpl_Test' }, built);
    const expected = { commit, environment: 'preview', bundledEditionId: edition };
    expect(releaseVerificationErrors(version, expected)).toEqual([]);
    expect(releaseVerificationErrors({ ...version, sha: 'dev', ref: 'local', environment: 'production', bundledEditionId: other }, expected)).toEqual(['sha', 'ref', 'environment', 'bundledEditionId']);
  });
  it('still detects an old browser bundle without forcing a reload', () => {
    const server = serverReleaseVersion({}, built);
    expect(buildVersionView({ buildSha: other.slice(0, 7), serverSha: server.sha }).status).toBe('stale');
    expect(buildVersionView({ buildSha: commit.slice(0, 7), serverSha: server.sha }).status).toBe('ok');
  });
});

describe('release transport', () => {
  it('passes only public provenance at both build and runtime', () => {
    const args = releaseDeployArgs({ commit, ref, at });
    expect(args.filter(x => x === `MANABI_RELEASE_SHA=${commit}`)).toHaveLength(2);
    expect(args).not.toContain('--prod');
    expect(args).not.toContain('--public');
    expect(args).not.toContain('--token');
  });
  it('production is always staged, and requires main', () => {
    expect(() => releaseDeployArgs({ commit, ref, at, staged: true })).toThrow('staged_production_requires_main');
    expect(releaseDeployArgs({ commit, ref: 'main', at, staged: true })).toEqual(expect.arrayContaining(['--prod', '--skip-domain']));
  });
  it('route exposes allowlisted metadata with no-store, never arbitrary environment values', async () => {
    vi.stubEnv('MANABI_BUILD_IDENTITY', JSON.stringify(built));
    vi.stubEnv('VERCEL_DEPLOYMENT_ID', 'dpl_Test');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '');
    vi.stubEnv('MANABI_RELEASE_SHA', '');
    vi.stubEnv('PRIVATE_TEST_VALUE', 'must-not-leak');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    const body = await response.text();
    expect(JSON.parse(body).commit).toBe(commit);
    expect(body).not.toContain('must-not-leak');
  });
  it('route fails closed on corrupt or conflicting server identity', async () => {
    vi.stubEnv('MANABI_BUILD_IDENTITY', JSON.stringify(built));
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', other);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'release_identity_unavailable' });
    vi.stubEnv('MANABI_BUILD_IDENTITY', '{');
    expect((await GET()).status).toBe(503);
  });
});
