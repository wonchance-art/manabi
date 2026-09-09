import {viewerDefaults} from '../../lib/viewerPreferences';
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

// 계약: 집중 모드(오너 승인 2026-08-19) — 지정 문장만 원래 밝기, 나머지는 어둡게.
// 실렌더 검증(투명도·좌표 불변)은 e2e/typography.e2e.mjs가 담당하고, 여기는 배선만 지킨다.
// 앵커 슬라이스는 sliceBetween(앵커 소실 시 throw) — raw slice(indexOf()는 앵커가
// 사라져도 초록으로 남았다(v2-L 공허 통과 실측, contractHygiene 메타 계약이 금지).
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('집중 모드 배선', () => {
  const css = read('src/index.css');
  const viewer = read('src/views/ViewerPage.jsx');
  const readerCss = read('src/components/viewer/reader-controls.css');

  it('옵트인 기본 꺼짐 — 관례(한자 대조·성조 색상 선례)', () => {
    expect(viewerDefaults('Chinese').focusMode).toBe(false);
  });

  it('지정이 있을 때만 발동한다 — 지정 없이 켜면 화면이 통째로 어두워지면 안 된다', () => {
    expect(viewer).toContain("focusMode && (pickedLineIdx !== null || tokenRange.range) ? ' reader-area--focus' : ''");
  });

  it('주변은 흐리게 하고 지정 문장·열린 단어는 선명하게 유지한다', () => {
    expect(readerCss).toContain('.word-token:not(.word-token--picked):not([data-selected="true"]) {opacity:.28');
    expect(readerCss).toContain('.word-token:is(.word-token--picked,[data-selected="true"]) {opacity:1');
    expect(readerCss).toContain('.word-token:is(.word-token--picked,[data-selected="true"]) .surface {opacity:1;}');
  });

  it('전환 애니메이션 + 모션 축소 존중', () => {
    expect(css).toMatch(/\.word-token \{[^}]*transition: opacity 0\.25s ease;/s);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.word-token \{ transition: none; \}/);
  });

  it('문장 이동 필 — 지정 중에만 뜨고, 지정·스크롤은 공통·분석은 모드 분기(오너 지시 2026-08-20)', () => {
    expect(viewer).toContain("pickedLineIdx !== null && sentences.length > 0 && (");
    const move = sliceBetween(viewer, 'const moveSentence', 'const runSelectionAnalysis');
    for (const call of ['tokenRange.clearRange()', 'setPickedLineIdx(target.rawIdx)', 'setSelectedRangeText(target.text)', 'readerVisibleBounds', 'window.scrollBy']) {
      expect(move).toContain(call);
    }
    // 집중 모드 ▲▼ = 순수 이동: 분석·시트 없음(읽기 방해 + 안 볼 번역의 Gemini 낭비),
    // 꺼짐 = 본래처럼 전체 분석. 순수 이동이 시트 신호를 올리면 계약 위반.
    expect(move).toContain('if (focusMode) clearAnalysisPanels();');
    expect(move).toContain('else runSelectionAnalysis(target.text);');
    expect(move).not.toContain('SheetSignal');
    // 패널 비움의 최소 범위 — 좌 결과·우 리스트·카드 활성이 함께 꺼져야 시트가 잦아든다
    const clear = sliceBetween(viewer, 'const clearAnalysisPanels', 'const moveSentence');
    for (const call of ["setLeftPanelResult('')", 'setDragTokens(null)', 'setIsSheetOpen(false)']) {
      expect(clear).toContain(call);
    }
    // 막대(¦): 집중 모드에서 지정 '밖' 막대는 순수 이동, 지정된 문장의 막대 재탭만
    // 전체 분석(오너 확정 2026-08-20 — 지정이 먼저, 분석은 안에서 한 번 더). 꺼짐 = 항상 분석.
    expect(viewer).toContain('if (focusMode && pickedLineIdx !== lineHead.rawIdx) clearAnalysisPanels();');
    expect(viewer).toContain('else runSelectionAnalysis(lineHead.text);');
    // 경계 비활성(순환 없음) — 필·바 공용 헬퍼 한 벌(동작 중복 금지)
    expect(viewer).toContain('disabled={!adjacentSentence(sentences, pickedLineIdx, dir)}');
    expect(css).toMatch(/\.sentence-nav__btn \{[^}]*width: 44px;/s);
  });

  it("문장 이동은 동일 패널 footer의 슬롯에서 제공한다", () => {
    const sheet=read('src/components/ViewerBottomSheet.jsx'); expect(sheet).toContain('barNav=null'); expect(sheet).toContain('{barNav}'); expect(sheet).toContain('viewer-inspector__nav'); expect(viewer).toContain('barNav={pickedLineIdx !== null && sentences.length > 0 ? (');
  });

  it('단일 규칙 — 밖 탭 = 순수 이동, 안 탭 = 카드, 문장 아닌 줄 = 무시(오너 확정 2026-08-20)', () => {
    const click = sliceBetween(viewer, 'const handleTokenClick', '// ② 리스트 단어 탭');
    // 집중 ON: 탭한 지점의 문장을 찾는다. 못 찾으면(막대 없는 2자 미만 줄) 무시 —
    // 카드 폴백을 두면 첫 탭이 곧장 카드를 띄우는 뒷문이 된다.
    expect(click).toContain('if (focusMode) {');
    expect(click).toMatch(/sentences\.find\(\(s\) => s\.rawIdx === parseInt\(m\[1\]\)\)/);
    expect(click).toContain('if (!line) return;');
    // 밖(지정 문장이 아님 — 지정 없음 = 발동 대기도 포함) = 순수 이동:
    // 지정만 옮기고 분석·시트·카드·발화 전부 없음, 낡은 패널은 비운다
    const outside = sliceBetween(click, 'if (focusMode) {', 'const t = { ...token');
    expect(outside).toContain('if (line.rawIdx !== pickedLineIdx) {');
    expect(outside).toContain('setSelectedRangeText(line.text);');
    expect(outside).toContain('clearAnalysisPanels();');
    expect(outside).toContain('return;');
    expect(outside).not.toContain('runSelectionAnalysis');
    expect(outside).not.toContain('setIsSheetOpen');
    expect(outside).not.toContain('speak(');
    // 안(지정 문장 내) 단어 탭 = 기존 카드 경로 + 지정 유지(집중 꺼짐일 때만 상호 배타 #1002)
    expect(click).toContain('if (!focusMode) setPickedLineIdx(null);');
  });

  it('빈 공간 탭 = 지정 해제(전문 조망) — 토큰·막대·▲▼·그립·버튼은 해제 대상 아님(오너 확정 2026-08-20)', () => {
    const blank = sliceBetween(viewer, 'const handleReaderBlankClick', 'const runSelectionAnalysis');
    // 집중 꺼짐이면 아무 일 없음 — 기존 동작 보존
    expect(blank).toContain('if (!focusMode) return;');
    // 저마다의 동작이 있는 컨트롤은 closest 가드로 거른다(¦·그립은 stopPropagation,
    // 드래그 합성 클릭은 handleClickCapture가 앞단에서 차단 — 이중 방어)
    for (const guard of ['.word-token', '.line-pick', '.sentence-nav', '.range-grip', 'button']) {
      expect(blank).toContain(guard);
    }
    // 해제 = 지정 + 범위 + 선택 텍스트 + 낡은 패널까지(순수 이동과 동일 원칙)
    for (const call of ['tokenRange.clearRange();', 'setPickedLineIdx(null);', "setSelectedRangeText('');", 'clearAnalysisPanels();']) {
      expect(blank).toContain(call);
    }
    // 본문 컨테이너에 실제 배선 — 캡처 차단은 그대로 앞단에 산다
    expect(viewer).toContain('onClick={handleReaderBlankClick}');
    expect(viewer).toContain('onClickCapture={tokenRange.handleClickCapture}');
  });

  it("문장 집중은 읽기 진행 탭에 있다", () => {
    const options=read('src/components/viewer/ViewerSettings.jsx'); expect(options).toContain('label="문장 집중"'); expect(options).toContain("set('focusMode',v)"); expect(options).toContain("tab==='pace'");
  });
});
