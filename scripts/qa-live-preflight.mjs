#!/usr/bin/env node
// Public HTTP checks only. Never log response bodies, cookies, or provider URLs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseVerificationErrors } from '../src/lib/releaseVersion.js';

const SHA = /^[a-f0-9]{40}$/;
const ID = /^dpl_[A-Za-z0-9]+$/;
const CALLBACK = '/auth/callback';
const NEXT = '/notes/new';

export function liveQaOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error();
    return url.origin;
  } catch { throw Error('https_origin_without_credentials_path_or_query_required'); }
}

export function liveQaOptions(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!['--deployment', '--commit', '--stable'].includes(key) || options[key] || !argv[i + 1] || argv[i + 1].startsWith('--')) throw Error('invalid_live_qa_option');
    options[key] = argv[i + 1];
  }
  if (!SHA.test(options['--commit'] || '')) throw Error('reviewed_40_character_commit_required');
  const deployment = liveQaOrigin(options['--deployment']);
  const stable = options['--stable'] ? liveQaOrigin(options['--stable']) : null;
  if (stable === deployment) throw Error('stable_and_deployment_must_differ');
  return { deployment, stable, commit: options['--commit'] };
}

function publicIdentity(value) {
  return {
    commit: SHA.test(value?.commit || '') ? value.commit : null,
    deploymentId: ID.test(value?.deploymentId || '') ? value.deploymentId : null,
    environment: ['preview', 'production', 'development'].includes(value?.environment) ? value.environment : null,
  };
}

async function versionJson(response) {
  if (!/\bapplication\/json\b/i.test(response.headers.get('content-type') || '')) throw Error('invalid_version_content_type');
  const reader = response.body?.getReader();
  if (!reader) throw Error('empty_version');
  const parts = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 65536) throw Error('version_too_large');
      parts.push(value);
    }
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); }
}

export async function inspectLiveQa({ deployment, stable = null, commit, bundledEditionId }, fetcher = fetch) {
  deployment = liveQaOrigin(deployment);
  if (stable) stable = liveQaOrigin(stable);
  if (!SHA.test(commit || '')) throw Error('reviewed_40_character_commit_required');
  if (stable === deployment) throw Error('stable_and_deployment_must_differ');
  const report = {
    schemaVersion: 1, kind: 'public-live-preflight', checkedAt: new Date().toISOString(),
    expectedCommit: commit, status: 'failed', candidateReady: false, stableReady: null,
    sites: [], aliasMatchesCandidate: null,
    evidence: { publicHttp: true, realAccount: false, providerLogin: false, oauthAllowlist: false, teacherStudentPermissions: false, writes: false },
  };
  for (const [role, origin] of [['candidate', deployment], ...(stable ? [['stable', stable]] : [])]) {
    const site = { role, origin, identity: null, checks: [] };
    report.sites.push(site);
    const check = (name, passed, detail) => site.checks.push({ name, passed, ...(detail ? { detail } : {}) });
    async function request(route, inspect) {
      let response;
      try {
        response = await fetcher(new URL(route, origin), {
          method: 'GET', redirect: 'manual', credentials: 'omit', cache: 'no-store',
          signal: AbortSignal.timeout(15000), headers: { accept: route === '/api/version' ? 'application/json' : 'text/html' },
        });
        // A fetch implementation that followed a redirect is not an identity proof.
        if (response.redirected) throw Error('redirect_followed');
        await inspect(response);
      } catch {
        check(route === '/api/version' ? 'version_request' : route.startsWith(CALLBACK) ? 'callback_request' : 'auth_request', false, 'request_or_response_invalid');
      } finally { await response?.body?.cancel().catch(() => {}); }
    }
    async function version(last = false) {
      await request('/api/version', async response => {
        check(last ? 'version_recheck_http' : 'version_http', response.status === 200);
        if (response.status !== 200) return;
        check(last ? 'version_recheck_no_store' : 'version_no_store', /(?:^|,)\s*no-store(?:\s*,|$)/i.test(response.headers.get('cache-control') || ''));
        const identity = await versionJson(response);
        const errors = releaseVerificationErrors(identity, { commit, environment: 'preview', bundledEditionId });
        check(last ? 'version_recheck_identity' : 'version_identity', errors.length === 0, errors.length ? errors.join(',') : undefined);
        const filtered = publicIdentity(identity);
        if (last) check('deployment_unchanged_during_check', JSON.stringify(site.identity) === JSON.stringify(filtered));
        else site.identity = filtered;
      });
    }
    await version();
    await request('/auth?' + new URLSearchParams({ from: NEXT }), async response => {
      check('auth_entry_html', response.status === 200 && /\btext\/html\b/i.test(response.headers.get('content-type') || ''));
    });
    for (const next of [NEXT, 'https://example.invalid']) {
      await request(CALLBACK + '?' + new URLSearchParams({ next }), async response => {
        const prefix = next === NEXT ? 'callback_return' : 'callback_external_rejected';
        check(prefix + '_status', response.status === 307);
        check(prefix + '_no_store', /(?:^|,)\s*no-store(?:\s*,|$)/i.test(response.headers.get('cache-control') || ''));
        const location = response.headers.get('location');
        if (!location) { check(prefix + '_target', false); return; }
        const target = new URL(location, origin);
        check(prefix + '_target', target.origin === origin && !target.username && !target.password && !target.hash
          && target.pathname === '/auth' && target.searchParams.get('error') === 'auth_callback_failed'
          && target.searchParams.get('from') === (next === NEXT ? NEXT : '/materials')
          && [...target.searchParams.keys()].length === 2);
      });
    }
    await version(true);
    site.passed = site.checks.length > 0 && site.checks.every(item => item.passed);
  }
  report.candidateReady = report.sites[0].passed;
  if (stable) {
    const [candidate, alias] = report.sites;
    report.aliasMatchesCandidate = !!candidate.identity?.deploymentId && candidate.identity.commit === alias.identity?.commit
      && candidate.identity.deploymentId === alias.identity?.deploymentId;
    report.stableReady = alias.passed && report.aliasMatchesCandidate;
  }
  report.status = report.candidateReady && (!stable || report.stableReady) ? 'passed' : 'failed';
  return report;
}

export function liveQaSummary(report) {
  const lines = ['# 공개 배포 사전 검사', '', `판정: ${report.status}`, `예상 실행 커밋: ${report.expectedCommit}`, '',
    '| 대상 | 버전·인증 복귀 | 실행 커밋 |', '|---|---|---|'];
  for (const site of report.sites) {
    lines.push(`| ${site.origin} | ${site.passed ? 'PASS' : 'FAIL'} | ${site.identity?.commit || '확인 불가'} |`);
  }
  lines.push('', `고정 주소가 같은 배포를 가리킴: ${report.aliasMatchesCandidate === null ? '검사 안 함' : report.aliasMatchesCandidate ? '예' : '아니오'}`, '',
    '이 결과는 공개 HTTP 사전 검사다. 실제 로그인·OAuth 허용 목록·교사/학생 권한·저장/재접속은 별도 검수이며 아직 확인하지 않았다.', '',
    '실패 항목:');
  for (const site of report.sites) for (const item of site.checks.filter(item => !item.passed)) {
    lines.push(`- ${site.role}: ${item.name}${item.detail ? ` (${item.detail})` : ''}`);
  }
  return lines.join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = liveQaOptions(process.argv.slice(2));
    const bundledEditionId = JSON.parse(fs.readFileSync(new URL('../src/content/textbookEditions/index.json', import.meta.url))).current;
    const report = await inspectLiveQa({ ...options, bundledEditionId });
    // Kept apart from .qa/runs and synthetic CI artifacts; contains only public metadata.
    const output = path.resolve('.qa/live', new Date().toISOString().replaceAll(':', '-') + '-' + process.pid);
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(path.join(output, 'summary.md'), liveQaSummary(report));
    console.log(liveQaSummary(report));
    console.log(`보고서: ${output}`);
    if (report.status !== 'passed') process.exitCode = 1;
  } catch (error) {
    const safe = new Set(['invalid_live_qa_option', 'https_origin_without_credentials_path_or_query_required', 'reviewed_40_character_commit_required', 'stable_and_deployment_must_differ']);
    console.error(safe.has(error.message) ? error.message : 'live_qa_preflight_failed');
    process.exitCode = 1;
  }
}
