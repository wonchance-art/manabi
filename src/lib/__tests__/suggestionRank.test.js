import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FIT_BAND, REASON, SUGGESTION_TOP_N, fitCloseness, rankSuggestions, usableFit } from '../suggestionRank';
import { FIT_MIN_TYPES } from '../materialFit';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const card = (over) => ({ id: over.id, language: 'Japanese', level: 'N5', title: over.id, ...over });
const fit = (coverage, total = 100) => ({ coverage, total, known: Math.round(coverage * total), unknown: total - Math.round(coverage * total) });

/**
 * 계약: U R1 커버리지 → 추천 랭킹 (#1077 5503520174 착수 SPEC).
 * 랭킹이지 필터가 아니다 · 결정적 · i+1 대역(2~15%) 안이 밖보다 앞 · FIT_MIN_TYPES 재사용 ·
 * material_id 없는 카드 혼합 처리 · 모든 카드에 사유 코드 · 동점 상대 순서 불변.
 */
describe('suggestionRank — 순수 랭커', () => {
  it('상수 — 대역 2%~15%, 상위 4장, FIT_MIN_TYPES는 materialFit의 것을 재사용(20)', () => {
    expect(FIT_BAND).toEqual({ min: 0.02, max: 0.15 });
    expect(SUGGESTION_TOP_N).toBe(4);
    expect(read('src/lib/suggestionRank.js')).toContain("import { FIT_MIN_TYPES } from './materialFit';");
    expect(usableFit(fit(0.9, FIT_MIN_TYPES - 1))).toBe(false);
    expect(usableFit(fit(0.9, FIT_MIN_TYPES))).toBe(true);
    expect(usableFit(null)).toBe(false);
  });

  it('결정적 — 저장 어휘 0·비로그인(langs 빈 배열)에서도 같은 입력이면 같은 순서, 무작위·시간 의존 0', () => {
    const cards = [card({ id: 'a', level: 'N4' }), card({ id: 'b' }), card({ id: 'c', language: 'English', level: 'A1' })];
    const first = rankSuggestions(cards, {}).map((c) => c.id);
    const second = rankSuggestions(cards, {}).map((c) => c.id);
    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    const src = read('src/lib/suggestionRank.js');
    expect(src).not.toMatch(/Math\.random|Date\.now|new Date/);
  });

  it('카드 수가 줄지 않는다 — 랭킹이지 필터가 아니다', () => {
    const cards = Array.from({ length: 7 }, (_, i) => card({ id: `c${i}` }));
    expect(rankSuggestions(cards, { langs: ['French'], fitOf: () => fit(0.1) })).toHaveLength(7);
  });

  it('i+1 대역 안의 카드가 대역 밖보다 앞선다(같은 언어·모두 산정됨), 중앙에 가까울수록 앞', () => {
    const fits = { hard: fit(0.5), sweet: fit(0.92), easy: fit(0.995), near: fit(0.88) };
    const cards = ['hard', 'easy', 'near', 'sweet'].map((id) => card({ id, material_id: id }));
    const out = rankSuggestions(cards, { langs: ['Japanese'], fitOf: (c) => fits[c.id] });
    expect(out.map((c) => c.id)).toEqual(['sweet', 'near', 'easy', 'hard']);
    expect(out[0].rank.reason).toBe(REASON.FIT);
    expect(out[1].rank.reason).toBe(REASON.FIT);   // 12% — 대역 안
    expect(out[2].rank.reason).toBe(REASON.FIT_EASY);
    expect(out[3].rank.reason).toBe(REASON.FIT_HARD);
    expect(fitCloseness(0.085)).toBeCloseTo(1, 10);
    expect(fitCloseness(0.5)).toBeLessThan(0);
  });

  it('FIT_MIN_TYPES 미만 표본에는 밴드를 달지 않는다 — 레벨 점수로 떨어진다', () => {
    const cards = [card({ id: 'thin', material_id: 'thin', level: 'N5' }), card({ id: 'lvl', level: 'N5' })];
    const out = rankSuggestions(cards, { langs: ['Japanese'], fitOf: (c) => (c.id === 'thin' ? fit(0.9, 5) : null), levelOf: () => 'N5' });
    expect(out.every((c) => c.rank.reason === REASON.LEVEL)).toBe(true);
    expect(out.map((c) => c.id)).toEqual(['thin', 'lvl']); // 동점 → 원래 순서
  });

  it('material_id 없는 카드가 섞여 있어도 예외 없이 정렬되고, 산정된 카드가 같은 언어 안에서 앞선다', () => {
    // nofit이 앞에 있고 레벨 점수도 더 높다(N5 = 이상 레벨) — 「산정된 카드 우선」 키가 없으면 nofit이 앞선다(변이 A 실측)
    const cards = [card({ id: 'nofit', level: 'N5' }), card({ id: 'withfit', material_id: 'm', level: 'N3' })];
    const out = rankSuggestions(cards, { langs: ['Japanese'], fitOf: (c) => (c.material_id ? fit(0.9) : null), levelOf: () => 'N5' });
    expect(out.map((c) => c.id)).toEqual(['withfit', 'nofit']);
    expect(out[1].rank.reason).toBe(REASON.LEVEL);
  });

  it('선호 언어가 1차 키 — 대역 안이라도 다른 언어는 뒤', () => {
    const cards = [card({ id: 'en', language: 'English', material_id: 'en' }), card({ id: 'ja', level: 'A1' })]; // A1은 N군 밖 → 레벨 점수 0
    const out = rankSuggestions(cards, { langs: ['Japanese'], fitOf: (c) => (c.id === 'en' ? fit(0.92) : null), levelOf: () => 'N5' });
    expect(out.map((c) => c.id)).toEqual(['ja', 'en']);
    expect(out[0].rank.reason).toBe(REASON.LANG);
  });

  it('모든 카드에 사유 코드가 붙는다 · 동점은 created_at 오름차순, 그래도 같으면 원래 순서', () => {
    const cards = [card({ id: 'late', created_at: '2026-09-02' }), card({ id: 'early', created_at: '2026-09-01' }), card({ id: 'x' }), card({ id: 'y' })];
    const out = rankSuggestions(cards, {});
    expect(out.every((c) => Object.values(REASON).includes(c.rank.reason))).toBe(true);
    expect(out.map((c) => c.id)).toEqual(['x', 'y', 'early', 'late']); // created_at 없음('') < 있음
  });
});

describe('홈 배선 (HomePage)', () => {
  const home = read('src/views/HomePage.jsx');

  it('scored[0] 한 장 대신 순수 랭커 상위 N장 — 커버리지는 material_id 카드만 materialFit으로', () => {
    expect(home).toContain("import { rankSuggestions, SUGGESTION_TOP_N, REASON } from '../lib/suggestionRank';");
    expect(home).toContain('}).slice(0, SUGGESTION_TOP_N);');
    expect(home).not.toMatch(/return scored\[0\]/);
    expect(home).toContain("fitOf: (s) => (s?.material_id ? fitMap[s.material_id] ?? null : null),");
    expect(home).toContain("levelOf: (s) => getIdealLevel(s.language, vocabByLang[s.language] || 0),");
    // 재료: 추천 material_id의 processed_json만(상한 12) + 이 화면이 이미 끌어온 단어 행으로 {surfaces, bases}
    expect(home).toContain(".select('id, processed_json').in('id', fitIds)");
    expect(home).toContain("select('language, word_text, base_form')");
    expect(home).toContain('materialFit(m.processed_json, savedForFit)');
    // 뷰어의 fetchUserVocabWords를 옮기지 않았다(offlineCache 앵커)
    expect(home).not.toContain('fetchUserVocabWords');
    expect(read('src/views/ViewerPage.jsx')).toContain('async function fetchUserVocabWords');
  });

  it('카드마다 사유 한 줄 — 문구는 뷰가 조립하고, 사유 없는 카드는 그리지 않는다', () => {
    expect(home).toContain('const reasonText = (r) => {');
    for (const r of ['FIT', 'FIT_EASY', 'FIT_HARD', 'LEVEL', 'LEVEL_NEAR', 'LANG', 'OTHER']) expect(home).toContain(`case REASON.${r}:`);
    expect(home).toContain('if (!reason) return null; // 사유 없는 카드는 그리지 않는다(계약)');
    expect(home).toContain('className="home-suggestion__reason"');
    expect(home).toContain('{suggestions.map((s, i) => {');
  });
});
