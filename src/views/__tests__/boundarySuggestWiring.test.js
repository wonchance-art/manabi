import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import { senseReviewItems, isBoundarySuggestion } from '../../lib/viewerSenseReview.js';
import { BOUNDARY_DISMISSED_LIMIT, BOUNDARY_MARKERS, dismissedBoundaryForms, withBoundarySuggestionDismissed } from '../../lib/boundaryEdits.js';
import { BoundaryEditError, dismissBoundarySuggestion } from '../../lib/boundaryEditFlow.js';
import { VIEWER_MESSAGES, VIEWER_MESSAGE_LOCALES } from '../../lib/viewerMessages.js';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const list = read('src/components/viewer/ViewerSenseReview.jsx');
const flow = read('src/lib/boundaryEditFlow.js');
const css = read('src/components/viewer/reader-controls.css');
const code = (text) => text.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * 뷰어 v2 AD-R4 PR④ — 경계 후보 「한 단어로 묶을까요?」(설계서 docs/manabi-viewer-v2-ad-r4.md §5.2 · §6.1 · §6.2 · §10 PR④).
 * 재료는 서버가 미등재 쌍의 앞 토큰에 다는 boundarySuggest뿐 — 서버 상수 ZH_BOUNDARY_REVIEW가 꺼진 지금은 표식이 없어 화면 변화 0.
 * N = 뜻 표식 수 + 경계 후보 수. [묶기]는 AD-R3 확인 줄(boundaryEditFlow — 새 쓰기 경로 0), [아니요]는 같은 원자 RPC로 그 꼴을 접는다.
 * 사용자/이 자료 경계 기록이 이긴다 — 기록 구간·표식 토큰의 후보는 목록에 없다. 「AI」 표시 0.
 */
const T = (text, extra = {}) => ({ text, base_form: text, meaning: `${text} 뜻`, ...extra });
function fixture(extra = {}) {
  return {
    metadata: { language: 'Chinese', viewerRevision: 'rev-1', ...extra.metadata },
    sequence: ['id_0_0', 'id_0_1', 'id_0_2', 'id_0_3', 'id_0_4', 'br_0', 'id_1_0', 'id_1_1', 'id_1_2', 'br_1', 'id_2_0', 'id_2_1'],
    dictionary: {
      id_0_0: T('运动员'), id_0_1: T('的'), id_0_2: T('身体', { boundarySuggest: '身体素质' }), id_0_3: T('素质'),
      id_0_4: T('好', { meaningCheck: 'doubt' }),
      br_0: { text: '\n', pos: '개행' },
      id_1_0: T('打', { meaningCheck: 'ctx' }), id_1_1: T('电', { boundarySuggest: '电话' }), id_1_2: T('话'),
      br_1: { text: '\n', pos: '개행' },
      // 줄 끝 후보 — 다음 토큰이 다른 줄이면 후보가 아니다
      id_2_0: T('他'), id_2_1: T('们', { boundarySuggest: '们我' }),
      ...extra.dictionary,
    },
  };
}

describe('경계 후보 — 순수 규칙(senseReviewItems)', () => {
  it('뜻 항목과 경계 항목이 문장 순서로 섞이고 N = 둘의 합 · 줄을 넘는 후보는 없다', () => {
    const items = senseReviewItems(fixture(), 'Chinese');
    expect(items.map((i) => (isBoundarySuggestion(i) ? `b:${i.form}` : i.id))).toEqual(['b:身体素质', 'id_0_4', 'id_1_0', 'b:电话']);
    expect(items[0]).toEqual({ kind: 'boundary', id: 'id_0_2~id_0_3', tokenId: 'id_0_2', nextId: 'id_0_3', form: '身体素质', parts: ['身体', '素质'],
      token: { ...T('身体', { boundarySuggest: '身体素质' }), id: 'id_0_2' } });
    for (const lang of ['Korean', 'Japanese', 'English']) expect(senseReviewItems(fixture(), lang)).toEqual([]);
  });

  it('표식이 없으면 경계 항목 0(서버 상수 꺼짐 = 운영 화면 변화 0)', () => {
    const json = fixture();
    for (const token of Object.values(json.dictionary)) delete token.boundarySuggest;
    expect(senseReviewItems(json, 'Chinese').filter(isBoundarySuggestion)).toEqual([]);
  });

  it('사용자/이 자료 경계가 이긴다 — 표식 토큰·기록 구간(적용·대기)과 겹치는 후보, 이어도 꼴이 다른 후보는 없다', () => {
    const marked = fixture({ dictionary: { id_0_3: T('素质', { boundary: 'user' }) } });
    expect(senseReviewItems(marked, 'Chinese').filter(isBoundarySuggestion).map((i) => i.form)).toEqual(['电话']);
    for (const status of ['applied', 'pending']) {
      const recorded = fixture({ metadata: { viewerBoundaries: { version: 1, edits: [{ id: 'b', line: 0, start: 5, end: 7, text: '身体', cuts: [], base: [], status }] } } });
      expect(senseReviewItems(recorded, 'Chinese').filter(isBoundarySuggestion).map((i) => i.form), status).toEqual(['电话']);
    }
    const elsewhere = fixture({ metadata: { viewerBoundaries: { version: 1, edits: [{ id: 'b', line: 0, start: 0, end: 3, text: '运动员', cuts: [1], base: [], status: 'applied' }] } } });
    expect(senseReviewItems(elsewhere, 'Chinese').filter(isBoundarySuggestion).map((i) => i.form)).toEqual(['身体素质', '电话']);
    const changed = fixture({ dictionary: { id_0_3: T('素') } });
    expect(senseReviewItems(changed, 'Chinese').filter(isBoundarySuggestion).map((i) => i.form)).toEqual(['电话']);
  });

  it('[아니요]로 접은 꼴은 목록에 없다 — 접기는 metadata만 바꾸고(토큰·기록·원문 무변경) 최근 200개만 둔다', () => {
    const json = fixture();
    const next = withBoundarySuggestionDismissed(json, '身体素质');
    expect(senseReviewItems(next, 'Chinese').filter(isBoundarySuggestion).map((i) => i.form)).toEqual(['电话']);
    expect(next.dictionary).toBe(json.dictionary);
    expect(next.sequence).toBe(json.sequence);
    expect(next.metadata).toEqual({ ...json.metadata, viewerBoundaryDismissed: ['身体素质'] });
    expect(json.metadata.viewerBoundaryDismissed).toBeUndefined();
    expect(withBoundarySuggestionDismissed(next, '身体素质').metadata.viewerBoundaryDismissed).toEqual(['身体素质']);
    let many = json;
    for (let k = 0; k < BOUNDARY_DISMISSED_LIMIT + 5; k++) many = withBoundarySuggestionDismissed(many, `꼴${k}`);
    expect(many.metadata.viewerBoundaryDismissed).toHaveLength(BOUNDARY_DISMISSED_LIMIT);
    expect([...dismissedBoundaryForms({ metadata: { viewerBoundaryDismissed: ['a', 3, '', null, 'b'] } })]).toEqual(['a', 'b']);
  });

  it('자동 묶기 표식(ai_registered)은 AD-R3 표식 목록에 있고, 「직접 묶은 단어」 판정(기록 기준)에는 들지 않는다', () => {
    expect(BOUNDARY_MARKERS).toContain('ai_registered');
    expect(viewer).toContain("boundaryOrigin === 'merged' && <p className=\"reader-card-boundary\">");
    expect(sliceBetween(flow, 'export function boundaryTokenOrigin(json, tokenId) {', '\n}')).toContain('readBoundaryEdits(json)');
  });
});

describe('경계 후보 [아니요] — 쓰기(dismissBoundarySuggestion)', () => {
  const material = { id: 7, raw_text: '运动员的身体素质非常好。', processed_json: fixture() };
  it('같은 원자 RPC(viewer_replace_analysis) 한 번 — 원문 그대로 · 기대값 = 지금 자료 · metadata만 바뀐다', async () => {
    const calls = [];
    const client = { rpc: async (name, args) => { calls.push({ name, args }); return { data: { material: { id: 7, raw_text: args.p_raw, processed_json: args.p_json } }, error: null }; } };
    const out = await dismissBoundarySuggestion(material, '身体素质', { client, attempt: 'att-1' });
    expect(calls).toHaveLength(1);
    const [{ name, args }] = calls;
    expect(name).toBe('viewer_replace_analysis');
    expect(args).toMatchObject({ p_id: '7', p_expected_raw: material.raw_text, p_raw: material.raw_text, p_attempt: 'att-1' });
    expect(args.p_expected_json).toBe(material.processed_json);
    expect(args.p_json.metadata).toEqual({ ...material.processed_json.metadata, viewerRevision: 'att-1', viewerBoundaryDismissed: ['身体素质'] });
    expect(args.p_json.dictionary).toBe(material.processed_json.dictionary);
    expect(out.material.processed_json.metadata.viewerBoundaryDismissed).toEqual(['身体素质']);
  });
  it('중국어 아님·빈 꼴은 쓰지 않는다', async () => {
    const client = { rpc: async () => { throw new Error('no write'); } };
    await expect(dismissBoundarySuggestion({ ...material, processed_json: { ...fixture(), metadata: { language: 'Japanese' } } }, '身体素质', { client })).rejects.toBeInstanceOf(BoundaryEditError);
    await expect(dismissBoundarySuggestion(material, '', { client })).rejects.toBeInstanceOf(BoundaryEditError);
  });
  it('저장 단어·FSRS·평가 이력·사전·전역 승격·교정 경로 호출 0', () => {
    const fn = sliceBetween(flow, 'export async function dismissBoundarySuggestion(material, form, deps) {', '\n}');
    expect(fn).toContain('replaceViewerAnalysis(deps.client, material, material.raw_text, nextJson, attempt)');
    for (const banned of ['token_corrections', 'addToVocab', 'promoteCorrection', 'dict-correct', 'user_vocabulary', 'review_events', 'morpheme_dictionary', '.update(']) {
      expect(fn, banned).not.toContain(banned);
    }
  });
});

describe('경계 후보 — 배선(ViewerPage)', () => {
  it('N(줄·목록 머리)은 senseReviewItems 하나에서 — 경계 후보가 뜻 표식과 같은 목록·같은 줄에 든다', () => {
    expect(viewer).toContain('const senseReviewList = useMemo(() => senseReviewItems(material?.processed_json, materialLang), [material?.processed_json, materialLang]);');
    expect(viewer).toContain('remaining={senseReviewList.length}');
    // [보기]는 연 순간의 경계 후보를 스냅숏으로 붙든다(묶거나 접은 뒤에도 그 자리에 결과 줄)
    expect(sliceBetween(viewer, 'const openSenseReview = () => {', '\n  };'))
      .toContain('setSenseReviewIds(senseReviewList.map((item) => (isBoundarySuggestion(item) ? { ...item, sentence: boundarySuggestSentence(item) } : item.id)));');
  });

  it('[묶기] = AD-R3 확인 줄(planBoundaryMerge → boundaryMutation.mutate({ request }) → commitBoundaryEdit) — 새 쓰기 경로 0, 진입점 조건은 boundaryAllowed', () => {
    const row = sliceBetween(viewer, 'const boundarySuggestRow = (snap) => {', '\n  };');
    expect(row).toContain('<BoundaryMergeConfirm');
    expect(row).toContain('boundaryMutation.mutate({ request: plan.request })');
    expect(row).toContain('joinable: boundaryAllowed');
    expect(sliceBetween(viewer, 'const planSuggestedMerge = (snap) => {', '\n  };')).toContain('planBoundaryMerge(material, start, start + 1, boundaryCtx)');
    expect(viewer).toContain('const joinSuggestion = (row) => { if (boundaryAllowed && !suggestBusy) setSuggestConfirm(row.id); };');
  });

  it('[아니요] = boundaryDismissMutation → dismissBoundarySuggestion(같은 원자 RPC) — 교정·단어장·사전 쓰기 0', () => {
    const mutation = sliceBetween(viewer, 'const boundaryDismissMutation = useMutation({', '\n  });');
    expect(mutation).toContain('dismissBoundarySuggestion(current, form, { client: supabase })');
    for (const banned of ['correctTokenMutation', 'promoteCorrection', 'addToVocab', 'dict-correct', 'morpheme_dictionary', 'user_vocabulary']) expect(mutation).not.toContain(banned);
    expect(viewer).toContain('const dismissSuggestion = (row) => { if (canEditToken && !suggestBusy) boundaryDismissMutation.mutate(row.form); };');
  });

  it('목록 줄: 문장(두 토큰 칠) · 「한 단어로 묶을까요?」 [묶기] [아니요] · 처리한 줄은 「묶었어요」/「확인했어요」 — 「AI」 0', () => {
    const row = sliceBetween(list, 'function BoundarySuggestionRow(', '\n}');
    expect(row).toContain('<mark>{row.parts[0]} {row.parts[1]}</mark>');
    expect(row).toContain("vt('한 단어로 묶을까요?')");
    expect(row).toContain("onClick={() => onJoin(row)}>{vt('묶기')}");
    expect(row).toContain("onClick={() => onDismiss(row)}>{vt('아니요')}");
    expect(row).toContain("vt(row.dismissed ? '확인했어요' : '묶었어요')");
    expect(row).toContain('row.confirm ||');
    expect(code(row)).not.toMatch(/\bAI\b|인공지능/);
    expect(list).not.toMatch(/supabase|fetch\(/);
  });

  it('새 문구는 ko·zh-CN·zh-TW 세 벌 · 누름 영역 44px · 토큰 색만', () => {
    for (const key of ['한 단어로 묶을까요?', '아니요', '저장하지 못했어요. 잠시 뒤 다시 해 주세요.']) {
      for (const locale of VIEWER_MESSAGE_LOCALES) {
        expect(VIEWER_MESSAGES[locale][key], `${locale}: ${key}`).toBeTruthy();
        expect(VIEWER_MESSAGES[locale][key]).not.toMatch(/\bAI\b|人工智能/);
      }
    }
    const block = sliceBetween(css, '/* AD-R4 PR④', '/* /AD-R4 PR④ */');
    expect(block).toContain('.viewer-sense-review__join-yes,.viewer-sense-review__join-no {min-height:44px;}');
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
