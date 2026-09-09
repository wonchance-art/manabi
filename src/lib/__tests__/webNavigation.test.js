import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAIN_NAV, navigationOwner, bookResume, recentMaterial, chooseResume } from '../webNavigation';
import { validReadingProgress, readingProgressKey } from '../bookNavigation';
const published = JSON.parse(readFileSync('src/content/textbookEditions/7f572327dc67893e9453246c/bundle.json', 'utf8'));
const book = { lessons: published.manuscript.lessons };

describe('approved navigation and current edition resume', () => {
  it('has five unique destinations and assigns nested reading routes without prefix collisions', () => {
    expect(MAIN_NAV.map(item => item.label)).toEqual(['오늘', '교재', '발견', '복습', '내 서재']);
    expect(new Set(MAIN_NAV.map(item => item.href)).size).toBe(5);
    for (const item of MAIN_NAV) expect(navigationOwner(item.href)).toBe(item.href);
    expect(navigationOwner('/books/japanese-n5')).toBe('/lessons');
    expect(navigationOwner('/studies/france/fr-culture')).toBe('/discover');
    expect(navigationOwner('/viewer/a-material')).toBe('/materials');
    expect(navigationOwner('/study')).toBe('/vocab');
    expect(navigationOwner('/materials-other')).toBe(null);
    expect(navigationOwner('/admin')).toBe(null);
  });
  it('uses all 42 published lessons, exact source anchors, and explicit completion only', () => {
    const progress = validReadingProgress({ page: 'u29-study2', completed: ['u01', 'u01', 'u29', 'n5-04-desu-da'] });
    const result = bookResume(book, progress, true);
    expect(result).toMatchObject({ page: 'u29-study2', started: true, completed: 2, total: 42 });
    expect(result.lesson).toMatchObject({ id: 'u29' });
    expect(bookResume(book, { page: 'u01-start', completed: [] }, false).started).toBe(false);
    expect(bookResume(book, { page: 'u01-start', completed: [] }, true).started).toBe(true);
    expect(bookResume(book, { page: 'u100-start', completed: ['old-unit'] }, true)).toMatchObject({ page: 'u01-start', started: false, completed: 0 });
    expect(bookResume(null, progress)).toBe(null);
  });
  it('never shares local records across accounts or editions', () => {
    expect(new Set([readingProgressKey('one', 'a'), readingProgressKey('one', 'b'), readingProgressKey('two', 'a'), readingProgressKey('one')]).size).toBe(4);
  });
  it('skips completed, deleted and inaccessible materials, and compares actual timestamps', () => {
    const row = { is_completed: false, updated_at: '2026-09-06T01:00:00Z', reading_materials: { id: 'mine', title: '실제 읽던 글' } };
    expect(recentMaterial([{ ...row, is_completed: true }, { ...row, reading_materials: null }, row])).toBe(row);
    expect(recentMaterial([])).toBe(null);
    expect(chooseResume({ started: false }, null, row)).toBe('material');
    expect(chooseResume({ started: true }, '2026-09-06T00:00:00Z', row)).toBe('material');
    expect(chooseResume({ started: true }, '2026-09-06T02:00:00Z', row)).toBe('book');
    expect(chooseResume({ started: true }, null, row)).toBe('book');
    expect(chooseResume(null, null, null)).toBe(null);
  });
});
