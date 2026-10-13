import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

// REV-SCOPE R1-A 배선 계약(#1337 6106712027 §5). 숫자와 줄은 같은 함수 · 같은 인자에서 나온다.
const read = path => fs.readFileSync(path, 'utf8');

describe('복습방 범위 배선', () => {
  const page = read('src/views/VocabPage.jsx');

  it('화면 숫자와 시작하는 줄이 같은 인자 하나로 계산된다', () => {
    expect(page).toContain('return { line: reviewScopeLine(args), count: countReviewScope(args), widen };');
    expect(page).toContain('count: scopeReview.count.total');
    expect(page).toMatch(/const startReview = \(\) =>\s*startSession\(\[\.\.\.session\.reviewsDue, \.\.\.session\.newAvailable\.slice\(0, session\.newToday\)\]/);
    // 덱 하나만 보던 예전 범위 장치는 남지 않는다
    expect(page).not.toContain('seriesFilter');
    expect(page).not.toContain('aria-label="덱 선택"');
  });

  it('범위 판정 하나가 예전 일정 줄과 FSRS 줄을 함께 거른다(FSRS 독점 해제는 R1-B)', () => {
    expect(page).toContain('&& scopeMatch(word)).map(word => word.id)');
    expect(page).toContain('reviewSupported(v) && scopeMatch(v)');
    expect(page).toContain("if (includeFsrs && registry.enabled && registry.ready.length) { setTab('fsrs'); return; }");
  });

  it('명시한 범위가 무효거나 못 읽으면 닫힌다 — 전체로 새지 않고 저장된 설정을 쓰지 않는다', () => {
    expect(page.match(/범위를 불러오지 못했어요\. 전체로 바꾸지 않았어요\./g)).toHaveLength(2);
    expect(page).toContain('if (request.invalid) return');
    // 닫힘 화면은 작업 공간(저장 effect)을 열기 전에 돌아간다
    expect(page.indexOf('if (request.invalid) return')).toBeLessThan(page.indexOf('<VocabWorkspace'));
    expect(page).toContain('const deckScope = useMemo(() => scopePending || scopeFailed ? [] :');
  });

  it('진입점이 모두 같은 범위 주소를 만든다', () => {
    const reader = read('src/components/books/BookReader.jsx');
    const home = read('src/components/books/BookHome.jsx');
    const viewer = read('src/views/ViewerPage.jsx');
    // 교재 도구막대 「담은 표현」 → 채점 복습방(교재 전체 과)
    expect(reader).toContain('href={bookReviewHref(bookHref(book.edition, reference ? progress.page : active || pageId))}>담은 표현</Link>');
    expect(home).toContain('href={bookReviewHref(bookHref(book.edition))}>담은 표현</Link>');
    // 교재 과 끝 「이 과 표현 복습」
    expect(reader).toContain('{ from: lesson.number, to: lesson.number })}>이 과 표현 복습 →</Link>');
    // 자료 뷰어 「이 자료 표현 복습」
    expect(viewer).toContain("src: { kind: 'material', ids: [String(id)] }");
  });

  it('이름 통일(§6-1 ⑧)', () => {
    expect(read('src/components/books/BookReview.jsx')).toContain('<h1>교재의 담은 표현');
    expect(page).toContain("['복습', scopeSourceLabel].filter(Boolean).join(' · ')");
    expect(page).not.toContain('N5 표현 복습');
    expect(page).not.toContain('‘이 예문 담기’');
    expect(read('src/views/StudySessionPage.jsx')).toContain("'+ 담기'");
  });

  it('비로그인 복습방이 계정 결과 비교에서 깨지지 않는다(undefined === undefined)', () => {
    expect(page).toContain('const currentWord = !!user && admission.current?.accountId === user.id');
    const data = read('src/lib/useVocabData.js');
    expect(data).toContain('const ownLearning = !!learning && learning.actorId === user?.id;');
    expect(data).not.toContain('learning?.actorId === user?.id ? learning.rows');
  });
});
