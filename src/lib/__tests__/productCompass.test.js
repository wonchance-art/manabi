import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 계약: 제품 나침반(오너 승인 2026-08-20) — "기초가 튼튼하지 않으면 안 된다."
// 나침반은 모든 세션이 자동 로드하는 CLAUDE.md에, 상세 지도는 arch 문서에 산다.
// 문서는 오독되고 낡는다는 실측 위에서, 최소한 '존재와 상호 포인터'는 계약으로 지킨다.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('제품 나침반 지속 계약', () => {
  it('CLAUDE.md — 나침반 섹션: 두 순환 + 3문 체크 + 정본 포인터', () => {
    const claude = read('CLAUDE.md');
    expect(claude).toContain('## 제품 나침반');
    expect(claude).toContain('두 학습 순환');
    expect(claude).toContain('모든 제안·구현 전 3문');
    expect(claude).toContain('docs/architecture-and-handoff.md');
    expect(claude).toContain('계약 테스트로 심는다');
    // 오너 지시(2026-08-20): 아이디어·설계 검토 시 선례·오픈소스 조사를 묻지 않아도 수행
    expect(claude).toContain('선례·오픈소스 조사는 기본값');
    expect(claude).toContain('채택/부분 채택/배제');
  });

  it('arch 문서 — 순환 지도(§1.1)와 이음새 지도, 3문 체크(§2), 최근 지뢰(§4.9-0)', () => {
    const arch = read('docs/architecture-and-handoff.md');
    expect(arch).toContain('### 1.1 두 학습 순환 지도');
    expect(arch).toContain('이음새 지도');
    // 의도적 단절을 부채로 오인해 임의로 잇는 사고 방지 — 두 종류 구분이 살아 있어야 한다
    expect(arch).toMatch(/의도적[\s\S]{0,600}부채/);
    expect(arch).toContain('제안·구현 전 3문 체크');
    expect(arch).toContain('### 4.9-0 최근 지뢰 3건');
  });
});
