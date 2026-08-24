import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.join(process.cwd(), 'src/views/ProfileStats.jsx'), 'utf8');

/**
 * 계약: 복습 타일이 **그리는 필드는 모두 조회에 있어야 한다**.
 *
 * 실제 사고(2026-08-24 수리): 쿼리 다이어트(#1079)가 user_vocabulary select에서
 * word_text·meaning을 빼갔는데 ReviewTile은 그걸 계속 렌더했다. 행 자체는 있으니
 * '아직 수집한 단어가 없어요' 폴백으로도 안 빠지고, 빈 글자만 3.5초마다 교체되는
 * 조용한 고장이 나흘간 살아 있었다. 조회와 렌더가 다른 곳에 있어 눈으로는 안 잡힌다.
 */
describe('ProfileStats — 조회 필드 ⊇ 렌더 필드', () => {
  // 타일용 조회 = user_vocabulary select 중 next_review_at(복습 시각)을 끌어오는 것.
  // 줄바꿈 체이닝에 취약한 위치 정규식 대신 필드 내용으로 고른다.
  const selects = [...src.matchAll(/\.select\('([^']+)'\)/g)].map((m) => m[1]);
  const tileSelect = selects.find((f) => f.includes('next_review_at'));
  const fields = (tileSelect || '').split(',').map((f) => f.trim());

  it('복습 타일 조회를 찾을 수 있다', () => {
    expect(tileSelect, 'user_vocabulary에서 next_review_at을 끄는 select가 있어야 한다').toBeTruthy();
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
    expect(src).toContain('word.word_text');
    expect(src).toContain('word.meaning');
    expect(src).toContain('word.id');
  });
});
