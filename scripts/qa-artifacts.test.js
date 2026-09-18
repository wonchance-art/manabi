import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { stageQaArtifacts } from './qa-artifacts.mjs';

describe('synthetic QA artifact staging', () => {
  it('keeps reports/screens/traces but never follows dependency or file links', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-evidence-'));
    try {
      const source = path.join(root, 'runs'), output = path.join(root, 'evidence');
      fs.mkdirSync(path.join(source, 'run', 'step'), { recursive: true });
      fs.mkdirSync(path.join(source, 'run', 'assets'));
      fs.mkdirSync(path.join(root, 'dependencies'));
      fs.writeFileSync(path.join(root, 'dependencies', 'package.json'), 'DO NOT COPY');
      const put = (name, value = name) => fs.writeFileSync(path.join(source, 'run', name), value);
      for (const file of ['result.json', 'summary.md', 'step/report.json', 'step/failure.png', 'step/failure-trace.zip', 'step/process.log']) put(file);
      put('step/release-contracts.mjs');put('assets/font.png');put('.env.local');
      fs.symlinkSync(path.join(root, 'dependencies'), path.join(source, 'run', 'node_modules'));
      fs.symlinkSync(path.join(root, 'dependencies', 'package.json'), path.join(source, 'run', 'linked.json'));
      const result = stageQaArtifacts(source, output);
      expect(result.files).toBe(6);expect(result.bytes).toBeGreaterThan(0);
      expect(fs.readFileSync(path.join(output, 'run', 'step', 'report.json'), 'utf8')).toBe('step/report.json');
      for (const file of ['node_modules', 'linked.json', '.env.local', 'assets', 'step/release-contracts.mjs']) expect(fs.existsSync(path.join(output, 'run', file))).toBe(false);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('handles a missing run directory without inventing evidence', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-evidence-empty-'));
    try {
      expect(stageQaArtifacts(path.join(root, 'absent'), path.join(root, 'output'))).toEqual({ files: 0, bytes: 0 });
      expect(fs.existsSync(path.join(root, 'output'))).toBe(false);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
