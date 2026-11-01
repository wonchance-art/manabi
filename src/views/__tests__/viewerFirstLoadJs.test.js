import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import * as gate from '../../lib/boundaryEditGate.js';
import * as flow from '../../lib/boundaryEditFlow.js';
import * as shape from '../../lib/conversation/conversationShape.js';
import * as turnModel from '../../lib/conversation/turnModel.js';

/**
 * 계약 VIEWER-JS-001 — 뷰어 첫 로드 JS에서 「누른 뒤에만 쓰는 코드」를 뺀다.
 * 배경(운영 실측 2026-11-01 KST, 390×844 · CPU×4): /viewer/[id] page 청크 381KB 중 첫 로드에 실행된 것은 82KB, 그 청크의
 * EvaluateScript 176ms. 경계 편집(묶기 · 나누기 흐름 + 분석 엔진), 다시 분석, 대화 턴 계산, 완료 · 퀴즈 창, 원문 수정 창,
 * 뜻·발음 수정, 뜻 확인 목록, 문형 카드, 작품 카드가 정적 import로 실려 있었다.
 *   ⑴ 뷰어 쪽(page.jsx)의 **정적** import 그래프는 아래 모듈에 닿지 않는다 — 닿으면 page 청크로 되돌아온다(번들러는 정적 import를 같은 청크에 싣는다).
 *   ⑵ 대신 그 모듈은 import()로 받는다(쓰는 자리 그대로 — 기능이 사라지지 않았다).
 *   ⑶ 첫 렌더부터 동기로 묻는 몫(경계 진입 판정 · 대화 표식)은 작은 모듈로 나눴고, 원래 모듈이 같은 함수를 그대로 다시 내보낸다(규칙 한 벌).
 *   ⑷ 받기 전 화면: 경계 진입점은 없음(소유자에게만 유휴 시간에 받는다), 창 · 패널은 lazyPanel(viewerLazyPanels.test.js), 쓰기 경로는 받은 뒤 진행.
 *   ⑸ 끊긴 채 처음 열 수 있는 창(완료 창)과 소유자 고치기 부품은 유휴 시간에 미리 받는다(OFFLINE-SWEEP-001과 같은 길).
 */
const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');

const EXT = ['', '.js', '.jsx', '.mjs', '/index.js', '/index.jsx'];
function resolve(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(root, 'src', spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null; // 패키지
  for (const ext of EXT) {
    const file = base + ext;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}
/** 정적 import · export-from만 따라간다(import()는 따로 받는 청크). */
function staticGraph(entry) {
  const seen = new Set(), queue = [path.join(root, entry)];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !/\.(m?js|jsx)$/.test(file)) continue;
    seen.add(file);
    const src = fs.readFileSync(file, 'utf8');
    for (const [, spec] of src.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[^;'"()]*?\bfrom\s+)?['"]([^'"]+)['"]/g)) {
      const next = resolve(file, spec);
      if (next) queue.push(next);
    }
  }
  return new Set([...seen].map((f) => path.relative(root, f)));
}

// 누른 뒤에만 쓰는 모듈 — 뷰어 첫 로드 정적 그래프 밖.
const DEFERRED = [
  'src/lib/analyzeText.js',
  'src/lib/boundaryEditFlow.js',
  'src/lib/reanalysisPreservation.js',
  'src/lib/conversation/turnModel.js',
  'src/components/viewer/ViewerBoundaryEdit.jsx',
  'src/views/ViewerQuizModal.jsx',
  'src/views/SourceEditModal.jsx',
  'src/views/TokenEditPanel.jsx',
  'src/components/viewer/ViewerSenseReview.jsx',
  'src/components/PatternCard.jsx',
  'src/components/viewer/ViewerArtCard.jsx',
  'src/components/conversation/PhoneFrame.jsx',
  'src/components/library/LibraryCollections.jsx',
];

describe('⑴⑵ 정적 그래프 밖 · import()로 받는다', () => {
  const graph = staticGraph('src/app/(app)/viewer/[id]/page.jsx');
  it('뷰어 쪽 정적 그래프에 본문 부품은 그대로 있다(걷기가 실제로 그래프를 본다)', () => {
    for (const f of ['src/views/ViewerPage.jsx', 'src/lib/usePagedReader.js', 'src/components/ViewerBottomSheet.jsx', 'src/lib/boundaryEditGate.js',
      'src/lib/conversation/conversationShape.js', 'src/lib/useReanalyze.js']) expect(graph.has(f), f).toBe(true);
  });
  it.each(DEFERRED)('%s — 첫 로드 정적 그래프에 없다', (file) => {
    expect(graph.has(file), `${file}가 정적 import로 뷰어 첫 로드에 들어왔다`).toBe(false);
  });
  it('쓰는 자리에서 import()로 받는다', () => {
    expect(viewer).toContain("const BOUNDARY_FLOW = deferredModule(() => import('../lib/boundaryEditFlow'));");
    expect(viewer).toContain("const loadBoundaryEdit = () => import('../components/viewer/ViewerBoundaryEdit');");
    for (const name of ['BoundaryMergeConfirm', 'BoundaryMergeRow', 'BoundaryPendingList', 'BoundarySplitPanel']) {
      expect(viewer).toContain(`const ${name} = lazyPanel(() => loadBoundaryEdit().then(m => m.${name}));`);
    }
    expect(viewer).toContain("const loadTurnModel = () => import('../lib/conversation/turnModel');");
    expect(viewer).toContain("const { fetchWithRateLimitRetry } = await import('../lib/analyzeText');");
    const reanalyze = read('src/lib/useReanalyze.js');
    expect(reanalyze).toContain("export const loadAnalysisEngine = () => Promise.all([import('./analyzeText'), import('./reanalysisPreservation')])");
    expect(reanalyze.match(/await loadAnalysisEngine\(\);/g)).toHaveLength(2);
    expect(read('src/lib/usePdfRangeMutation.js')).toContain("const { analyzeText } = await import('./analyzeText');");
  });
});

describe('⑶ 나눈 작은 모듈 — 같은 함수를 그대로 다시 내보낸다', () => {
  it('경계 진입 판정 · 이유 문구 · 오류 형: boundaryEditFlow의 것 = boundaryEditGate의 것', () => {
    for (const name of ['BoundaryEditError', 'boundaryEditContext', 'boundaryEntryAllowed', 'boundaryReasonHidden', 'boundaryReasonMessage',
      'koreanBoundaryPiece', 'koreanSplitEntryAllowed']) expect(flow[name], name).toBe(gate[name]);
    expect(viewer).toMatch(/import \{\s*BoundaryEditError, boundaryEditContext, boundaryEntryAllowed, boundaryReasonHidden, boundaryReasonMessage, koreanBoundaryPiece, koreanSplitEntryAllowed,\s*\} from '\.\.\/lib\/boundaryEditGate';/);
  });
  it('대화 표식 · 줄별 토큰: turnModel의 것 = conversationShape의 것', () => {
    for (const name of ['CONVERSATION_VERSION', 'conversationOf', 'tokensByLineIndex']) expect(turnModel[name], name).toBe(shape[name]);
    expect(viewer).toContain("import { conversationOf, tokensByLineIndex } from '../lib/conversation/conversationShape';");
  });
});

describe('⑷ 받기 전 화면과 쓰기 경로', () => {
  it('경계 흐름은 소유자에게만 받는다 — 받기 전에는 문맥이 null이라 진입 판정이 모두 거짓', () => {
    expect(viewer).toContain('const boundaryFlow = useDeferredModule(BOUNDARY_FLOW, canEditToken);');
    expect(viewer).toContain('const boundaryCtx = boundaryFlow && boundaryEditContext(material, {');
    expect(gate.boundaryEntryAllowed(null)).toBe(false);
    expect(gate.koreanSplitEntryAllowed(null)).toBe(false);
    expect(viewer).toContain('boundaryPendingOpen && canEditToken && boundaryFlow && (');
  });
  it('묶기 · 나누기 · 되돌리기 · [아니요] 쓰기는 흐름 모듈을 받은 뒤 같은 함수로 간다', () => {
    const boundary = sliceBetween(viewer, 'const boundaryMutation = useMutation({', 'onSuccess:');
    expect(boundary).toContain('const { commitBoundaryEdit, undoBoundaryEdit } = await BOUNDARY_FLOW.preload();');
    expect(boundary).toContain('return commitBoundaryEdit(current, request, deps);');
    const dismiss = sliceBetween(viewer, 'const boundaryDismissMutation = useMutation({', 'onSuccess:');
    expect(dismiss).toContain('const { dismissBoundarySuggestion } = await BOUNDARY_FLOW.preload();');
  });
  it('대화 턴 · 채운 줄은 받은 모듈의 같은 계산으로 끼운다', () => {
    expect(sliceBetween(viewer, 'const handleConversationTurn = useCallback(async (body) => {', '}, [')).toContain('const { applyTurnResult } = await loadTurnModel();');
    expect(sliceBetween(viewer, 'const handleConversationFill = useCallback(async (body) => {', '}, [')).toContain('const { applyFillResult } = await loadTurnModel();');
  });
  it('useDeferredModule — enabled일 때만, 유휴 시간에, 못 받으면 null 그대로', () => {
    const lib = read('src/lib/deferredModule.js');
    expect(lib).toContain('if (!enabled || handle.current()) return undefined;');
    expect(lib).toContain('const cancel = onIdle(() => { handle.preload().then(() => { if (alive) setLoaded(true); }, () => {}); });');
    expect(lib).toContain('return enabled ? handle.current() : null;');
  });
});

describe('⑸ 끊긴 채 처음 열 수 있는 창은 미리 받는다', () => {
  it('완료 창은 모든 독자, 고치기 부품은 소유자, 문형 카드는 문법 표시를 켠 독자, 작품 카드는 그림 자료, 말풍선 틀은 대화 부품과 함께', () => {
    expect(viewer).toContain('useEffect(() => onIdle(() => { ViewerQuizModal.preload().catch(() => {}); }), []);');
    expect(viewer).toContain('return onIdle(() => { for (const part of [BoundaryMergeConfirm, ViewerSenseReview, TokenEditPanel]) part.preload().catch(() => {}); });');
    expect(viewer).toContain('useEffect(() => (patternOn ? onIdle(() => { PatternCard.preload().catch(() => {}); }) : undefined), [patternOn]);');
    expect(viewer).toContain('useEffect(() => { if (artBookLocked) ViewerArtCard.preload().catch(() => {}); }, [artBookLocked]);');
    expect(viewer).toContain('useEffect(() => { if (conversationMode) { PhoneFrame.preload().catch(() => {}); ConversationThread.preload().catch(() => {}); } }, [conversationMode]);');
  });
});
