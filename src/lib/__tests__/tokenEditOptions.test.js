import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildMeaningOptions, buildReadingOptions, buildTokenCorrections } from '../tokenEditOptions.js';

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

describe('buildTokenCorrections — 저장 교정 구성(마감 ③)', () => {
  const token = { meaning: '선생님', furigana: 'lǎoshī' };

  it('바뀐 필드만 담고, 무변경이면 null(무저장 닫기 신호)', () => {
    expect(buildTokenCorrections(token, { meaning: '선생님', reading: 'lǎoshī' })).toBeNull();
    expect(buildTokenCorrections(token, { meaning: '스승', reading: 'lǎoshī' }))
      .toEqual({ meaning: '스승' });
  });

  it('뜻 비우기는 무시한다(빈 뜻은 교정으로 무의미)', () => {
    expect(buildTokenCorrections(token, { meaning: '', reading: 'lǎoshī' })).toBeNull();
    expect(buildTokenCorrections(token, { meaning: '  ', reading: 'lǎoshī' })).toBeNull();
  });

  it('발음 비우기는 허용한다(잘못 붙은 병음 제거는 정당한 교정)', () => {
    expect(buildTokenCorrections(token, { meaning: '선생님', reading: '' }))
      .toEqual({ furigana: '' });
  });

  it('pos는 뜻 교정에 동반될 때만 실린다', () => {
    expect(buildTokenCorrections(token, { meaning: '스승', reading: 'lǎoshī', meaningPos: '명사' }))
      .toEqual({ meaning: '스승', pos: '명사' });
    expect(buildTokenCorrections(token, { meaning: '선생님', reading: 'x', meaningPos: '명사' }))
      .toEqual({ furigana: 'x' });
  });
});

// 계약: 편집 UI가 뷰어에 실제로 배선돼 있어야 한다 — 교정 뮤테이션은 예전부터 있었지만
// 호출하는 UI가 없어 죽은 코드였다(이번에 개통). 배선이 사라지면 다시 죽는다.
describe('편집 배선 계약 (ViewerPage.jsx)', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');

  it('TokenEditPanel이 교정 뮤테이션과 함께 렌더되고, 성공 시에만 닫는다(마감 ③)', () => {
    expect(src).toContain('<TokenEditPanel');
    expect(src).toMatch(/correctTokenMutation\.mutate\(\s*\{ tokenId: selectedToken\.id, corrections \}/);
    // 실패 시 패널·입력값 유지: 닫기와 전역 승격이 per-call onSuccess 안에 있어야 한다
    expect(src).toMatch(/onSuccess: \(\) => \{\s*if \(opts\?\.applyGlobal\) promoteCorrection\(selectedToken, corrections\);\s*setIsEditingToken\(false\);/);
  });

  it('토큰 전환 시 리마운트·편집 닫기(마감 ③ — 이전 입력값이 새 토큰에 붙는 것 차단)', () => {
    expect(src).toMatch(/key=\{selectedToken\.id\}/);
    expect(src).toMatch(/useEffect\(\(\) => \{ setIsEditingToken\(false\); \}, \[selectedToken\?\.id\]\)/);
  });

  it('편집은 자료 소유자에게만 노출된다(materials update RLS 정합)', () => {
    expect(src).toMatch(/canEditToken = !!user\?\.id && user\.id === material\?\.owner_id/);
  });
});

// 패널 자체 마감 계약 — Esc 닫기, 저장 버튼은 유효 교정이 있을 때만.
describe('편집 패널 마감 계약 (TokenEditPanel.jsx)', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/views/TokenEditPanel.jsx'), 'utf8');

  it('Esc로 닫히고, 저장 활성 판정이 buildTokenCorrections와 정합', () => {
    expect(src).toMatch(/e\.key === 'Escape'/);
    expect(src).toContain('buildTokenCorrections(token, { meaning, reading, meaningPos })');
    expect(src).toMatch(/disabled=\{saving \|\| !pending\}/);
  });
});
