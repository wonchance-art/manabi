import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractReadingSections } from '../bookReadingHtml';
import { readingUnit, validReadingProgress, readingProgressKey, readingDraftKey, lessonGroups, legacyTextbookTarget } from '../bookNavigation';

const directory = 'src/content/textbookEditions/7f572327dc67893e9453246c';
const raw = readFileSync(`${directory}/index.html`, 'utf8');
const book = JSON.parse(readFileSync(`${directory}/bundle.json`, 'utf8'));
const sections = extractReadingSections(raw);
describe('continuous reading preserves the published book', () => {
  it('keeps every original web article, source id, example and exercise', () => {
    const original = [...raw.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(([html]) => html).filter(html => /data-unit-page=/.test(html.match(/^<article\b[^>]*>/)[0]));
    expect(sections).toHaveLength(413);
    expect(sections).toHaveLength(original.length);
    expect(new Set(sections.map(section => section.id)).size).toBe(sections.length);
    for (let index = 0; index < sections.length; index++) {
      const opening = original[index].match(/^<article\b[^>]*>/)[0];
      expect(sections[index].html).toBe(original[index].replace(opening, opening.replace(/\s+hidden(?:="[^"]*")?/, '')));
    }
    const text = sections.map(section => section.html).join('');
    expect((text.match(/class="examples"/g) || []).length).toBe((original.join('').match(/class="examples"/g) || []).length);
    expect((text.match(/data-save=/g) || []).length).toBe((original.join('').match(/data-save=/g) || []).length);
  });
  it('resolves all 42 lessons and every published web anchor to their containing unit', () => {
    for (const lesson of book.manuscript.lessons) {
      expect(readingUnit(lesson.id, sections)).toBe(lesson.id);
      expect(sections.filter(section => section.unit === lesson.id).length).toBeGreaterThanOrEqual(4);
    }
    for (const section of sections) for (const anchor of section.anchors) expect(readingUnit(anchor, sections)).toBe(section.unit);
    for (const culture of book.manuscript.cultures) expect(readingUnit(culture.id, sections)).toBe('materials');
    expect(readingUnit('u99', sections)).toBe(null);
  });
  it('does not accept executable HTML in a future edition', () => {
    for (const payload of ['<script>alert(1)</script>', '<img onerror="alert(1)">', '<a href="javascript:alert(1)">open</a>']) expect(() => extractReadingSections(`<article id="u01-start" data-unit-page="u01">${payload}</article>`)).toThrow('Unsafe edition HTML');
  });
});
describe('personal reading state and navigation', () => {
  it('keeps all lessons in their actual contiguous parts without changing their order', () => {
    expect(lessonGroups(book.manuscript.lessons).flatMap(group => group.lessons.map(lesson => lesson.id))).toEqual(book.manuscript.lessons.map(lesson => lesson.id));
  });
  it('separates guest, member and edition progress and answers', () => {
    for (const key of [readingProgressKey, readingDraftKey]) {
      expect(new Set([key('one'), key('one', 'alice'), key('one', 'bob'), key('two', 'alice')]).size).toBe(4);
    }
    expect(validReadingProgress({ page: 'javascript:alert(1)', completed: ['u01', 'u01', 'u42', 'u43', null] })).toEqual({ page: 'u01-start', completed: ['u01', 'u42'] });
  });
  it('only moves legacy textbooks, preserving unrelated viewer and reading routes', () => {
    for (const lang of ['japanese', 'chinese', 'english', 'french']) for (const suffix of ['', '/grammar/first', '/vocab/n5', '/bunkei/a1']) expect(legacyTextbookTarget(`/${lang}${suffix}`)).toBe(`/admin/legacy-textbooks/${lang}${suffix}`);
    for (const path of ['/lessons', '/books/japanese-n5', '/vocab', '/materials', '/japanese/reading/first', '/admin', '/viewer/42', '/assets/overworld/map.json']) expect(legacyTextbookTarget(path)).toBe(null);
  });
});
