import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { digest, relevantFile, resumeStep, reportMarkdown } from './qa-state.mjs';

describe('QA evidence reuse', () => {
  it('only resumes a completed step with unchanged inputs and an intact report', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'manabi-qa-test-'));
    try {
      const step = { id: 'notes-webkit', browser: 'webkit', groups: ['notes.collection'] };
      const relative = '.qa/runs/prior/notes/report.json';
      fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
      const bytes = JSON.stringify({ engine: 'webkit', groups: step.groups, cleanup: { status: 'completed' }, errors: [] });
      fs.writeFileSync(path.join(root, relative), bytes);
      const item = { id: step.id, status: 'passed', exitCode: 0, reportPath: relative, reportHash: digest(bytes) };
      const previous = { fingerprint: 'same', status: 'failed', steps: [item] };
      expect(resumeStep(step, previous, 'same', root)).toEqual(item);
      expect(resumeStep(step, previous, 'changed', root)).toBeNull();
      expect(resumeStep(step, { ...previous, status: 'running' }, 'same', root)).toBeNull();
      expect(resumeStep(step, { ...previous, steps: [{ ...item, reportPath: '../secret' }] }, 'same', root)).toBeNull();
      fs.writeFileSync(path.join(root, relative), bytes + ' ');
      expect(resumeStep(step, previous, 'same', root)).toBeNull();
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  it('tracks content, DB and test changes but not archival notes or derived PDF worker', () => {
    for (const file of ['src/content/book.md', 'e2e/check.mjs', 'scripts/qa.mjs', 'supabase/migrations/new.sql', 'package-lock.json', '.github/workflows/ci.yml']) expect(relevantFile(file)).toBe(true);
    expect(relevantFile('docs/verification/report.md')).toBe(false);
    expect(relevantFile('public/pdf.worker.min.mjs')).toBe(false);
  });
  it('does not present synthetic evidence as real authentication or production completion', () => {
    const result = reportMarkdown({ profile: 'notes', status: 'passed', head: 'a'.repeat(40), startedAt: '2026-09-17T00:00:00Z', steps: [] });
    expect(result).toContain('KST');
    expect(result).toContain('실제 사용자 로그인');
    expect(result).toContain('의미하지 않습니다');
  });
});
