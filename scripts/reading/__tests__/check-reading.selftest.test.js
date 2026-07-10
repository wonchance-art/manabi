import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// 독해 검증기의 결함 자가 검출 — spawnSync로 --self-test 호출(exit 0 = 전종 검출).
// 기존 10종 + 강화 6종(P1-2 리터럴 하드게이트 3·P1-3 まだです 경계·P1-5 드릴 미커버·P2-10 중첩 지명)
// + P1-4 맵 미등재 = 17종.
describe('check-reading --self-test', () => {
  it('픽스처 17종을 모두 검출한다', () => {
    const r = spawnSync('node', ['scripts/check-reading.mjs', '--self-test'], { cwd: ROOT, encoding: 'utf8' });
    expect(r.stdout).toContain('17/17 검출');
    expect(r.status).toBe(0);
  }, 30000);
});
