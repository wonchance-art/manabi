import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// 독해 검증기의 결함 자가 검출 — spawnSync로 --self-test 호출(exit 0 = 전종 검출).
// 기존 17종(G1·G4·G5·G6·Q·DR + 강화: P1-2 리터럴 하드게이트 3·P1-3 まだです 경계·P1-5 드릴 미커버·
// P2-10 중첩 지명·G7 강등) + 신규 5종(YLOCK 가나-온리 오염·오쿠리가나 くます·락 미등재·G4 どちらも
// 조사 정확일치·문항 id 중복) = 22종.
describe('check-reading --self-test', () => {
  it('픽스처 22종을 모두 검출한다', () => {
    const r = spawnSync('node', ['scripts/check-reading.mjs', '--self-test'], { cwd: ROOT, encoding: 'utf8' });
    expect(r.stdout).toContain('22/22 검출');
    expect(r.status).toBe(0);
  }, 30000);
});
