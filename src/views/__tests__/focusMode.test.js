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
    // 흐림 0.5(VIEWER-V2-ROUNDS-001 §5 AD-R2 — 오너 확정). 0.28은 주변 문장 대비가 종이 1.77:1로
    // 위치 감각만 남고 읽히지 않았다. 계약은 실제로 이기는 규칙(reader-controls.css)에 건다.
    expect(readerCss).toContain('.word-token:not(.word-token--picked):not([data-selected="true"]) {opacity:.5;');
    // index.css의 옛 기본 규칙(0.18)은 특이도에 져서 한 번도 적용되지 않던 죽은 값이었다 — 값이
    // 둘이면 어느 쪽이 진짜인지 오독된다. 집중 흐림 값은 한 곳에만 둔다.
    expect(css).not.toMatch(/\.reader-area--focus \.word-token:not\(\.word-token--picked\) \{[^}]*opacity/);
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

  // VIEWER-R0-BUGS-001 버그 4 — 첫 탭(순수 이동) 뒤 빈 보조 패널(탭 머리만, 390px 113px) 대신 문장 이동 막대.
  // 실렌더 기하·터치·키보드는 e2e/viewer-focus-move.e2e.mjs가 지키고, 여기는 배선만 잡는다.
  it('문장 지정만으로는 보조 패널을 띄우지 않고 이동 막대가 대신한다 — 번역은 막대(¦) 재탭과 같은 경로', () => {
    const sheet = read('src/components/ViewerBottomSheet.jsx');
    expect(sheet).toContain('if(!leftActive&&!rightActive)return null;');
    const fallback = sliceBetween(viewer, 'fallback={boardActions=>', '<ViewerBottomSheet');
    expect(fallback).not.toContain('pickedLineIdx');
    // 수업 판(boardActions)에서는 예전처럼 아무것도 띄우지 않는다 — 수업 경로 보존(V2 §0.2).
    expect(viewer).toContain('/> : boardActions ? null : sentenceMoveBar} />}');
    expect(viewer).toContain('active: pickedLineIdx !== null && sentences.length > 0 && !classStudyActive,');
    // 막대가 떠 있으면 본문 끝이 막대 위로 오고, 문장 이동 위치 계산도 막대를 바닥으로 본다.
    // 개정(AD-R2 PR ①, VIEWER-V2-ROUNDS-001 §5 「자동 진행」): 같은 바닥 자리의 단독 「▶ 자동 진행」도 바닥 요소로 본다.
    expect(read('src/lib/useReaderLayout.js')).toContain("'.viewer-inspector,.class-reader-dock,.sentence-move-bar,.viewer-pace-float'");
    expect(read('src/components/viewer/sentence-move-bar.css')).toContain('.viewer-layout:has(.sentence-move-bar)>.viewer-center {padding-bottom:calc(var(--sentence-move-bar-space) + 48px);}');
    const bar = sliceBetween(viewer, 'const translatePickedSentence', 'function extractSourceSentence');
    expect(bar).toContain('runSelectionAnalysis(pickedSentence.text);');
    expect(bar).not.toContain('callGemini');
    expect(bar).toContain("{sentenceNavBtn(-1, 'sentence-move-bar__btn')}");
    expect(bar).toContain("{sentenceNavBtn(1, 'sentence-move-bar__btn')}");
    expect(bar).toContain('onClick={closeMoveBar}');
    expect(sliceBetween(viewer, 'const closeMoveBar', '};')).toContain('releasePickedSentence();');
    expect(sliceBetween(viewer, 'const handleReaderBlankClick', 'const runSelectionAnalysis')).toContain('releasePickedSentence();');
    expect(read('src/components/viewer/sentence-move-bar.css')).toMatch(/\.sentence-move-bar button \{[^}]*min-width:44px;min-height:44px;/);
  });

  it("문장 집중은 읽기 진행 탭에 있다", () => {
    const options=read('src/components/viewer/ViewerSettings.jsx'); expect(options).toContain('label="문장 집중"'); expect(options).toContain("set('focusMode',v)"); expect(options).toContain("tab==='pace'");
  });
});
