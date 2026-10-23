// 낱말 탭마다 단어 카드를 한 번만 짓는다(VIEWER-TAP-INP-001). 예전에는 렌더마다 `const rightPanelContent =
// renderRightPanelContent()`로 카드를 미리 지어 두고, 카드가 열린 동안에는 시트가 그 값을 쓰지 않고 카드를 다시 지었다 —
// 낱말을 누를 때마다(카드가 열린 렌더) 카드 요소 트리를 두 번 만들고 하나를 버렸다. 오른쪽 패널 내용은 쓰는 자리에서만 만든다.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

const viewer = fs.readFileSync('src/views/ViewerPage.jsx', 'utf8');
const code = viewer.replace(/\/\/.*$/gm, ''); // 주석 제외

describe('오른쪽 패널(단어 카드) — 쓰는 자리에서만 짓는다', () => {
  it('렌더마다 미리 지어 두는 값이 되살아나지 않는다', () => {
    expect(code).not.toMatch(/const\s+rightPanelContent\s*=/);
    expect(code).not.toMatch(/\{rightPanelContent\}/);
  });
  it('시트: 카드가 열리면 교재 설명을 붙여 한 번, 아니면 교재 설명 + 패널 내용(드래그 목록 · 빈 안내)을 한 번', () => {
    const sheet = sliceBetween(code, 'fallback={boardActions=>', '/> : boardActions ? null : sentenceMoveBar}');
    expect(sheet).toContain('rightContent={selectedToken&&isSheetOpen?renderRightPanelContent(annotationContent&&');
    expect(sheet).toContain(':<>{annotationContent}{renderRightPanelContent()}</>}');
    expect(sheet.match(/renderRightPanelContent\(/g)).toHaveLength(2); // 두 갈래 중 하나만 평가된다
  });
  it('수업 화면은 함수 그대로 넘겨 필요할 때 짓는다(wordContent)', () => {
    expect(code).toContain('wordContent={(dragTokens!==null||(selectedToken&&isSheetOpen))?renderRightPanelContent:null}');
  });
  it('패널 내용 함수는 카드(있으면) + 드래그 목록, 둘 다 없으면 빈 안내 — 짓는 내용 그대로', () => {
    const fn = sliceBetween(code, 'const renderRightPanelContent = (classAction=null,classMeaning=null) => {', 'const renderSentencePanel = () => {');
    expect(fn).toContain('const wordDetailCard=renderWordDetailCard(classAction,classMeaning);');
    expect(fn).toMatch(/wordDetailCard \|\| wordListPanel \?/);
    expect(fn).toContain('"단어 클릭 → 상세"');
  });
});
