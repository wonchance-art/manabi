#!/usr/bin/env node
// One local, credential-free entry point; no deploy, merge or hosted DB writes.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { profileSteps, qaEnvironment, validateEvidence, isLoadedEnvFile } from './qa-profiles.mjs';
import { digest, sourceFingerprint, writeJson, resumeStep, reportMarkdown } from './qa-state.mjs';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2), profile = args.shift();
let resume;
while (args.length) {
  const flag = args.shift();
  if (flag !== '--resume' || resume || !args[0]) throw Error('usage: node scripts/qa.mjs <build|sql|reader|notes|classroom|release> [--resume .qa/runs/.../result.json]');
  resume = args.shift();
}
if (Number(process.versions.node.split('.')[0]) !== 24) throw Error('web_qa_requires_node24');
if (profile !== 'build') profileSteps(profile);
// Next automatically loads .env files. Refuse instead of allowing a synthetic test
// build to accidentally inherit an actual project environment. Never read contents.
for (const name of fs.readdirSync(cwd)) if (isLoadedEnvFile(name)) throw Error('qa_requires_isolated_checkout_without_env_files');
fs.mkdirSync(path.join(cwd, '.qa'), { recursive: true });
const lock = path.join(cwd, '.qa/run.lock');
let lockFd;
try { lockFd = fs.openSync(lock, 'wx');fs.writeSync(lockFd, String(process.pid)); }
catch { throw Error('qa_already_running_or_interrupted_lock: inspect .qa/run.lock before retrying'); }

const children = new Set();
const kill = child => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
  const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }, 3000);
  timer.unref();
};
let interrupted = false;
const interrupt = () => { interrupted = true;for (const child of children) kill(child); };
process.on('SIGINT', interrupt);process.on('SIGTERM', interrupt);
const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid;
const runDir = path.join(cwd, '.qa/runs', runId), base = 'http://localhost:3137';
fs.mkdirSync(runDir, { recursive: true });
const env = qaEnvironment({}, base, runDir);
const fingerprint = sourceFingerprint(cwd);
const report = { version: 1, profile, fingerprint,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' }).trim(),
  startedAt: new Date().toISOString(), status: 'running', steps: [],
  realAccount: 'not-run', externalAiEvaluation: 'not-run', physicalDevice: 'not-run', production: 'not-modified' };
const persist = () => { writeJson(path.join(runDir, 'result.json'), report);fs.writeFileSync(path.join(runDir, 'summary.md'), reportMarkdown(report));writeJson(path.join(cwd, '.qa/latest.json'), { report: path.relative(cwd, path.join(runDir, 'result.json')), status: report.status }); };

async function runProcess(command, commandArgs, childEnv, log, timeoutMs = 15 * 60_000) {
  if (interrupted) throw Error('qa_interrupted');
  const fd = fs.openSync(log, 'w');
  const child = spawn(command, commandArgs, { cwd, env: childEnv, stdio: ['ignore', fd, fd], detached: true });
  children.add(child);
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true;kill(child); }, timeoutMs);
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject);child.once('exit', code => resolve(code)); });
    if (timedOut) throw Error('qa_process_timeout');
    if (interrupted) throw Error('qa_interrupted');
    return code;
  } finally { clearTimeout(timer);children.delete(child);fs.closeSync(fd); }
}
let server, serverFd;
async function prepareBuild() {
  const receiptFile = path.join(cwd, '.qa/build.json'), buildIdFile = path.join(cwd, '.next/BUILD_ID');
  let receipt;try { receipt = JSON.parse(fs.readFileSync(receiptFile)); } catch { /* first build */ }
  if (receipt?.fingerprint === fingerprint && fs.existsSync(buildIdFile) && receipt.buildId === fs.readFileSync(buildIdFile, 'utf8').trim()) return;
  console.log('QA build: isolated synthetic environment');
  const prebuild = await runProcess('npm', ['run', 'prebuild'], env, path.join(runDir, 'prebuild.log'));
  if (prebuild !== 0) throw Error('qa_prebuild_failed: see prebuild.log');
  const code = await runProcess('npm', ['run', 'e2e:build'], env, path.join(runDir, 'build.log'), 20 * 60_000);
  if (code !== 0) throw Error('qa_build_failed: see build.log');
  writeJson(receiptFile, { fingerprint, buildId: fs.readFileSync(buildIdFile, 'utf8').trim(), fixtureEnvironment: true });
}
async function startServer() {
  await new Promise((resolve, reject) => { const probe = net.createServer();probe.once('error', error => reject(Error(`qa_server_bind_${error.code}`)));probe.listen(3137, '127.0.0.1', () => probe.close(resolve)); });
  serverFd = fs.openSync(path.join(runDir, 'server.log'), 'w');
  const serverEnv = { ...env, NODE_OPTIONS: `${env.NODE_OPTIONS} --import=${new URL('../e2e/server-fetch-mock.mjs', import.meta.url).href}` };
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3137'], { cwd, env: serverEnv, stdio: ['ignore', serverFd, serverFd], detached: true });
  children.add(server);let spawnError;server.on('error', error => { spawnError = error; });
  const until = Date.now() + 45_000;
  while (Date.now() < until) {
    if (spawnError || server.exitCode !== null || interrupted) throw Error('qa_server_failed');
    try { if ((await fetch(base + '/manifest.webmanifest', { signal: AbortSignal.timeout(1500) })).ok) return; } catch { /* wait for this process */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw Error('qa_server_timeout');
}
try {
  persist();
  if (profile === 'build') { await prepareBuild();report.status = 'passed'; }
  else {
    let previous;
    if (resume) {
      const file = path.resolve(cwd, resume);
      if (!file.startsWith(path.join(cwd, '.qa/runs') + path.sep)) throw Error('resume_requires_local_qa_report');
      previous = JSON.parse(fs.readFileSync(file));
    }
    for (const step of profileSteps(profile)) {
      const old = resumeStep(step, previous, fingerprint, cwd);
      if (old) { report.steps.push({ ...old, reused: true });persist();console.log(`QA ${step.id}: reused`);continue; }
      const item = { id: step.id, evidence: step.evidence, status: 'running' };report.steps.push(item);persist();
      let evidence;
      try {
        if (step.app && !server) { await prepareBuild();await startServer(); }
        const out = path.join(runDir, step.id);fs.mkdirSync(out, { recursive: true });
        console.log(`QA ${step.id}: running`);
        item.exitCode = await runProcess(process.execPath, [step.file], qaEnvironment(step, base, out), path.join(out, 'process.log'));
        const reportPath = path.join(out, 'report.json');
        const bytes = fs.readFileSync(reportPath);evidence = JSON.parse(bytes);
        Object.assign(item, { reportPath: path.relative(cwd, reportPath), reportHash: digest(bytes) });
        validateEvidence(step, evidence, item.exitCode);
        Object.assign(item, { status: 'passed', groups: evidence.groups, checks: Array.isArray(evidence.checks) ? evidence.checks.length : evidence.checks });
        console.log(`QA ${step.id}: passed`);
      } catch (error) {
        item.status = 'failed';
        item.failure = String(evidence?.failure || evidence?.cleanup?.errors?.join('; ') || error.message).slice(0, 4000);
        console.error(`QA ${step.id}: ${item.failure}`);
        throw Error(`${step.id}: ${item.failure}`);
      }
      finally { persist(); }
    }
    report.status = 'passed';
  }
} catch (error) { report.status = 'failed';report.failure = error.message;process.exitCode = 1; }
finally {
  if (server) {
    if (server.pid && server.exitCode === null && server.signalCode === null) { const exited = new Promise(resolve => server.once('exit', resolve));kill(server);await exited; }
    children.delete(server);
  }
  if (serverFd !== undefined) fs.closeSync(serverFd);
  for (const child of children) kill(child);
  if (sourceFingerprint(cwd) !== fingerprint) { report.status = 'failed';report.failure = 'source_changed_during_qa';process.exitCode = 1; }
  report.finishedAt = new Date().toISOString();persist();
  fs.closeSync(lockFd);fs.unlinkSync(lock);
  process.off('SIGINT', interrupt);process.off('SIGTERM', interrupt);
  console.log(`QA ${report.status}: ${path.relative(cwd, runDir)}/summary.md`);
}
