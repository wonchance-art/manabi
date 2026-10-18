import { describe, expect, it } from 'vitest';
import { canonical, escapeHtml, japaneseMarkup, renderBook, sha256, validateSource } from '../../../scripts/textbooks/build-n4-web.mjs';

const lesson = {
  id: 'u01', number: 1, part: '설명', title: '사정 설명', goal: '설명해요', scene: '친구와 대화해요', prerequisite: '보통형',
  words: [{ ja: '電車', reading: 'でんしゃ', ko: '전철' }],
  patterns: [{ title: '설명', formula: '〜んです', body: '사정을 설명해요.', examples: [{ ja: '電車が遅れたんです。', ko: '전철이 늦었어요.' }] }],
  dialog: [{ role: 'A', ja: '電車が遅れたんです。', ko: '전철이 늦었어요.' }],
  oral: [{ id: '말하기 1', prompt: '사정을 말해요', cue: '電車', answer: '電車が遅れたんです。', why: '사정을 설명해요.' }],
  reading: '電車が遅れました。', reading_question: '무엇이 늦었나요?', reading_answer: '전철', reading_why: '電車라고 썼어요.',
  checks: [{ id: '확인 1', prompt: '문장의 뜻을 골라요', options: ['전철이 늦었어요', '버스가 빨라요'], answer: '전철이 늦었어요', why: '電車는 전철이에요.' }],
  writing_prompt: '사정을 말해요', writing_hint: '〜んです', writing_check: '사정을 말했나요?', writing_sample: { ja: '電車が遅れたんです。', ko: '전철이 늦었어요.' },
};
const book = { bookId: 'japanese-n4', level: 'N4', status: 'draft', title: '계약 검사 fixture', version: 'test', lessons: [lesson] };
const reviewSets = () => [7, 14, 21, 28, 35, 42].map(afterLesson => ({
  id: `review${afterLesson}`, afterLesson, title: `연결 ${afterLesson}`, scene: '배운 표현으로 답해요', kanji: { 電車: 'でんしゃ' },
  items: Array.from({ length: 3 }, (_, i) => ({ id: `연결 ${i + 1}`, prompt: '電車의 사정을 설명해요', ...(i === 0 ? { options: ['늦었어요', '아니에요'] } : {}), answer: i === 0 ? '늦었어요' : '電車が遅れたんです。', why: '배운 설명을 연결했어요', sourceUnits: [1] })),
}));

describe('N4 source-to-web publication boundaries', () => {
  it('escapes all authored HTML and never turns source text into executable markup', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)"> & \'')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;');
    const rendered = renderBook({ ...book, title: '<script>alert(1)</script>', lessons: [{ ...lesson, scene: '<img onerror="boom()">' }] }, 'a'.repeat(24));
    expect(rendered.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(rendered.html).not.toContain('<img onerror');
  });
  it('rejects a mismatched answer, duplicate options and broken lesson sequence', () => {
    expect(validateSource(book, 1)).toEqual([]);
    const altered = { ...lesson, id: 'u02', checks: [{ ...lesson.checks[0], options: ['같음', '같음'] }] };
    const errors = validateSource({ ...book, lessons: [altered] }, 1).join(' ');
    expect(errors).toContain('Nonsequential'); expect(errors).toContain('ambiguous/missing exercise answer');
    expect(validateSource({ ...book, bookId: 'japanese-n5' }, 1)).toContain('N4 draft identity required');
  });
  it('creates deterministic sections with exact lesson-source identity and draft limits', () => {
    const revision = sha256(JSON.stringify(canonical(book))).slice(0, 24);
    const first = renderBook(book, revision), second = renderBook(book, revision);
    expect(first).toEqual(second);
    expect(first.pages.map(page => page.id)).toEqual(['cover', 'u01-start', 'u01-patterns', 'u01-dialogue', 'u01-practice', 'reference-start']);
    expect(first.sourceIndex['u01-patterns']).toMatchObject({ lesson: 1 });
    expect(first.sourceIndex['u01-patterns'].text).toContain('電車が遅れたんです。');
    expect(first.html).toContain('대화 대본 확인(음성 미제작)');
    expect(first.html).not.toMatch(/\/api\/|<audio\b|<iframe\b/);
    expect(first.html).toContain('data-save="u01-check-1"');
  });
  it('hashes editorial content, metadata, source references and syllabus together', () => {
    const hash = value => sha256(JSON.stringify(canonical(value)));
    expect(hash({ a: 1, b: 2 })).toBe(hash({ b: 2, a: 1 }));
    expect(hash({ ...book, meta: { purpose: 'a' } })).not.toBe(hash({ ...book, meta: { purpose: 'b' } }));
    expect(hash({ ...book, sourceReferences: ['a'] })).not.toBe(hash({ ...book, sourceReferences: ['b'] }));
    expect(hash({ ...book, syllabus: [1] })).not.toBe(hash({ ...book, syllabus: [2] }));
  });
  it('prefers the longest supplied reading and excludes ruby from source identity', () => {
    expect(japaneseMarkup('日本語の本', { 日本語: 'にほんご', 日本: 'にほん', 本: 'ほん' })).toBe('<ruby>日本語<rt>にほんご</rt></ruby>の<ruby>本<rt>ほん</rt></ruby>');
    const rendered = renderBook({ ...book, lessons: [{ ...lesson, kanji: { 電車: 'でんしゃ' } }] }, 'b'.repeat(24));
    expect(rendered.html).toContain('<ruby>電車<rt>でんしゃ</rt></ruby>');
    expect(rendered.sourceIndex['u01-patterns'].text).toContain('電車が遅れたんです。');
    expect(rendered.sourceIndex['u01-patterns'].text).not.toContain('電車でんしゃ');
    expect(japaneseMarkup('午後', { 後: 'あと' })).toBe('午後');
    expect(japaneseMarkup('一人', { 人: 'ひと' })).toBe('一人');
    expect(japaneseMarkup('12時', { 時: 'じ' })).toBe('12時');
    expect(japaneseMarkup('日本人', { 日本: 'にほん', 人: 'ひと' })).toBe('日本人');
    expect(japaneseMarkup('午後に一人', { 午後: 'ごご', 後: 'あと', 一人: 'ひとり', 人: 'ひと' })).toBe('<ruby>午後<rt>ごご</rt></ruby>に<ruby>一人<rt>ひとり</rt></ruby>');
  });
  it('renders authored support tables and reading context instead of silently dropping them', () => {
    const rendered = renderBook({ ...book, lessons: [{ ...lesson, study_pages: [{ title: '形の助け', lead: '접속을 확인해요', rows: [{ label: '명사', ja: '学生なんです', ko: '학생이에요' }], note: 'だ를 붙이지 않아요' }], reading_lead: '이 글은 모임의 안내예요' }] }, 'c'.repeat(24));
    expect(rendered.html).toContain('形の助け'); expect(rendered.html).toContain('学生なんです');
    expect(rendered.html).toContain('이 글은 모임의 안내예요');
  });
  it('accepts the final cumulative task with existing patterns and no new grammar', () => {
    const lessons = Array.from({ length: 42 }, (_, index) => ({ ...lesson, id: `u${String(index + 1).padStart(2, '0')}`, number: index + 1 }));
    lessons[41] = { ...lessons[41], patterns: [], reviewPatterns: [lesson.patterns[0], { ...lesson.patterns[0], title: '이전에 배운 표현' }] };
    expect(validateSource({ ...book, lessons, cumulativeReview: reviewSets() }, 42)).toEqual([]);
    const rendered = renderBook({ ...book, lessons, cumulativeReview: reviewSets() }, 'd'.repeat(24));
    expect(rendered.html).toContain('새 문형 0개 · 지금까지 배운 표현으로 누적 수행해요.');
    lessons[40] = { ...lessons[40], patterns: [], reviewPatterns: lessons[41].reviewPatterns };
    expect(validateSource({ ...book, lessons }, 42)).toContain('u41: missing patterns');
  });
  it('places cumulative reviews after the assigned lesson with unique persisted keys and valid sources', () => {
    const lessons = Array.from({ length: 7 }, (_, index) => ({ ...lesson, id: `u${String(index + 1).padStart(2, '0')}`, number: index + 1 }));
    const cumulativeReview = reviewSets();
    const input = { ...book, lessons, cumulativeReview };
    expect(validateSource(input, 7)).toEqual([]);
    const rendered = renderBook(input, 'e'.repeat(24));
    expect(rendered.sourceIndex['u07-practice'].text).toContain('연결해서 써요');
    expect(rendered.sourceIndex['u06-practice'].text).not.toContain('연결해서 써요');
    expect(rendered.html).toContain('data-save="u07-review7-1"');
    expect(rendered.html).toContain('data-save="u07-review7-2"');
    expect(rendered.html).not.toContain('data-save="u07-review14-1"');
    expect(rendered.html).toContain('<ruby>電車<rt>でんしゃ</rt></ruby>');
    expect(rendered.sourceIndex['u07-practice'].text).not.toContain('電車でんしゃ');
    cumulativeReview[0].items[0].sourceUnits = [8];
    expect(validateSource(input, 7)).toContain('review7: invalid/future review source unit');
    cumulativeReview[1].id = cumulativeReview[0].id;
    expect(validateSource(input, 7)).toContain('Invalid/duplicate cumulative review ID: review7');
  });
});
