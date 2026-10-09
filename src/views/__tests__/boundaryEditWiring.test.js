import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import { VIEWER_MESSAGES, VIEWER_MESSAGE_LOCALES } from '../../lib/viewerMessages.js';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const flow = read('src/lib/boundaryEditFlow.js');
const parts = read('src/components/viewer/ViewerBoundaryEdit.jsx');
const css = read('src/components/viewer/reader-controls.css');

/**
 * 뷰어 v2 AD-R3 PR③ — 「이 자료」 한 단어로 묶기 · 나누기 배선(설계서 docs/manabi-viewer-v2-ad-r3.md §4.2 · §6 · §8.1
 * 「저장·일정 불변」 「원자 저장」 「자리 구분」). e2e(viewer-boundary-edit.e2e.mjs)가 요청 감시로 같은 것을 실화면에서 잰다.
 */
describe('AD-R3 PR③ 배선 — 쓰기는 원자 RPC + 교정 이력뿐', () => {
  const mutation = sliceBetween(viewer, 'const boundaryMutation = useMutation({', '\n  });');
  it('경계 저장은 viewer_replace_analysis(replaceViewerAnalysis)이고 reading_materials 직접 update·correctTokenMutation을 쓰지 않는다', () => {
    expect(flow).toContain("import { replaceViewerAnalysis } from './reanalysisPreservation';");
    expect(flow).toContain('replaceViewerAnalysis(client, material, material.raw_text, nextJson, attempt)');
    expect(flow).not.toMatch(/\.update\(|reading_materials/);
    expect(flow).toContain("client.from('token_corrections').insert(");
    expect(flow).toContain("source: 'boundary_edit'");
    expect(mutation).toContain('commitBoundaryEdit(current, request, deps)');
    expect(mutation).toContain('undoBoundaryEdit(current, undo, deps)');
    expect(mutation).not.toContain('correctTokenMutation');
  });
  it('저장 단어·FSRS·평가 이력·개인 뜻·출처·아는 단어·사전·전역 승격 호출 0(§4.2)', () => {
    for (const src of [flow, mutation, parts]) {
      for (const banned of ['addToVocab', 'saveInlineVocabulary', 'gradeInline', 'promoteCorrection', 'knownState', 'recordVocabEncounters',
        'dict-correct', 'user_vocabulary', 'vocabulary_contexts', 'review_events', 'morpheme_dictionary', '/api/learning']) {
        expect(src, banned).not.toContain(banned);
      }
    }
  });
  it('자리 구분: 글자 누름 처리기(toggleInspectChar)에서 경계 편집을 부르지 않는다 — 나누기는 ⋯ 메뉴·카드 [나누기]에서만(§6.2)', () => {
    const inspect = sliceBetween(viewer, 'const toggleInspectChar = (ch, key, reading) => {', '\n  };');
    expect(inspect).not.toMatch(/boundary|Boundary|split/i);
    expect(viewer).toContain("{ id: 'split', label: vt('나누기'), onSelect: () => openBoundaryPanel({ kind: 'split', tokenId: cardTokenId }) }");
  });
});

describe('AD-R3 PR③ 배선 — 진입점 조건', () => {
  it('진입점은 소유자 · 중·일·영 · 사본/구간/수업 모드 제외 · 분석 완료 · 재분석 중 아님(한국어는 메뉴·드래그 항목 자체가 없다)', () => {
    expect(viewer).toContain('const boundaryAllowed = canEditToken && legacyTokenEditingAllowed && boundaryEntryAllowed(boundaryCtx) && isDone');
    expect(viewer).toContain('!reanalyzeMutation.isPending');
    expect(viewer).toContain('passage: !!passageOf(material)');
    expect(viewer).toContain('classMode: classStudyActive');
    expect(flow).toMatch(/ctx\.owner === true && BOUNDARY_LANGUAGES\.includes\(ctx\.language\)\s*&& !ctx\.classCopy && !ctx\.passage && !ctx\.classMode/);
    expect(flow).toContain('classCopy: !!meta.source_ref || !!material?.__local');
    // 드래그 버튼·카드 줄·⋯ 항목은 모두 boundaryAllowed에서 나온다
    expect(viewer).toContain('const dragRange = boundaryAllowed && tokenRange.range && !tokenRange.dragging ? tokenRange.range : null;');
    expect(viewer).toContain('const cardTokenId = boundaryAllowed && selectedToken?.id && isSheetOpen ? selectedToken.id : null;');
    expect(viewer).toContain('...(cardTokenId ? [');
  });
  it('「직접 묶은 단어 · [나누기]」는 소유자 카드에만, 수업 모드에서는 그리지 않는다 · 「AI」 표시 없음', () => {
    expect(viewer).toContain("{!classStudyActive && renderBoundaryCard()}");
    expect(viewer).toContain("boundaryOrigin === 'merged' && <p className=\"reader-card-boundary\">");
    expect(parts.replace(/\/\/.*$/gm, '')).not.toMatch(/\bAI\b/); // 주석 밖(화면 문구)에 「AI」 0
  });
  it('재분석 알림: 목업 문구 + [보기] → [문장] 탭 자리 목록(useReanalyze onPendingBoundaries)', () => {
    expect(viewer).toContain('onPendingBoundaries: showPendingBoundaries');
    expect(viewer).toContain("vt('분석을 다시 했어요. 직접 고친 단어 경계 {count}개는 이번 분석에 적용하지 못했어요.', { count })");
    expect(sliceBetween(viewer, 'const showPendingBoundaries = (count) =>', "'warning', 10000);")).toContain('setBoundaryPendingOpen(true); setSentenceTabSignal(s => s + 1);');
  });
});

describe('AD-R3 PR③ 문구 · 누름 영역', () => {
  it('새 문구는 ko·zh-CN·zh-TW 세 벌', () => {
    for (const key of ['한 단어로 묶기', '옆 단어와 묶기', '나누기', '묶기', '어디서 나눌까요?', '이 자료만', '직접 묶은 단어', '묶었어요', '나눴어요',
      '앞 단어와', '뒤 단어와', '단어장의 {word}은(는) 그대로 있어요.', '적용하지 못한 단어 경계 · {count}개', '{left}와(과) {right} 사이에서 나누기']) {
      for (const locale of VIEWER_MESSAGE_LOCALES) expect(VIEWER_MESSAGES[locale][key], `${locale}: ${key}`).toBeTruthy();
    }
  });
  it('버튼·칼선 칸 44px, 색은 뷰어 별칭 토큰만', () => {
    const block = sliceBetween(css, '/* AD-R3 PR③', '/* /AD-R3 PR③ */');
    expect(block).toContain('.viewer-boundary-merge__start {display:inline-flex;align-items:center;gap:6px;min-height:44px;}');
    expect(block).toContain('width:44px;min-width:44px;height:44px;');
    expect(block).toContain('.reader-card-boundary button,.reader-card-boundary-undo button {min-height:44px;}');
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });
});
