import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import { VIEWER_MESSAGES, VIEWER_MESSAGE_LOCALES } from '../../lib/viewerMessages.js';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const flow = read('src/lib/boundaryEditFlow.js');
const korean = read('src/lib/koreanBoundarySplit.js');
const css = read('src/components/viewer/reader-controls.css');

/**
 * 뷰어 v2 AD-R3 §7.5 — 한국어 나누기 B안(오너 결정 2026-10-09) 배선. 화면 동작은 e2e(viewer-boundary-edit.e2e.mjs 한국어 사례)가
 * 실화면·요청 감시로 잰다. 여기서는 실화면이 놓치기 쉬운 경로(키보드 등급·AI 오버레이·묶기 진입점)를 소스로 고정한다.
 */
describe('AD-R3 §7.5 한국어 나누기 배선', () => {
  it('진입점은 중·일·영과 같은 권한 조건 + 한국어, 묶기(드래그·옆 단어와 묶기)는 여전히 legacyTokenEditingAllowed(한국어 0)', () => {
    expect(viewer).toContain("const koreanSplitAllowed = materialLang === 'Korean' && canEditToken && koreanSplitEntryAllowed(boundaryCtx) && isDone");
    expect(viewer).toContain('&& !material?.__offline && !reanalyzeMutation.isPending;');
    expect(flow).toMatch(/ctx\.owner === true && ctx\.language === 'Korean' && !ctx\.classCopy && !ctx\.passage && !ctx\.classMode/);
    expect(viewer).toContain('const boundaryAllowed = canEditToken && legacyTokenEditingAllowed && boundaryEntryAllowed(boundaryCtx) && isDone');
    const menu = sliceBetween(viewer, '} : koreanMenuShown ? {', '} : null;');
    expect(menu).toContain("items: [{ id: 'split', label: vt('나누기')");
    expect(menu).not.toMatch(/id: 'merge-neighbor'|id: 'edit'/);
  });
  it('경계 쓰기 mutation은 한국어 진입점이 열려 있을 때만 한국어 요청을 받는다(그 밖은 지금처럼 거부)', () => {
    const mutation = sliceBetween(viewer, 'const boundaryMutation = useMutation({', '\n  });');
    expect(mutation).toContain("if (!legacyTokenEditingAllowedRef.current && !koreanSplitAllowedRef.current) throw new BoundaryEditError('korean');");
    expect(viewer).toContain('koreanSplitAllowedRef.current = koreanSplitAllowed;');
  });
  it('나눈 조각: 문맥 설명 AI 오버레이 꺼짐 · 저장/등급(버튼·키보드) 없음 · 더 알아보기(AI 요청 버튼) 없음', () => {
    expect(viewer).toContain("scope: cacheScope, enabled: materialLang === 'Korean' && isSheetOpen && !koreanPieceSelected});");
    expect(sliceBetween(viewer, 'function koreanSaveReady(token) {', '\n  }')).toContain('!koreanBoundaryPiece(material?.processed_json, token.id)');
    expect(viewer).toContain('|| koreanPieceSelected,\n    inlineDue: !!user && !koreanPieceSelected');
    expect(viewer).toContain('{user && learningStorageSupported && !koreanPieceSelected && (() => {\n        // 네 등급은 FSRS 평가다.');
    expect(viewer).toContain('{user && learningCapabilities.review && !koreanPieceSelected && findSavedVocab(');
    expect(viewer).toContain('{!koreanPieceSelected && <section ref={learnRef}');
    expect(viewer).toContain("{koreanPieceSelected && <p className=\"reader-card-boundary-note\" role=\"status\">{vt('나눈 조각은 단어장에 담지 않아요.')}</p>}");
  });
  it('한국어 조각은 분석·AI 호출 없이 기존 morphology로 만든다(순수 모듈 · 흐름의 한국어 갈래)', () => {
    expect(korean).not.toMatch(/callLLM|callGemini|fetch\(|\/api\//);
    const branch = sliceBetween(flow, 'if (!run.restored && korean) {', '} else if (!run.restored) {');
    expect(branch).toContain('koreanPieces(run)');
    expect(branch).not.toContain('analyze(');
  });
  it('새 문구 ko·zh-CN·zh-TW 세 벌 · 색은 뷰어 별칭 토큰만', () => {
    for (const key of ['이 단어는 나눌 자리가 없어요.', '줄어든 꼴', '모양이 바뀐 꼴', '나눈 조각', '원래대로', '원래대로 했어요',
      '나눈 조각은 단어장에 담지 않아요.', '이 조각 설명은 분석한 설명 언어로만 있어요.']) {
      for (const locale of VIEWER_MESSAGE_LOCALES) expect(VIEWER_MESSAGES[locale][key], `${locale}: ${key}`).toBeTruthy();
    }
    const block = sliceBetween(css, '/* AD-R3 §7.5', '/* /AD-R3 §7.5 */');
    expect(block).toContain('.viewer-boundary-split__gloss');
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });
});
