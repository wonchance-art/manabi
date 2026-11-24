import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { LEVELS, levelRank } from '../constants';
import { sliceBetween } from './helpers/sliceBetween.js';

// LIB-FIX-001(2026-11-24 KST): 서재 급수순(personal_library_page_v2)의 순위는 SQL 함수 library_private.material_level_rank가 정하고,
// 자료실 급수순은 JS levelRank(LEVELS 배열 순서)가 정한다 — 같은 기준이 두 곳에 있으니 둘이 같다는 것을 여기서 묶는다(중복 신설 금지).
// 값마다의 실행 대조는 PGlite 계약 supabase/tests/library-level-sort-rank.mjs가 한다(LEVELS 전부 · 목록 밖 · 언어 모름).
const sql = fs.readFileSync('supabase/migrations/20261124010000_library_level_sort_rank.sql', 'utf8');
const block = sliceBetween(sql, '-- level-rank:begin', '-- level-rank:end');

function sqlArrays() {
  const out = {};
  for (const m of block.matchAll(/WHEN '(\w+)' THEN ARRAY\[([^\]]*)\]/g)) out[m[1]] = [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1]);
  return out;
}

describe('서재 급수 순위 — SQL 배열 = LEVELS', () => {
  it('언어 목록과 각 언어의 급수 순서가 같다', () => {
    expect(block.length).toBeGreaterThan(100);
    expect(sqlArrays()).toEqual(Object.fromEntries(Object.entries(LEVELS).map(([k, v]) => [k, [...v]])));
  });
  it('0부터 — SQL은 array_position − 1(JS levelRank의 indexOf와 같은 원점)', () => {
    expect(block).toMatch(/array_position\(CASE p_language[\s\S]*END::text\[\], p_level\) - 1/);
    expect(levelRank('Japanese', 'N5 기초')).toBe(0);
    expect(levelRank('Chinese', 'H5 고급')).toBe(5);
    expect(levelRank('English', '없는 급수')).toBe(null);
  });
  it('급수순 키는 순위 함수 · 없는 급수는 맨 끝(nulls last)', () => {
    expect(sql).toMatch(/case when p_filters->>'sort'='level' then library_private\.material_level_rank\(item->>'language',item->>'level'\) end nulls last/);
  });
});
