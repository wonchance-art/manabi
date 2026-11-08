// M2 공개 카드 난이도 한 줄(오너 「권장대로」 · 계산은 서버 metadata.difficulty — 오케스트레이터 2026-11-08 KST).
// 대체 경로 계약: 값이 없거나 형식이 다르면 줄을 그리지 않는다(지금 화면). 브라우저는 급수 색인을 싣지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { difficultyLine } from '../difficultyLine';

const d = (o) => ({ version: 1, scale: 'HSK', medianLevel: 1, p90Level: 3, types: 55, listedShare: 0.9, ...o });

describe('difficultyLine — 목업 문구 그대로', () => {
  it('HSK: 중앙 · 상위 10%가 다르면 「대부분 · 어려운 말 …까지」, 같으면 「… 단어 위주」', () => {
    expect(difficultyLine(d())).toBe('대부분 HSK 1 · 어려운 말 HSK 3까지 · 단어 55개');
    expect(difficultyLine(d({ p90Level: 1, types: 34 }))).toBe('HSK 1 단어 위주 · 단어 34개');
  });
  it('JLPT는 N 표기(5 = N5)', () => {
    expect(difficultyLine(d({ scale: 'JLPT', medianLevel: 5, p90Level: 3, types: 80 }))).toBe('대부분 N5 · 어려운 말 N3까지 · 단어 80개');
  });
});

describe('대체 경로 — 줄 없음(지금 화면)', () => {
  it.each([
    ['값 없음', undefined], ['null', null], ['다른 판', d({ version: 2 })], ['영어(scale null)', d({ scale: null })],
    ['모르는 척도', d({ scale: 'CEFR' })], ['급수 없음', d({ medianLevel: null })], ['단어 0', d({ types: 0 })],
  ])('%s', (_, value) => { expect(difficultyLine(value)).toBeNull(); });
});

describe('배선', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'src/views/MaterialsPage.jsx'), 'utf8');
  it('카드는 서버 값만 읽고, 급수 색인(levelListData · materialDifficulty)을 목록에 싣지 않는다', () => {
    expect(page).toContain('difficultyLine(m.processed_json?.metadata?.difficulty)');
    expect(page).toContain("return line ? <p className=\"mat-card__difficulty\">{line}</p> : null;");
    expect(page).not.toMatch(/from ['"][^'"]*(levelListData|materialDifficulty)['"]/);
    expect(fs.readFileSync(path.join(process.cwd(), 'src/lib/difficultyLine.js'), 'utf8')).not.toMatch(/^import /m);
  });
});
