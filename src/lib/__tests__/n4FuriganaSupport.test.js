import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { japaneseMarkup, renderBook } from '../../../scripts/textbooks/build-n4-web.mjs';

const root = path.resolve(import.meta.dirname, '../../content/textbookManuscripts/japanese-n4');
const book = JSON.parse(fs.readFileSync(path.join(root, 'book.json'), 'utf8'));
book.lessons = fs.readdirSync(path.join(root, 'lessons')).filter(name => /^u\d{2}\.json$/.test(name)).sort()
  .map(name => JSON.parse(fs.readFileSync(path.join(root, 'lessons', name), 'utf8')));
const withoutRuby = html => html.replace(/<ruby>[\s\S]*?<\/ruby>/g, '');
const missingHan = (text, kanji) => withoutRuby(japaneseMarkup(text, kanji)).match(/\p{Script=Han}/gu) || [];
const rendered = renderBook(book, 'a'.repeat(24));
const article = id => rendered.html.match(new RegExp(`<article\\b[^>]* id="${id}"[\\s\\S]*?<\\/article>`))?.[0] || '';
const ruby = (text, reading) => `<ruby>${text}<rt>${reading}</rt></ruby>`;

function supportStrings(value, output = [], field = '') {
  if (typeof value === 'string') output.push({ field, text: value });
  else if (Array.isArray(value)) value.forEach((item, index) => supportStrings(item, output, `${field}.${index}`));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      // An explicit whole-sentence/word reading is displayed separately by ja().
      if (['kanji', 'id', 'reading'].includes(key) || (key === 'ja' && value.reading)) continue;
      supportStrings(item, output, `${field}.${key}`);
    }
  }
  return output;
}

describe('N4 authored reading support', () => {
  it('requires a complete known compound instead of guessing component readings', () => {
    expect(japaneseMarkup('午後五時', { 午後: 'ごご', 五時: 'ごじ', 後: 'あと', 時: 'とき' })).toBe('午後五時');
    expect(japaneseMarkup('午後五時', { 午後五時: 'ごごごじ', 後: 'あと', 時: 'とき' })).toBe(ruby('午後五時', 'ごごごじ'));
    expect(japaneseMarkup('日本人・一人・12時', { 日本: 'にほん', 人: 'ひと', 時: 'じ' })).toBe('日本人・一人・12時');
  });

  it('covers the actual 42 reading texts with explicit readings for every Han character', () => {
    const uncovered = book.lessons.filter(lesson => missingHan(lesson.reading, lesson.kanji).length)
      .map(lesson => lesson.id);
    expect(book.lessons).toHaveLength(42);
    expect(uncovered).toEqual([]);
  });

  it('covers every Japanese learning and answer field without relying on a global dictionary', () => {
    const fields = ['goal', 'words', 'patterns', 'reviewPatterns', 'study_pages', 'dialog', 'oral', 'checks', 'preparation',
      'prerequisite', 'listen_question', 'listen_answer', 'listen_why', 'listen_choices', 'reading_question',
      'reading_answer', 'reading_why', 'writing_hint', 'writing_sample', 'writing_check', 'culture'];
    const uncovered = book.lessons.flatMap(lesson => fields.flatMap(field => supportStrings(lesson[field], [], field))
      .filter(item => missingHan(item.text, lesson.kanji).length)
      .map(item => `${lesson.id}:${item.field}:${item.text}`));
    expect(uncovered).toEqual([]);
  });

  it('covers the six cumulative review sets and the N5 bridge examples', () => {
    const uncovered = book.cumulativeReview.flatMap(review => {
      const lesson = book.lessons.find(item => item.number === review.afterLesson);
      const kanji = { ...lesson.kanji, ...review.kanji };
      return supportStrings(review).filter(item => missingHan(item.text, kanji).length)
        .map(item => `${review.id}:${item.field}`);
    });
    uncovered.push(...supportStrings(book.frontMatter).filter(item => missingHan(item.text, book.kanji).length)
      .map(item => `guide:${item.field}`));
    expect(book.cumulativeReview).toHaveLength(6);
    expect(uncovered).toEqual([]);
  });

  it('renders reading support in questions, oral cues, answers, explanations and writing hints', () => {
    const practice = article('u29-practice');
    const dialogue = article('u29-dialogue');
    expect(practice.match(/<fieldset[\s\S]*?<\/fieldset>/)?.[0]).toContain(ruby('五時', 'ごじ'));
    expect(practice.match(/<p class="hint"[\s\S]*?<\/p>/)?.[0]).toContain(ruby('金曜日', 'きんようび'));
    expect(practice).toContain(ruby('午後五時', 'ごごごじ'));
    expect(dialogue.match(/<p class="cue">[\s\S]*?<\/p>/)?.[0]).toContain(ruby('五時', 'ごじ'));
    expect(dialogue.match(/<summary>말하기 1[\s\S]*?<\/details>/)?.[0]).toContain(ruby('申込書', 'もうしこみしょ'));
    expect(article('u30-patterns')).toContain(ruby('昨日買った', 'きのうかった'));
    expect(article('u40-dialogue')).toContain(ruby('落ち着い', 'おちつい'));
    expect(article('u06-start').match(/<p class="goal">[\s\S]*?<\/p>/)?.[0]).toContain(ruby('聞こえる', 'きこえる'));
    expect(article('u09-start').match(/<p class="goal">[\s\S]*?<\/p>/)?.[0]).toContain(ruby('予定', 'よてい'));
  });

  it('keeps source identity and answer values unchanged when reading maps are removed', () => {
    const plain = structuredClone(book);
    plain.kanji = {};
    plain.lessons.forEach(lesson => { lesson.kanji = {}; });
    plain.cumulativeReview.forEach(review => { review.kanji = {}; });
    const withoutReadings = renderBook(plain, 'a'.repeat(24));
    expect(rendered.sourceIndex).toEqual(withoutReadings.sourceIndex);
    const values = html => [...html.matchAll(/data-save="([^"]+)" value="([^"]*)"/g)].map(match => match.slice(1));
    expect(values(rendered.html)).toEqual(values(withoutReadings.html));
  });

  it('keeps authored surface text and readings escaped', () => {
    const result = japaneseMarkup('<入口>&', { 入口: '<img src=x onerror=alert(1)>' });
    expect(result).toBe('&lt;<ruby>入口<rt>&lt;img src=x onerror=alert(1)&gt;</rt></ruby>&gt;&amp;');
    expect(result).not.toContain('<img');
  });
});
