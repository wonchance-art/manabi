import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// 배선 계약(오너 승인 ②): "우리가 갖고 있는 단어 사전과 연동" —
// 뷰어 시트는 급수 뱃지 + 정본 뜻·예문을 자동 표시하고, 단어장은 급수로
// 자동 분류·필터된다(급수는 저장 없이 표시 시점 계산, 기존 단어 소급 적용).

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('뷰어 시트 — 우리 사전 연동', () => {
  const src = read('src/views/ViewerPage.jsx');

  it('선택 토큰을 레퍼런스 어휘 훅으로 조회한다', () => {
    expect(src).toContain("from '../lib/refVocabIndex'");
    expect(src).toMatch(/useRefVocabEntry\(materialLang,\s*selectedToken\?\.base_form\s*\|\|\s*selectedToken\?\.text\)/);
  });

  it('급수 뱃지와 우리 사전 섹션(뜻·예문)을 렌더한다', () => {
    expect(src).toContain('refLevelLabel(refVocab.level)');
    expect(src).toContain('우리 사전');
    expect(src).toContain('refVocab.word.ex');
  });
});

describe('단어장 — 급수 자동 분류·필터', () => {
  const page = read('src/views/VocabPage.jsx');
  const list = read('src/views/VocabList.jsx');
  const css = read('src/index.css');

  it('VocabPage: 중국어 단어가 있을 때 인덱스를 지연 로드하고 필터 상태를 영속화한다', () => {
    expect(page).toContain("loadRefVocabIndex('Chinese')");
    expect(page).toContain("localStorage.setItem('vocab_levelFilter', levelFilter)");
    expect(page).toContain('refLevelOf={refLevelOf}');
    expect(page).toContain('showLevelFilter={showLevelFilter}');
  });

  it('VocabPage: 급수 필터는 중국어 한정 스코프로 거른다', () => {
    expect(page).toMatch(/levelFilter !== 'all' && zhRefIndex/);
    expect(page).toContain("x._item.language !== 'Chinese'");
  });

  it('VocabList: 급수 필터 선택지(HSK 1~6·생활·미분류)와 행 뱃지를 렌더한다', () => {
    expect(list).toContain("aria-label=\"급수 필터\"");
    for (const label of ['HSK 1', 'HSK 6', '생활', '미분류']) expect(list).toContain(label);
    expect(list).toContain('refLevelLabel(refLevelOf?.(v))');
    expect(list).toContain("className=\"vocab-row__level\"");
  });

  it('뱃지 스타일이 존재한다', () => {
    expect(css).toContain('.vocab-row__level');
  });
});
