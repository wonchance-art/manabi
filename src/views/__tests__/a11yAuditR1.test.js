import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('핵심 학습 경로 접근성 수리 계약', () => {
  it('랜딩의 게스트 로그인 권유가 이름 있는 보조 영역으로 노출된다', () => {
    const landing = source('src/views/LandingPage.jsx');
    expect(landing).toContain('<aside aria-label="로그인 안내">');
    // 계약은 "이름 있는 보조 영역 + /auth 로그인 링크"다. prefetch 같은 성능 속성이 붙어도
    // 접근성 계약은 그대로이므로 마크업 정확 일치 대신 링크의 존재로 검사한다.
    expect(landing).toMatch(/<Link href="\/auth"[^>]*>로그인<\/Link>/);
  });

  it('교재 필터는 선택 상태를 알리고 그룹·챕터 이동에 네이티브 링크를 쓴다', () => {
    const lessons = source('src/views/LessonsPage.jsx');
    expect(lessons).toContain('role="group" aria-label="언어 필터"');
    expect(lessons).toContain('role="group" aria-label="레벨 필터"');
    expect(lessons).toContain('aria-pressed={langFilter === f.key}');
    expect(lessons).toContain('className="lessons-list__group-toggle"');
    expect(lessons).toContain('aria-controls={`${groupKey}-chapters`}');
    expect(lessons).toContain('href={`${refLang.base}/grammar/${ch.slug}`}');
    expect(lessons).not.toContain('role="link"');
  });

  it('챕터 입력은 보이는 지시문과 연결되고 동적 채점 결과를 공지한다', () => {
    const drills = source('src/components/ChapterDrills.jsx');
    const writing = source('src/components/WritingPractice.jsx');
    expect(drills).toContain('aria-labelledby={promptId}');
    expect(drills).toContain('role="status" aria-live="polite"');
    expect(writing).toContain('aria-labelledby={`${titleId} ${promptId}`}');
    expect(writing).toContain('role="region" aria-label="모범답과 자기 점검"');
    expect(writing).toContain('aria-controls={samplesId}');
  });

  it('어휘 목록은 중첩 인터랙션 대신 독립 버튼과 선택 상태를 제공한다', () => {
    const list = source('src/views/VocabList.jsx');
    expect(list).not.toContain('role="button"');
    expect(list).toContain('className="vocab-row__word-button"');
    expect(list).toContain('aria-pressed={selectMode ? selected : undefined}');
    expect(list).toContain('aria-label="단어장 검색"');
    // 정렬은 칩 3개에서 레이블 있는 select로 바뀌었다(줄 수를 줄이려고).
    // 계약은 "정렬 컨트롤에 접근 가능한 이름이 있다"이지 특정 마크업이 아니다.
    expect(list).toMatch(/aria-label="정렬 순서"/);
    expect(list).toContain('aria-label={`${v.word_text} 발음 듣기`}');
  });

  it('어휘 모달은 이름·Escape·포커스 트랩·포커스 복귀·레이블 연결을 갖는다', () => {
    for (const relativePath of ['src/views/VocabList.jsx', 'src/views/VocabPage.jsx', 'src/views/VocabDetailCard.jsx']) {
      const text = source(relativePath);
      expect(text).toContain('role="dialog"');
      expect(text).toContain('aria-modal="true"');
      expect(text).toContain("event.key === 'Escape'");
      expect(text).toContain('previousFocus?.focus?.()');
    }
    expect(source('src/views/VocabList.jsx')).toContain('htmlFor="vocab-edit-word"');
    expect(source('src/views/VocabPage.jsx')).toContain('htmlFor="vocab-add-word"');
    expect(source('src/views/VocabDetailCard.jsx')).toContain('aria-label="단어 상세 닫기"');
  });

  it('어휘·문법 복습의 모드와 동적 결과가 보조기술에 전달된다', () => {
    const vocab = source('src/views/VocabReview.jsx');
    const page = source('src/views/VocabPage.jsx');
    const grammar = source('src/views/GrammarReviewSession.jsx');
    // 방식·덱 선택은 세션 시작 전(VocabPage)의 셀렉트다 — 칩 그룹에서 바꿨지만 접근 가능한 이름은 유지.
    expect(page).toContain('aria-label="복습 방식"');
    expect(page).toContain('aria-label="덱 선택"');
    // 진행 안내도 카드 안에서 상단바로 옮겼다 — 안내 자체는 유지되어야 한다.
    expect(page).toContain('role="progressbar"');
    expect(page).toContain('role="status" aria-live="polite"');
    expect(vocab).toContain('role="status" aria-live="polite"');
    expect(grammar).toContain('role="status" aria-live="polite"');
    expect(grammar).toContain('aria-controls={`grammar-review-answer-${idx}-${q.id}`}');
  });
});
