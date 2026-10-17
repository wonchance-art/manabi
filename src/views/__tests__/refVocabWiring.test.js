import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// 배선 계약(오너 승인 ②): "우리가 갖고 있는 단어 사전과 연동" —
// 뷰어 시트는 급수 뱃지 + 정본 뜻·예문을 자동 표시하고, 단어장은 급수로
// 자동 분류·필터된다(급수는 저장 없이 표시 시점 계산, 기존 단어 소급 적용).

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('뷰어 시트 — 우리 사전 연동', () => {
  const src = read('src/views/ViewerPage.jsx');

  it('선택 토큰을 레퍼런스 어휘 훅으로 조회한다 — 키는 sep_link → base_form → text', () => {
    expect(src).toContain("from '../lib/refVocabIndex'");
    // 이합사 O 조각(道了歉의 歉)은 sep_link(VO)로 조회한다(2026-09-02). base_form은 만남 기록 전용으로
    // 남고, 카드·조회·저장·「이미 앎」·호는 전부 이 한 키를 쓴다 — 자리마다 손으로 적으면 갈린다.
    expect(src).toMatch(/const selectedLexKey = selectedToken\?\.sep_link\s*\|\|\s*selectedToken\?\.base_form;/);
    expect(src).toMatch(/useRefVocabEntry\(materialLang,\s*selectedLexKey\s*\|\|\s*selectedToken\?\.text\)/);
    // 만남 기록만은 O 조각을 건너뛴다 — V(base_form=VO)가 한 번 남긴다(이중 계상 방지)
    expect(src).toMatch(/if \(t\.sep_link\) continue;/);
  });

  it('문맥 뜻(사용자 교정 포함)을 유지하고 사전의 다른 뜻을 구분한다', () => {
    expect(src).toContain('const refMeaning = contextualMeaning(selectedToken) || null;');
    expect(src).toContain('referenceMatchesContext(selectedToken, refVocab?.word)');
    expect(src).toMatch(/refMeaning \|\| selectedToken\.meaning \|\| vt\('\(뜻 없음\)'\)/);
  });

  it('급수 뱃지·정본 예문은 박스 없이 자연 배치, 한자 노트는 한자 대조와 중복 방지', () => {
    // 급수 뱃지는 HSK 2026 표(ZH-LEVEL-2026-001 — zhHskLevelSites.test.js가 정본 계약)
    expect(src).toContain('{hskLevelLabel && <span className="word-detail-card__level">{hskLevelLabel}</span>}');
    expect(src).toContain('refVocab?.word?.ex');
    expect(src).toMatch(/refVocab\?\.word\?\.hanja && !showHanjaKo/);
    // 오너 피드백: 별도 '우리 사전' 라벨 블록으로 가두지 않는다
    expect(src).not.toContain('우리 사전 ·');
  });
});

describe('단어장 — 급수 자동 분류·필터', () => {
  const page = read('src/views/VocabPage.jsx');
  const list = read('src/views/VocabList.jsx');
  const css = read('src/index.css');

  it('VocabPage: 중국어 단어가 있을 때 급수 표를 지연 로드하고 급수를 범위로 영속화한다', () => {
    expect(page).toContain('useZhHskLevels(hasZhVocab)');
    // REV-SCOPE-R1A: 급수는 목록 전용 필터가 아니라 복습 범위의 축이다 — 범위 하나로 저장한다(명시 주소일 때는 저장하지 않음).
    expect(page).toContain("localStorage.setItem(SAVED_SCOPE_KEY, serializeReviewScope(scopeDraft)");
    expect(page).toContain("levelFilter={scope.level || 'all'}");
    expect(page).toContain('setLevelFilter={selectLevel}');
    expect(page).toContain('refLevelOf={refLevelOf}');
    expect(page).toContain('showLevelFilter={showLevelFilter}');
  });

  it('VocabPage: 급수는 중국어 한정 범위이고, 목록뿐 아니라 개수 · 복습 줄까지 같은 범위로 거른다', () => {
    expect(page).toContain("const showLevelFilter = hasZhVocab && !!zhHskLevels && scope.lang === 'Chinese';");
    // 목록(vocab)과 복습 줄(countReviewScope · scopedFsrsCardIds)이 같은 범위 거르기를 쓴다
    expect(page).toContain('allVocab.filter(scopeMatcher.matches)');
    expect(page).toContain('createScopeMatcher(scope, { levels: scopeLevels, sourceIds: scopeSourceIds })');
    expect(page).toContain('scopedFsrsCardIds(scopeArgs)');
    const scope = read('src/lib/reviewScope.js');
    expect(scope).toContain("if (scope.level && wordZhLevel(word, levels) !== scope.level) return false;");
  });

  it('VocabList: 급수 필터 선택지(HSK 2026 급수 1~7·미분류)와 행 뱃지를 렌더한다', () => {
    expect(list).toContain("aria-label=\"급수 필터\"");
    expect(list).toContain("label: zhHskLevelLabel(level)");
    expect(list).toContain('미분류');
    expect(list).toContain('zhHskLevelLabel(refLevelOf?.(v))');
    expect(list).toContain("className=\"vocab-row__level\"");
  });

  it('뱃지 스타일이 존재한다', () => {
    expect(css).toContain('.vocab-row__level');
  });
});
