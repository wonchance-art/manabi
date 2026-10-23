import { describe, expect, it } from 'vitest';
import { HUN_RUBY_DEFAULTS, hunLabelEm, hunRubyCells } from '../viewerHunRuby';
import { hanjaReadingsOf, listHanjaHunEum } from '../hanjaKo';
import koTable from '../data/hanjaKo.json';
import hunTable from '../data/hanjaHun.json';
import tradTable from '../data/hanjaTrad.json';

/**
 * 계약: 표제어 훈음 루비 셀(VIEWER-V2-ROUNDS-001 §2.1 · AE-R1 설계서 §2·§7.1·§10.2).
 * viewerHanjaReading.test.js의 네 성질(빈 표 0 · 반복 글자·순서 보존 · 음만 폴백 · 마크업 해석 0)을
 * 루비 셀 함수로 옮기고, 넘침 규칙을 더한다: 글자 칸(32px)보다 넓으면 그 칸만 벌림(--hun-n),
 * 칸 × 1.6을 넘으면 훈/음 두 줄. 조회는 R0+ 단일 함수 hanjaReadingsOf 그대로(정체 꼴).
 */
const real = { koTable, hunTable, tradTable };

describe('네 성질(별도 훈음 목록에서 이관)', () => {
  it('표 미로드·라벨 전무면 null — 빈 루비 줄을 만들지 않는다', () => {
    expect(hunRubyCells('老师', {})).toBeNull();
    expect(hunRubyCells('老师', { koTable: {} })).toBeNull();
    expect(hunRubyCells('🙂abc', { koTable: { 老: '로' }, hunTable: { 老: '늙을' } })).toBeNull();
    expect(hunRubyCells('', real)).toBeNull();
  });
  it('반복 글자·순서·두음 라벨을 보존하고 글자 수와 같은 길이', () => {
    const cells = hunRubyCells('老老师', { koTable: { 老: '로', 师: '사' }, hunTable: { 老: '늙을', 师: '스승' } });
    expect(cells.map((c) => [c.ch, c.label])).toEqual([['老', '늙을 로(노)'], ['老', '늙을 로(노)'], ['师', '스승 사']]);
  });
  it('음만 있는 글자는 음 라벨, 미등재 글자는 빈 셀(지어내지 않는다) — 자리는 남긴다', () => {
    const cells = hunRubyCells('弩你🙂', { koTable: { 弩: '노', 你: '니' }, hunTable: { 弩: '쇠뇌' } });
    expect(cells.map((c) => c.label)).toEqual(['쇠뇌 노', '니(이)', null]);
    expect(cells[2]).toMatchObject({ lines: [], hunN: 0, spread: false });
    expect(cells.length).toBe([...'弩你🙂'].length);
  });
  it('라벨은 문자열 그대로 돌려준다 — HTML을 만들지 않는다(렌더가 이스케이프)', () => {
    const cells = hunRubyCells('字', { koTable: { 字: '자' }, hunTable: { 字: '<img src=x>' } });
    expect(cells[0].lines).toEqual(['<img src=x>', '자']);
    expect(typeof cells[0].lines[0]).toBe('string');
  });
  it('라벨은 기존 훈음 나열(listHanjaHunEum)과 같은 값 — 같은 조회 함수', () => {
    for (const word of ['技术', '价格', '体育场', '壮观', '一点']) {
      const fromCells = hunRubyCells(word, real).filter((c) => c.label).map(({ ch, label }) => ({ ch, label }));
      expect(fromCells).toEqual(listHanjaHunEum(word, koTable, hunTable, tradTable));
      expect(hunRubyCells(word, real).map((c) => c.label)).toEqual(hanjaReadingsOf(word, real).map((r) => r.label));
    }
  });
});

describe('정체 꼴 골든(R0+) — 루비에서도 그대로', () => {
  it('技术 재주 술 · 一点 검은 점 점', () => {
    expect(hunRubyCells('技术', real).map((c) => c.label)).toEqual(['재주 기', '재주 술']);
    expect(hunRubyCells('一点', real)[1].label).toBe('검은 점 점');
  });
});

describe('넘침 — 칸 벌림(--hun-n)과 두 줄', () => {
  it('폭 어림은 설계서 실측과 맞는다(13px: 「몸 체」 30 · 「기를 육」 43)', () => {
    expect(hunLabelEm('몸 체') * 13).toBeCloseTo(29.9, 1);
    expect(hunLabelEm('기를 육') * 13).toBeCloseTo(42.9, 1);
    expect(HUN_RUBY_DEFAULTS).toMatchObject({ glyphPx: 32, hunPx: 13, twoLineRatio: 1.6 });
  });
  const t = { koTable: { 体: '체', 育: '육', 场: '장', 壮: '장', 老: '로' }, hunTable: { 体: '몸', 育: '기를', 场: '마당', 壮: '씩씩할', 老: '늙을' } };
  it('글자 칸 안이면 벌리지 않는다 — 몸 체', () => {
    const [cell] = hunRubyCells('体', t);
    expect(cell).toMatchObject({ lines: ['몸 체'], spread: false, wrap: false });
    expect(cell.hunN).toBeCloseTo(32 / 13, 2);
  });
  it('칸보다 넓고 1.6배 이하면 한 줄로 그 칸만 벌린다 — 기를 육 · 마당 장', () => {
    const cells = hunRubyCells('体育场', t);
    expect(cells.map((c) => c.spread)).toEqual([false, true, true]);
    expect(cells[1]).toMatchObject({ lines: ['기를 육'], hunN: 3.3 });
    expect(cells[1].hunN * 13).toBeGreaterThan(32);
  });
  it('1.6배를 넘으면 훈/음 두 줄 — 씩씩할 장 · 늙을 로(노)', () => {
    const [a] = hunRubyCells('壮', t);
    expect(a.lines).toEqual(['씩씩할', '장']);
    expect(a.em).toBe(3);
    const [b] = hunRubyCells('老', t);
    expect(b.lines).toEqual(['늙을', '로(노)']);
  });
  it('아주 긴 훈(풀이)은 칸을 상한(글자 폭 3배)까지만 벌리고 칸 안에서 줄바꿈 — 잘라내지 않는다', () => {
    const long = '쇠뇌(여러 개의 화살이나 돌을 잇따라 쏘게 된 큰 활)';
    const [cell] = hunRubyCells('弩', { koTable: { 弩: '노' }, hunTable: { 弩: long } });
    expect(cell.lines).toEqual([long, '노']);
    expect(cell.wrap).toBe(true);
    expect(cell.hunN).toBeCloseTo((32 * 3) / 13, 2);
    expect(cell.label).toBe(`${long} 노`);
  });
  it('음만 있는 라벨은 나누지 않는다', () => {
    const [cell] = hunRubyCells('你', { koTable: { 你: '니' }, hunTable: {} });
    expect(cell.lines).toEqual(['니(이)']);
  });
  it('글자 칸·훈음 크기 옵션 — 둘 다 200%면 판정이 같고(em 단위), 칸만 키우면 벌림이 사라진다', () => {
    expect(hunRubyCells('育', t, { glyphPx: 64, hunPx: 26 })[0]).toMatchObject({ spread: true, hunN: 3.3 });
    expect(hunRubyCells('育', t, { glyphPx: 64 })[0].spread).toBe(false);
  });
});
