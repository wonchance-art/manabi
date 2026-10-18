import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

vi.mock('../supabase', () => ({ supabase: {} }));
const { WORD_FACETS, allFacetsKnown, facetIndex, facetMark, updateFacetRows } = await import('../wordFacets.js');
const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

// 탭별 O · X(LEVEL-FACET-AO-001, 오너 결정 2026-10-15 KST 「계정에」) — 알아보기와 떠올리기를 한 줄에 합치지 않는다.
describe('탭별 O · X 기록', () => {
  it('탭은 넷 — 보기 탭(전체 제외)과 같은 이름', () => {
    expect(WORD_FACETS).toEqual(['word', 'sentence', 'meaning', 'audio']);
  });

  it('행 → 단어별 탭 기록, 모르는 탭 · 표시는 버린다, NFC로 대조', () => {
    const idx = facetIndex([
      { word_text: '学习', facet: 'word', mark: 'o' }, { word_text: '学习', facet: 'meaning', mark: 'x' },
      { word_text: '学习', facet: 'grade', mark: 'o' }, { word_text: '爸爸', facet: 'audio', mark: '?' }]);
    expect(facetMark(idx, '学习', 'word')).toBe('o');
    expect(facetMark(idx, '学习', 'meaning')).toBe('x');
    expect(facetMark(idx, '学习', 'sentence')).toBeNull();
    expect(facetMark(idx, '爸爸', 'audio')).toBeNull();
  });

  it('네 탭 모두 O일 때만 「아는 단어로 옮길까요」 — 하나라도 X · 빈칸이면 아님', () => {
    const rows = WORD_FACETS.map((facet) => ({ word_text: '学习', facet, mark: 'o' }));
    expect(allFacetsKnown(facetIndex(rows), '学习')).toBe(true);
    expect(allFacetsKnown(facetIndex(updateFacetRows(rows, { wordText: '学习', facet: 'meaning', mark: 'x' })), '学习')).toBe(false);
    expect(allFacetsKnown(facetIndex(updateFacetRows(rows, { wordText: '学习', facet: 'audio', mark: null })), '学习')).toBe(false);
  });

  it('낙관적 반영: 같은 단어 · 탭은 한 줄만, null이면 지운다', () => {
    const rows = updateFacetRows([{ word_text: 'a', facet: 'word', mark: 'x' }], { wordText: 'a', facet: 'word', mark: 'o' });
    expect(rows).toEqual([{ word_text: 'a', facet: 'word', mark: 'o' }]);
    expect(updateFacetRows(rows, { wordText: 'a', facet: 'word', mark: null })).toEqual([]);
  });

  it('마이그레이션: 추가형 표 하나 · 본인 행만(RLS 4) · anon 차단 · 다른 표에 트리거 없음', () => {
    const sql = read('supabase/migrations/20261015090000_user_word_facets.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.user_word_facets');
    expect(sql).toContain("CHECK (facet IN ('word', 'sentence', 'meaning', 'audio'))");
    expect(sql).toContain("CHECK (mark IN ('o', 'x'))");
    expect(sql).toContain('PRIMARY KEY (user_id, lang, word_text, facet)');
    expect(sql.match(/CREATE POLICY/g)).toHaveLength(4);
    expect(sql.match(/auth\.uid\(\)/g).length).toBeGreaterThanOrEqual(5);
    expect(sql).toContain('REVOKE ALL ON public.user_word_facets FROM anon;');
    const code = sql.replace(/^--.*$/gm, ''); // 롤백 안내 주석(DROP TABLE)은 실행문이 아니다
    expect(code).not.toMatch(/CREATE (OR REPLACE )?(TRIGGER|FUNCTION)|DROP TABLE|ALTER TABLE public\.(?!user_word_facets)|DELETE FROM|UPDATE public\./);
  });

  it('화면 배선: 전체 탭은 아는 단어 · 공부 중 그대로, 탭 O는 그 탭만, 탭 X는 기록 + 공부 중 담기', () => {
    const page = read('src/views/LevelListPage.jsx');
    const o = sliceBetween(page, 'const markFacetO = ', '\n  };');
    expect(o).toContain('facets.mark({ wordText: entry.key, facet, mark });');
    expect(o).not.toMatch(/exclude\(entry\);(?! setToast)/); // 아는 단어로 옮기기는 토스트를 눌렀을 때만
    expect(o).toContain('allFacetsKnown(after, entry.key)');
    const x = sliceBetween(page, 'const markFacetX = ', '\n  };');
    expect(x).toContain("facets.mark({ wordText: entry.key, facet: facetView, mark: 'x' });");
    expect(x).toContain('studyX(entry);');
    expect(page).toContain("onO={() => (facetView ? markFacetO(e) : markO(e))} onX={() => (facetView ? markFacetX(e) : markX(e))}");
    // 표를 읽어 왔을 때만 탭별 기록 — 운영 미적용이면 모든 탭이 단어 단위 O · X(누를 때마다 저장 실패 금지)
    expect(page).toContain("const facetView = vocab && prefs.view !== 'all' && facets.available ? prefs.view : null;");
    expect(read('src/lib/useWordFacets.js')).toContain('available: query.isSuccess');
    expect(page).toContain('splitKnown(inRound, hiddenSet)'); // 새 바퀴면 범위 안 단어만(LEVEL-ROUND-001 ②)
    // 표에 직접 쓰는 곳은 wordFacets.js 하나
    expect(page).not.toContain("from('user_word_facets')");
    // 읽기 · 한 줄 쓰기 + 레벨 초기화의 여러 줄 지우기 · 되살리기(LEVEL-ROUND-001 ②)
    expect(read('src/lib/wordFacets.js').match(/from\('user_word_facets'\)/g)).toHaveLength(4);
  });
});
