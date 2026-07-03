import { describe, it, expect } from 'vitest';
import { createRegistry } from '../../content/refRegistry';

// 인트로 레벨 판정 — 각 언어 levelMeta의 첫 항목(OT/A0)이 인트로.
describe('createRegistry — isIntroLevel / INTRO_LEVEL', () => {
  const levelMeta = [
    { key: 'OT', label: 'OT 오리엔테이션' },
    { key: 'A1', label: 'A1 기초' },
    { key: 'A2', label: 'A2 초급' },
  ];
  const grammarMap = {
    OT: [{ slug: 'ot-01', level: 'OT', order: 1 }],
    A1: [{ slug: 'a1-01', level: 'A1', order: 1 }],
  };
  const reg = createRegistry(levelMeta, grammarMap, {});

  it('INTRO_LEVEL은 levelMeta 첫 항목의 key', () => {
    expect(reg.INTRO_LEVEL).toBe('OT');
  });

  it('첫 레벨은 인트로로 판정 (대소문자 무관)', () => {
    expect(reg.isIntroLevel('OT')).toBe(true);
    expect(reg.isIntroLevel('ot')).toBe(true);
  });

  it('그 외 레벨은 인트로가 아님', () => {
    expect(reg.isIntroLevel('A1')).toBe(false);
    expect(reg.isIntroLevel('A2')).toBe(false);
  });

  it('빈 값·null은 인트로가 아님', () => {
    expect(reg.isIntroLevel(null)).toBe(false);
    expect(reg.isIntroLevel(undefined)).toBe(false);
    expect(reg.isIntroLevel('')).toBe(false);
  });
});

// 프랑스어처럼 첫 레벨 key가 'A0'인 경우도 동일하게 동작
describe('createRegistry — A0가 인트로인 언어(프랑스어)', () => {
  const reg = createRegistry([{ key: 'A0' }, { key: 'A1' }], { A0: [], A1: [] }, {});

  it('A0가 인트로', () => {
    expect(reg.INTRO_LEVEL).toBe('A0');
    expect(reg.isIntroLevel('A0')).toBe(true);
    expect(reg.isIntroLevel('a0')).toBe(true);
    expect(reg.isIntroLevel('A1')).toBe(false);
  });
});
