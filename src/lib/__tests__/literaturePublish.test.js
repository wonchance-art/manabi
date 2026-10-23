import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { literatureBatchTargets,
  planLiteratureMetadataSync,
  literatureExposedRows,
  literatureBoundaryIssues,
  literatureResumeTargets,
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
import { WIKISOURCE_BOOKS } from '../../content/literature/wikisource/index.generated.js';
import { senseReviewItems } from '../viewerSenseReview.js';

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

  it('exposed: 분석 전이거나 한 번도 검수하지 않은 장이 공개돼 있으면(P0-3 이전 바로 공개) 경고 — 이어 분석·일괄 대상이 아니다', () => {
    const legacy = [1, 2, 3, 4, 5, 6].map((order) => row(order, { status: 'pending', visibility: 'public' }));
    expect(literatureStage(book, legacy)).toBe('exposed');
    expect(literatureStage(book, all({ visibility: 'public', review: null }))).toBe('exposed'); // 분석 뒤 공개 상태로 검수 없이
    expect(literatureExposedRows(legacy)).toHaveLength(6);
    // 정상 공개 뒤 재분석으로 검수가 낡은 장은 exposed가 아니다(검수 기록이 있다 — released 유지)
    expect(literatureStage(book, all({ visibility: 'public', revision: 'r2' }))).toBe('released');
    const summaries = [{ key: 'x', publishable: true, stage: 'exposed', plan: { conflicts: [], insert: [] } }];
    expect(literatureBatchTargets(summaries)).toEqual([]);
    expect(literatureResumeTargets(summaries)).toEqual([]);
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
    // 작품 수는 카탈로그가 정본(수록 줄 = 작품 폴더 — literatureCatalog.test.js) — 넣을 때 여기를 고치지 않는다
    expect(LITERATURE_BOOKS.length).toBe(JSON.parse(readFileSync('src/content/literature/catalog.json', 'utf8')).works.filter((entry) => entry.status === '수록' && entry.key.startsWith('aozora-')).length);
    expect(LITERATURE_BOOKS.every(literatureBookPublishable)).toBe(true);
    const broken = { ...book, chapters: book.chapters.map((chapter) => ({ ...chapter, metadata: { ...chapter.metadata, literature: { ...chapter.metadata.literature, rights: { status: 'reviewing', basis: 'unknown' } } } })) };
    expect(literatureBookPublishable(broken)).toBe(false);
  });

  it('권리 근거·장별 게시 상태를 싣고 원문은 싣지 않는다', () => {
    const summary = literatureBookSummary(book, [{ ...row(1), status: 'completed', visibility: 'public' }]);
    expect(summary).toMatchObject({ key: 'aozora-000121-000628', title: 'ごん狐', author: '新美南吉', level: 'N3 중급', total: 6, publishable: true,
      rights: { basis: 'public-domain', reviewedJurisdictions: ['JP', 'KR', 'US'], publishedYear: 1932, authorDeathYear: 1943, charset: '新字新仮名' },
      plan: { state: 'partial', insert: [2, 3, 4, 5, 6] }, stage: 'exposed' }); // 검수 기록 없이 공개된 장이 있다
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
        // 토큰 글자가 원문 자리에 이어지지 않는 분석이라 쪼개진 낱말은 셀 수 없음(null — 0으로 속이지 않는다).
        { order: 1, rubyLocks: locks(0), applied: 2, hints: 0, hintsAttached: 0, hintsMissed: [], remaining: 0, boundary: null, boundaryWords: [] },
        { order: 2, rubyLocks: locks(1), applied: null, hints: 0, hintsAttached: null, hintsMissed: [], remaining: null, boundary: null, boundaryWords: [] },
        { order: 3, rubyLocks: locks(2), applied: null, hints: 0, hintsAttached: null, hintsMissed: [], remaining: null, boundary: null, boundaryWords: [] },
      ]);
  });
});

describe('큐레이션 책(ART-P0-3) — 같은 게시 계획, 출처별 판정·근거 칸', () => {
  const art = artBooks().find((item) => item.book.key === 'art-ukiyoe-landscape-hokusai-hiroshige');
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
      .toEqual({ order: 1, rubyLocks: 0, applied: 0, hints: 0, hintsAttached: 0, hintsMissed: [], remaining: 0, boundary: 0, boundaryWords: [] });
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
    expect(literatureBatchTargets(books).map((book) => book.key)).toEqual(['b', 'a']); // 준비를 시작한 작품이 먼저
  });
  it('대기열 차례 — 준비를 시작한 작품 먼저, 그 안과 나머지는 받은 차례 그대로', () => {
    const books = [summary({ key: 'a' }), summary({ key: 'p1', stage: 'preparing' }), summary({ key: 'c' }), summary({ key: 'p2', stage: 'preparing' })];
    expect(literatureBatchTargets(books).map((book) => book.key)).toEqual(['p1', 'p2', 'a', 'c']);
  });
});

describe('쪼개진 저자 루비 낱말(AOZORA-P1-10 — 오너 「고유명사 … 형태소로 나눠버리는 상황 빈번함」 2026-10-15 KST)', () => {
  const chapter = book.chapters[0];
  /** 글자마다 토큰 하나 — merge에 든 루비 기준은 한 토큰으로. */
  const analyzed = (merge = []) => {
    const sequence = [], dictionary = {};
    for (let at = 0; at < chapter.rawText.length;) {
      const lock = chapter.metadata.literature.rubyLocks.find((item) => item.start === at && merge.includes(item.base));
      const text = lock ? lock.base : String.fromCodePoint(chapter.rawText.codePointAt(at));
      sequence.push(`t${at}`);
      dictionary[`t${at}`] = text === '\n' ? { text, pos: '개행' } : { text };
      at += text.length;
    }
    return { sequence, dictionary };
  };
  const multi = chapter.metadata.literature.rubyLocks.filter((lock) => lock.base.length >= 2);

  it('2자 이상 루비 기준이 토큰 둘 이상에 걸친 자리를 센다 — 한 토큰으로 묶이면 빠진다(한 글자 루비는 세지 않는다)', () => {
    expect(multi.length).toBeGreaterThan(2);
    expect(literatureBoundaryIssues(chapter, analyzed())).toEqual({ count: multi.length, words: [...new Set(multi.map((lock) => lock.base))] });
    const [first, ...rest] = multi;
    expect(literatureBoundaryIssues(chapter, analyzed(rest.map((lock) => lock.base)))).toEqual({ count: 1, words: [first.base] });
    expect(literatureBoundaryIssues(chapter, analyzed(multi.map((lock) => lock.base)))).toEqual({ count: 0, words: [] });
  });

  it('토큰이 루비 바깥에서 걸쳐 들어와도 쪼개짐이다(앞 글자와 붙은 토큰 + 뒤 토큰)', () => {
    const lock = multi[0];
    const json = analyzed(multi.slice(1).map((item) => item.base));
    const at = json.sequence.indexOf(`t${lock.start - 1}`);
    const head = chapter.rawText.slice(lock.start - 1, lock.start + 1);
    json.sequence.splice(at, 2, 'joined');
    json.dictionary.joined = { text: head };
    expect(literatureBoundaryIssues(chapter, json).count).toBe(1);
  });

  it('분석 전·원문에 이어지지 않는 분석은 null(셀 수 없음), 루비 낱말이 없는 장은 0', () => {
    expect(literatureBoundaryIssues(chapter, { sequence: [] })).toBe(null);
    expect(literatureBoundaryIssues(chapter, { sequence: ['x'], dictionary: { x: { text: '存在しない語' } } })).toBe(null);
    const plain = { ...chapter, metadata: { ...chapter.metadata, literature: { ...chapter.metadata.literature, rubyLocks: [] } } };
    expect(literatureBoundaryIssues(plain, { sequence: ['x'], dictionary: { x: { text: '存在しない語' } } })).toEqual({ count: 0, words: [] });
  });
});

describe('위키문헌 중국어 — 고유명사 밑줄(nameMarks)도 쪼개짐을 센다 · 남은 확인은 자료 언어로(감사 2026-10-17)', () => {
  const zh = WIKISOURCE_BOOKS.find((item) => item.chapters[0].metadata.literature.nameMarks?.length);
  const chapter = zh.chapters[0];
  const charTokens = () => {
    const sequence = [], dictionary = {};
    [...chapter.rawText].forEach((text, k) => { sequence.push(`c${k}`); dictionary[`c${k}`] = text === '\n' ? { text, pos: '개행' } : { text }; });
    return { sequence, dictionary };
  };
  it('글자마다 토큰이면 2자 이상 이름 자리가 모두 쪼개짐', () => {
    const names = chapter.metadata.literature.nameMarks.filter((mark) => mark.base.length >= 2);
    expect(names.length).toBeGreaterThan(0);
    expect(literatureBoundaryIssues(chapter, charTokens()).count).toBe(names.length);
  });
  it('literatureReviewRemaining은 뷰어(senseReviewItems)와 같은 언어로 센다', () => {
    const json = { metadata: { language: 'Chinese' }, sequence: ['a'], dictionary: { a: { text: '孔乙己', pos: '고유명사' } } };
    expect(literatureReviewRemaining(json)).toBe(senseReviewItems(json, 'Chinese').length);
    expect(literatureReviewRemaining({ ...json, metadata: {} })).toBe(senseReviewItems(json, 'Japanese').length);
  });
});

describe('권리 칸 — 번역자 · 공공누리 배포 기관을 싣는다(관리자가 판정을 가른 기록을 본다)', () => {
  const ws = (key) => WIKISOURCE_BOOKS.find((item) => item.book.key === key);
  it('자본론: 번역 판 · 번역자 몰년 · 공공누리 책: 배포 기관 · 원작 단독 책은 칸 없음', () => {
    expect(literatureBookSummary(ws('ws-en-karl-marx_capital')).rights.translator).toEqual({ name: expect.stringContaining('Untermann'), deathYear: 1956, publishedYear: 1906 });
    const kogl = literatureBookSummary(ws('ws-ko-samil-centennial_swipgo-bareuge-ingneun-dongnip-seoneonseo')).rights;
    expect(kogl).toMatchObject({ basis: 'kogl-type1', holder: expect.stringContaining('100주년'), authorDeathYear: null });
    expect(kogl).not.toHaveProperty('translator');
    expect(literatureBookSummary(ws('ws-ko-yi-sang_nalgae')).rights).not.toHaveProperty('holder');
  });
});

describe('분석 전 장 metadata 맞추기(AOZORA-P1-12)', () => {
  const pendingRow = (order, metadata, overrides = {}) => ({ ...row(order), status: 'pending', metadata, ...overrides });
  const reorder = (value) => JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(value).reverse())));

  it('분석 전·원문 같은 장 중 정본과 다른 장만 — 키 순서·updated_at은 차이로 보지 않는다', () => {
    const stale = { ...book.chapters[0].metadata };
    delete stale.viewerBoundaries;
    const plan = planLiteratureMetadataSync(book, [
      pendingRow(1, stale),
      pendingRow(2, reorder({ ...book.chapters[1].metadata, updated_at: '2026-10-14T00:00:00Z' })),
      pendingRow(3, stale, { status: 'completed' }), // 분석한 장은 덮지 않는다
      pendingRow(4, stale, { raw_text: '書き換え' }), // 원문이 다른 장은 충돌 — 맞추지 않는다
    ], '2026-10-16T00:00:00Z');
    expect(plan).toEqual([{ id: 101, order: 1, metadata: { ...book.chapters[0].metadata, updated_at: '2026-10-16T00:00:00Z' } }]);
    expect(planLiteratureMetadataSync(book, [])).toEqual([]);
  });
});

describe('분석 이어하기 대상(AOZORA-P1-10)', () => {
  const summary = (overrides) => ({ publishable: true, stage: 'preparing', plan: { conflicts: [], insert: [] }, ...overrides });
  it('모든 장을 준비했고 분석만 멈춘 작품 — 준비가 끊긴 작품(쓰기 필요)·충돌·다른 단계는 사람이 누른다', () => {
    const books = [
      summary({ key: 'a' }),
      summary({ key: 'b', plan: { conflicts: [], insert: [3] } }),
      summary({ key: 'c', stage: 'unpublished', plan: { conflicts: [], insert: [1] } }),
      summary({ key: 'd', plan: { conflicts: [{ id: 1, reason: 'text-differs' }], insert: [] } }),
      summary({ key: 'e', publishable: false }),
      summary({ key: 'f', stage: 'reviewing' }),
    ];
    expect(literatureResumeTargets(books).map((item) => item.key)).toEqual(['a']);
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
    expect(batch).toContain('await analyzeChapters(book, controller)');
    expect(batch).not.toMatch(/'release'|'review'/u);
    expect(panel).toContain("else if (action === 'batch') runBatch(targets);");
  });

  it('화면을 열면 멈춘 분석을 한 번만 자동으로 잇는다 — 같은 일괄 경로(멈춤 그대로), 준비(쓰기)는 하지 않는 대상만', () => {
    const resume = sliceBetween(panel, 'const resumedRef = useRef(false);', '}, [data]);');
    expect(resume).toContain('if (!data?.books || resumedRef.current) return;');
    expect(resume).toContain('resumedRef.current = true;');
    expect(resume).toContain('const stopped = literatureResumeTargets(data.books);');
    expect(resume).toContain('runBatch(stopped);');
  });

  it('묶음 검수는 확인 끝·쪼개진 낱말 0·검수 전 장만, 확인 창을 거쳐 reviewMany — 쪼개진 낱말이 남은 장은 확인 창 뒤 acceptBoundaries', () => {
    const review = sliceBetween(panel, 'function ChapterReview', '\n}\n');
    expect(review).toContain('return chapter.material && !chapter.material.reviewed && item?.remaining === 0 && item?.boundary === 0;');
    expect(review).toContain('onClick={() => onReviewMany(book, clean)}');
    expect(review).toContain('쪼개진 낱말 ${item.boundary}곳');
    expect(panel).toContain("onReviewMany={(item, chapters) => setConfirm({ action: 'reviewMany', book: item, chapters })}");
    expect(panel).toContain("? setConfirm({ action: 'review', book: item, chapter, item: coverage })");
    expect(panel).toContain("if (action === 'review') review.mutate({ book, chapter, acceptBoundaries: true });");
    expect(panel).toContain("else if (action === 'reviewMany') reviewMany.mutate({ book, chapters });");
    expect(panel).toContain("post('reviewMany', book.key, { orders: chapters.map((chapter) => chapter.order) })");
  });

  it('분석 전에 먼저 prepare로 분석 전 장의 metadata를 정본에 맞춘다(AOZORA-P1-12)', () => {
    const analyze = sliceBetween(panel, 'async function analyzeChapters', '\n  }\n');
    expect(analyze.indexOf("if (targets.length) await post('prepare', book.key);")).toBeGreaterThan(-1);
    expect(analyze.indexOf("await post('prepare', book.key);")).toBeLessThan(analyze.indexOf('runPreservedReanalysis'));
  });

  it('분석 실패는 장마다 건너뛰고 잇는다 — 멈춤은 그대로 멈추고, 연달아 실패하면 공통 원인으로 보고 멈춘다(AOZORA-P1-13)', () => {
    const analyze = sliceBetween(panel, 'async function analyzeChapters', '\n  }\n');
    expect(analyze).toContain("if (error?.name === 'AbortError') throw error;");
    expect(analyze).toContain('failed.push({ title: chapter.title,');
    expect(analyze).toContain('if (streak >= FAILURE_STOP) throw');
    expect(analyze).toContain('return failed;');
    expect(panel).toContain('const FAILURE_STOP = 3;');
    const batch = sliceBetween(panel, 'async function runBatch', '\n  }\n');
    expect(batch).toContain('failed.push(...(await analyzeChapters(book, controller))');
  });

  it('「게시」(prepare) 성공 뒤 바로 분석을 시작하고, 「공개」(release)는 ready 단계에서만 보인다', () => {
    expect(sliceBetween(panel, 'const prepare = useMutation', 'const release = useMutation')).toContain('if (next) analyzeBook(next);');
    expect(panel).toContain("{book.stage === 'ready' && (");
    expect(panel).toContain("post('release', book.key)");
  });
});

describe('관리자 게시 화면 표지(오너 「게시 누르는 창에도 표지」 2026-10-15 KST)', () => {
  const panel = readFileSync(path.join(process.cwd(), 'src/components/LiteraturePublishPanel.jsx'), 'utf8');

  it('서재와 같은 LiteratureCover를 정본 대조표의 작품으로 그린다(새 표지 그림을 따로 만들지 않는다)', () => {
    expect(panel).toContain("import LiteratureCover from './books/LiteratureCover';");
    expect(sliceBetween(panel, 'export function BookCover', '\n}\n')).toContain('literatureWork(bookKey)');
  });

  it('표 한 줄과 게시·공개·일괄 확인 창에 표지 — 정본 문학책(kind=literature)일 때만', () => {
    const row = sliceBetween(panel, '<td className="admin-table__title">', '</td>');
    expect(row).toContain("kind === 'literature' && <BookCover bookKey={book.key} scale={0.5} />");
    expect(sliceBetween(panel, '<ConfirmModal', '/>')).toContain('message={confirmMessage}');
    const message = sliceBetween(panel, 'const confirmMessage', '\n  );\n');
    expect(message).toContain("kind !== 'literature' || !['prepare', 'batch', 'release'].includes(confirm.action) ? confirmText");
    expect(message).toContain("(confirm.action === 'batch' ? confirm.books : [confirm.book]).map((book) => (");
  });
});
