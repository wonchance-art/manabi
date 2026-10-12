import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 뷰어 v2 AD-R3 §7.5 — 한국어 나누기 B안(오너 결정 2026-10-09)의 흐름.
// 자료는 실제 analyzeText(analyzeHybrid 한국어) → /api/analyze/korean 서버 조립(analyzeKoreanLines, 가짜 모델)으로 만든다.
// 나누기·되돌리기·원래대로는 /api/analyze·/api/analyze/korean을 부르지 않고(조각 = 기존 morphology), 쓰기는
// viewer_replace_analysis(원문 그대로) + token_corrections 이력뿐이다. 재분석은 뷰어 쪽에서 기록을 다시 적용한다.

vi.mock('../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } } }));

import { KO_WORDS, koreanFetch } from './helpers/koreanBoundaryHarness.js';
import { analyzeText } from '../analyzeText';
import { runPreservedReanalysis } from '../reanalysisPreservation';
import { inspectAnalysisCoverage } from '../analysisCoverage';
import { koreanReadingSource, learningSourceRevision, readingSourceTarget } from '../learningSources';
import { boundaryLineEntries, pendingBoundaryCount, readBoundaryEdits } from '../boundaryEdits';
import {
  BoundaryEditError, boundaryEditContext, boundaryUndoValid, commitBoundaryEdit, koreanBoundaryPiece, koreanSplitEntryAllowed,
  koreanSplitPreview, pendingBoundaryRows, planKoreanSplit, undoBoundaryEdit,
} from '../boundaryEditFlow';

const T0 = Date.UTC(2026, 9, 9, 0, 0, 0);
const RAW = '저는 도서관에서 공부했어요.\n밥을 먹었어요. 했어요.\n친구를 도와요. 집을 지으셨어요.';
const OWNER = 'u-owner';

let bodies, rpcs, inserts, uuid, words;
const client = (rows = []) => ({
  from: (table) => {
    const chain = {
      select: () => chain, eq: () => chain, order: () => chain, range: async () => ({ data: rows, error: null }),
      insert: async (row) => { inserts.push({ table, row: JSON.parse(JSON.stringify(row)) }); return { error: null }; },
      update: () => { throw new Error(`direct update on ${table}`); },
    };
    return chain;
  },
  rpc: async (name, args) => {
    rpcs.push({ name, args: JSON.parse(JSON.stringify(args)) });
    return { data: { material: { id: args.p_id, owner_id: OWNER, raw_text: args.p_raw, processed_json: args.p_json } }, error: null };
  },
});
const noAnalyze = async () => { throw new Error('한국어 나누기는 분석을 부르지 않는다'); };
const deps = (extra = {}) => ({ client: client(), analyze: noAnalyze, userId: OWNER, ...extra });

beforeEach(() => {
  vi.useFakeTimers({ now: T0, toFake: ['Date'] });
  uuid = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`);
  bodies = []; rpcs = []; inserts = []; words = { current: KO_WORDS };
  vi.stubGlobal('fetch', koreanFetch(bodies, words));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const signal = () => new AbortController().signal;
async function material(raw = RAW, locale = 'ko') {
  const json = await analyzeText(raw, signal(), { metadata: { language: 'Korean', explanationLocale: locale } });
  bodies.splice(0);
  return { id: 7, owner_id: OWNER, raw_text: raw, processed_json: json };
}
const entries = (json, line) => boundaryLineEntries(json, line);
const texts = (json, line) => entries(json, line).map(e => e.token.text);
const idOf = (json, line, text) => entries(json, line).find(e => e.token.text === text)?.id;
const ctxOf = (mat, extra = {}) => boundaryEditContext(mat, { userId: OWNER, ...extra });
const plan = (mat, line, text, opts = { locale: 'ko' }) => planKoreanSplit(mat, idOf(mat.processed_json, line, text), ctxOf(mat), opts);
async function split(mat, line, text, pick = c => c) {
  const p = plan(mat, line, text);
  expect(p.ok).toBe(true);
  return commitBoundaryEdit(mat, { line: p.line, start: p.start, end: p.end, cuts: pick(p.cuts) }, deps());
}

describe('진입점 — 소유자 · 한국어 · 사본/구간/수업 모드 제외(중·일·영과 같은 조건)', () => {
  it('소유자 한국어 자료만 · 비소유자·수업 사본·구간·수업 모드·다른 언어는 0', async () => {
    const mat = await material();
    expect(koreanSplitEntryAllowed(ctxOf(mat))).toBe(true);
    expect(koreanSplitEntryAllowed(boundaryEditContext(mat, { userId: 'other' }))).toBe(false);
    expect(koreanSplitEntryAllowed(boundaryEditContext({ ...mat, __local: true }, { userId: OWNER }))).toBe(false);
    expect(koreanSplitEntryAllowed(ctxOf({ ...mat, processed_json: { ...mat.processed_json, metadata: { ...mat.processed_json.metadata, source_ref: { team: 't' } } } }))).toBe(false);
    expect(koreanSplitEntryAllowed(ctxOf(mat, { passage: true }))).toBe(false);
    expect(koreanSplitEntryAllowed(ctxOf(mat, { classMode: true }))).toBe(false);
    expect(koreanSplitEntryAllowed({ ...ctxOf(mat), language: 'Chinese' })).toBe(false);
    expect(planKoreanSplit(mat, idOf(mat.processed_json, 0, '도서관에서'), boundaryEditContext(mat, { userId: 'other' }), { locale: 'ko' })).toEqual({ ok: false, reason: 'not_owner' });
  });
});

describe('나누기 패널 계획 — 후보 칼선만 · 축약은 공식', () => {
  it('도서관에서: 후보 칼선 하나(줄 좌표) · 미리 보기 조각마다 morphology 설명', async () => {
    const mat = await material();
    const p = plan(mat, 0, '도서관에서');
    expect(p).toMatchObject({ ok: true, language: 'Korean', line: 0, start: 2, end: 7, chars: ['도서관', '에서'], cuts: [5], initialCuts: [] });
    expect(koreanSplitPreview(p, [5]).map(x => [x.text, x.morphemes.map(m => m.function), x.formula])).toEqual([
      ['도서관', ['명사. 책을 모아 두고 읽는 곳'], null], ['에서', ['장소를 나타내는 조사'], null]]);
    expect(koreanSplitPreview(p, []).map(x => x.text)).toEqual(['도서관에서']);
  });
  it('했어요 · 도와요 · 지으셨어요: 나눌 자리 없음 + 공식', async () => {
    const mat = await material();
    expect(plan(mat, 1, '했어요')).toMatchObject({ ok: false, reason: 'no_literal_cut', formula: { surface: '했어요', terms: ['하다', '-였-', '-어요'], kind: 'contracted' } });
    expect(plan(mat, 2, '도와요')).toMatchObject({ ok: false, reason: 'no_literal_cut', formula: { terms: ['돕다', '-아요'], kind: 'changed' } });
    expect(plan(mat, 2, '지으셨어요')).toMatchObject({ ok: false, reason: 'no_literal_cut', formula: { kind: 'contracted' } });
  });
  it('공부했어요: 일부만(공부 │ 했어요), 합친 조각은 공식을 갖는다', async () => {
    const mat = await material();
    const p = plan(mat, 0, '공부했어요');
    expect(p.chars).toEqual(['공부', '했어요']);
    expect(koreanSplitPreview(p, p.cuts)[1].formula).toEqual({ surface: '했어요', terms: ['하다', '-였-', '-어요'], kind: 'contracted' });
  });
  it('형태 분석 언어가 지금 설명 언어와 다르면 진입점 없음 · 공백/문장부호·형태 분석 없음도 없음', async () => {
    const mat = await material(RAW, 'zh-CN');
    expect(plan(mat, 0, '도서관에서', { locale: 'ko' })).toEqual({ ok: false, reason: 'locale_mismatch' });
    expect(plan(mat, 0, '도서관에서', { locale: 'zh-CN' }).ok).toBe(true);
    const ko = await material('오늘 도서관에서.');
    expect(plan(ko, 0, '오늘')).toEqual({ ok: false, reason: 'no_morphology' });
    expect(plan(ko, 0, ' ')).toEqual({ ok: false, reason: 'punctuation' });
    expect(plan(ko, 0, '.')).toEqual({ ok: false, reason: 'punctuation' });
  });
});

describe('나누기 한 번 — 분석 호출 0 · 원자 RPC(원문 그대로) · 이력 1행 · 다른 토큰 그대로', () => {
  it('도서관에서 → 도서관 │ 에서', async () => {
    const mat = await material();
    const before = mat.processed_json;
    const eojeolId = idOf(before, 0, '도서관에서');
    const out = await split(mat, 0, '도서관에서');
    expect(bodies).toEqual([]);
    expect(rpcs).toHaveLength(1);
    const { args } = rpcs[0];
    expect(args.p_raw).toBe(RAW);
    expect(args.p_expected_raw).toBe(RAW);
    expect(args.p_json.metadata.viewerRevision).toBe(args.p_attempt);
    const json = out.material.processed_json;
    expect(texts(json, 0)).toEqual(['저는', ' ', '도서관', '에서', ' ', '공부했어요', '.']);
    expect(inspectAnalysisCoverage(RAW, json)).toMatchObject({ validStructure: true, missingIndices: [] });
    const [rec] = readBoundaryEdits(json);
    expect(rec).toMatchObject({ line: 0, start: 2, end: 7, text: '도서관에서', cuts: [5], status: 'applied', base: [{ id: eojeolId, token: before.dictionary[eojeolId] }] });
    const piece = json.dictionary[out.selectId];
    expect(piece).toMatchObject({ text: '도서관', meaning: '명사. 책을 모아 두고 읽는 곳', boundary: 'user', explanationLocale: 'ko' });
    expect(out.selectId).toMatch(/^id_0_e2_/);
    // 바뀐 구간 밖 토큰은 같은 id·같은 객체
    for (const line of [1, 2]) expect(entries(json, line)).toEqual(entries(before, line));
    expect(json.dictionary[idOf(before, 0, '저는')]).toBe(before.dictionary[idOf(before, 0, '저는')]);
    // 이력 1행(중·일·영과 같은 형식) · 그 밖 표 쓰기 0
    expect(inserts).toEqual([{ table: 'token_corrections', row: { material_id: 7, token_id: eojeolId, user_id: OWNER,
      before_value: { boundary: { line: 0, start: 2, end: 7, text: '도서관에서', cuts: [] } },
      after_value: { source: 'boundary_edit', id: rec.id, cuts: [5], scope: 'material' } } }]);
    expect(koreanBoundaryPiece(json, out.selectId)).toMatchObject({ record: { id: rec.id }, eojeol: { text: '도서관에서' } });
    expect(koreanBoundaryPiece(json, idOf(json, 0, '저는'))).toBeNull();
  });
  it('후보 밖 칼선(했어요 안·음절 중간)은 거절 — 쓰기 0', async () => {
    const mat = await material();
    const id = idOf(mat.processed_json, 1, '했어요');
    const p = planKoreanSplit(mat, idOf(mat.processed_json, 1, '먹었어요'), ctxOf(mat), { locale: 'ko' });
    const span = entries(mat.processed_json, 1);
    expect(id).toBeTruthy();
    await expect(commitBoundaryEdit(mat, { line: 1, start: p.start, end: p.end, cuts: [p.start + 3] }, deps())).rejects.toMatchObject({ reason: 'invalid_cuts' });
    const at = span.slice(0, span.findIndex(e => e.id === id)).reduce((n, e) => n + e.token.text.replace(/\s/g, '').length, 0);
    await expect(commitBoundaryEdit(mat, { line: 1, start: at, end: at + 3, cuts: [at + 1] }, deps())).rejects.toBeInstanceOf(BoundaryEditError);
    expect(rpcs).toEqual([]);
    expect(inserts).toEqual([]);
  });
  it('두 어절을 하나로 묶는 요청(어절을 넘는 묶기)은 거절 — 한국어 묶기는 열지 않았다', async () => {
    const mat = await material();
    await expect(commitBoundaryEdit(mat, { line: 1, start: 0, end: 6, cuts: [] }, deps())).rejects.toBeInstanceOf(BoundaryEditError);
    expect(rpcs).toEqual([]);
  });
});

describe('다시 나누기 · 원래대로 · 되돌리기 — 원래 어절 토큰이 id째 돌아온다', () => {
  it('먹 │ 었 │ 어요 → (조각에서) 먹 │ 었어요 → 원래대로 → 되돌리기', async () => {
    let mat = await material();
    const original = mat.processed_json;
    const eojeolId = idOf(original, 1, '먹었어요');
    let out = await split(mat, 1, '먹었어요');
    mat = out.material;
    expect(texts(mat.processed_json, 1).slice(0, 5)).toEqual(['밥을', ' ', '먹', '었', '어요']);
    const firstPiece = idOf(mat.processed_json, 1, '먹');
    // 조각에서 연 패널 = 어절 전체 · 지금 칼선이 골라진 채
    const p = planKoreanSplit(mat, idOf(mat.processed_json, 1, '었'), ctxOf(mat), { locale: 'ko' });
    expect(p).toMatchObject({ ok: true, chars: ['먹', '었', '어요'], cuts: [3, 4], initialCuts: [3, 4] });
    out = await commitBoundaryEdit(mat, { line: 1, start: p.start, end: p.end, cuts: [3] }, deps());
    mat = out.material;
    expect(texts(mat.processed_json, 1).slice(0, 4)).toEqual(['밥을', ' ', '먹', '었어요']);
    expect(idOf(mat.processed_json, 1, '먹')).toBe(firstPiece);
    expect(mat.processed_json.dictionary[idOf(mat.processed_json, 1, '었어요')]).toMatchObject({ lemma: '었', morphology: [{ form: '-었-' }, { form: '-어요' }] });
    expect(readBoundaryEdits(mat.processed_json)).toHaveLength(1);
    // 원래대로 = 칼선 0 → base 복원(서버 0), 기록 0이면 키도 지운다
    const undoBefore = out.undo;
    out = await commitBoundaryEdit(mat, { line: 1, start: p.start, end: p.end, cuts: [] }, deps());
    expect(out.restored).toBe(true);
    expect(entries(out.material.processed_json, 1)).toEqual(entries(original, 1));
    expect(out.material.processed_json.dictionary[eojeolId]).toEqual(original.dictionary[eojeolId]);
    expect(out.material.processed_json.metadata.viewerBoundaries).toBeUndefined();
    // 되돌리기(직후) = 원래대로 전 상태
    const undone = await undoBoundaryEdit(out.material, out.undo, deps());
    expect(texts(undone.material.processed_json, 1).slice(0, 4)).toEqual(['밥을', ' ', '먹', '었어요']);
    expect(boundaryUndoValid(undone.material.processed_json, undoBefore)).toBe(true);
    expect(bodies).toEqual([]);
    expect(inserts.every(x => x.table === 'token_corrections' && x.row.after_value.source === 'boundary_edit')).toBe(true);
  });
});

describe('저장해 둔 어절의 원문 돌아가기(§7.5 ⑦)', () => {
  it('어절을 저장 → 나누기 → 첫 조각으로 · 원래대로 → 어절로 정확히', async () => {
    const mat = await material();
    const json = mat.processed_json;
    const eojeolId = idOf(json, 0, '도서관에서');
    const sourceRevision = await learningSourceRevision(RAW);
    const src = await koreanReadingSource({ materialId: 7, rawText: RAW, token: { ...json.dictionary[eojeolId], id: eojeolId }, sourceRevision });
    const saved = { locator: { version: 1, sourceRevision, sourceSpan: src.sourceSpan, quoteSpan: src.quoteSpan, surface: src.surface }, quote: src.quote, lang: 'Korean' };
    expect(readingSourceTarget(json, saved, { rawText: RAW, sourceRevision })).toBe(eojeolId);
    const out = await split(mat, 0, '도서관에서');
    const after = out.material.processed_json;
    expect(readingSourceTarget(after, saved, { rawText: RAW, sourceRevision })).toBe(idOf(after, 0, '도서관'));
    const p = plan(out.material, 0, '에서');
    const back = await commitBoundaryEdit(out.material, { line: 0, start: p.start, end: p.end, cuts: [] }, deps());
    expect(readingSourceTarget(back.material.processed_json, saved, { rawText: RAW, sourceRevision })).toBe(eojeolId);
    // 조각이 아닌 다른 어절의 범위 일치는 바뀌지 않는다
    const other = await koreanReadingSource({ materialId: 7, rawText: RAW, token: { ...after.dictionary[idOf(after, 0, '저는')], id: idOf(after, 0, '저는') }, sourceRevision });
    expect(readingSourceTarget(after, { locator: { version: 1, sourceRevision, sourceSpan: other.sourceSpan, quoteSpan: other.quoteSpan, surface: '저는' }, quote: other.quote, lang: 'Korean' },
      { rawText: RAW, sourceRevision })).toBe(idOf(after, 0, '저는'));
  });
});

describe('재분석 뒤 유지 — 뷰어 쪽 재적용(서버는 어절만)', () => {
  async function reanalyze(mat, options = {}) {
    await runPreservedReanalysis(client(), mat, signal(), analyzeText, options);
    const [{ args }] = rpcs.splice(0);
    return { ...mat, raw_text: args.p_raw, processed_json: args.p_json };
  }
  it('전체 재분석: 같은 morphology면 다시 나눔 · 조각 id 승계 · 기록 applied · 서버 요청에 기록을 싣지 않는다', async () => {
    let mat = await material();
    mat = (await split(mat, 0, '도서관에서')).material;
    const pieceIds = [idOf(mat.processed_json, 0, '도서관'), idOf(mat.processed_json, 0, '에서')];
    rpcs.splice(0);
    const next = await reanalyze(mat, { fullReset: true });
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.every(b => b.url.endsWith('/api/analyze/korean') && !('boundaries' in b.body))).toBe(true);
    expect(texts(next.processed_json, 0)).toEqual(['저는', ' ', '도서관', '에서', ' ', '공부했어요', '.']);
    expect([idOf(next.processed_json, 0, '도서관'), idOf(next.processed_json, 0, '에서')]).toEqual(pieceIds);
    const [rec] = readBoundaryEdits(next.processed_json);
    expect(rec).toMatchObject({ status: 'applied', line: 0, start: 2, end: 7, cuts: [5] });
    expect(rec.base).toHaveLength(1);
    expect(rec.base[0].token.text).toBe('도서관에서');
    expect(inspectAnalysisCoverage(RAW, next.processed_json)).toMatchObject({ validStructure: true, missingIndices: [] });
    expect(pendingBoundaryCount(next.processed_json)).toBe(0);
    // 다시 원래대로가 된다(재적용된 base)
    const p = plan(next, 0, '에서');
    const back = await commitBoundaryEdit(next, { line: 0, start: p.start, end: p.end, cuts: [] }, deps());
    expect(texts(back.material.processed_json, 0)).toEqual(['저는', ' ', '도서관에서', ' ', '공부했어요', '.']);
  });
  it('새 morphology에 그 칼선이 없으면 pending(알림·목록) · 어절은 그대로', async () => {
    let mat = await material();
    mat = (await split(mat, 0, '도서관에서')).material;
    rpcs.splice(0);
    words.current = { ...KO_WORDS, 도서관에서: { ...KO_WORDS.도서관에서, morphology: [{ form: '도서관에서', function: '장소' }] } };
    const next = await reanalyze(mat, { fullReset: true });
    expect(texts(next.processed_json, 0)).toEqual(['저는', ' ', '도서관에서', ' ', '공부했어요', '.']);
    expect(readBoundaryEdits(next.processed_json)[0]).toMatchObject({ status: 'pending', text: '도서관에서', cuts: [5] });
    expect(pendingBoundaryCount(next.processed_json)).toBe(1);
    expect(pendingBoundaryRows(next)).toEqual([{ id: readBoundaryEdits(next.processed_json)[0].id, text: '도서관에서', display: '도서관 │ 에서', merged: false, sentence: '저는 도서관에서 공부했어요.' }]);
    // 겹치는 자리는 다시 나눌 수 없다(대기 기록)
    expect(plan(next, 0, '도서관에서')).toEqual({ ok: false, reason: 'pending_edit' });
  });
  it('원문 위에 줄을 넣으면 기록 줄을 옮겨 다시 나눈다', async () => {
    let mat = await material();
    mat = (await split(mat, 1, '먹었어요')).material;
    rpcs.splice(0);
    const raw2 = `오늘\n${RAW}`;
    const next = await reanalyze(mat, { rawTextOverride: raw2, fullReset: true });
    expect(next.raw_text).toBe(raw2);
    expect(texts(next.processed_json, 2).slice(0, 5)).toEqual(['밥을', ' ', '먹', '었', '어요']);
    expect(readBoundaryEdits(next.processed_json)[0]).toMatchObject({ line: 2, status: 'applied', cuts: [3, 4] });
    expect(inspectAnalysisCoverage(raw2, next.processed_json)).toMatchObject({ validStructure: true, missingIndices: [] });
  });
});
