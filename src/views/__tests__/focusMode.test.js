import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 계약: 집중 모드(오너 승인 2026-08-19) — 지정 문장만 원래 밝기, 나머지는 어둡게.
// 실렌더 검증(투명도·좌표 불변)은 e2e/typography.e2e.mjs가 담당하고, 여기는 배선만 지킨다.
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('집중 모드 배선', () => {
  const css = read('src/index.css');
  const viewer = read('src/views/ViewerPage.jsx');
  const settings = read('src/lib/useViewerSettings.js');

  it('옵트인 기본 꺼짐 — 관례(한자 대조·성조 색상 선례)', () => {
    expect(settings).toContain("readPref('focusMode', false)");
  });

  it('지정이 있을 때만 발동한다 — 지정 없이 켜면 화면이 통째로 어두워지면 안 된다', () => {
    expect(viewer).toContain("focusMode && (pickedLineIdx !== null || tokenRange.range) ? ' reader-area--focus' : ''");
  });

  it('어둡기는 비지정 토큰에만 걸린다(지정 토큰·상속 무관 opacity)', () => {
    expect(css).toMatch(/\.reader-area--focus \.word-token:not\(\.word-token--picked\) \{\s*opacity: 0\.18;/);
  });

  it('전환 애니메이션 + 모션 축소 존중', () => {
    expect(css).toMatch(/\.word-token \{[^}]*transition: opacity 0\.25s ease;/s);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.word-token \{ transition: none; \}/);
  });

  it('문장 이동 필 — 지정 중에만 뜨고, 지정·스크롤은 공통·분석은 모드 분기(오너 지시 2026-08-20)', () => {
    expect(viewer).toContain("pickedLineIdx !== null && sentences.length > 0 && (");
    const move = viewer.slice(viewer.indexOf('const moveSentence'), viewer.indexOf('const runSelectionAnalysis'));
    for (const call of ['tokenRange.clearRange()', 'setPickedLineIdx(target.rawIdx)', 'setSelectedRangeText(target.text)', 'scrollIntoView']) {
      expect(move).toContain(call);
    }
    // 집중 모드 ▲▼ = 순수 이동: 분석·시트 없음(읽기 방해 + 안 볼 번역의 Gemini 낭비),
    // 꺼짐 = 본래처럼 전체 분석. 순수 이동이 시트 신호를 올리면 계약 위반.
    expect(move).toContain('if (focusMode) clearAnalysisPanels();');
    expect(move).toContain('else runSelectionAnalysis(target.text);');
    expect(move).not.toContain('SheetSignal');
    // 패널 비움의 최소 범위 — 좌 결과·우 리스트·카드 활성이 함께 꺼져야 시트가 잦아든다
    const clear = viewer.slice(viewer.indexOf('const clearAnalysisPanels'), viewer.indexOf('const moveSentence'));
    for (const call of ["setLeftPanelResult('')", 'setDragTokens(null)', 'setIsSheetOpen(false)']) {
      expect(clear).toContain(call);
    }
    // 막대(¦) 경로는 본래처럼 전체 분석(오너: "전체 지정 버튼 누르면 나타나도록")
    expect(viewer).toContain('runSelectionAnalysis(lineHead.text);');
    // 경계 비활성(순환 없음)
    expect(viewer).toContain("disabled={!adjacentSentence(sentences, pickedLineIdx, -1)}");
    expect(css).toMatch(/\.sentence-nav__btn \{[^}]*width: 44px;/s);
  });

  it('토글이 설정에 있고 언어 무관이다', () => {
    expect(viewer).toContain("'☑ 집중 모드 켜짐' : '◻ 집중 모드 꺼짐'");
    // 중국어 조건(materialLang === 'Chinese') 블록 밖 — 후리가나 토글과 같은 층위
    const idx = viewer.indexOf('집중 모드 켜짐');
    const before = viewer.slice(idx - 600, idx);
    expect(before).toContain('후리가나');
    expect(before).not.toContain("materialLang === 'Chinese' && (");
  });
});
