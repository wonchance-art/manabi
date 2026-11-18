import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 계약: 글 올리기 → 뷰어 흐름 B 묶음(FLOW-ADD-B6 ~ B9, 오너 「알아서 권장대로」 2026-11-16 KST · 오케스트레이터 검수).
 * 화면 모양은 실제 빌드 목업 · 화면 벽으로 확인했고(PR 기록), 여기서는 되살아나면 안 되는 배선만 고정한다.
 */
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('B6 — 뷰어 분석 진행 「n / m줄」 · 버튼 정리', () => {
  const viewer = read('src/views/ViewerPage.jsx');
  it('보존 재분석은 분석기가 센 처리 줄 · 전체 줄을 넘기고, 훅이 이 탭 분석의 진행으로 받는다', () => {
    expect(read('src/lib/reanalysisPreservation.js')).toContain('onProgress?.({ processed, total });');
    const hook = read('src/lib/useReanalyze.js');
    expect(hook).toContain('setProgress({ processed: Math.min(step.processed, step.total), total: step.total, materialId });');
    expect(hook).toContain('progress: progress?.materialId === materialId && mutation.isPending ? progress : null,');
  });
  it('배너 글 · 막대 · 낭독 영역이 같은 진행을 쓴다 — 낭독은 약 10%마다(announcedProgress)', () => {
    expect(viewer).toContain('{withCount(vt(analyzingLine), analysisProgress?.processed)}</span>');
    expect(viewer).toContain('withCount(vt(analyzingLine), announcedProgress(analysisProgress?.processed, analysisProgress?.total))');
    expect(viewer).toContain('<div className="analyzing-banner__bar" aria-hidden="true">');
  });
  it('이 탭에서 분석이 도는 동안 「새로고침」은 숨기고, 중단은 하나(배너) — 도구줄 중단은 배너를 숨기는 대화 화면만', () => {
    expect(viewer).toContain('{!reanalyzeMutation.isPending && <button onClick={() => refetch()} className="analyzing-banner__refresh">{vt("새로고침")}</button>}');
    expect(viewer).toContain('{conversation && user?.id === material?.owner_id && reanalyzeMutation.isPending && (');
    expect(viewer).not.toContain('⏹');
  });
  it('일부 실패 알림은 복구 배너가 없는 학습 구간에서만 — 배너와 같은 말을 두 번 하지 않는다', () => {
    expect(read('src/lib/useReanalyze.js')).toContain("else if (json?.status === 'partial') { if (passageOf(material)) toast?.('일부 줄은 분석을 다시 시도해야 해요.', 'warning'); }");
  });
  it('진행 막대는 한 색 칠 — 그라디언트 · 반짝임 없음(옛 가져오기 막대도 같은 꼴)', () => {
    const css = read('src/index.css');
    expect(css).toContain('.analyzing-banner__bar > div { height: 100%; background: currentColor;');
    expect(css).toContain('.analyzing-banner__refresh.analyzing-banner__stop { background: var(--danger); }');
    expect(css).not.toContain('progressShimmer');
  });
});

describe('B7 — 이미 분석한 원본은 「이어서 공부하기」', () => {
  it('본문 = 분석 원문 · 같은 언어 · 분석 끝(completed · partial)일 때만 말을 바꾸고, 여는 길은 그대로(openDocumentStudy)', () => {
    const reader = read('src/components/materials/OriginalMaterialReader.jsx');
    expect(reader).toContain("&& ['completed', 'partial'].includes(material.processed_json?.status) && material.processed_json?.metadata?.language === savedLanguage;");
    expect(reader).toContain("{busy ? '여는 중…' : continuing ? '이어서 공부하기 ↗' : '이 글로 공부하기 ↗'}");
  });
});

describe('B8 — 옛 가져오기 언어는 글자로 짐작 · 입구 이모지 없음', () => {
  const page = read('src/views/MaterialAddPage.jsx');
  it('작성기와 같은 짐작(guessStudyLanguage) · 같은 안내 · 사용자가 고른 값은 덮지 않는다', () => {
    expect(page).toContain("import { MAX_BODY_CHARS, guessStudyLanguage } from '../lib/materialComposer';");
    expect(page).toContain('if (languageChosen || isNote || pdfSource || epubSource) return;');
    expect(page).toContain("onClick={() => { chooseLanguage(key); setLevel(defaultLevel); }}");
    expect(page).toContain('{languageGuessed && <small className="import-language-hint">글자를 보고 골랐어요</small>}');
  });
  it('입구 칩은 글자만', () => {
    expect(page).toMatch(/const ENTRIES = \[\n  \['pdf', 'PDF'\],\n  \['epub', 'EPUB'\],\n  \['sentences', '문장 목록'\],\n  \['link', '링크'\],\n\];/);
  });
});

describe('B9 — 한국어 입구는 계정 배포 계약일 때만', () => {
  it('작성기 위 링크 · 옛 가져오기 버튼이 작성기 언어 칩과 같은 useStudyLanguages를 따른다', () => {
    const entry = read('src/components/materials/MaterialEntry.jsx');
    expect(entry).toContain('const textReadingLinks = textReadingLanguages.filter(info => studyLanguageList.includes(info.language));');
    expect(entry).toContain('textReadingLinks.map(info => (');
    // 주소로 온 길(isTextReading)은 계약 확인에 묶지 않는다 — 확인이 다시 도는 동안 화면이 갈리지 않게.
    expect(entry).toContain('&& textReadingLanguages.some(info => info.language === requested?.language);');
    expect(entry).not.toMatch(/const textReadingLanguages = [^;]*studyLanguageList/);
    const page = read('src/views/MaterialAddPage.jsx');
    expect(page).toContain("&& (info.code !== 'ko' || koreanReady)");
    expect(page).toContain("const koreanReady = studyLanguageList.some(value => viewerLanguageInfo(value)?.code === 'ko');");
  });
});
