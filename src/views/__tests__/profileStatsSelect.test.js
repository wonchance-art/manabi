import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { VOCABULARY_LEARNING_SUMMARY_FIELDS } from '../../lib/vocabularyLearningRead';

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
// 단어 복습 칸은 배움(HomePage)이 조회하고 배움 · 현황 공용 모듈(LearnTiles)이 그린다(LEARN-HOME-AK-001).
// 현황(ProfileStats)은 같은 요약 snapshot으로 기억 건강 · 레벨 어휘를 그린다.
const src = read('src/views/ProfileStats.jsx');
const home = read('src/views/HomePage.jsx');
const tiles = read('src/components/learn/LearnTiles.jsx');

/**
 * 계약: 복습 타일이 **그리는 필드는 모두 조회에 있어야 한다**.
 *
 * 실제 사고(2026-08-24 수리): 쿼리 다이어트(#1079)가 user_vocabulary select에서
 * word_text·meaning을 빼갔는데 ReviewTile은 그걸 계속 렌더했다. 행 자체는 있으니
 * '아직 수집한 단어가 없어요' 폴백으로도 안 빠지고, 빈 글자만 3.5초마다 교체되는
 * 조용한 고장이 나흘간 살아 있었다. 조회와 렌더가 다른 곳에 있어 눈으로는 안 잡힌다.
 */
describe('ProfileStats — 조회 필드 ⊇ 렌더 필드', () => {
  // 019: 조회는 complete snapshot API로 이동했다. 실제 전송 allowlist를 렌더 필드와 대조한다.
  const fields = VOCABULARY_LEARNING_SUMMARY_FIELDS;

  it('복습 타일 조회를 찾을 수 있다', () => {
    expect(src).toContain("fetchVocabularyLearningRows(userId, { fields: 'summary' })");
    expect(src).toContain('projections: learning.projections');
    expect(src).toContain('<MemoryHealthCard lang={lang} projections={projections}');
    expect(home).toContain("fetchVocabularyLearningRows(userId, { fields: 'summary' })");
    expect(home).toContain('<ReviewTile projections={data?.learning?.projections || []}');
    expect(tiles).toContain('isVocabularyReviewDue(p, now)');
  });

  it.each(['id', 'word_text', 'meaning'])('타일이 그리는 %s가 조회에 있다', (field) => {
    expect(fields).toContain(field);
  });

  it.each(['created_at', 'last_reviewed_at', 'next_review_at'])('통계가 쓰는 %s가 조회에 있다', (field) => {
    expect(fields).toContain(field);
  });

  it('전 컬럼(*)로 되돌아가지 않는다 — 다이어트 취지는 유지', () => {
    expect(fields).not.toContain('*');
    // 본문·요미가나처럼 큰 컬럼은 여전히 끌지 않는다
    expect(fields).not.toContain('source_sentence');
  });

  it('타일이 실제로 그 세 필드를 쓴다(반대 방향 드리프트도 잡는다)', () => {
    expect(tiles).toContain('word.word_text');
    expect(tiles).toContain('word.meaning');
    expect(tiles).toContain('word.id');
  });
});
