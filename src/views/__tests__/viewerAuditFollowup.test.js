import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

// 뷰어 전수 점검(2026-10-23 KST) 1차 기능 버그 — 배선 계약. 동작은 단위(viewerPreferences · readingSheet · wordState ·
// listenControlsSpeechNotice)와 e2e가 재고, 여기서는 고친 길이 다시 끊기지 않게 원문 구조로 지킨다.
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const viewer = () => read('src/views/ViewerPage.jsx');
const settings = () => read('src/components/viewer/ViewerSettings.jsx');

describe('뷰어 점검 후속 — 기능 버그 배선', () => {
  it('되돌리기 · 이 탭 기본값도 보기 버튼과 같은 길(onReaderView)로 보기를 바꾼다 — 1쪽으로 가지 않게', () => {
    const s = settings();
    expect(s).toContain("const viewTo=view=>{if(onReaderView&&view&&view!==(s.readerView||'paged'))onReaderView(view);};");
    expect(sliceBetween(s, 'const undo=()=>keepPosition(()=>{', 's.restore(snapshot.current);')).toContain('viewTo(snapshot.current.readerView);');
    expect(s).toContain("if(TAB_KEYS[tab]?.includes('readerView'))viewTo(defaults.readerView);s.resetTab(tab);");
  });

  it('쪽 → 스크롤 → 쪽 왕복은 가운데로 데려온 그 글자로 돌아간다', () => {
    const block = sliceBetween(viewer(), 'const changeReaderView = next => {', 'settings.setReaderView(next);');
    expect(block).toContain("if (next === 'scroll') {");
    expect(block).toContain('pager.controller?.()?.anchor');
    expect(block).toContain('rect.bottom > bounds.top && rect.top < bounds.bottom ? kept : null');
  });

  it('읽기 설정 · 학습 메뉴를 열어도 듣기 · 단어 발음을 끊지 않는다(소리 내는 창만 끊는다)', () => {
    const v = viewer();
    expect(v).toContain("const speechStopKind = activeModal && !['settings','activities'].includes(activeModal.kind) ? activeModal.kind : null;");
    expect(v).toContain('stopSignal={speechStopKind}');
    expect(v).not.toContain('stopSignal={activeModal?.kind}');
  });

  it('자동 진행이 켠 문장 집중은 자동 진행이 끝나면 끈다 — 사용자가 켠 집중은 그대로', () => {
    const v = viewer();
    expect(sliceBetween(v, 'const startPacer=()=>{', 'setPaceRunning(true);')).toContain('if(!focusMode)pacerFocusRef.current=true;');
    expect(v).toContain('useEffect(()=>{if(!paceRunning&&pacerFocusRef.current){pacerFocusRef.current=false;setFocusMode(false);}},[paceRunning,setFocusMode]);');
  });

  it('손님 문장 고르기는 재분석 요청 없이 자료 토큰으로 단어 목록을 만든다([더 쉽게] · [자세히]는 [문장] 탭 개편으로 없다)', () => {
    const v = viewer();
    const run = sliceBetween(v, 'const runSelectedSentence = async', 'explainSelectedSentenceRef.current = runSelectedSentence;');
    const guest = sliceBetween(run, 'if (!user) {', 'return;');
    expect(guest).toContain('collectDragTokens(');
    expect(run.indexOf('if (!user) {')).toBeLessThan(run.indexOf("await fetch(materialLang === 'Korean'"));
    expect(v).not.toContain('reader-sentence__actions');
    // 실패는 각 칸에서: 번역 = 「번역을 가져오지 못했어요」 + 다시 시도, 단어 목록 = 빈 목록 문구(오류 토스트 둘 겹침 0)
    expect(run).toContain('SENTENCE_TX_FAILED');
    expect(run).not.toContain("toast('단어 분석을 가져오지 못했어요.");
    expect(v).toContain("leftPanelResult === SENTENCE_TX_FAILED");
  });

  it('Esc는 초점이 패널 밖이어도 열린 것을 닫는다(글자 카드 → 단어창 → 문장 막대) · 글자 카드만 열려 있으면 글자 카드만', () => {
    const v = viewer();
    const esc = sliceBetween(v, 'escapeRef.current = {', 'const pickedPosition');
    expect(esc).toContain('if (h.char) h.closeChar();');
    expect(esc).toContain('else if (h.card) h.closeCard();');
    expect(esc).toContain('else if (h.bar) h.closeBar();');
    expect(v).toContain("onKeyDown={e => { if (e.key === 'Escape' && inspectChar) { e.preventDefault(); e.stopPropagation(); setInspectChar(null); } }}>");
  });

  it('초점 복귀 — 문장 패널 닫기는 문장 막대로, 제목 편집 닫기는 「제목 편집」으로, 듣기 시작 · 정지는 바뀐 버튼으로', () => {
    const v = viewer();
    expect(sliceBetween(v, 'const closeWordCard = () => {', 'detailGate.current.cancel();')).toContain("lineHead?.querySelector('.line-pick')");
    expect(v).toContain('titleEditRef.current?.focus({ preventScroll: true })');
    expect(v).toContain('aria-label={vt("자료 제목")}');
    const listen = read('src/components/ListenControls.jsx');
    expect(sliceBetween(listen, 'function play() {', 'if (paused')).toContain('holdFocus();');
    expect(sliceBetween(listen, 'function stop() {', 'interruptedRef.current = false;')).toContain('holdFocus();');
  });

  it('「연결한 교재 단원」은 뷰어 · PDF 뷰어에서 뺐다(오너 지시 2026-10-23 KST) — 교재 쪽 「자료와 함께 복습하기」는 그대로', () => {
    for (const f of ['src/views/ViewerPage.jsx', 'src/views/PdfViewerPage.jsx']) expect(read(f), f).not.toContain('MaterialChapterLinks');
    for (const f of ['src/views/ReferenceChapterPage.jsx', 'src/components/books/BookMaterials.jsx', 'src/components/books/BookReader.jsx'])
      expect(read(f), f).toContain('<MaterialChapterLinks ');
  });
});
