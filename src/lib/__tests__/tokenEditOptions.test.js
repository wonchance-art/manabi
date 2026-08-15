import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildMeaningOptions, buildReadingOptions } from '../tokenEditOptions.js';

// 계약: 뜻·발음 수동 편집(링큐식)의 후보 구성 — 사전 다중 뜻(pos 태그 동반)이 흔한 순으로
// 먼저, 현재 표시값이 사전에 없으면 뒤에 붙고, 전부 중복 없이.

describe('buildMeaningOptions — 뜻 후보', () => {
  const dictEntry = {
    meanings: [
      { meaning: '일하다', priority: 1, pos: '동사' },
      { meaning: '일, 직업', priority: 2, pos: '명사' },
    ],
  };

  it('사전 다중 뜻(pos 동반)이 순서대로, 현재 뜻이 사전에 없으면 뒤에 붙는다', () => {
    expect(buildMeaningOptions(dictEntry, { meaning: '작업' })).toEqual([
      { meaning: '일하다', pos: '동사' },
      { meaning: '일, 직업', pos: '명사' },
      { meaning: '작업' },
    ]);
  });

  it('현재 뜻이 사전과 같으면 중복 없이 한 번만', () => {
    expect(buildMeaningOptions(dictEntry, { meaning: '일하다' })).toHaveLength(2);
  });

  it('사전 없음(미등재 단어)이면 현재 뜻만, 전부 비면 빈 배열', () => {
    expect(buildMeaningOptions(null, { meaning: '계획' })).toEqual([{ meaning: '계획' }]);
    expect(buildMeaningOptions(null, { meaning: '' })).toEqual([]);
  });
});

describe('buildReadingOptions — 발음 후보', () => {
  it('현재 발음(문장 문맥 병음) → 사전 발음 → 추가 후보(다음자) 순, 중복 제거', () => {
    expect(buildReadingOptions(
      { reading: 'hái' },
      { furigana: 'huán' },
      ['hái', 'huán', 'xuán'],
    )).toEqual(['huán', 'hái', 'xuán']);
  });

  it('빈 값은 제외한다', () => {
    expect(buildReadingOptions(null, { furigana: '' }, [])).toEqual([]);
    expect(buildReadingOptions({ reading: 'gōngzuò' }, {}, [])).toEqual(['gōngzuò']);
  });
});

// 계약: 편집 UI가 뷰어에 실제로 배선돼 있어야 한다 — 교정 뮤테이션은 예전부터 있었지만
// 호출하는 UI가 없어 죽은 코드였다(이번에 개통). 배선이 사라지면 다시 죽는다.
describe('편집 배선 계약 (ViewerPage.jsx)', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');

  it('TokenEditPanel이 교정 핸들러와 함께 렌더된다', () => {
    expect(src).toContain('<TokenEditPanel');
    expect(src).toMatch(/handleCorrectToken\(selectedToken\.id, corrections\)/);
  });

  it('편집은 자료 소유자에게만 노출된다(materials update RLS 정합)', () => {
    expect(src).toMatch(/canEditToken = !!user\?\.id && user\.id === material\?\.owner_id/);
  });
});
