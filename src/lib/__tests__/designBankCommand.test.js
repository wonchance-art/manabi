import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 계약: /design-bank 절차 명령 (#1077 설계, 오너 착수 승인 2026-08-30).
 * 이 파일의 존재 이유는 **이중 진실 방지**다 — 설계 원칙 정본은 CLAUDE.md이고
 * 명령 파일은 절차만 담는다. 원칙을 여기 복사하면 두 곳이 갈린다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const CMD = '.claude/commands/design-bank.md';

describe('/design-bank — 절차 명령', () => {
  it('기존 명령 6종 옆에 7번째로 존재하고 같은 머리 형식을 쓴다', () => {
    const dir = fs.readdirSync(path.join(process.cwd(), '.claude/commands'));
    expect(dir).toContain('design-bank.md');
    expect(dir.filter((f) => f.endsWith('.md')).length).toBeGreaterThanOrEqual(7);
    expect(read(CMD).split('\n')[0]).toBe('# /design-bank — 아이디어 → 설계 → 박제');
  });

  it('규모 3분류를 먼저 선언하게 한다 — J를 A와 같은 무게로 다룬 과설계의 교정', () => {
    const doc = read(CMD);
    expect(doc).toContain('규모 선언');
    for (const grade of ['탐침', '국소', '구조']) expect(doc).toContain(grade);
  });

  it('실측 우선·섹션별 승인·자기 검토가 절차로 들어 있다', () => {
    const doc = read(CMD);
    expect(doc).toContain('주장 **전에** grep');
    expect(doc).toContain('한 번에 한 질문');
    expect(doc).toContain('실측으로 확인 안 된 것');
  });

  it('v2-L 약속 이행 — 새 계약은 깨뜨려 FAIL 1회 확인 + sliceBetween 지정', () => {
    const doc = read(CMD);
    expect(doc).toContain('일부러 깨뜨려 FAIL을 1회 확인');
    expect(doc).toContain('sliceBetween');
    // 미커밋 파일에 git checkout을 쓰다 작업분을 날린 사고를 절차로 막는다
    expect(doc).toContain('역치환');
  });

  it('이중 진실 방지 — 원칙은 CLAUDE.md를 가리키고 여기서 재서술하지 않는다', () => {
    const doc = read(CMD);
    expect(doc).toContain('CLAUDE.md가 정본');
    // 원칙 본문(나침반 3문의 실제 문장)이 복사돼 있으면 두 곳이 갈린다
    expect(doc).not.toContain('순환의 어느 정거장에 꽂히나');
    expect(doc).not.toContain('오너 승인 2026-08-20');
  });

  it('박제처가 #1077 코멘트 + 목차 표 갱신으로 못박혀 있다', () => {
    const doc = read(CMD);
    expect(doc).toContain('#1077');
    expect(doc).toContain('목차 코멘트의 표를 갱신');
  });
});
