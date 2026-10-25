// ROUTE-AUDIT-2 F4(2026-10-25 KST) — 자료 맞춤도의 담김 인덱스를 due 인덱스(완전 snapshot 요약)에서 쓴다.
// 「함께 읽는 글」(/discover?view=reading) · 서재 도구(?tools=1 · ?sort=fit)가 같은 user_vocabulary 표를 1000행씩 차례로 다시 읽었다
// (합성 3,000단어 모바일: 3왕복 · 265 kB 원문, snapshot 요약 208 kB gz와 별도). snapshot은 내 행 전부라(fsrs_vocabulary_snapshot
// WHERE v.user_id=p_actor — 제외 · 이미 앎 행도 싣는다) 같은 surfaces · bases가 나온다 — 화면(맞춤도 숫자 · 정렬)은 그대로다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildVocabularyWordIndex } from '../vocabularyDueIndex';
import { materialFit } from '../materialFit';
import { mergeKnownIntoIndex } from '../knownWords';
import { sliceBetween } from './helpers/sliceBetween';

const NOW = Date.parse('2026-10-25T00:00:00.000Z');
const iso = v => new Date(v).toISOString();
const actorId = 'actor';
const row = (id, word, base, extra = {}) => ({ id, user_id: actorId, word_text: word, base_form: base, language: 'Japanese', meaning: '',
  created_at: iso(NOW - 864e5), source_material_id: null, interval: 1, ease_factor: 2.5, repetitions: 0, last_reviewed_at: null, next_review_at: null, ...extra });
const entry = (r, extra = {}) => ({ cardId: r.id, userId: actorId, enrolled: false, eligible: true, known: false, excluded: false,
  card: null, attempt: null, nextQuestionAt: null, firstQuestionAt: null, ...extra });

function fixture() {
  const rows = [row('v1', '食べた', '食べる'), row('v2', '学校', null), row('v3', '行く', '行く', { next_review_at: iso(NOW + 864e5), last_reviewed_at: iso(NOW - 864e5) }),
    row('v4', '静か', '静か'), row('v5', '雨', '雨')];
  // 제외(v4) · 이미 앎(v5)도 snapshot 행에 남는다 — 예전 user_vocabulary 직접 조회도 그 행을 셌다.
  const registry = [entry(rows[0]), entry(rows[1]), entry(rows[2]), entry(rows[3], { excluded: true, eligible: false }), entry(rows[4], { known: true, excluded: true, eligible: false })];
  return { version: 1, actorId, enabled: true, registryAvailable: true, complete: true, now: iso(NOW), rows, registry };
}
// 예전 saved-vocab-index의 계산(MaterialsPage — 표의 모든 행에서 word_text · base_form)
function tableIndex(rows) {
  const surfaces = new Set(), bases = new Set();
  for (const v of rows) { if (v.word_text) surfaces.add(v.word_text); if (v.base_form) bases.add(v.base_form); }
  return { surfaces, bases };
}

describe('맞춤도 담김 인덱스 — snapshot 요약에서 만들어도 예전 표 조회와 같다', () => {
  it('surfaces · bases가 같다(제외 · 이미 앎 · base_form 없는 행 포함)', () => {
    const snap = fixture();
    const index = buildVocabularyWordIndex(snap, NOW);
    const table = tableIndex(snap.rows);
    expect([...index.surfaces].sort()).toEqual([...table.surfaces].sort());
    expect([...index.bases].sort()).toEqual([...table.bases].sort());
  });

  it('자료 맞춤도 값이 같다(이미 앎 합류 전 · 후)', () => {
    const snap = fixture();
    const index = buildVocabularyWordIndex(snap, NOW), table = tableIndex(snap.rows);
    const processed = { status: 'completed', metadata: { language: 'Japanese' }, sequence: ['a', 'b', 'c', 'd', 'e', 'f'],
      dictionary: { a: { text: '食べ', base_form: '食べる', pos: '動詞' }, b: { text: '学校', pos: '名詞' }, c: { text: '静か', pos: '形容動詞' },
        d: { text: '雨', pos: '名詞' }, e: { text: '空', pos: '名詞' }, f: { text: '行く', base_form: '行く', pos: '動詞' } } };
    expect(materialFit(processed, index)).toEqual(materialFit(processed, table));
    const known = [{ word_text: '空', lang: 'ja' }];
    expect(materialFit(processed, mergeKnownIntoIndex(index, known))).toEqual(materialFit(processed, mergeKnownIntoIndex(table, known)));
  });

  it('MaterialsPage는 due 인덱스를 쓰고, 같은 표 완전 조회는 snapshot 실패 때만 돈다', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'src/views/MaterialsPage.jsx'), 'utf8');
    const fallback = sliceBetween(page, "queryKey: ['saved-vocab-index', user?.id],", '\n  });\n');
    expect(fallback).toContain('enabled: !!user && !!dueVocabError,');
    expect(page).toContain('const savedVocabIndex = dueVocabIndex || savedVocabFallback;');
    // 예전처럼 표 조회 결과를 곧바로 담김 인덱스로 쓰지 않는다 — 병합 지점은 savedFitIndex 한 곳(맞춤도 · 책 카드 공용) 그대로.
    expect(page).not.toContain('const { data: savedVocabIndex }');
    expect(page.match(/mergeKnownIntoIndex\(savedVocabIndex, knownRows\)/g)).toHaveLength(1);
  });
});
