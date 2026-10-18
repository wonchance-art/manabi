import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { MAIN_NAV, navigationOwner, bookResume, recentMaterial, chooseResume } from '../webNavigation';
import { validReadingProgress, readingProgressKey } from '../bookNavigation';
import { sliceBetween } from './helpers/sliceBetween';
const published = JSON.parse(readFileSync('src/content/textbookEditions/7f572327dc67893e9453246c/bundle.json', 'utf8'));
const book = { lessons: published.manuscript.lessons };

describe('approved navigation and current edition resume', () => {
  it('has four menus in the approved order and assigns nested routes without prefix collisions', () => {
    // 메뉴 넷: 배움 · 대화 · 서재 · 산책(오너 확정 목업 2026-10-09 + 대화 오픈 지시 2026-10-15).
    expect(MAIN_NAV.map(item => item.label)).toEqual(['배움', '대화', '서재', '산책']);
    expect(MAIN_NAV.map(item => item.href)).toEqual(['/home', '/conversation/new', '/materials', '/discover']);
    expect(new Set(MAIN_NAV.map(item => item.href)).size).toBe(4);
    // 대화 메뉴 = 새 대화 화면(주제 · 이어서 하기). 대화 경로 안에서는 대화 메뉴에 불이 들어온다.
    expect(existsSync('src/app/(app)/conversation/new/page.jsx')).toBe(true);
    expect(navigationOwner('/conversation')).toBe('/conversation/new');
    expect(navigationOwner('/conversation-other')).toBe(null);
    for (const item of MAIN_NAV) expect(navigationOwner(item.href)).toBe(item.href);
    // 메뉴에서 빠진 교재 · 복습 · 학습 경로는 배움 소속이다(정정 2026-10-11) — 어느 메뉴에도 불이 안 들어오는 화면이 없게.
    for (const path of ['/vocab', '/vocab?lang=Chinese', '/review/grammar', '/study', '/learn/course', '/lessons', '/books/japanese-n5', '/progress', '/writing']) {
      expect(navigationOwner(path.split('?')[0]), path).toBe('/home');
    }
    expect(navigationOwner('/study/library')).toBe('/materials');
    expect(navigationOwner('/studies/france/fr-culture')).toBe('/discover');
    expect(navigationOwner('/viewer/a-material')).toBe('/materials');
    expect(navigationOwner('/groups')).toBe('/materials');
    expect(navigationOwner('/quick')).toBe('/materials'); // 빠른 분석 → 자료로 저장(서재)
    expect(navigationOwner('/writing-other')).toBe(null);
    expect(navigationOwner('/quickly')).toBe(null);
    expect(navigationOwner('/vocabulary-other')).toBe(null);
    expect(navigationOwner('/materials-other')).toBe(null);
    expect(navigationOwner('/admin')).toBe(null);
  });
  it('keeps /lessons and /vocab as live routes even though they left the menu', () => {
    for (const route of ['lessons', 'vocab']) expect(existsSync(`src/app/(app)/${route}/page.jsx`), route).toBe(true);
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

  it('집중 읽기 메뉴도 지금 위치를 표시한다 — 뷰어에서 기본 메뉴가 숨어도 「서재」에 불(M09 6155101880)', () => {
    expect(navigationOwner('/viewer/301')).toBe('/materials');
    const layout = readFileSync('src/components/Layout.jsx', 'utf8');
    const reader = sliceBetween(layout, 'function ReaderSiteMenu', 'export default function Layout');
    expect(reader).toContain("aria-current={navigationOwner(pathname) === item.href ? 'page' : undefined}");
    expect(readFileSync('src/components/web/focused-reader.css', 'utf8')).toContain('.reader-site-menu nav a[aria-current="page"]');
  });
});
