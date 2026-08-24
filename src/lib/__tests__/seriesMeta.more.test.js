import { describe, expect, it } from 'vitest';
import { findNextInSeries, parseTitle } from '../seriesMeta';

describe('parseTitle additional contracts', () => {
  it.each([
    [null, { level: null, series: null, num: null, display: '' }],
    ['', { level: null, series: null, num: null, display: '' }],
    [12, { level: null, series: null, num: null, display: 12 }],
    ['plain', { level: null, series: null, num: null, display: 'plain' }],
    ['[N5] title', { level: 'N5', series: null, num: null, display: 'title' }],
    ['[A1 grammar #007] title ', { level: 'A1', series: 'grammar', num: 7, display: 'title' }],
    ['[N5 문법] 제목', { level: 'N5', series: '문법', num: null, display: '제목' }],
    ['[N5 문법 #2]', { level: 'N5', series: '문법', num: 2, display: '' }],
  ])('parses %j', (input, expected) => expect(parseTitle(input)).toEqual(expected));
});

describe('findNextInSeries additional contracts', () => {
  const rows = [
    { id: 'later', title: '[N5 문법 #5] later' },
    { id: 'next', title: '[N5 문법 #3] next' },
    { id: 'other', title: '[A1 문법 #3] other' },
  ];
  it('finds the nearest greater number independent of input order', () => {
    expect(findNextInSeries({ level: 'N5', series: '문법', num: 2 }, rows)?.id).toBe('next');
  });
  it.each([null, {}, { level: 'N5', series: '문법' }, { level: 'N5', num: 2 }])('rejects incomplete metadata %j', (meta) => {
    expect(findNextInSeries(meta, rows)).toBeNull();
  });
  it('returns null when only previous entries exist', () => {
    expect(findNextInSeries({ level: 'N5', series: '문법', num: 9 }, rows)).toBeNull();
  });
});
