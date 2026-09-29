import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { digest } from './qa-state.mjs';
import { assessCloseout, closeoutMarkdown, evidenceFile, initialCloseout, runCloseout } from './qa-closeout.mjs';

const current = { head: 'a'.repeat(40), fingerprint: 'b'.repeat(64) };
const now = Date.parse('2026-09-18T03:00:00+09:00');
const bytes = Buffer.from('Reproduced the original failure, fixed it and checked the final candidate.');
const read = () => bytes;
const fresh = () => ({ ...initialCloseout('reader-focus', current, '2026-09-18T01:00:00+09:00'),
  scope: 'Keep focus in the inspector after a lookup resolves.',
  checks: [{ id: 'keyboard', required: true, kind: 'synthetic-ui', status: 'passed',
    expectation: 'Focus remains within the inspector; Escape restores the selected token.',
    observed: 'Keyboard navigation and Escape passed in Chromium and WebKit.',
    method: 'fresh', checkedAt: '2026-09-18T02:00:00+09:00',
    evidence: [{ path: '.qa/runs/current/report.json', sha256: digest(bytes) }] }],
  review: { outcome: 'The keyboard path is restored.', counterevidence: 'Physical iPad was outside this keyboard-only task.',
    learning: 'Keep an async result focus target mounted.', remaining: [] },
  next: { candidates: [{ id: 'meaning', action: 'Design explicit contextual meaning selection.',
    reason: 'A meal host was confused with a host country in actual use.', priority: 'now', authorization: 'proposal',
    doneWhen: 'Context and dictionary choices stay separate; personal corrections and SRS are preserved.' }],
  selected: 'meaning', reason: 'Meaning is the next unresolved learner-facing risk.' } });

describe('task closeout is distinct from green CI', () => {
  it('records a complete bounded review without inferring acceptance or authorizing follow-up', () => {
    const record = fresh(), result = assessCloseout(record, current, read, now);
    expect(result).toMatchObject({ status: 'reviewed', execution: 'proposal', userAcceptance: 'not-inferred', production: 'not-authorized-by-closeout' });
    const summary = closeoutMarkdown(record, result);
    expect(summary).toContain('synthetic-ui');
    expect(summary).toContain('다음 작업을 실행하지 않습니다');
    expect(summary).toContain(record.review.counterevidence);
  });
  it.each(['head', 'fingerprint'])('rejects a different final %s even when all checks passed', field => {
    expect(() => assessCloseout(fresh(), { ...current, [field]: 'changed' }, read, now)).toThrow('stale_candidate');
  });
  it.each(['2026-09-18T00:00:00+09:00', '2026-09-18T04:00:00+09:00', 'invalid'])('rejects stale or impossible final checks: %s', checkedAt => {
    const record = fresh();record.checks[0].checkedAt = checkedAt;
    expect(() => assessCloseout(record, current, read, now)).toThrow('recheck_required');
  });
  it('rejects changed evidence instead of carrying an earlier success forward', () => {
    expect(() => assessCloseout(fresh(), current, () => Buffer.from('altered'), now)).toThrow('changed_evidence');
    const record = fresh();record.checks[0].evidence = [];
    expect(() => assessCloseout(record, current, read, now)).toThrow('evidence_required');
  });
  it('requires a concrete reason before reusing earlier evidence', () => {
    const record = fresh();record.checks[0].method = 'verified-reuse';
    expect(() => assessCloseout(record, current, read, now)).toThrow('reuse_reason_required');
    record.checks[0].reuseReason = 'Only the separate task board commit changed; reviewed the diff and original report hash.';
    expect(assessCloseout(record, current, read, now).status).toBe('reviewed');
  });
  it.each(['failed', 'not-run'])('does not call a task complete with a required %s check', status => {
    const record = fresh();Object.assign(record.checks[0], { status, reason: 'No physical keyboard available.' });
    expect(assessCloseout(record, current, read, now)).toMatchObject({ status: 'follow-up', unresolved: ['keyboard'] });
  });
  it('does not hide known failures as optional or drop remaining problems', () => {
    const record = fresh();record.checks.push({ ...record.checks[0], id: 'optional', required: false, status: 'failed' });
    expect(assessCloseout(record, current, read, now).status).toBe('follow-up');
    record.checks.pop();record.review.remaining = ['Unexpected focus escape during a live result.'];
    expect(assessCloseout(record, current, read, now).status).toBe('follow-up');
  });
  it('keeps out-of-scope unrun checks visible without forcing endless task expansion', () => {
    const record = fresh();record.checks.push({ id: 'pencil', required: false, kind: 'physical-device', status: 'not-run',
      expectation: 'Pencil handwriting remains usable.', observed: 'Not observed.', reason: 'Outside this keyboard change.' });
    expect(assessCloseout(record, current, read, now).status).toBe('reviewed');
    expect(closeoutMarkdown(record, assessCloseout(record, current, read, now))).toContain('Not observed.');
  });
  it.each(['outcome', 'counterevidence', 'learning'])('requires the %s review even with passing automation', field => {
    const record = fresh();record.review[field] = '';
    expect(() => assessCloseout(record, current, read, now)).toThrow('review_required');
  });
  it('requires a direction and completion criterion rather than an unbounded new task', () => {
    const record = fresh();record.next.candidates[0].doneWhen = '';
    expect(() => assessCloseout(record, current, read, now)).toThrow('invalid_next');
    record.next = { candidates: [], selected: null, reason: 'All requested work is done; no new trigger.' };
    expect(assessCloseout(record, current, read, now).execution).toBe('wait');
    record.review.remaining = ['Known unsolved defect.'];
    expect(() => assessCloseout(record, current, read, now)).toThrow('follow_up_direction_required');
  });
  it('requires blocked dependencies and refuses to select a blocked task', () => {
    const record = fresh();record.next.candidates[0].priority = 'blocked';
    expect(() => assessCloseout(record, current, read, now)).toThrow('dependency_required');
    record.next.candidates[0].dependency = 'Teacher login and team password.';
    expect(() => assessCloseout(record, current, read, now)).toThrow('invalid_direction');
    record.next.selected = null;
    expect(assessCloseout(record, current, read, now).execution).toBe('wait');
  });
  it('starts incomplete and rejects duplicate check IDs', () => {
    expect(() => assessCloseout(initialCloseout('new', current), current, read, now)).toThrow();
    const record = fresh();record.checks.push({ ...record.checks[0] });
    expect(() => assessCloseout(record, current, read, now)).toThrow('duplicate_or_missing_check');
  });
  it('only reads permitted regular evidence files, not arbitrary paths or symlink targets', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-closeout-'));
    try {
      const dir = path.join(root, '.qa/closeouts/test');fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'report.log'), bytes);
      expect(fs.readFileSync(evidenceFile(root, '.qa/closeouts/test/report.log'))).toEqual(bytes);
      for (const file of ['.env.local', '.codex/config.toml', '.qa/closeouts/test/../../x.log', '.qa/closeouts/test/auth-state.json']) {
        expect(() => evidenceFile(root, file)).toThrow('invalid_evidence_path');
      }
      fs.symlinkSync(path.join(dir, 'report.log'), path.join(dir, 'link.log'));
      expect(() => evidenceFile(root, '.qa/closeouts/test/link.log')).toThrow('symlink_evidence');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  it('runs the full local closeout without overwriting a review or retaining stale success', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-closeout-cli-'));
    const git = args => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
    try {
      git(['init']);git(['config', 'user.name', 'QA']);git(['config', 'user.email', 'qa@example.invalid']);
      fs.writeFileSync(path.join(root, '.gitignore'), '.qa/\n');git(['add', '.gitignore']);git(['commit', '-m', 'fixture']);
      expect(runCloseout(root, ['init', 'test']).exitCode).toBe(0);
      expect(() => runCloseout(root, ['init', 'test'])).toThrow('EEXIST');
      const dir = path.join(root, '.qa/closeouts/test'), file = path.join(dir, 'review.json');
      const candidate = JSON.parse(fs.readFileSync(file)).candidate;
      const record = fresh();record.candidate = candidate;
      record.checks[0].checkedAt = new Date().toISOString();
      record.checks[0].evidence[0].path = '.qa/closeouts/test/check.log';
      fs.writeFileSync(path.join(dir, 'check.log'), bytes);fs.writeFileSync(file, JSON.stringify(record));
      expect(runCloseout(root, ['check', 'test']).exitCode).toBe(0);
      expect(JSON.parse(fs.readFileSync(path.join(dir, 'result.json'))).status).toBe('reviewed');
      record.checks[0].status = 'not-run';record.checks[0].reason = 'Waiting for access.';
      fs.writeFileSync(file, JSON.stringify(record));
      expect(runCloseout(root, ['check', 'test']).exitCode).toBe(2);
      fs.writeFileSync(path.join(root, 'change.txt'), 'uncommitted');
      expect(() => runCloseout(root, ['check', 'test'])).toThrow('requires_clean_checkout');
      expect(fs.existsSync(path.join(dir, 'result.json'))).toBe(false);
      fs.rmSync(path.join(root, 'change.txt'));
      git(['commit', '--allow-empty', '-m', 'next head']);
      expect(() => runCloseout(root, ['check', 'test'])).toThrow('stale_candidate');
      fs.symlinkSync(dir, path.join(root, '.qa/closeouts/linked'));
      expect(() => runCloseout(root, ['check', 'linked'])).toThrow('must_not_be_symlink');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
