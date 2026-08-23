import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { knownWordsLang, mergeKnownIntoIndex } from '../knownWords.js';

// 계약: '이미 앎'(#1077-14, 목업 ⑤) — 단어장·SRS 분리, 합류는 인덱스 합집합뿐.

describe('knownWordsLang — 만남 기록과 같은 언어 매핑', () => {
  it('4언어 매핑·미지원은 null', () => {
    expect(knownWordsLang('Japanese')).toBe('ja');
    expect(knownWordsLang('French')).toBe('fr');
    expect(knownWordsLang('Chinese')).toBe('zh');
    expect(knownWordsLang('English')).toBe('en');
    expect(knownWordsLang('Korean')).toBeNull();
    expect(knownWordsLang(undefined)).toBeNull();
  });
});

describe('mergeKnownIntoIndex — materialFit 무변경 합류(순수)', () => {
  it('표기를 surfaces·bases 양쪽에 합집합하고 원본 Set은 불변', () => {
    const saved = { surfaces: new Set(['peu']), bases: new Set(['pouvoir']) };
    const merged = mergeKnownIntoIndex(saved, [{ word_text: 'bonjour' }, { word_text: '駅' }]);
    expect(merged.surfaces.has('bonjour')).toBe(true);
    expect(merged.bases.has('駅')).toBe(true);
    expect(merged.surfaces.has('peu')).toBe(true);
    expect(merged.bases.has('pouvoir')).toBe(true);
    expect(saved.surfaces.has('bonjour')).toBe(false); // 원본 불변
    expect(saved.bases.has('駅')).toBe(false);
  });

  it('빈 입력·무효 행은 조용히', () => {
    const merged = mergeKnownIntoIndex(null, [{ word_text: '' }, {}, null]);
    expect(merged.surfaces.size).toBe(0);
    expect(merged.bases.size).toBe(0);
  });
});

// 배선·스키마 계약 — 원칙이 코드로 표현되면 계약 테스트로 심는다.
describe("'이미 앎' 배선 계약", () => {
  const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
  const migration = read('supabase/migrations/20260823170000_user_known_words.sql');

  it('마이그레이션 — own-only 3정책(취소용 delete 포함)·anon 차단·lang 2자 계약', () => {
    expect(migration).toContain('user_known_words_select_own');
    expect(migration).toContain('user_known_words_insert_own');
    expect(migration).toContain('user_known_words_delete_own'); // 만남과 달리 취소 가능
    expect(migration).toMatch(/REVOKE ALL ON public\.user_known_words FROM anon/);
    expect(migration).toMatch(/lang\s+text NOT NULL CHECK \(lang ~ '\^\[a-z\]\{2\}\$'\)/);
  });

  it('단어장·SRS 무접촉 — 마이그레이션이 학습 테이블을 참조하지 않는다', () => {
    const sql = migration.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    expect(sql).not.toMatch(/user_vocabulary|review_events|reading_progress/);
  });

  it('서재 — 커버리지 합류는 인덱스 합집합(엔진 시그니처 무변경)', () => {
    const src = read('src/views/MaterialsPage.jsx');
    expect(src).toContain('mergeKnownIntoIndex');
    // materialFit 호출은 인덱스 하나를 받는 기존 형태 그대로
    expect(src).toMatch(/materialFit\(m\.processed_json, index\)/);
  });

  it("뷰어 — 시트에 '이미 알아요' 토글, 저장된 단어에는 숨김", () => {
    const src = read('src/views/ViewerPage.jsx');
    expect(src).toContain('👌 이미 알아요');
    expect(src).toContain('아는 말로 표시됨 — 취소');
    expect(src).toContain('!isWordSaved && (() => {');
  });
});
