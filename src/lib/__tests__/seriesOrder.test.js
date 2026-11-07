// SERIES-ORDER-001 (2026-11-08 KST) — 공개 자료 목록이 한 번에 넣은 시드 수십 편을 감당하는지.
// 운영 실측: 공개 132편의 created_at이 시각 3개뿐이라 최신순 안쪽이 DB 임의 순서였고(「B1 #6 · A1 #5 · B1 #10 …」),
// 번호가 빠진 시리즈([H3 여행 #2]만 공개)는 카드 표지가 「2/1」이었다.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { compareSeriesPath, seriesTotalsOf } from '../seriesMeta';
import { sliceBetween } from './helpers/sliceBetween.js';

const row = (title, created_at = '2026-05-01T10:11:31.698508+00:00') => ({ title, created_at });

describe('seriesTotalsOf — 총 편수는 가장 큰 번호', () => {
  it('빠진 번호가 있어도 번호가 총 편수를 넘지 않는다', () => {
    const totals = seriesTotalsOf([row('[H3 여행 #2] 问路 (길 묻기)'), row('[H2 여행 #1] 去上海旅游 (상하이 여행)')]);
    expect(totals.get('H3|여행')).toBe(2);
    expect(totals.get('H2|여행')).toBe(1);
  });
  it('1부터 빠짐없는 시리즈는 편수와 같다', () => {
    const totals = seriesTotalsOf(Array.from({ length: 30 }, (_, i) => row(`[A1 grammar #${30 - i}] t`)));
    expect(totals.get('A1|grammar')).toBe(30);
  });
  it('시리즈 · 번호가 없는 제목은 세지 않는다', () => {
    expect(seriesTotalsOf([row('[N5] 学校の一日'), row('사용자 자료'), null]).size).toBe(0);
  });
});

describe('compareSeriesPath — 시리즈 → 번호 → 최신순', () => {
  // 레벨 순서는 부르는 쪽(levelRank)이 먼저 정한다 — 이 비교는 한 레벨 안이다.
  it('같은 시각 · 같은 레벨의 시드가 시리즈 → 번호 순으로 선다', () => {
    const shuffled = ['[N5 문법 #6] a', '[N5 카나 #2] b', '[N5 문법 #10] c', '[N5 문법 #1] d', '[N5 카나 #1] e'].map(t => row(t));
    expect([...shuffled].sort(compareSeriesPath).map(r => r.title)).toEqual([
      '[N5 문법 #1] d', '[N5 문법 #6] a', '[N5 문법 #10] c', '[N5 카나 #1] e', '[N5 카나 #2] b',
    ]);
  });
  it('시리즈 없는 자료는 뒤로, 그 안은 최신순', () => {
    const rows = [row('일기', '2026-01-01T00:00:00Z'), row('[N5 문법 #2] x'), row('메모', '2026-02-01T00:00:00Z')];
    expect([...rows].sort(compareSeriesPath).map(r => r.title)).toEqual(['[N5 문법 #2] x', '메모', '일기']);
  });
});

describe('자료 목록 배선', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '../../views/MaterialsPage.jsx'), 'utf8');
  it('최신순은 시각이 같을 때만 언어 → 레벨 → 시리즈 경로로 잇는다', () => {
    const block = sliceBetween(page, "if (sortBy === 'newest')", "if (sortBy === 'words')");
    expect(block).toContain('if (ta !== tb) return tb - ta;');
    expect(block).toContain('compareSeriesPath(a, b)');
  });
  it('카드의 시리즈 총 편수는 seriesTotalsOf 하나에서 나온다', () => {
    expect(page).toContain('const seriesTotals = seriesTotalsOf(materials);');
    expect(page).not.toMatch(/seriesTotals\.set\(/);
  });
});
