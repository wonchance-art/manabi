import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// 독해 검증기의 6종 결함 자가 검출 — spawnSync로 --self-test 호출(exit 0 = 6/6 검출)
describe('check-reading --self-test', () => {
  it('픽스처 6종을 모두 검출한다', () => {
    const r = spawnSync('node', ['scripts/check-reading.mjs', '--self-test'], { cwd: ROOT, encoding: 'utf8' });
    expect(r.stdout).toContain('6/6 검출');
    expect(r.status).toBe(0);
  }, 30000);
});
