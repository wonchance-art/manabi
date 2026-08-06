import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('핵심 학습 경로 접근성 R2 계약', () => {
  it('챕터 패턴 체크는 문제와 선택지를 연결하고 채점·완료 결과를 공지한다', () => {
    const pattern = source('src/components/RefPatternCheck.jsx');
    expect(pattern).toContain('role="group" aria-labelledby={promptId}');
    expect(pattern).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(pattern).toContain('aria-controls={answerId}');
    expect(pattern).toContain('aria-labelledby={`${checkId}-title`}');
  });

  it('어휘 복습 힌트와 단일 선택 상태를 보조기술에 전달한다', () => {
    const review = source('src/views/VocabReview.jsx');
    expect(review).toContain('aria-controls={hintId}');
    expect(review).toContain('id={hintId}');
    expect(review).toContain('aria-pressed={contextSelected === i}');
    expect(review).toContain("', 선택한 오답'");
  });

  it('단어장 도구와 CSV 가져오기는 이름 있는 키보드 조작을 제공한다', () => {
    const page = source('src/views/VocabPage.jsx');
    expect(page).toContain('aria-label="단어장 도구"');
    expect(page).toContain('onClick={() => csvInputRef.current?.click()}');
    expect(page).toContain('aria-label="CSV 파일 선택"');
    expect(page).not.toContain('<label style={{ display: \'block\', padding: \'10px 14px\', fontSize: \'0.85rem\', cursor: \'pointer\', color: \'var(--text-primary)\' }}>\n                    CSV 가져오기');
  });
});
