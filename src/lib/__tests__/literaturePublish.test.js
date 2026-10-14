import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { literatureBatchTargets,
  LITERATURE_PUBLISH_STATE,
  literatureBookPublishable,
  literatureBookSummary,
  literaturePublishRows,
  literatureReviewRemaining,
  chapterReviewed,
  literatureRubyCoverage,
  literatureStage,
  planLiteraturePublish,
  planLiteratureRelease,
} from '../literaturePublish.js';
import { getBook, groupByBook } from '../bookMeta.js';
import { LITERATURE_BOOKS } from '../../content/literature/aozora/index.generated.js';
import { artBooks } from '../artBook.js';
import { sliceBetween } from './helpers/sliceBetween';

// 관리자 게시 계획(AOZORA-P0-2) — 실물 「ごん狐」(6장)로 book key + 장 순서 멱등·충돌 시 무게시를 고정한다.

const book = LITERATURE_BOOKS.find((item) => item.book.key === 'aozora-000121-000628');
const row = (order, overrides = {}) => ({ id: 100 + order, order: String(order), raw_text: book.chapters[order - 1].rawText, ...overrides });

describe('planLiteraturePublish — book key + 장 순서 멱등', () => {
  it('없음 → 전 장, 일부 → 남은 장, 전부 → 없음', () => {
    expect(planLiteraturePublish(book, [])).toEqual({ state: LITERATURE_PUBLISH_STATE.UNPUBLISHED, insert: [1, 2, 3, 4, 5, 6], conflicts: [] });
    expect(planLiteraturePublish(book, [row(1), row(3)])).toEqual({ state: LITERATURE_PUBLISH_STATE.PARTIAL, insert: [2, 4, 5, 6], conflicts: [] });
    expect(planLiteraturePublish(book, [1, 2, 3, 4, 5, 6].map((order) => row(order)))).toEqual({ state: LITERATURE_PUBLISH_STATE.PUBLISHED, insert: [], conflicts: [] });
  });

  it.each([
    ['정본과 원문이 다른 장', [row(1, { raw_text: '書き換えた本文' })], { order: 1, id: 101, reason: 'text-differs' }],
    ['같은 순서가 둘', [row(2), row(2, { id: 999 })], { order: 2, id: 999, reason: 'duplicate-order' }],
    ['정본에 없는 순서', [row(1, { order: '7', id: 7 })], { order: '7', id: 7, reason: 'unknown-order' }],
  ])('%s → conflict(아무것도 덮지 않는다 — API는 409)', (_, rows, conflict) => {
    const plan = planLiteraturePublish(book, rows);
    expect(plan.state).toBe(LITERATURE_PUBLISH_STATE.CONFLICT);
    expect(plan.conflicts).toEqual([conflict]);
  });
});

describe('literaturePublishRows — 기존 책 등록과 같은 행 모양', () => {
  const rows = literaturePublishRows(book, [2, 5], 'admin-id', '2026-10-14T00:00:00.000Z');

  it('고른 장만, **비공개**·관리자 소유·분석 전(pending), 원문·metadata는 정본 그대로 — 공개는 분석 뒤 따로', () => {
    expect(rows.map((item) => item.title)).toEqual(['ごん狐 — 二', 'ごん狐 — 五']);
    expect(rows[0]).toMatchObject({ visibility: 'private', owner_id: 'admin-id', raw_text: book.chapters[1].rawText,
      processed_json: { sequence: [], dictionary: {}, last_idx: -1, status: 'pending' } });
    expect(rows[0].processed_json.metadata).toEqual({ ...book.chapters[1].metadata, updated_at: '2026-10-14T00:00:00.000Z' });
  });

  it('공개 탭 책 카드(groupByBook)가 한 권으로 묶는다(D3, 코드 변경 없음)', () => {
    const all = literaturePublishRows(book, [1, 2, 3, 4, 5, 6], 'admin-id').map((item, index) => ({ id: index, ...item })).reverse();
    expect(getBook(all[0].processed_json.metadata)).toMatchObject({ key: 'aozora-000121-000628', title: 'ごん狐', order: 6, total: 6 });
    expect(groupByBook(all).books.map((item) => [item.key, item.chapters.map((chapter) => chapter.id)])).toEqual([['aozora-000121-000628', [0, 1, 2, 3, 4, 5]]]);
  });
});

describe('준비 → 분석 → 검수 → 공개(P0-3 · P0-4)', () => {
  const reviewed = (revision = 'r1') => ({ review: { reviewedAt: '2026-10-14T00:00:00Z', viewerRevision: revision }, revision });
  const all = (overrides = {}) => [1, 2, 3, 4, 5, 6].map((order) => row(order, { status: 'completed', visibility: 'private', ...reviewed(), ...overrides }));

  it('검수 완료 = 검수 때의 분석 revision이 지금과 같음(재분석하면 다시 검수)', () => {
    expect(chapterReviewed({ review: { viewerRevision: 'r1' }, revision: 'r1' })).toBe(true);
    expect(chapterReviewed({ review: { viewerRevision: 'r1' }, revision: 'r2' })).toBe(false);
    expect(chapterReviewed({ review: null, revision: 'r1' })).toBe(false);
  });

  it('단계: unpublished → preparing(일부·분석 전) → reviewing(분석 완료·검수 전) → ready(전 장 검수·비공개) → released', () => {
    expect(literatureStage(book, [])).toBe('unpublished');
    expect(literatureStage(book, [row(1, { status: 'completed', visibility: 'private' })])).toBe('preparing');
    expect(literatureStage(book, all().map((item, index) => (index === 3 ? { ...item, status: 'pending' } : item)))).toBe('preparing');
    expect(literatureStage(book, all({ review: null }))).toBe('reviewing');
    expect(literatureStage(book, all().map((item, index) => (index === 2 ? { ...item, revision: 'r2' } : item)))).toBe('reviewing');
    expect(literatureStage(book, all())).toBe('ready');
    expect(literatureStage(book, all({ visibility: 'public' }))).toBe('released');
    expect(literatureStage(book, [row(1, { raw_text: '書き換え' })])).toBe('conflict');
  });

  it('공개는 모든 장이 있고 모두 분석·검수 완료일 때만 — 비공개 장만 고른다', () => {
    expect(planLiteratureRelease(book, all())).toEqual({ ok: true, reason: null, ids: [101, 102, 103, 104, 105, 106] });
    const mixed = all().map((item, index) => (index < 2 ? { ...item, visibility: 'public' } : item));
    expect(planLiteratureRelease(book, mixed).ids).toEqual([103, 104, 105, 106]);
    expect(planLiteratureRelease(book, all().map((item, index) => (index === 5 ? { ...item, status: 'analyzing' } : item))))
      .toEqual({ ok: false, reason: 'not-analyzed', ids: [] });
    expect(planLiteratureRelease(book, all().map((item, index) => (index === 4 ? { ...item, review: null } : item))))
      .toEqual({ ok: false, reason: 'not-reviewed', ids: [] });
    expect(planLiteratureRelease(book, all().slice(0, 5))).toEqual({ ok: false, reason: 'incomplete', ids: [] });
    expect(planLiteratureRelease(book, [...all(), row(2, { id: 999, status: 'completed' })])).toEqual({ ok: false, reason: 'conflict', ids: [] });
  });

  it('남은 「뜻 확인 필요」 = 검수 힌트 표식 수(뜻을 확정하면 0)', () => {
    const json = { sequence: ['a', 'b'], dictionary: { a: { text: '米', meaningCheck: 'ctx', meaningSuggest: '미터(m)' }, b: { text: 'x' } },
      metadata: { literature: { provider: 'aozora' } } };
    expect(literatureReviewRemaining(json)).toBe(1);
    expect(literatureReviewRemaining({ ...json, dictionary: { ...json.dictionary, a: { text: '米', meaning: '미터(m)' } } })).toBe(0);
  });
});

describe('관리자 화면 요약·루비 적용률', () => {
  it('정본 작품 모두 게시 가능 — 권리 기록이 깨지면 불가', () => {
    expect(LITERATURE_BOOKS.length).toBe(14);
    expect(LITERATURE_BOOKS.every(literatureBookPublishable)).toBe(true);
    const broken = { ...book, chapters: book.chapters.map((chapter) => ({ ...chapter, metadata: { ...chapter.metadata, literature: { ...chapter.metadata.literature, rights: { status: 'reviewing', basis: 'unknown' } } } })) };
    expect(literatureBookPublishable(broken)).toBe(false);
  });

  it('권리 근거·장별 게시 상태를 싣고 원문은 싣지 않는다', () => {
    const summary = literatureBookSummary(book, [{ ...row(1), status: 'completed', visibility: 'public' }]);
    expect(summary).toMatchObject({ key: 'aozora-000121-000628', title: 'ごん狐', author: '新美南吉', level: 'N3 중급', total: 6, publishable: true,
      rights: { basis: 'public-domain', reviewedJurisdictions: ['JP', 'KR', 'US'], publishedYear: 1932, authorDeathYear: 1943, charset: '新字新仮名' },
      plan: { state: 'partial', insert: [2, 3, 4, 5, 6] }, stage: 'preparing' });
    expect(summary.chapters[0]).toEqual({ order: 1, title: '一', chars: book.chapters[0].rawText.length, rubyLocks: book.chapters[0].metadata.literature.rubyLocks.length,
      material: { id: 101, status: 'completed', visibility: 'public', reviewed: false } });
    expect(summary.chapters[1].material).toBe(null);
    expect(JSON.stringify(summary)).not.toContain(book.chapters[0].rawText.slice(0, 20));
  });

  it('루비 적용률 — 분석 전은 null, 분석 뒤는 저자 루비가 걸린 토큰 수', () => {
    const analyzed = { sequence: ['a', 'b', 'c'], dictionary: { a: { reading_source: 'aozora' }, b: {}, c: { reading_source: 'aozora' } } };
    const locks = (k) => book.chapters[k].metadata.literature.rubyLocks.length;
    expect(literatureRubyCoverage(book, [{ order: '1', processed_json: analyzed }, { order: '2', processed_json: { sequence: [] } }]).slice(0, 3))
      .toEqual([
        { order: 1, rubyLocks: locks(0), applied: 2, hints: 0, hintsAttached: 0, hintsMissed: [], remaining: 0 },
        { order: 2, rubyLocks: locks(1), applied: null, hints: 0, hintsAttached: null, hintsMissed: [], remaining: null },
        { order: 3, rubyLocks: locks(2), applied: null, hints: 0, hintsAttached: null, hintsMissed: [], remaining: null },
      ]);
  });
});

describe('큐레이션 책(ART-P0-3) — 같은 게시 계획, 출처별 판정·근거 칸', () => {
  const [art] = artBooks();
  const withProvider = (target, provider) => ({ ...target, chapters: target.chapters.map((chapter) => ({ ...chapter,
    metadata: { ...chapter.metadata, literature: { ...chapter.metadata.literature, provider } } })) });

  it('게시 가능 판정은 provider로 나뉜다 — art는 카탈로그 대조, 모르는 출처·빈 책은 불가(fail-closed)', () => {
    expect(literatureBookPublishable(art)).toBe(true);
    const edited = { ...art, chapters: art.chapters.map((chapter, index) => (index === 0 ? { ...chapter, rawText: `${chapter.rawText}（追記）` } : chapter)) };
    expect(literatureBookPublishable(edited)).toBe(false);
    expect(literatureBookPublishable(withProvider(art, 'aozora'))).toBe(false); // 권리 기록 없는 해설문을 아오조라로 꾸며도 통과하지 않는다
    expect(literatureBookPublishable(withProvider(book, 'art'))).toBe(false); // 카탈로그에 없는 원문
    expect(literatureBookPublishable(withProvider(book, 'gutenberg'))).toBe(false);
    expect(literatureBookPublishable({ ...art, chapters: [] })).toBe(false);
    expect(literatureBookPublishable(null)).toBe(false);
  });

  it('요약: rubyLocks 없는 장도 던지지 않고(0), 권리 근거 대신 장별 출처·라이선스 이름·원문 링크·크레딧', () => {
    const summary = literatureBookSummary(art, [{ id: 7, order: '1', raw_text: art.chapters[0].rawText, status: 'pending', visibility: 'private' }]);
    expect(summary).toMatchObject({ key: art.book.key, total: 8, publishable: true, stage: 'preparing', plan: { state: 'partial' } });
    expect(summary).not.toHaveProperty('rights');
    expect(summary.provenance.provider).toBe('art');
    expect(summary.provenance.chapters[0]).toEqual({ order: 1, source: art.chapters[0].metadata.literature.source,
      license: '정부표준이용규약 2.0', sourceUrl: art.chapters[0].metadata.literature.sourceUrl, credit: art.chapters[0].metadata.literature.credit });
    expect(summary.chapters.map((chapter) => chapter.rubyLocks)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(summary.chapters[0].material).toEqual({ id: 7, status: 'pending', visibility: 'private', reviewed: false });
    expect(JSON.stringify(summary)).not.toContain(art.chapters[0].rawText.slice(0, 20));
  });

  it('검수 보조도 던지지 않는다 — 루비·제안 0', () => {
    const analyzed = { sequence: ['a'], dictionary: { a: { text: '波' } } };
    expect(literatureRubyCoverage(art, [{ order: '1', processed_json: analyzed }])[0])
      .toEqual({ order: 1, rubyLocks: 0, applied: 0, hints: 0, hintsAttached: 0, hintsMissed: [], remaining: 0 });
  });

  it('아오조라 요약은 그대로 — provenance 칸이 없다', () => {
    expect(literatureBookSummary(book)).not.toHaveProperty('provenance');
    expect(literatureBookSummary(book).rights.basis).toBe('public-domain');
  });
});

describe('일괄 게시·분석 대상(설계 §4.1 — 오너 「권장대로」 2026-10-14 KST)', () => {
  const summary = (overrides) => ({ publishable: true, stage: 'unpublished', plan: { conflicts: [], insert: [1] }, ...overrides });
  it('게시 가능 · 준비/분석이 남음 · 충돌 없음만 — 검수·공개 단계는 사람이 작품마다', () => {
    const books = [
      summary({ key: 'a' }),
      summary({ key: 'b', stage: 'preparing', plan: { conflicts: [], insert: [] } }),
      summary({ key: 'c', publishable: false }),
      summary({ key: 'd', plan: { conflicts: [{ id: 1, reason: 'text-differs' }], insert: [] } }),
      summary({ key: 'e', stage: 'reviewing' }),
      summary({ key: 'f', stage: 'ready' }),
      summary({ key: 'g', stage: 'released' }),
    ];
    expect(literatureBatchTargets(books).map((book) => book.key)).toEqual(['a', 'b']);
  });
});

describe('관리자 화면 배선 — 게시 한 번에 준비·분석, 공개는 분석 뒤', () => {
  const panel = readFileSync(path.join(process.cwd(), 'src/components/LiteraturePublishPanel.jsx'), 'utf8');

  it('분석은 뷰어와 같은 경로(runPreservedReanalysis + analyzeText, 전체 분석) — 새 분석기를 만들지 않는다', () => {
    expect(panel).toContain('await runPreservedReanalysis(supabase, row, controller.signal, analyzeText, { fullReset: true });');
    expect(panel).toContain("import { runPreservedReanalysis } from '../lib/reanalysisPreservation';");
  });

  it('일괄: 대상 판정은 순수 함수 하나, 작품마다 최신 상태를 다시 읽어 준비 → 같은 분석 경로, 검수·공개는 하지 않는다', () => {
    const batch = sliceBetween(panel, 'async function runBatch', '\n  }\n');
    expect(panel).toContain('const pending = literatureBatchTargets(books);');
    expect(batch).toContain("await post('prepare', book.key);");
    expect(batch).toContain('await analyzeChapters(book, controller);');
    expect(batch).not.toMatch(/'release'|'review'/u);
    expect(panel).toContain("if (action === 'batch') runBatch(targets);");
  });

  it('「게시」(prepare) 성공 뒤 바로 분석을 시작하고, 「공개」(release)는 ready 단계에서만 보인다', () => {
    expect(sliceBetween(panel, 'const prepare = useMutation', 'const release = useMutation')).toContain('if (next) analyzeBook(next);');
    expect(panel).toContain("{book.stage === 'ready' && (");
    expect(panel).toContain("post('release', book.key)");
  });
});
