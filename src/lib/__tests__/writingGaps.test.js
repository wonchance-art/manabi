import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { GAP_MAX_LEN, diffGapsOf, fixesOf, gapKey, harvestWritingGaps } from '../writingGaps';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const row = (o) => ({ id: o.id ?? 'r', created_at: o.created_at ?? '2026-09-02T00:00:00Z', language: 'Japanese', errors: [], ...o });

/**
 * 계약: U R2 첨삭 → 「못 쓴 말」 수확 (#1077 5503520174 착수 SPEC).
 * 두 재료 독립(errors[].fix / sentence↔corrected diff) · 오류 없는 문장 수확 0 · 반복은 count 누적 ·
 * 자동 담기 금지 · 중복 행 금지(정본 upsert) · 언어가 다른 행은 섞이지 않는다.
 */
describe('writingGaps — 순수 수확기', () => {
  it('errors가 비어도 sentence↔corrected 대조만으로 수확된다(diffChars 재사용)', () => {
    expect(read('src/lib/writingGaps.js')).toContain("import { diffChars } from './diffChars';");
    const out = harvestWritingGaps([row({ sentence: '私は学校に行く', corrected: '私は学校へ行きます', errors: [] })]);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((g) => g.sources.includes('diff'))).toBe(true);
    expect(out.map((g) => g.text)).toContain('へ');
  });

  it('errors만 있고 corrected가 없어도 수확된다', () => {
    const out = harvestWritingGaps([row({ sentence: 'Je suis allé', corrected: null, errors: [{ part: 'allé', fix: 'allé au', why: '', tag: 'prep' }] })]);
    expect(out.map((g) => g.text)).toEqual(['allé au']);
    expect(out[0].sources).toEqual(['fix']);
  });

  it('오류 없는 문장(corrected === sentence)에서 수확량이 0이다 — errors가 있어도', () => {
    const out = harvestWritingGaps([row({ sentence: '今日は晴れです', corrected: '今日は晴れです', errors: [{ fix: '晴れ' }] })]);
    expect(out).toEqual([]);
    expect(diffGapsOf(row({ sentence: 'a b', corrected: 'a  b' }))).toEqual([]);
  });

  it('같은 표현 반복은 count로 누적되고(약점 강도), 정렬은 count → 최근 → 표현', () => {
    const rows = [
      row({ id: 1, created_at: '2026-09-01', sentence: 'x', corrected: 'x y', errors: [{ fix: 'を' }] }),
      row({ id: 2, created_at: '2026-09-02', sentence: 'x', corrected: 'x z', errors: [{ fix: 'を' }, { fix: 'に' }] }),
      row({ id: 3, created_at: '2026-09-03', sentence: 'q', corrected: 'q w', errors: [{ fix: 'に' }] }),
    ];
    const out = harvestWritingGaps(rows);
    const wo = out.find((g) => g.text === 'を');
    const ni = out.find((g) => g.text === 'に');
    expect(wo.count).toBe(2);
    expect(ni.count).toBe(2);
    expect(out.indexOf(ni)).toBeLessThan(out.indexOf(wo)); // 같은 count → 최근(09-03) 먼저
    expect(wo.samples.map((s) => s.id)).toEqual([1, 2]);
    // 한 행 안에서 같은 표현이 fix·diff 양쪽에 있어도 한 번만 센다
    const both = harvestWritingGaps([row({ sentence: 'x', corrected: 'x を', errors: [{ fix: 'を' }] })]);
    expect(both.find((g) => g.text === 'を').count).toBe(1);
    expect(both.find((g) => g.text === 'を').sources).toEqual(['diff', 'fix']);
  });

  it('언어가 다른 행은 섞이지 않는다 — 같은 표현이라도 별개 항목', () => {
    const out = harvestWritingGaps([
      row({ language: 'Japanese', sentence: 'x', corrected: 'x!', errors: [{ fix: 'the' }] }),
      row({ language: 'English', sentence: 'x', corrected: 'x!', errors: [{ fix: 'the' }] }),
    ]);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((g) => gapKey(g.lang, g.text))).size).toBe(2);
    expect(harvestWritingGaps([row({ language: null, sentence: 'x', corrected: 'y', errors: [{ fix: 'z' }] })])).toEqual([]);
  });

  it('문장 통째·구두점만·빈 값은 표현이 아니다', () => {
    expect(fixesOf({ errors: [{ fix: 'a'.repeat(GAP_MAX_LEN + 1) }, { fix: '。' }, { fix: '' }, { fix: ' です ' }] })).toEqual(['です']);
    expect(diffGapsOf(row({ sentence: '行く', corrected: '行く。' }))).toEqual([]);
  });
});

describe('작문 화면 배선 (WritingStudioPage)', () => {
  const page = read('src/views/WritingStudioPage.jsx');

  it('수확은 순수 모듈, 담기는 정본 조립기(buildVocabRow + VOCAB_UPSERT) — 행 조립 신설 0', () => {
    expect(page).toContain("import { harvestWritingGaps, gapKey } from '../lib/writingGaps';");
    expect(page).toContain("import { VOCAB_UPSERT, buildVocabRow } from '../lib/vocabIO';");
    expect(page).toContain('const writingGaps = useMemo(() => harvestWritingGaps(gapRows), [gapRows]);');
    const add = sliceBetween(page, 'async function addGap(g) {', '\n  }\n');
    expect(add).toContain('buildVocabRow({');
    expect(add).toContain("supabase.from('user_vocabulary').upsert([row], VOCAB_UPSERT)");
    expect(add).not.toMatch(/word_text:\s/);
    // 수확 재료는 errors 컬럼 미적용 환경에서도 sentence↔corrected로(두 재료 독립)
    expect(page).toContain("'id, created_at, language, sentence, corrected'");
  });

  it('자동 담기 금지 — 단어장으로 가는 문은 [담기] 버튼뿐(M7 저촉 회피 지점)', () => {
    expect(page).toContain('onClick={() => addGap(g)}');
    expect(page.match(/addGap\(/g)).toHaveLength(2); // 정의 1 + 버튼 onClick 1
    expect(page).not.toMatch(/useEffect\([\s\S]{0,300}addGap\(/);
    expect(page).toContain('자동으로 담지 않아요');
  });
});
