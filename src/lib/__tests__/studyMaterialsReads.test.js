import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { introduceFsrsCard } from '../fsrsScheduler';
import { compactVocabularySnapshot } from '../vocabularySnapshotLight';
import { sliceBetween } from './helpers/sliceBetween';
// /study 조립(assembleStudyMaterials)의 DB 읽기 묶음(PERF-STUDY-001) — 최근 주제 · 최근 사용 문단은 첫 병렬 묶음에서 함께 읽는다.
// 읽기만 앞당긴다: 같은 재료(avoidThemes · 연재 prevArc/episode), 조회 실패는 지금처럼 조용히 빈 값.
// 모듈 대역은 learningRemainingReaders.test.js와 같은 경계(스냅숏 RPC · 레지스트리 · 문항 조립만 대역).
const env = vi.hoisted(() => ({ snapshot: null, client: { rpc: vi.fn() }, ref: null, captured: {} }));
vi.mock('../server/fsrsLearning', () => ({ fsrsServiceClient: () => env.client }));
vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('@/content/refLangs', () => ({ getRefLang: () => env.ref }));
vi.mock('../publishedChapter', () => ({ loadPublishedRegistry: async (_language, ref) => ref }));
vi.mock('@/views/refShared', () => ({ refMain: value => value?.ja || '', refPron: () => '' }));
vi.mock('@/lib/refQuiz', () => ({ buildChapterQuiz: () => ({ meaning: [], apply: [] }) }));
vi.mock('@/lib/studySession', () => ({
  composeSession: value => { env.captured.session = value; return []; },
  buildWarmupItems: () => [],
  buildEncounterItems: () => [],
}));
vi.mock('@/lib/writingPrompts', () => ({ levelBand: () => 'N5' }));
vi.mock('@/lib/studyParagraph', () => ({ THEMES: ['일상', '카페', '여행'] }));
import { assembleStudyMaterials } from '../studyMaterials';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const NOW = Date.parse('2026-10-06T03:00:00.000Z'); // KST 화요일 — 약점 세션이 아니라 연재 판정까지 간다.
const iso = value => new Date(value).toISOString();
const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
function snapshot() {
  const rows = [1, 2].map(n => ({ id: id(n), user_id: ACTOR, word_text: `語${n}`, base_form: `語${n}`, language: 'Japanese', meaning: `뜻 ${n}`,
    furigana: '', source_sentence: null, source_material_id: null, created_at: iso(NOW - 5 * 86400000), interval: 2, ease_factor: 4,
    repetitions: 1, last_reviewed_at: iso(NOW - 2 * 86400000), next_review_at: iso(NOW - 86400000) }));
  const card = introduceFsrsCard(NOW - 100000);
  return { version: 1, actorId: ACTOR, enabled: true, registryAvailable: true, complete: true, now: iso(NOW), rows,
    registry: rows.map(row => ({ userId: ACTOR, cardId: row.id, enrolled: false, eligible: true, known: false, excluded: false, card: null,
      nextQuestionAt: null, firstQuestionAt: null })), _card: card };
}
const THEME_ROWS = [{ theme: '카페' }, { theme: '여행' }];
const USED_ROW = { paragraph: { arcSummary: '고양이가 역에서 기다린다', userNext: { text: '비가 온다', score: 2 } }, materials: { episode: 3 },
  used_at: iso(NOW - 86400000), created_at: iso(NOW - 2 * 86400000) };
/** 쿼리마다 출발 때까지 도착한 응답 수를 남기고 잠깐 뒤 답한다 — 그 수가 같은 묶음 = 한 번의 왕복.
 *  (출발 시각 10ms 군집으로 묶던 판정은 병렬 부하에서 한 묶음이 쪼개질 수 있어 시계 없는 순서로 잰다 — libraryPrefetchWait 선례.) */
function database({ failParagraphs = false } = {}) {
  const starts = [];
  let answered = 0;
  return { starts, from(table) {
    const chain = { filters: [] };
    for (const method of ['select', 'not', 'lte', 'gte', 'order', 'limit', 'in', 'range']) chain[method] = () => chain;
    chain.eq = (key, value) => { chain.filters.push([key, value]); return chain; };
    chain.then = (resolve, reject) => {
      starts.push({ table, answered, used: chain.filters.some(([k, v]) => k === 'status' && v === 'used') });
      const data = table !== 'study_paragraphs' ? [] : chain.filters.some(([k, v]) => k === 'status' && v === 'used') ? [USED_ROW] : THEME_ROWS;
      const result = new Promise(done => setTimeout(done, 25)).then(() => {
        answered += 1;
        if (failParagraphs && table === 'study_paragraphs') throw new Error('relation does not exist');
        return { data };
      });
      return result.then(resolve, reject);
    };
    return chain;
  } };
}
const waves = starts => { const out = []; for (const s of starts) { const last = out.at(-1); if (last && last.answered === s.answered) last.items.push(s); else out.push({ answered: s.answered, items: [s] }); } return out; };
const read = file => fs.readFileSync(path.resolve(__dirname, '../../..', file), 'utf8');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
  env.snapshot = snapshot(); env.captured = {};
  env.client.rpc.mockReset().mockImplementation(async (name, args) => ({ data: name === 'fsrs_vocabulary_snapshot_light'
    ? compactVocabularySnapshot(env.snapshot, { language: args.p_language, summary: args.p_summary }) : env.snapshot }));
  env.ref = { ALL_CHAPTERS: [], LEVEL_META: [{ key: 'N5' }], langCode: 'ja', base: '/japanese', getChapter: () => null, isIntroLevel: () => false,
    getVocab: () => ({ themes: [{ words: [] }] }) };
});
afterEach(() => { vi.useRealTimers(); });

describe('/study 조립 — 최근 문단 읽기를 첫 병렬 묶음에', () => {
  it('최근 주제 · 최근 사용 문단을 grammar_review 등과 같은 묶음에서 읽는다(순차 왕복 없음)', async () => {
    const db = database();
    await assembleStudyMaterials(db, ACTOR, 'Japanese');
    const main = waves(db.starts).find(wave => wave.items.some(s => s.table === 'grammar_review'));
    expect(main.items.map(s => s.table)).toEqual(expect.arrayContaining(['grammar_review', 'user_ref_progress', 'review_events', 'user_vocab_encounters']));
    expect(main.items.filter(s => s.table === 'study_paragraphs')).toHaveLength(2);
    expect(main.items.some(s => s.table === 'study_paragraphs' && s.used)).toBe(true);
    expect(db.starts.filter(s => s.table === 'study_paragraphs')).toHaveLength(2); // 앞당긴 만큼 다시 읽지 않는다
  });
  it('같은 재료 — 피할 주제 · 연재(prevArc · episode · userNext)', async () => {
    const { paragraphMaterials } = await assembleStudyMaterials(database(), ACTOR, 'Japanese');
    expect(paragraphMaterials.avoidThemes).toEqual(['카페', '여행']);
    expect(paragraphMaterials).toMatchObject({ prevArc: '고양이가 역에서 기다린다', episode: 4, userNext: '비가 온다', theme: '일상' });
  });
  it('문단 테이블 조회 실패는 지금처럼 조용히 빈 값(피할 주제 없음 · 새 이야기)', async () => {
    const { paragraphMaterials } = await assembleStudyMaterials(database({ failParagraphs: true }), ACTOR, 'Japanese');
    expect(paragraphMaterials.avoidThemes).toEqual([]);
    expect(paragraphMaterials.prevArc).toBeUndefined();
  });
  it('사용 처리(status=used 쓰기)는 조립 안에서 하지 않는다 — 읽기만 앞당겼다', () => {
    const source = read('src/lib/studyMaterials.js');
    expect(source).not.toMatch(/from\('study_paragraphs'\)[^;]*\.(update|insert|upsert)\(/);
    const assemble = sliceBetween(source, 'export async function assembleStudyMaterials');
    expect(assemble).not.toMatch(/await supabase\.from\('study_paragraphs'\)/);
  });
});
