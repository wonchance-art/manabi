import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 계약: 단어 카드 단일화(② 오너 승인 2026-08-19) — 문장 리스트의 단어를 탭하면
// 오버레이 팝업 대신 '본문 클릭과 같은 단어 카드'가 리스트 위에 붙는다(X로 닫기).
// 팝업은 기능 축소판(예문·복습·편집 없음)이 두 벌로 갈라지는 원인이라 뷰어에서 제거.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const css = read('src/index.css');

describe('단어 카드 단일화 계약', () => {
  it('리스트 단어 탭이 팝업이 아니라 카드 핸들러로 배선된다(텍스트·뜻 두 영역)', () => {
    expect(viewer.match(/onClick=\{\(\) => handleListWordClick\(t\)\}/g)?.length).toBe(2);
    // 뷰어에서 팝업 부활 금지 — PDF 뷰어(PdfViewerPage)만 자기 팝업을 유지한다.
    // (텍스트 서식 클래스 pdf-detail-popup__text 재사용은 허용 — 컨테이너·오버레이만 금지)
    expect(viewer).not.toContain('useDragWordPopup');
    expect(viewer).not.toContain('pdf-detail-overlay');
    expect(viewer).not.toContain('className="pdf-detail-popup"');
  });

  it('리스트 클릭은 문장 컨텍스트를 유지한다 — dragTokens·pickedLineIdx를 건드리면 리스트·집중 어둡기가 사라진다', () => {
    const fn = viewer.match(/const handleListWordClick = \(t\) => \{[\s\S]*?\n  \};/)?.[0];
    expect(fn).toBeTruthy();
    expect(fn).not.toContain('setDragTokens');
    expect(fn).not.toContain('setPickedLineIdx');
    expect(fn).toContain('setSelectedToken({ ...t })');
    expect(fn).toContain('setIsSheetOpen(true)');
  });

  it('카드는 리스트 위에 렌더된다(합성 순서 계약)', () => {
    const composite = viewer.indexOf('{wordDetailCard}\n      {wordListPanel}');
    expect(composite).toBeGreaterThan(-1);
    // 리스트 위 카드에만 구분선 모디파이어
    expect(viewer).toContain("word-detail-card${dragTokens !== null ? ' word-detail-card--above-list' : ''}");
    expect(css).toContain('.word-detail-card--above-list');
  });

  it('X로 닫힌다 — 카드 상태만 정리하고 리스트는 남긴다', () => {
    expect(viewer).toContain('aria-label="단어 상세 닫기"');
    const fn = viewer.match(/const closeWordCard = \(\) => \{[\s\S]*?\n  \};/)?.[0];
    expect(fn).toBeTruthy();
    expect(fn).toContain('setSelectedToken(null)');
    expect(fn).not.toContain('setDragTokens');
  });

  it('편집(✏️)은 자료 토큰에만 — 리스트 단어는 id가 없어 이 자료의 교정 대상이 아니다', () => {
    expect(viewer).toContain('canEditToken && selectedToken.id && (');
  });

  it('카드 열림 시 패널·시트를 맨 위로 되돌린다(리스트를 내려 본 뒤에도 카드가 보이게)', () => {
    expect(viewer).toContain("querySelectorAll('.viewer-side--right, .viewer-sheet__section-body')");
  });
});
