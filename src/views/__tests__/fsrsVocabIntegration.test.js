import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import FsrsReviewSession from '../../components/vocab/FsrsReviewSession';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

vi.mock('../../components/learning/VocabularyContexts', () => ({ default: () => null }));
const controller = { question() {}, reveal() {}, grade() {}, undo() {}, refresh() {}, leave() {} };
const review = { busy: false, ready: [], registryAvailable: true, enabled: true, completed: 0, controller,
  current: { phase: 'question', attempt: { id: 'attempt' }, word: { id: 'one', word_text: '你好', meaning: '안녕하세요' } } };

describe('FSRS personal review surface', () => {
  it('question HTML never exposes the meaning, and the bottom grading bar stays locked until reveal', () => {
    // REV-SCOPE-R1B-1 §5-3: 채점 막대는 하단 고정이고 뒷면 전엔 잠금(두 번 탭 오채점 방지). 잠긴 버튼은 누를 수 없다.
    const html = renderToStaticMarkup(createElement(FsrsReviewSession, { review, onExit() {} }));
    expect(html).toContain('你好');
    expect(html).toContain('정답 확인하기');
    expect(html).not.toContain('안녕하세요');
    expect(html).not.toContain('nǐ');
    const buttons = html.match(/<button[^>]*class="review-score-btn[^"]*"[^>]*>/g) || [];
    expect(buttons).toHaveLength(4);
    for (const button of buttons) expect(button).toContain('disabled=""');
    expect(html).toContain('review-grade-bar is-locked');
  });
  it('revealed HTML preserves four labels/classes/order and forces a single row at every width', () => {
    const html = renderToStaticMarkup(createElement(FsrsReviewSession, { review: { ...review,
      current: { ...review.current, phase: 'revealed', previews: {}, previewAt: '2026-10-03T00:00:00Z' } }, onExit() {} }));
    expect(html).toContain('안녕하세요');
    expect(html.match(/review-score-btn review-score-btn--[a-z]+/g)).toEqual([
      'review-score-btn review-score-btn--again', 'review-score-btn review-score-btn--hard',
      'review-score-btn review-score-btn--good', 'review-score-btn review-score-btn--easy',
    ]);
    expect(html).toMatch(/다시[\s\S]*어려움[\s\S]*알맞음[\s\S]*쉬움/);
    expect(html).toContain('grid-template-columns:repeat(4, minmax(0, 1fr))');
  });
  it('all three legacy mutations on the personal page guard enrolled IDs', () => {
    const source = readFileSync(new URL('../VocabPage.jsx', import.meta.url), 'utf8');
    for (const handler of ['handleScore', 'handleSkip', 'undoLastGrade']) {
      const body = sliceBetween(source, `const ${handler} =`, '\n  };');
      expect(body).toContain('fsrsReview.controller.canLegacy(');
    }
    // REV-SCOPE-R1B-1: FSRS 독점 해제 — 「FSRS 카드가 있으면 세션 전체를 FSRS 탭으로」가 없고, 새 일정 카드는 섞인 줄 안에서 연다.
    expect(source).not.toContain("setTab('fsrs')");
    expect(source).toContain('<FsrsReviewSession review={fsrsReview} embedded cardId={currentStep.id}');
    // REV-SCOPE-R1A: 오늘 줄 계산은 countReviewScope로 옮겼고, 등록 id 가드는 그 canLegacy 입력으로 넘긴다.
    expect(source).toContain('canLegacy: id => !fsrsReview.enrolledIds.includes(id) && fsrsReview.controller.canLegacy(id)');
  });
  it('active manual save uses one atomic command and only confirmed disabled mode retains legacy insert', () => {
    const source = readFileSync(new URL('../VocabPage.jsx', import.meta.url), 'utf8');
    const manual = sliceBetween(source, 'const manualAddMutation', 'manualAddPendingRef.current =');
    expect(manual).toContain('await fsrsReview.controller.refresh()');
    const active = sliceBetween(manual, 'if (fsrsReview.controller.getSnapshot().enabled)', 'const row =');
    expect(active).toContain('return fsrsReview.controller.saveVocabulary(vocabulary)');
    expect(active).not.toContain('supabase');
    expect(manual).toContain('ignoreDuplicates: true');
    expect(manual).not.toContain('enrollInserted(');
    expect(manual).not.toContain('ease_factor:');
    expect(manual).not.toContain('last_reviewed_at:');
    expect(manual).toContain('result?.ok !== true');
    expect(manual.indexOf('result?.ok !== true')).toBeLessThan(manual.indexOf('setManualAddOpen(false)'));
  });
});
