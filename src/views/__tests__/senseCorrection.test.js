import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import { senseCorrectionFor, revertCorrections, buildMeaningOptions } from '../../lib/tokenEditOptions.js';
import { buildSenseList } from '../../lib/viewerSenseList.js';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const card = sliceBetween(viewer, 'const renderWordDetailCard = (classAction=null,classMeaning=null) => !selectedToken || !isSheetOpen ? null : (', 'const renderRightPanelContent =');

/**
 * AE-R1 PR③ — 사전 뜻 줄을 눌러 「이 자리 뜻」으로 교정 + 되돌리기(VIEWER-V2-ROUNDS-001 §2.1 사전 뜻 목록,
 * 설계서 docs/manabi-viewer-v2-ae-r1.md §3.4 · §7.3 「교정 되돌리기(PR③)」 · §8 PR③).
 * 쓰기는 기존 정본 correctTokenMutation(processed_json + token_corrections 이력) 하나 — 새 경로 신설 0.
 * 전역 승격(promoteCorrection → /api/dict-correct · user_vocabulary)은 부르지 않는다(정본 §0.2 「저장한 뜻은
 * 자동으로 덮어쓰지 않는다」). 권한은 ✎와 같은 판정(canEditToken · 자료 토큰 · 비한국어 · 저장 지원), 수업 모드는 표시만(Q3).
 */
describe('이 자리 뜻 교정 — 순수 규칙 (tokenEditOptions)', () => {
  const dict = { meanings: [{ meaning: '(경관이) 웅장하다, 장관이다', pos: '형용사' }, { meaning: '장관, 웅장한 경관', pos: '명사' }], reading: 'zhuàng guān', pos: '형용사·명사' };
  const token = { text: '壮观', base_form: '壮观', furigana: 'zhuàng guān', meaning: '(경관이) 웅장하다, 장관이다', pos: '형용사' };

  it('사전 뜻 줄을 고르면 그 뜻과 그 뜻의 품사만 — TokenEditPanel 칩과 같은 규칙(buildMeaningOptions)', () => {
    expect(senseCorrectionFor(token, dict, '장관, 웅장한 경관')).toEqual({ meaning: '장관, 웅장한 경관', pos: '명사' });
    // 발음은 건드리지 않는다
    expect(senseCorrectionFor(token, dict, '장관, 웅장한 경관')).not.toHaveProperty('furigana');
  });

  it('뜻별 품사가 없는 사전(ja)이면 뜻만 — 행 품사로 품사를 바꾸지 않는다', () => {
    const ja = { meanings: [{ meaning: '날씨' }, { meaning: '좋은 날씨' }], reading: 'てんき', pos: '명사' };
    expect(senseCorrectionFor({ text: '天気', furigana: 'てんき', meaning: '날씨', pos: '명사' }, ja, '좋은 날씨')).toEqual({ meaning: '좋은 날씨' });
  });

  it('우리 사전(refVocab)에서 온 줄은 뜻만, 지금 뜻과 같으면 null(쓰기 0)', () => {
    expect(senseCorrectionFor(token, dict, '장관이다')).toEqual({ meaning: '장관이다' });
    expect(senseCorrectionFor(token, dict, token.meaning)).toBeNull();
    expect(senseCorrectionFor(token, dict, '  ')).toBeNull();
  });

  it('목록의 사전 줄은 모두 교정 후보 안에 있다 — 목록과 교정 후보가 어긋나지 않는다', () => {
    const groups = buildSenseList({ dictEntry: dict, refWord: null, token, language: 'Chinese', reading: 'zhuàng guān' });
    const options = buildMeaningOptions(dict, token).map((o) => o.meaning);
    for (const item of groups.flatMap((g) => g.items)) expect(options).toContain(item.meaning);
  });

  it('되돌리기 = 바꾼 칸의 이전 값 그대로 — 적용 후 되돌리면 원래 토큰', () => {
    const corrections = senseCorrectionFor(token, dict, '장관, 웅장한 경관');
    const before = revertCorrections(token, corrections);
    expect(before).toEqual({ meaning: '(경관이) 웅장하다, 장관이다', pos: '형용사' });
    const applied = { ...token, ...corrections };
    expect({ ...applied, ...before }).toEqual(token);
    // 바꾸지 않은 칸은 되돌리기에 싣지 않는다
    expect(revertCorrections(token, { meaning: '장관이다' })).toEqual({ meaning: '(경관이) 웅장하다, 장관이다' });
  });
});

describe('이 자리 뜻 교정 — 배선 (ViewerPage)', () => {
  const choose = sliceBetween(viewer, 'const chooseSense = (item) => {', '\n  };');
  const undo = sliceBetween(viewer, 'const undoSense = () => {', '\n  };');

  it('사전 뜻 줄은 senseEditable일 때만 누름 영역 — 판정은 ✎와 같은 권한 + 수업 모드 제외', () => {
    expect(viewer).toContain('const senseEditable = canEditToken && !!selectedToken?.id && legacyTokenEditingAllowed && learningStorageSupported && !classStudyActive;');
    const senses = sliceBetween(card, 'className="reader-card-senses"', '</section>');
    expect(senses).toMatch(/senseEditable && !item\.current \? <button/);
    expect(senses).toContain('onClick={() => chooseSense(item)}');
    expect(senses).toContain('reader-card-sense__context');
    // 표시만인 줄에는 누름 영역이 없다(role=button 흉내 금지)
    expect(senses).not.toContain('role="button"');
  });

  it('교정은 기존 correctTokenMutation 하나 — 이 토큰 자리만, 전역 승격·단어장·사전 쓰기 0', () => {
    expect(choose).toContain('senseCorrectionFor(selectedToken, editDictEntry, item.meaning)');
    expect(choose).toMatch(/correctTokenMutation\.mutate\(\s*\{ tokenId: selectedToken\.id, corrections, quiet: true \}/);
    expect(choose).toContain('revertCorrections(selectedToken, corrections)');
    for (const banned of ['promoteCorrection', 'dict-correct', 'user_vocabulary', 'addToVocab', 'saveInlineVocabulary', 'knownState']) {
      expect(choose).not.toContain(banned);
      expect(undo).not.toContain(banned);
    }
  });

  it('되돌리기는 같은 mutation으로 이전 값 1회 — 「뜻을 바꿨어요 · 되돌리기」는 그 토큰에서만', () => {
    expect(undo).toMatch(/correctTokenMutation\.mutate\(\s*\{ tokenId: senseUndo\.tokenId, corrections: senseUndo\.before, quiet: true \}/);
    expect(undo).toContain('senseUndo.tokenId !== selectedToken?.id');
    expect(card).toContain("vt('뜻을 바꿨어요')");
    expect(card).toContain("vt('되돌리기')");
    expect(card).toMatch(/senseUndo\?\.tokenId === selectedToken\.id &&/);
    expect(viewer).toMatch(/useEffect\(\(\) => \{ setSenseUndo\(null\); \}, \[selectedToken\?\.id, isSheetOpen\]\)/);
  });

  it('조용한 교정(quiet)은 「수정이 저장됐어요!」 토스트를 생략 — 실패 토스트와 TokenEditPanel 경로는 그대로', () => {
    const mutation = sliceBetween(viewer, 'const correctTokenMutation = useMutation({', '\n  });');
    expect(mutation).toMatch(/onSuccess: \(\{ tokenId, corrections \}, variables\) => \{/);
    expect(mutation).toMatch(/if \(!variables\?\.quiet\) toast\('수정이 저장됐어요!', 'success'\);/);
    expect(mutation).toContain("onError: (err) => toast('수정 실패 — ' + friendlyToastMessage(err), 'error')");
    expect(mutation).not.toContain('promoteCorrection');
  });
});

describe('⋯ 메뉴 — 분석 고치기 (ViewerBottomSheet · ViewerSheetMenu)', () => {
  const sheet = read('src/components/ViewerBottomSheet.jsx');
  const menu = read('src/components/viewer/ViewerSheetMenu.jsx');

  it('시트 머리줄 menu 슬롯 — 기본 null(PDF 뷰어 무영향), 단어 탭이 열려 있을 때만', () => {
    expect(sheet).toMatch(/menu=null/);
    expect(sheet).toMatch(/open&&tab==='right'&&menu\?\.items\?\.length>0&&<ViewerSheetMenu/);
  });

  it('메뉴 버튼 44px · aria-haspopup=menu · 항목 role=menuitem · Esc 닫기와 포커스 복귀 · 화살표 이동', () => {
    expect(menu).toContain('aria-haspopup="menu"');
    expect(menu).toContain('aria-expanded={open}');
    expect(menu).toContain('role="menu"');
    expect(menu).toContain('role="menuitem"');
    expect(menu).toContain('data-icon-action');
    expect(menu).toMatch(/e\.key==='Escape'[\s\S]*?stopPropagation\(\)[\s\S]*?buttonRef\.current\?\.focus\(\)/);
    expect(menu).toMatch(/ArrowDown/);
    expect(menu).toMatch(/ArrowUp/);
  });

  it('ViewerPage — 메뉴 항목 「뜻·발음 수정」은 ✎와 같은 권한(senseEditable)과 같은 편집 패널', () => {
    expect(viewer).toMatch(/const sheetMenu = senseEditable && selectedToken && isSheetOpen \? \{/);
    expect(viewer).toContain("vt('뜻·발음 수정'), onSelect: openTokenEditing");
    expect(viewer).toContain('menu={sheetMenu}');
    // ✎(정본 §2.1 뜻 줄)는 그대로 남는다
    expect(viewer).toContain('canEditToken && selectedToken.id && (');
  });
});

describe('「자세한 설명」 공유 detail_text 지연 조회 (ViewerPage)', () => {
  it('더 알아보기 구역이 화면에 들어올 때(IntersectionObserver, 미지원이면 카드 열림 후 1회) 카드당 1회', () => {
    const effect = sliceBetween(viewer, '// AE-R1 PR③ 공유 detail_text', '\n  }, [');
    expect(effect).toContain('IntersectionObserver');
    expect(effect).toContain("typeof IntersectionObserver === 'undefined'");
    expect(effect).toContain('fetchSharedDetailText(supabase, selectedToken, materialLang)');
    expect(effect).toContain('user?.id');
    expect(effect).not.toContain('fetchWordDetailText');
    expect(card).toContain('ref={learnRef}');
  });
});
