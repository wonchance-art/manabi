import { describe, expect, it } from 'vitest';
import { buildReaderSections, lineIndexOfTokens, readerLineGroups, sectionOfLine, sectionedPagePosition, sectionedPercent } from '../readerSections.js';

// VIEWER-SECTIONS-001 — 긴 글의 쪽 넘김을 구간 단위로 그리는 순수 계산.
function material(lineLengths) {
  const sequence = [], dictionary = {};
  lineLengths.forEach((n, l) => {
    for (let t = 0; t < n; t++) { const id = `id_${l}_${t}`; sequence.push(id); dictionary[id] = { text: 'x', pos: '명사' }; }
    if (l < lineLengths.length - 1) { const br = `br_${l}_${n}`; sequence.push(br); dictionary[br] = { text: '\n', pos: '개행' }; }
  });
  return { sequence, dictionary };
}

describe('readerLineGroups — 렌더 · 문장 목록이 같이 쓰는 줄 묶기', () => {
  it('개행 토큰으로 자르고 원문 줄 번호를 토큰 id에서 읽는다 · 사전에 없는 토큰은 건너뛴다', () => {
    const { sequence, dictionary } = material([2, 3]);
    sequence.push('missing');
    expect(readerLineGroups(sequence, dictionary)).toEqual([
      { rawIdx: 0, tokenIds: ['id_0_0', 'id_0_1'] },
      { rawIdx: 1, tokenIds: ['id_1_0', 'id_1_1', 'id_1_2'] },
    ]);
    expect(readerLineGroups(null, dictionary)).toEqual([]);
  });
});

describe('buildReaderSections — 줄을 쪼개지 않고 목표 칸 수로 묶는다', () => {
  const groups = lens => readerLineGroups(...Object.values(material(lens)));
  it('짧은 글(1,200칸 미만)은 나누지 않는다 — 지금 그대로', () => {
    expect(buildReaderSections(groups(Array(50).fill(12)))).toBeNull(); // 600칸
  });
  it('목표(500칸)에 닿을 때까지 줄을 잇고, 짧은 꼬리는 앞 구간에 붙인다', () => {
    const sections = buildReaderSections(groups(Array(110).fill(12))); // 1,320칸 — 42줄(504) · 42줄(504) · 26줄(312 ≥ 250 그대로)
    expect(sections.map(s => [s.start, s.end, s.tokens])).toEqual([[0, 42, 504], [42, 84, 504], [84, 110, 312]]);
    const tail = buildReaderSections(groups([...Array(105).fill(12), 3])); // 꼬리 3줄 39칸 → 앞에 붙음
    expect(tail.at(-1).end).toBe(106);
    expect(tail.every(s => s.tokens >= 250)).toBe(true);
  });
  it('한 줄이 목표보다 길면 그 줄 혼자 한 구간', () => {
    const sections = buildReaderSections(groups([700, 700, 10]));
    expect(sections.map(s => [s.start, s.end])).toEqual([[0, 1], [1, 3]]);
  });
  it('구간은 빈틈 · 겹침 없이 모든 줄을 덮는다', () => {
    const lens = Array.from({ length: 300 }, (_, i) => 5 + (i * 7) % 13);
    const sections = buildReaderSections(groups(lens));
    expect(sections[0].start).toBe(0);
    expect(sections.at(-1).end).toBe(300);
    sections.slice(1).forEach((s, i) => expect(s.start).toBe(sections[i].end));
    expect(sections.reduce((a, s) => a + s.tokens, 0)).toBe(lens.reduce((a, b) => a + b, 0));
  });
});

describe('구간 찾기 · 쪽 표시', () => {
  it('줄 → 구간(경계 포함) · 토큰 → 줄', () => {
    const sections = [{ start: 0, end: 42 }, { start: 42, end: 84 }, { start: 84, end: 110 }];
    expect([0, 41, 42, 83, 84, 109, 500, -1].map(l => sectionOfLine(sections, l))).toEqual([0, 0, 1, 1, 2, 2, 2, 0]);
    const lines = lineIndexOfTokens([{ tokenIds: ['a', 'b'] }, { tokenIds: ['c'] }]);
    expect([lines.get('a'), lines.get('c'), lines.get('z')]).toEqual([0, 1, undefined]);
  });
  it('목업: 앞 구간을 다 알면 「N쪽 · P%」, 전부 알면 「N / 전체쪽 · P%」, 가운데서 열었으면 「P%」', () => {
    expect(sectionedPagePosition({ section: 0, page: 2, counts: [12, undefined, undefined], percent: 4.4 })).toEqual({ page: 3, count: null, percent: 4 });
    expect(sectionedPagePosition({ section: 1, page: 0, counts: [12, 13, undefined], percent: 33 })).toEqual({ page: 13, count: null, percent: 33 });
    expect(sectionedPagePosition({ section: 2, page: 4, counts: [12, 13, 9], percent: 90 })).toEqual({ page: 30, count: 34, percent: 90 });
    expect(sectionedPagePosition({ section: 2, page: 0, counts: [undefined, 13, 9], percent: 70 })).toEqual({ page: null, count: null, percent: 70 });
    expect(sectionedPagePosition({ section: 0, page: 0, counts: [5], percent: 120 })).toEqual({ page: 1, count: 5, percent: 100 });
  });
  it('글 전체 진도 = 앞 구간 칸 + 지금 구간 안 진도', () => {
    const sections = [{ tokens: 500 }, { tokens: 500 }, { tokens: 250 }];
    expect(sectionedPercent(sections, 0, 0)).toBe(0);
    expect(sectionedPercent(sections, 1, 50)).toBe(60);
    expect(sectionedPercent(sections, 2, 100)).toBe(100);
  });
});
