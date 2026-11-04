import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween';

/**
 * 계약: 오너 승인 문단의 이중 진실 방지 (오너 확정 2026-11-04 — 원칙 문서 감사 M1).
 *
 * Claude 세션은 CLAUDE.md만, Codex는 AGENTS.md만 자동 로드한다. 그래서 「학습 개선의 지속 실행
 * 승인」 문단은 두 파일에 같이 있어야 하는데, 한쪽만 고치면 두 에이전트가 서로 다른 권한으로 움직인다.
 * 문구를 얼리는 게 아니라 **두 사본이 같다**는 것만 묻는다 — 고칠 때는 두 곳을 함께 고치면 된다.
 */
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const HEAD = '## 학습 개선의 지속 실행 승인';
const body = (src, end) => sliceBetween(src, HEAD, end).trim();

describe('CLAUDE.md ↔ AGENTS.md 승인 문단 일치', () => {
  it('지속 실행 승인 문단이 두 파일에서 글자까지 같다', () => {
    const claude = body(read('CLAUDE.md'), '## 공통 품질 실행');
    const agents = body(read('AGENTS.md'), '## 공통 품질 실행');
    expect(claude.length).toBeGreaterThan(200);
    expect(agents).toBe(claude);
  });
});
