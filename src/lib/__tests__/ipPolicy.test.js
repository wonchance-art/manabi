import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween';

/**
 * 계약: IP 정책 정합 (오너 확정 2026-08-31 "아주 적극적으로 사용해야함", #1077).
 *
 * 이 계약이 존재하는 이유는 **실측된 사고**다. 브랜드 정책 v1(#642, 2026-07-25
 * "최대한 활용")은 문서로 멀쩡히 살아 있었는데, CLAUDE.md 하드리밋에는 조건도 예외도
 * 없는 `IP: 상호·인물·작품·브랜드·국기·엠블럼 무재현` 한 줄만 있었다. 세션은 CLAUDE.md를
 * 자동 로드하고 정책 문서는 찾아 읽어야 하므로 **단정형 한 줄이 정책을 5주간 덮었고**,
 * ot-12-menzei 돈키호테가 그 틈에서 멈춰 섰다.
 *
 * ⇒ 그러므로 지킬 것은 문구가 아니라 **두 문서가 갈리지 않는 것**이다. 문구를 통째로
 * 얼리면 이번 축에서 반복 관찰된 실수(요구가 아니라 구현 모양을 고정)를 되풀이한다.
 * 아래 단언은 전부 "요구가 살아 있나"만 묻는다 — 표현·순서·예시는 자유롭게 고쳐도 된다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('IP 정책 정합 계약 (v2 — 브랜드 적극 사용)', () => {
  it('CLAUDE.md 하드리밋: 전면 금지가 아니라 적극 사용 + 금지 넷', () => {
    const limits = sliceBetween(read('CLAUDE.md'), '## 하드리밋', '## 개발 환경');

    // ① 옛 단정형이 되살아나지 않는다 — 이 한 줄이 정책을 덮었던 장본인이다.
    expect(limits, '옛 전면 금지 문장 부활').not.toContain('상호·인물·작품·브랜드·국기·엠블럼 무재현');

    // ② 텍스트 사용이 허용임을 하드리밋 자체가 말한다(정책 문서까지 안 가도 읽히게).
    expect(limits).toMatch(/적극\s*사용/);

    // ③ 금지 넷이 전부 살아 있다. 어느 하나가 빠지면 정책이 반쪽이 된다.
    expect(limits, '금지⑴ 시각 재현').toMatch(/로고[\s\S]{0,80}(도트|이미지)/);
    expect(limits, '금지⑵ 저작물 본문 복제').toMatch(/가사[\s\S]{0,60}(복제|전재|원문)/);
    expect(limits, '금지⑶ 허위·비방').toMatch(/비방|허위/);
    expect(limits, '금지⑷ 중화권 정치').toContain('중화권 정치 서술 완전 배제');
  });

  it('이중 진실 방지 — CLAUDE.md가 정책 정본을 가리킨다', () => {
    // 사고의 구조적 원인은 정책 내용이 아니라 **포인터 부재**였다.
    // 정책만 고치고 포인터를 안 박으면 같은 일이 그대로 반복된다.
    const limits = sliceBetween(read('CLAUDE.md'), '## 하드리밋', '## 개발 환경');
    expect(limits).toContain('docs/policy-brand-content.md');
  });

  it('정책 정본은 v2이고 등재제로 되돌아가지 않는다', () => {
    const policy = read('docs/policy-brand-content.md');

    expect(policy).toMatch(/브랜드·작품 활용 v2/);
    // 허용목록(등재제) 폐기가 v2의 핵심 — "등재돼야 쓸 수 있다"가 부활하면 안 된다.
    expect(policy, '등재제 판정 기준 부활').not.toContain('감사는 목록 등재 여부로 판정한다');
    expect(policy).toMatch(/허용목록[\s\S]{0,20}폐기/);
    // 금지 넷이 상세 정본에도 실재해야 CLAUDE.md 요약과 짝이 맞는다.
    for (const ban of ['시각 재현', '본문 복제', '비방', '중화권 정치']) {
      expect(policy, `정책 문서에 금지 누락: ${ban}`).toContain(ban);
    }
  });

  it('구 IP 감사표는 스테일 경고를 달고 v1 시점 기록임을 밝힌다', () => {
    // 이 문서의 A/B/C 분류는 "무재현" 전제 위에서 쓰였다. 경고 없이 두면
    // 다음 세션이 현행 판정 기준으로 오독한다(이번 사고와 같은 형태의 오독).
    const head = sliceBetween(read('docs/audit-ip-candidates.md'), '# IP 감사', '## 요약');
    expect(head).toMatch(/v1 시점 기록/);
    expect(head).toContain('docs/policy-brand-content.md');
  });
});
