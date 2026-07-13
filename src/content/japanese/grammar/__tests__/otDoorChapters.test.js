import { describe, it, expect } from 'vitest';
import chapters from '../n5.js';

// 🏮 문화 도어 챕터(편의점·이자카야) 사실·범위 계약 — 월드 NPC 와 원전 챕터가 같은 정정을
//   유지하도록 회귀 고정(Codex #92). 단정 표현이 다시 스며들면 여기서 실패한다.

const bySlug = (slug) => chapters.find((c) => c.slug === slug);
const flat = (chap) => JSON.stringify(chap);

describe('ot-08-izakaya — 단정 완화 계약', () => {
  const s = flat(bySlug('ot-08-izakaya'));

  it('과도한 단정 표현이 남지 않는다(가게·상황차 반영)', () => {
    for (const banned of ['전혀 무례하지', '오히려 정석', '국민 첫 주문', '일본인이 앉자마자', '바가지가 아니라 문화', '바가지 아님']) {
      expect(s).not.toContain(banned);
    }
  });

  it('범위 제한 표현으로 대체돼 있다', () => {
    expect(s).toContain('많은'); // "많은 이자카야에서 / 많은 사람이 …" 범위 한정
    expect(s).toContain('가게에 따라'); // お通し 유료·호출 매너의 가게차
    expect(s).toContain('とりあえず生で'); // 핵심 표현 자체는 유지
  });

  it('とりあえず生で의 で 설명이 수단이 아닌 선택·요청(Nで)으로 정정돼 있다', () => {
    expect(s).toContain('Nで'); // 선택·요청형 명시
    expect(s).toContain('선택·요청'); // 프레이밍 명시
    // 옛 오설명(생맥주를 '수단'으로 가르치던 문구)이 남지 않아야 한다.
    expect(s).not.toContain("'로'와 같은 조사"); // "…의 で — '생맥주로'의 '로'와 같은 조사" 옛 문구
    expect(s).not.toContain('바로 앞 6챕터에서 배운 그 수단');
  });
});

describe('ot-07-konbini — 肉まん 데움 오정보 계약', () => {
  const chap = bySlug('ot-07-konbini');
  const s = flat(chap);

  it('あたため 문답 대상은 おべんとう(도시락) — 肉まん에 데움을 붙이지 않는다', () => {
    expect(s).toContain('おべんとう'); // 데움 대상 = 도시락
    // 스토리/예문에 "肉まん、あたため" 형태(호빵을 데운다)가 남지 않아야 함.
    expect(s).not.toMatch(/肉まん[、。][^」]*あたため/);
  });
});
