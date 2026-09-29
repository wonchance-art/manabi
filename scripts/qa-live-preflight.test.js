import { describe, expect, it } from 'vitest';
import { inspectLiveQa, liveQaOptions, liveQaSummary } from './qa-live-preflight.mjs';

const commit = 'a'.repeat(40);
const edition = 'b'.repeat(24);
const candidate = 'https://candidate.vercel.app';
const stable = 'https://stable.vercel.app';
const options = { deployment: candidate, stable, commit, bundledEditionId: edition };
const identity = {
  commit, sha: commit.slice(0, 7), ref: 'codex/release', releaseId: `web-v2-${commit.slice(0, 12)}`,
  at: '2026-09-17T00:00:00Z', deploymentId: 'dpl_fixture', environment: 'preview', bundledEditionId: edition,
};

function fakeSite(override = () => undefined) {
  const calls = [];
  const fetcher = async (url, request) => {
    calls.push({ url, request });
    const replaced = override(url, calls);
    if (replaced) return replaced;
    if (url.pathname === '/api/version') return Response.json(identity, { headers: { 'cache-control': 'no-store, max-age=0' } });
    if (url.pathname === '/auth') return new Response('<h1>Login</h1>', { headers: { 'content-type': 'text/html' } });
    const next = url.searchParams.get('next') === '/notes/new' ? '/notes/new' : '/materials';
    return new Response(null, { status: 307, headers: {
      'cache-control': 'private, no-store', location: url.origin + '/auth?' + new URLSearchParams({ error: 'auth_callback_failed', from: next }),
    } });
  };
  return { calls, fetcher };
}

describe('public live QA preflight', () => {
  it('compares immutable and stable deployments without sending credentials or authenticating', async () => {
    const { calls, fetcher } = fakeSite();
    const report = await inspectLiveQa(options, fetcher);
    expect(report.status).toBe('passed');
    expect(report.aliasMatchesCandidate).toBe(true);
    expect(calls).toHaveLength(10);
    for (const call of calls) {
      expect(call.request).toMatchObject({ method: 'GET', redirect: 'manual', credentials: 'omit', cache: 'no-store' });
      expect(call.request.headers.authorization).toBeUndefined();
      expect(call.url.searchParams.has('code')).toBe(false);
    }
    expect(report.evidence).toEqual({ publicHttp: true, realAccount: false, providerLogin: false, oauthAllowlist: false, teacherStudentPermissions: false, writes: false });
    expect(liveQaSummary(report)).toContain('아직 확인하지 않았다');
  });

  it('catches stale alias while preserving successful candidate evidence', async () => {
    const { fetcher } = fakeSite(url => url.origin === stable && url.pathname === '/api/version'
      ? Response.json({ ...identity, commit: 'c'.repeat(40), deploymentId: 'dpl_old' }, { headers: { 'cache-control': 'no-store' } }) : null);
    const report = await inspectLiveQa(options, fetcher);
    expect(report).toMatchObject({ status: 'failed', candidateReady: true, stableReady: false, aliasMatchesCandidate: false });
    expect(report.sites[1].checks.find(check => check.name === 'version_identity').passed).toBe(false);
  });

  it('does not treat two builds of the same commit as the same deployment', async () => {
    const { fetcher } = fakeSite(url => url.origin === stable && url.pathname === '/api/version'
      ? Response.json({ ...identity, deploymentId: 'dpl_rebuilt' }, { headers: { 'cache-control': 'no-store' } }) : null);
    const report = await inspectLiveQa(options, fetcher);
    expect(report.sites.every(site => site.passed)).toBe(true);
    expect(report.status).toBe('failed');
    expect(report.aliasMatchesCandidate).toBe(false);
  });

  it('detects a deployment changing during the inspection', async () => {
    const { fetcher } = fakeSite((url, calls) => url.origin === stable && url.pathname === '/api/version'
      && calls.filter(call => call.url.origin === stable && call.url.pathname === '/api/version').length === 2
      ? Response.json({ ...identity, deploymentId: 'dpl_changed' }, { headers: { 'cache-control': 'no-store' } }) : null);
    const report = await inspectLiveQa(options, fetcher);
    expect(report.status).toBe('failed');
    expect(report.sites[1].checks.find(check => check.name === 'deployment_unchanged_during_check').passed).toBe(false);
  });

  it.each([
    ['protection redirect', () => new Response(null, { status: 302, headers: { location: 'https://login.example.invalid/?token=PRIVATE' } })],
    ['cached version', () => Response.json(identity, { headers: { 'cache-control': 'max-age=3600' } })],
    ['malformed JSON', () => new Response('{PRIVATE', { headers: { 'content-type': 'application/json' } })],
    ['HTML challenge', () => new Response('PRIVATE', { headers: { 'content-type': 'text/html' } })],
    ['production', () => Response.json({ ...identity, environment: 'production' }, { headers: { 'cache-control': 'no-store' } })],
    ['oversized data', () => Response.json({ ...identity, private: 'PRIVATE'.repeat(15000) }, { headers: { 'cache-control': 'no-store' } })],
  ])('fails closed for %s without recording response contents', async (_, response) => {
    const { fetcher } = fakeSite(url => url.pathname === '/api/version' ? response() : null);
    const report = await inspectLiveQa(options, fetcher);
    expect(report.status).toBe('failed');
    expect(JSON.stringify(report)).not.toContain('PRIVATE');
  });

  it('rejects external login returns and an unexpected auth redirect', async () => {
    const { fetcher } = fakeSite(url => url.pathname === '/auth/callback'
      ? new Response(null, { status: 307, headers: { 'cache-control': 'no-store', location: 'https://example.invalid?token=PRIVATE' } })
      : url.pathname === '/auth' ? new Response(null, { status: 302, headers: { location: '/home' } }) : null);
    const report = await inspectLiveQa(options, fetcher);
    expect(report.status).toBe('failed');
    expect(report.sites[0].checks.filter(check => !check.passed).map(check => check.name)).toEqual(['auth_entry_html', 'callback_return_target', 'callback_external_rejected_target']);
    expect(JSON.stringify(report)).not.toContain('PRIVATE');
  });

  it('drops unknown JSON properties and fetch exception details', async () => {
    let { fetcher } = fakeSite(url => url.pathname === '/api/version'
      ? Response.json({ ...identity, private: 'PRIVATE' }, { headers: { 'cache-control': 'no-store' } }) : null);
    const report = await inspectLiveQa(options, fetcher);
    expect(report.status).toBe('passed');
    expect(JSON.stringify(report)).not.toContain('PRIVATE');
    fetcher = async () => { throw Error('PRIVATE'); };
    const failed = await inspectLiveQa(options, fetcher);
    expect(failed.status).toBe('failed');
    expect(JSON.stringify(failed)).not.toContain('PRIVATE');
  });

  it('does not pretend to check an alias when only a candidate is supplied', async () => {
    const report = await inspectLiveQa({ ...options, stable: null }, fakeSite().fetcher);
    expect(report.status).toBe('passed');
    expect(report.stableReady).toBeNull();
    expect(report.aliasMatchesCandidate).toBeNull();
  });

  it('rejects ambiguous, secret-bearing and unknown CLI arguments before requests', () => {
    expect(liveQaOptions(['--deployment', candidate, '--stable', stable, '--commit', commit])).toEqual({ deployment: candidate, stable, commit });
    for (const url of ['http://candidate.vercel.app', candidate + '/viewer/188', candidate + '/?token=PRIVATE', candidate + '/#PRIVATE', 'https://user:PRIVATE@candidate.vercel.app']) {
      expect(() => liveQaOptions(['--deployment', url, '--commit', commit])).toThrow('https_origin_without_credentials_path_or_query_required');
    }
    expect(() => liveQaOptions(['--deployment', candidate, '--commit', 'aaaaaaa'])).toThrow('reviewed_40_character_commit_required');
    expect(() => liveQaOptions(['--deployment', candidate, '--commit', commit, '--stable', candidate])).toThrow('stable_and_deployment_must_differ');
    expect(() => liveQaOptions(['--deployment', candidate, '--commit', commit, '--token', 'PRIVATE'])).toThrow('invalid_live_qa_option');
    expect(() => liveQaOptions(['--deployment', candidate, '--commit', commit, '--commit', commit])).toThrow('invalid_live_qa_option');
  });
});
