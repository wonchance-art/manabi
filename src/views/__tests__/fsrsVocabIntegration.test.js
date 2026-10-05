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
  it('question HTML never exposes the meaning or grading controls', () => {
    const html = renderToStaticMarkup(createElement(FsrsReviewSession, { review, onExit() {} }));
    expect(html).toContain('你好');
    expect(html).toContain('정답 확인하기');
    expect(html).not.toContain('안녕하세요');
    expect(html).not.toContain('review-score-btn');
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
    expect(source).toContain("tab === 'fsrs'");
    expect(source).toContain('fsrsReview.enrolledIds.includes(v.id)');
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
