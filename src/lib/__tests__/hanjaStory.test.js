import { describe, expect, it } from 'vitest';
import story from '../data/hanjaStory.json';
import etym from '../data/hanjaEtym.json';
import ko from '../data/hanjaKo.json';

// 계약: 구성 풀이 스토리 정본(R4 — 오너 승인 2026-08-28 "R4 ㄱㄱ").
// 저작 원칙: 실제 분해·자형 근거로만 말한다 — 스토리에 등장하는 한자는 그 글자
// 자신·부수·성분(2단)·간번체 자형(과 그 성분)뿐이어야 한다. 이 닫힘이 깨지면
// 엉뚱한 성분을 언급하는 저작 오류다.

const entries = Object.entries(story);

describe('hanjaStory 데이터 정본', () => {
  it('시드 규모 — 최빈 240자 안팎(하한 220)', () => {
    expect(entries.length).toBeGreaterThan(220);
  });

  it('키는 전부 한 글자 한자이고 음 정본(hanjaKo) 소속', () => {
    const bad = entries.filter(([ch]) => [...ch].length !== 1 || !ko[ch]).map(([ch]) => ch);
    expect(bad).toEqual([]);
  });

  it('본문은 비어 있지 않고 60자 이하 — 카드 한 줄 규율', () => {
    const bad = entries.filter(([, s]) => !s || typeof s !== 'string' || [...s].length > 60).map(([ch]) => ch);
    expect(bad).toEqual([]);
  });

  it('한자 언급 닫힘 — 자기·부수·성분(2단)·간번체(와 그 1단 성분)만', () => {
    const allowedFor = (ch) => {
      const set = new Set([ch]);
      const add1 = (c) => {
        const e = etym[c];
        if (!e) return;
        if (e[1]) set.add(e[1]); // 부수
        for (const x of e[2] || '') set.add(x);
      };
      const e = etym[ch] || [];
      if (e[1]) set.add(e[1]);
      for (const x of e[2] || '') { set.add(x); add1(x); }
      for (const x of (e[3] || '') + (e[4] || '') + (e[5] || '')) { set.add(x); add1(x); }
      return set;
    };
    const bad = [];
    for (const [ch, s] of entries) {
      const allowed = allowedFor(ch);
      for (const h of s.match(/\p{Script=Han}/gu) || []) {
        if (!allowed.has(h)) bad.push(`${ch}:${h}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('스팟 핀 — 대표 3자(想·好·学)의 풀이가 성분·자형과 결이 맞는다', () => {
    expect(story['想']).toContain('相');
    expect(story['想']).toContain('心');
    expect(story['好']).toContain('女');
    expect(story['好']).toContain('子');
    expect(story['学']).toContain('學');
  });
});
