#!/usr/bin/env node
// Local task closeout, separate from synthetic CI. Never publishes or executes next work.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { digest, sourceFingerprint, writeJson } from './qa-state.mjs';

const text = value => typeof value === 'string' && value.trim().length > 0;
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const kinds = ['automated', 'synthetic-ui', 'actual-account', 'physical-device', 'editorial', 'inspection'];
const assert = (condition, message) => { if (!condition) throw Error(message); };

export function closeoutSnapshot(cwd) {
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  assert(!git(['status', '--porcelain', '--untracked-files=normal']), 'closeout_requires_clean_checkout');
  return { head: git(['rev-parse', 'HEAD']), fingerprint: sourceFingerprint(cwd) };
}

// Evidence is local and excluded from CI artifact upload. Never follow links or
// accept arbitrary paths into credentials, personal uploads or browser auth files.
export function evidenceFile(cwd, relative) {
  assert(typeof relative === 'string' && /^(\.qa\/(runs|live|closeouts)\/|docs\/verification\/)/.test(relative)
    && !relative.split('/').some(part => part === '..' || part === '.')
    && !/(^|[/_.-])(env|cookie|token|secret|storage-?state|auth-?state)([./_-]|$)/i.test(relative)
    && /\.(json|md|log|png)$/.test(relative), 'closeout_invalid_evidence_path');
  const root = fs.realpathSync(cwd), target = path.resolve(root, relative);
  assert(target.startsWith(root + path.sep), 'closeout_invalid_evidence_path');
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    assert(!fs.lstatSync(current).isSymbolicLink(), 'closeout_symlink_evidence');
  }
  assert(fs.statSync(target).isFile(), 'closeout_evidence_not_file');
  return target;
}

export function assessCloseout(record, current, readEvidence, now = Date.now()) {
  assert(record?.version === 1 && text(record.task) && text(record.scope), 'closeout_task_required');
  assert(record.candidate?.head === current.head && record.candidate?.fingerprint === current.fingerprint,
    'closeout_stale_candidate');
  const frozen = Date.parse(record.candidate.frozenAt);
  assert(Number.isFinite(frozen) && frozen <= now, 'closeout_invalid_freeze_time');
  assert(Array.isArray(record.checks) && record.checks.length > 0, 'closeout_checks_required');
  const ids = new Set();
  for (const check of record.checks) {
    assert(text(check.id) && !ids.has(check.id), 'closeout_duplicate_or_missing_check');ids.add(check.id);
    assert(text(check.expectation) && typeof check.required === 'boolean' && kinds.includes(check.kind), 'closeout_invalid_check');
    assert(['passed', 'failed', 'not-run'].includes(check.status), 'closeout_invalid_check_status');
    assert(text(check.observed), 'closeout_observation_required');
    if (check.status === 'not-run') {
      assert(text(check.reason), 'closeout_missing_not_run_reason');continue;
    }
    const checkedAt = Date.parse(check.checkedAt);
    assert(Number.isFinite(checkedAt) && checkedAt >= frozen && checkedAt <= now, 'closeout_recheck_required');
    assert(check.method === 'fresh' || (check.method === 'verified-reuse' && text(check.reuseReason)), 'closeout_reuse_reason_required');
    assert(Array.isArray(check.evidence) && check.evidence.length > 0, 'closeout_evidence_required');
    for (const item of check.evidence) {
      assert(text(item.path) && sha(item.sha256), 'closeout_invalid_evidence');
      assert(digest(readEvidence(item.path)) === item.sha256, 'closeout_changed_evidence');
    }
  }
  assert(record.checks.some(check => check.required), 'closeout_required_check_missing');
  const review = record.review;
  assert(review && text(review.outcome) && text(review.counterevidence) && text(review.learning), 'closeout_review_required');
  assert(Array.isArray(review.remaining) && review.remaining.every(text), 'closeout_remaining_required');
  assert(Array.isArray(record.next?.candidates), 'closeout_next_review_required');
  const nextIds = new Set();
  for (const item of record.next.candidates) {
    assert(text(item.id) && !nextIds.has(item.id), 'closeout_duplicate_next');nextIds.add(item.id);
    assert(text(item.action) && text(item.reason) && text(item.doneWhen)
      && ['now', 'later', 'blocked'].includes(item.priority)
      && ['existing-scope', 'proposal', 'needs-user'].includes(item.authorization), 'closeout_invalid_next');
    if (item.priority === 'blocked' || item.authorization === 'needs-user') assert(text(item.dependency), 'closeout_dependency_required');
  }
  assert(text(record.next.reason), 'closeout_direction_reason_required');
  let selected = null;
  if (record.next.selected !== null) {
    selected = record.next.candidates.find(item => item.id === record.next.selected);
    assert(selected && selected.priority === 'now', 'closeout_invalid_direction');
  }
  const unresolved = record.checks.filter(check => check.required && check.status !== 'passed');
  const failures = record.checks.filter(check => check.status === 'failed');
  const status = unresolved.length || failures.length || review.remaining.length ? 'follow-up' : 'reviewed';
  assert(status === 'reviewed' || record.next.candidates.length > 0, 'closeout_follow_up_direction_required');
  return { status, unresolved: unresolved.map(check => check.id),
    nextAction: selected?.action || null,
    execution: selected?.authorization || 'wait',
    // Human/agent observations are audited for completeness, not independently certified.
    verification: 'evidence-integrity-and-review-completeness',
    production: 'not-authorized-by-closeout', userAcceptance: 'not-inferred' };
}

export function closeoutMarkdown(record, result) {
  const checks = record.checks.map(check => `- ${check.id}: ${check.status} · ${check.kind} · ${check.required ? '필수' : '선택'}\n  - 기대: ${check.expectation}\n  - 관찰: ${check.observed}${check.status === 'not-run' ? `\n  - 미실행: ${check.reason}` : `\n  - 재검수: ${check.method}${check.reuseReason ? ` (${check.reuseReason})` : ''}`}`);
  return [`# ${record.task} · 최종 리뷰`, '', `범위: ${record.scope}`, '',
    `후보: ${record.candidate.head}`, `입력 지문: ${record.candidate.fingerprint}`, '',
    `마무리 판정: **${result.status}** (이 과제 범위만)`, '',
    '## 최종 재검수', '', ...checks, '',
    '## 결과 리뷰', '', record.review.outcome, '', `반례·한계: ${record.review.counterevidence}`, '',
    `다음에 반영할 점: ${record.review.learning}`, '',
    ...record.review.remaining.map(item => `- 남은 문제: ${item}`), '',
    '## 다음 방향', '', record.next.reason, '',
    ...record.next.candidates.map(item => `- ${item.id} [${item.priority}; ${item.authorization}]: ${item.action}\n  - 이유: ${item.reason}\n  - 완료 조건: ${item.doneWhen}${item.dependency ? `\n  - 의존 조건: ${item.dependency}` : ''}`), '',
    `선택: ${record.next.selected || '대기/종료'} · 이 도구는 다음 작업을 실행하지 않습니다.`, '',
    '증거 파일 무결성·리뷰 누락을 검사했습니다. 관찰의 진실성·의미 정확성·사용자 수용을 자동 인증하지 않으며 병합·배포 승인을 대신하지 않습니다.', '',
  ].join('\n');
}

export function initialCloseout(task, candidate, frozenAt = new Date().toISOString()) {
  return { version: 1, task, scope: '', candidate: { ...candidate, frozenAt },
    checks: [{ id: 'user-flow', expectation: '', required: true, kind: 'inspection', status: 'not-run', observed: '', reason: '' }],
    review: { outcome: '', counterevidence: '', learning: '', remaining: [] },
    next: { candidates: [], selected: null, reason: '' } };
}

export function runCloseout(cwd, args) {
    const [action, id, ...extra] = args;
    assert(['init', 'check'].includes(action) && /^[a-z0-9][a-z0-9-]{0,79}$/.test(id || '') && !extra.length,
      'usage: npm run qa:closeout -- <init|check> <task-id>');
    const directory = path.join(cwd, '.qa/closeouts', id), file = path.join(directory, 'review.json');
    for (const target of [path.join(cwd, '.qa'), path.join(cwd, '.qa/closeouts'), directory]) {
      if (fs.existsSync(target)) assert(fs.lstatSync(target).isDirectory(), 'closeout_directory_must_not_be_symlink');
    }
    // Remove old success even when the checkout is now dirty or the candidate changed.
    if (action === 'check') for (const name of ['result.json', 'summary.md']) fs.rmSync(path.join(directory, name), { force: true });
    const current = closeoutSnapshot(cwd);
    if (action === 'init') {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(initialCloseout(id, current), null, 2) + '\n', { flag: 'wx' });
      return { exitCode: 0, output: `미완료 초안: .qa/closeouts/${id}/review.json` };
    } else {
      const bytes = fs.readFileSync(evidenceFile(cwd, `.qa/closeouts/${id}/review.json`));
      const record = JSON.parse(bytes);
      const result = assessCloseout(record, current, relative => fs.readFileSync(evidenceFile(cwd, relative)));
      const finalCandidate = closeoutSnapshot(cwd);
      assert(finalCandidate.head === current.head && finalCandidate.fingerprint === current.fingerprint,
        'closeout_candidate_changed_during_review');
      assert(digest(fs.readFileSync(file)) === digest(bytes), 'closeout_review_changed_during_check');
      const summary = closeoutMarkdown(record, result);
      writeJson(path.join(directory, 'result.json'), { ...result, candidate: current, reviewHash: digest(bytes) });
      fs.writeFileSync(path.join(directory, 'summary.md'), summary);
      return { exitCode: result.status === 'reviewed' ? 0 : 2, output: summary };
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = runCloseout(fileURLToPath(new URL('../', import.meta.url)), process.argv.slice(2));
    console.log(result.output);process.exitCode = result.exitCode;
  } catch (error) { console.error(`마무리 미확정: ${error.message}`);process.exitCode = 1; }
}
