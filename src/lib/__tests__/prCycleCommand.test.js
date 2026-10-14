import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 계약: /pr-cycle 「병합 직전 점검」(오너 승인 2026-10-14 — 스킬 검토 ⑩ verification-before-completion 부분 채택).
 * 2026-10-14 두 번의 병합 사고(#1450 보류 요청 미확인 · #1459 철회 커밋 cherry-pick)는
 * 모두 테스트 · CI green 상태에서 났다. 원인은 검수 채널을 고정 페이지로만 읽은 것이다.
 * 절차가 조용히 빠지지 않게 핵심 단계만 고정한다(문구 전체를 복사하지 않는다 — 이중 진실 방지).
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const doc = read('.claude/commands/pr-cycle.md');
const check = sliceBetween(doc, '### 5-1. 병합 직전 점검', '### 6.');

describe('/pr-cycle — 병합 직전 점검', () => {
  it('green이어도 바로 병합하지 않고 5-1을 먼저 거친다 — 병합 지시는 점검 뒤에만 나온다', () => {
    const ci = sliceBetween(doc, '### 5. CI 확인', '### 5-1.');
    expect(ci).toContain('5-1 병합 직전 점검');
    expect(ci).not.toContain('squash merge**(');
    expect(check).toContain('squash merge');
  });

  it('검수 채널을 마지막 댓글까지 — comments 수로 끝 번호, 다음 페이지 빈 배열 확인', () => {
    expect(check).toContain('#1337');
    expect(check).toContain('comments');
    expect(check).toContain('빈 배열');
    for (const stop of ['병합 보류', '오너 지시 전달', '철회']) expect(check).toContain(stop);
  });

  it('철회 인계 금지 · 검수 head = 지금 head(expectedHeadSha) · base 이동 시 합친 결과 · CI', () => {
    expect(check).toContain('cherry-pick');
    expect(check).toContain('expectedHeadSha');
    expect(check).toContain('git merge-tree');
    expect(check).toContain('git merge --abort');
    expect(check).toContain('필수 CI');
  });

  it('이번 턴에 새로 조회한 결과로만 — 기억 재사용 금지', () => {
    expect(check).toContain('이번 턴에 새로 조회한 결과');
  });
});
