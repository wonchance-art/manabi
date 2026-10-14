import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { applyMaterialReviewHints, countAttachedReviewHints, resolveReviewHints } from '../literatureReviewHints.js';
import { applyTokenCorrections } from '../tokenEditOptions.js';
import { senseReviewItems, senseReviewOptions } from '../viewerSenseReview.js';
import { LITERATURE_BOOKS } from '../../content/literature/aozora/index.generated.js';
import manifest from '../../content/literature/aozora/manifest.generated.json';
import { sliceBetween } from './helpers/sliceBetween';

// 정본 책 검수 힌트(AOZORA-P0-4 「분석 → 검수·편집 → 공개」) — 사전 검토자가 단 문맥 뜻 제안이
// 빌드에서 원문 위치로 풀리고, 분석 말미에 「뜻 확인 필요」 표식 + 제안으로만 붙으며(뜻은 그대로), 관리자 확정으로 걷힌다.

const review = (hints) => ({ schemaVersion: 1, reviewedBy: 'claude', hints });

describe('resolveReviewHints — 빌드: 글자·n번째 → 장 rawText 범위', () => {
  const texts = ['十米も向こうへ逃げました。或朝、或る家。', '二章の本文。'];

  it('n번째 위치로 풀고 시작 위치 순으로 정렬한다', () => {
    const [first, second] = resolveReviewHints(review([
      { chapter: 1, form: '或', nth: 2, meaning: '어떤' },
      { chapter: 1, form: '米', meaning: '미터(m)', note: 'メートル' },
      { chapter: 2, form: '本文', meaning: '본문' },
    ]), texts);
    expect(first).toEqual([
      { start: 1, end: 2, base: '米', meaning: '미터(m)', note: 'メートル' },
      { start: 16, end: 17, base: '或', meaning: '어떤' },
    ]);
    expect(second).toEqual([{ start: 3, end: 5, base: '本文', meaning: '본문' }]);
  });

  it.each([
    ['원문에 없는 글자(원문이 바뀌면 빌드 실패)', [{ chapter: 1, form: '狐', meaning: '여우' }], 'is not in chapter'],
    ['n번째가 없음', [{ chapter: 1, form: '米', nth: 2, meaning: '미터' }], 'is not in chapter'],
    ['장 번호 밖', [{ chapter: 3, form: '米', meaning: '미터' }], 'out of range'],
    ['겹치는 힌트', [{ chapter: 1, form: '十米', meaning: '10미터' }, { chapter: 1, form: '米', meaning: '미터' }], 'overlap'],
    ['빈 뜻', [{ chapter: 1, form: '米', meaning: ' ' }], 'meaning'],
  ])('%s → 실패', (_, hints, message) => {
    expect(() => resolveReviewHints(review(hints), texts)).toThrow(message);
  });

  it('형식 — schemaVersion·reviewedBy 필수', () => {
    expect(() => resolveReviewHints({ schemaVersion: 2, reviewedBy: 'claude', hints: [] }, texts)).toThrow('schemaVersion');
    expect(() => resolveReviewHints({ schemaVersion: 1, hints: [] }, texts)).toThrow('reviewedBy');
  });
});

describe('applyMaterialReviewHints — 분석 말미: 표식 + 제안만, 뜻은 그대로', () => {
  const rawText = '十米も逃げた';
  const json = (extra = {}) => ({
    sequence: ['t0', 't1', 't2', 't3'],
    dictionary: { t0: { text: '十', meaning: '열' }, t1: { text: '米', meaning: '쌀' }, t2: { text: 'も', meaning: '도' }, t3: { text: '逃げた', meaning: '도망쳤다' } },
    metadata: { literature: { provider: 'aozora', reviewHints: [
      { start: 1, end: 2, base: '米', meaning: '미터(m)', note: 'メートル' },
      { start: 3, end: 4, base: '逃', meaning: '달아나다' },
    ] }, ...extra },
  });

  it('범위와 같은 토큰 → 그 토큰, 없으면 범위를 품은 토큰에 붙인다', () => {
    const { json: out, diagnostics } = applyMaterialReviewHints(rawText, json());
    expect(out.dictionary.t1).toEqual({ text: '米', meaning: '쌀', meaningCheck: 'ctx', meaningSuggest: '미터(m)', meaningNote: 'メートル' });
    expect(out.dictionary.t3).toMatchObject({ meaning: '도망쳤다', meaningCheck: 'ctx', meaningSuggest: '달아나다' });
    expect(out.dictionary.t0).toEqual({ text: '十', meaning: '열' });
    expect(diagnostics).toEqual({ hintCount: 2, attachedCount: 2 });
    expect(countAttachedReviewHints(out)).toBe(2);
  });

  it('사용자가 뜻을 교정한 토큰은 건드리지 않는다(교정 > 힌트) · 원문과 어긋난 힌트는 건너뛴다', () => {
    const corrected = applyMaterialReviewHints(rawText, json({ viewerCorrections: { t1: ['meaning'] } })).json;
    expect(corrected.dictionary.t1).toEqual({ text: '米', meaning: '쌀' });
    const drifted = applyMaterialReviewHints('百米も逃げた!', { ...json(), metadata: { literature: { provider: 'aozora', reviewHints: [{ start: 0, end: 1, base: '十', meaning: '열' }] } } });
    expect(drifted.diagnostics.attachedCount).toBe(0);
  });

  it('힌트가 없으면 무변경', () => {
    const plain = { sequence: [], dictionary: {}, metadata: {} };
    expect(applyMaterialReviewHints('', plain)).toEqual({ json: plain, diagnostics: null });
  });

  it('뜻을 확정하면(제안 고르기·이대로 둘게요·직접 고치기) 표식과 제안·근거가 함께 걷힌다', () => {
    const token = applyMaterialReviewHints(rawText, json()).json.dictionary.t1;
    expect(applyTokenCorrections(token, { meaning: '미터(m)' })).toEqual({ text: '米', meaning: '미터(m)' });
    expect(applyTokenCorrections(token, { furigana: 'メートル' })).toMatchObject({ meaningCheck: 'ctx', meaningSuggest: '미터(m)' });
  });

  it('analyzeHybrid가 저자 루비 잠금 바로 뒤에 붙인다(유일한 분석 경로 — 재분석에도 다시 붙음)', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/lib/analyzeText.js'), 'utf8');
    const hook = sliceBetween(source, 'const locked = applyMaterialRubyLocks(rawText, currentJson);', 'currentJson.status = resolveAnalysisStatus');
    expect(hook).toContain('currentJson = applyMaterialReviewHints(rawText, currentJson).json;');
  });
});

describe('「뜻 확인 필요」 목록 — 일본어 정본 책에서도(검수 단계)', () => {
  const flagged = {
    sequence: ['t1'], dictionary: { t1: { text: '米', meaning: '쌀', meaningCheck: 'ctx', meaningSuggest: '미터(m)' } },
    metadata: { literature: { provider: 'aozora' } },
  };

  it('정본 책(provider aozora)인 일본어 자료만 — 일반 일본어 자료는 그대로 0', () => {
    expect(senseReviewItems(flagged, 'Japanese').map((item) => item.id)).toEqual(['t1']);
    expect(senseReviewItems({ ...flagged, metadata: {} }, 'Japanese')).toEqual([]);
    expect(senseReviewItems(flagged, 'English')).toEqual([]);
  });

  it('후보 맨 앞에 문맥 제안 — 사전 행에 같은 뜻이 있으면 그 줄에 표시만', () => {
    const [first] = senseReviewOptions(null, flagged.dictionary.t1, 'Japanese');
    expect(first).toEqual({ meaning: '미터(m)', pos: null, current: false, suggested: true });
  });

  it('뷰어: 일본어 정본 책도 목록을 열 수 있고, 후보는 자료 언어로 만든다', () => {
    const viewer = readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(viewer).toContain("(materialLang === 'Chinese' || (materialLang === 'Japanese' && canonicalLiteratureLocked))");
    expect(viewer).toContain('senseReviewOptions(dictEntry ?? null, token, materialLang)');
  });
});

describe('정본 5편 — 시범 검수 힌트(手袋を買いに)', () => {
  it('빌드가 힌트를 장 metadata에 싣고 위치가 원문과 정확히 맞는다 · 대조표에는 싣지 않는다', () => {
    const book = LITERATURE_BOOKS.find((item) => item.book.key === 'aozora-000121-000637');
    const [chapter] = book.chapters;
    expect(chapter.metadata.literature.reviewHints.length).toBe(34);
    for (const hint of chapter.metadata.literature.reviewHints) expect(chapter.rawText.slice(hint.start, hint.end)).toBe(hint.base);
    expect(chapter.metadata.literature.reviewHints.find((hint) => hint.base === '米')).toMatchObject({ meaning: '미터(m)' });
    expect(manifest.works['aozora-000121-000637'].literature).not.toHaveProperty('reviewHints');
  });
});
