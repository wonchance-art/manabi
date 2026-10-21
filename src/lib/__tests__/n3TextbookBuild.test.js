import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { artifactManifestFor, canonical, declaredLessonCount, escapeHtml, japaneseMarkup, renderBook, safeAssetPath, sha256, validateSource } from '../../../scripts/textbooks/build-n3-web.mjs';
import { validateArtifact, verifyDerivedArtifact } from '../../../scripts/textbooks/validate-n3-web.mjs';

const lesson = {
  id: 'u01', number: 1, part: '予定の変化', title: '계획이 달라졌어요', goal: '일정의 변화와 결정을 구별해요', scene: '친구와 모임 일정을 확인해요', prerequisite: 'N4:11',
  words: [{ ja: '予定', reading: 'よてい', ko: '예정' }],
  patterns: [{ title: '지금 정해진 것', formula: '〜ことになりました', body: '상황이나 협의로 정해진 결과를 말해요.', examples: [{ ja: '来週、集まることになりました。', ko: '다음 주에 모이기로 정해졌어요.' }] }],
  dialog: [{ role: 'A', ja: '来週、集まることになりました。', ko: '다음 주에 모이기로 정해졌어요.' }],
  oral: [{ id: '말하기 1', prompt: '결정된 일정을 말해요', cue: '来週', answer: '来週、集まることになりました。', why: '현재 합의된 일정을 전해요.' }],
  reading: '来週、集まることになりました。', reading_question: '언제 모이나요?', reading_answer: '다음 주', reading_why: '来週라고 썼어요.',
  checks: [{ id: '확인 1', prompt: '정해진 일정을 골라요', options: ['다음 주에 모여요', '오늘 모였어요'], answer: '다음 주에 모여요', why: '来週는 다음 주예요.' }],
  writing_prompt: '정해진 일을 전해요', writing_hint: '〜ことになりました', writing_check: '결정된 내용을 전했나요?', writing_sample: { ja: '来週、集まることになりました。', ko: '다음 주에 모이기로 정해졌어요.' },
};
const book = { bookId: 'japanese-n3', level: 'N3', status: 'draft', title: '구조 위험 검사 fixture', version: 'test', lessons: [lesson] };
const reviewSets = () => [8, 16, 24, 32, 40, 48].map(afterLesson => ({
  id: `review${afterLesson}`, afterLesson, title: `연결 ${afterLesson}`, scene: '배운 표현으로 답해요', kanji: { 来週: 'らいしゅう' },
  items: Array.from({ length: 3 }, (_, i) => ({ id: `연결 ${i + 1}`, prompt: '정해진 일정을 전해요', ...(i === 0 ? { options: ['다음 주', '오늘'] } : {}), answer: i === 0 ? '다음 주' : '来週、集まることになりました。', why: '확인한 일정이에요', sourceUnits: [1] })),
}));
const fullBook = () => {
  const lessons = Array.from({ length: 48 }, (_, i) => ({ ...lesson, id: `u${String(i + 1).padStart(2, '0')}`, number: i + 1 }));
  lessons[47] = { ...lessons[47], patterns: [], reviewPatterns: [lesson.patterns[0], { ...lesson.patterns[0], title: '앞에서 배운 대조 표현' }] };
  return { ...book, lessons, syllabus: { lessonCount: 48, reviewAfterLessons: [8, 16, 24, 32, 40, 48], lessons: lessons.map(({ id, number }) => ({ id, number })) }, cumulativeReview: reviewSets() };
};

const derivedFixture = () => {
  const manuscript = { ...structuredClone(book), templates: { n5StylesSha256: 'a'.repeat(64) } };
  const contentHash = sha256(JSON.stringify(canonical(manuscript))), editionId = contentHash.slice(0, 24);
  const output = renderBook(manuscript, editionId);
  const assets = { 'index.html': { sha256: sha256(output.html), bytes: Buffer.byteLength(output.html), type: 'text/html; charset=utf-8' } };
  return { html: output.html, bundle: { bookId: 'japanese-n3', manuscript, contentHash, editionId, pages: output.pages, sourceIndex: output.sourceIndex, assets, artifactManifest: artifactManifestFor(manuscript, output.pages, assets, editionId) } };
};

describe('N3 source-to-web boundaries inherited without mutating N4', () => {
  it('rejects identities from another course and incomplete/ambiguous answer keys', () => {
    expect(validateSource(book, 1)).toEqual([]);
    expect(validateSource({ ...book, bookId: 'japanese-n4' }, 1)).toContain('N3 draft identity required');
    const altered = { ...lesson, id: 'u02', checks: [{ ...lesson.checks[0], options: ['같음', '같음'] }] };
    const errors = validateSource({ ...book, lessons: [altered] }, 1).join(' ');
    expect(errors).toContain('Nonsequential'); expect(errors).toContain('ambiguous/missing exercise answer');
  });
  it('uses the declared syllabus so a representative first lesson cannot be packaged as a full book', () => {
    const input = fullBook(); input.lessons = [input.lessons[0]];
    expect(declaredLessonCount(input)).toBe(48);
    expect(validateSource(input)).toContain('Expected 48 lessons');
    expect(validateSource(input, 1)).toEqual([]);
    input.cumulativeReview = [];
    expect(validateSource(input, 1)).toEqual([]);
    expect(validateSource(input)).toContain('Cumulative review boundaries must match the syllabus');
    expect(validateSource(input, 49)).toContain('Expected lesson count must be within the declared syllabus');
  });
  it('requires the actual final lesson to review, without carrying over N4 lesson 42 as a special case', () => {
    const input = fullBook(); expect(validateSource(input)).toEqual([]);
    input.lessons[41] = { ...input.lessons[41], patterns: [], reviewPatterns: input.lessons[47].reviewPatterns };
    expect(validateSource(input)).toContain('u42: one or two new patterns required');
    input.lessons[41] = { ...lesson, id: 'u42', number: 42 };
    input.lessons[47] = { ...input.lessons[47], patterns: [lesson.patterns[0]] };
    expect(validateSource(input)).toContain('u48: final lesson must review at least two existing patterns and introduce none');
  });
  it('rejects missing, duplicate, reordered or future cumulative-review evidence', () => {
    const input = fullBook(); input.cumulativeReview[0].items[0].sourceUnits = [9];
    expect(validateSource(input)).toContain('review8: invalid/future review source unit');
    input.cumulativeReview[0].items[0].sourceUnits = [1]; input.cumulativeReview[1].id = 'review8';
    expect(validateSource(input)).toContain('Invalid/duplicate cumulative review ID: review8');
    input.cumulativeReview = reviewSets().slice(0, 5);
    expect(validateSource(input)).toContain('Cumulative review boundaries must match the syllabus');
    input.syllabus.reviewAfterLessons = [16, 8, 24, 32, 40, 48];
    expect(validateSource(input)).toContain('Explicit ordered syllabus reviewAfterLessons ending at the final lesson required');
  });
  it('keeps authored HTML inert in headings, dialogue and persisted option values', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)"> & \'')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;');
    const rendered = renderBook({ ...book, title: '<script>alert(1)</script>', lessons: [{ ...lesson, scene: '<img onerror="boom()">', checks: [{ ...lesson.checks[0], options: ['<script>bad()</script>', 'safe'] }] }] }, 'a'.repeat(24));
    expect(rendered.html).not.toContain('<img onerror'); expect(rendered.html).not.toContain('<script>bad()');
    expect(rendered.html).toContain('value="&lt;script&gt;bad()&lt;/script&gt;"');
  });
  it('uses exact compound readings without inventing kanji readings or polluting source quotes', () => {
    expect(japaneseMarkup('日本語の本', { 日本語: 'にほんご', 日本: 'にほん', 本: 'ほん' })).toBe('<ruby>日本語<rt>にほんご</rt></ruby>の<ruby>本<rt>ほん</rt></ruby>');
    expect(japaneseMarkup('午後に一人で12時', { 後: 'あと', 人: 'ひと', 時: 'じ' })).toBe('午後に一人で12時');
    const rendered = renderBook({ ...book, lessons: [{ ...lesson, kanji: { 来週: 'らいしゅう' } }] }, 'b'.repeat(24));
    expect(rendered.html).toContain('<ruby>来週<rt>らいしゅう</rt></ruby>');
    expect(rendered.sourceIndex['u01-patterns'].text).toContain('来週、集まることになりました。');
    expect(rendered.sourceIndex['u01-patterns'].text).not.toContain('来週らいしゅう');
  });
  it('applies supplied readings to authored titles and role labels as well as prose', () => {
    const input = { ...book, lessons: [{ ...lesson, title: '来週の予定', roles: ['美央'], kanji: { 来週: 'らいしゅう', 予定: 'よてい', 美央: 'みお' }, dialog: [{ ...lesson.dialog[0], role: '美央' }] }] };
    const rendered = renderBook(input, 'c'.repeat(24));
    expect(rendered.html).toContain('<h2><ruby>来週<rt>らいしゅう</rt></ruby>の<ruby>予定<rt>よてい</rt></ruby></h2>');
    expect(rendered.html).toContain('<b><ruby>美央<rt>みお</rt></ruby></b>');
    expect(rendered.sourceIndex['u01-dialogue'].text).not.toContain('美央みお');
  });
  it('preserves the four-section reading/quote contract, support tables and final-review placement deterministically', () => {
    const input = fullBook(); input.lessons[0] = { ...input.lessons[0], study_pages: [{ title: '접속 도움', lead: '형태를 확인해요', rows: [{ label: '동사', ja: '行くことになりました', ko: '가기로 정해졌어요' }] }], reading_lead: '이 글은 모임의 안내예요' };
    const hash = sha256(JSON.stringify(canonical(input))).slice(0, 24), first = renderBook(input, hash);
    expect(first).toEqual(renderBook(input, hash));
    expect(first.pages).toHaveLength(48 * 4 + 2);
    expect(first.sourceIndex['u01-patterns'].text).toContain('접속 도움');
    expect(first.sourceIndex['u01-practice'].text).toContain('이 글은 모임의 안내예요');
    expect(first.sourceIndex['u08-practice'].text).toContain('연결해서 써요');
    expect(first.sourceIndex['u07-practice'].text).not.toContain('연결해서 써요');
    expect(first.html).toContain('data-save="u08-review8-1"');
    expect(first.sourceIndex['u48-patterns'].text).toContain('새 문형 0개');
    expect(first.sourceIndex['u42-patterns'].text).not.toContain('새 문형 0개');
    expect(first.html).not.toMatch(/\/api\/|<audio\b|<iframe\b/);
  });
  it('rejects traversal, absolute paths, empty segments and prototype-property asset names', () => {
    for (const name of ['../index.html', '/index.html', 'fonts//JP.woff', 'fonts/./JP.woff', '__proto__', 'constructor', 'fonts/toString']) expect(safeAssetPath(name)).toBe(false);
    for (const name of ['index.html', 'fonts/JP.woff', 'font-licenses/NotoCJK-system-copyright.txt']) expect(safeAssetPath(name)).toBe(true);
  });
  it('binds metadata, source references, syllabus and rendering provenance into the canonical identity', () => {
    const hash = value => sha256(JSON.stringify(canonical(value)));
    expect(hash({ a: 1, b: 2 })).toBe(hash({ b: 2, a: 1 }));
    for (const delta of [{ meta: { purpose: 'new' } }, { sourceReferences: ['new'] }, { syllabus: { lessonCount: 48 } }, { templates: { fontSourceHashes: { font: 'new' } } }]) expect(hash({ ...book, ...delta })).not.toBe(hash(book));
  });
  it('does not allow source-declared one-unit data to shrink the registered N3 release', () => {
    const reduced = { ...book, syllabus: { lessonCount: 1, lessons: [{ id: 'u01', number: 1 }] } };
    expect(validateSource(reduced)).toContain('Expected 48 lessons');
    const changedReviews = fullBook();
    changedReviews.syllabus.reviewAfterLessons = [16, 32, 48];
    changedReviews.cumulativeReview = changedReviews.cumulativeReview.filter(review => [16, 32, 48].includes(review.afterLesson));
    expect(validateSource(changedReviews)).toContain('Full N3 release must match the registered lesson count and cumulative boundaries');
  });
  it.each([
    ['web revision', bundle => { bundle.artifactManifest.webContentRevision = '0'.repeat(24); }, 'Derived artifact manifest/provenance mismatch'],
    ['page title', bundle => { bundle.pages[0].title = 'Unreviewed replacement'; }, 'Derived page metadata mismatch'],
    ['CSS provenance', bundle => { bundle.artifactManifest.inheritedVisuals.cssSha256 = '0'.repeat(64); }, 'Derived artifact manifest/provenance mismatch'],
    ['source quote', bundle => { bundle.sourceIndex['u01-practice'].text = 'Unreviewed replacement'; }, 'Derived source index mismatch'],
  ])('rejects a changed %s even when the HTML asset and prior receipt identities are unchanged', (_name, change, expectedError) => {
    const fixture = derivedFixture(); expect(verifyDerivedArtifact(fixture.bundle, fixture.html)).toEqual([]);
    const before = { contentHash: fixture.bundle.contentHash, bundleHash: fixture.bundle.artifactManifest.bundleHash };
    change(fixture.bundle);
    expect({ contentHash: fixture.bundle.contentHash, bundleHash: fixture.bundle.artifactManifest.bundleHash }).toEqual(before);
    expect(verifyDerivedArtifact(fixture.bundle, fixture.html)).toContain(expectedError);
  });
  it('rejects a freshly rehashed manuscript that silently keeps an old rendered reading', () => {
    const fixture = derivedFixture(); fixture.bundle.manuscript.lessons[0].reading = '今日は集まりません。';
    fixture.bundle.contentHash = sha256(JSON.stringify(canonical(fixture.bundle.manuscript))); fixture.bundle.editionId = fixture.bundle.contentHash.slice(0, 24);
    const errors = verifyDerivedArtifact(fixture.bundle, fixture.html);
    expect(errors).toContain('Rendered HTML differs from the exact manuscript/template/revision');
    expect(errors).toContain('Derived source index mismatch');
  });
  it('never reads a suffix inside a numeric kanji compound as an independent time', () => {
    expect(japaneseMarkup('13時', { '3時': 'さんじ' })).toBe('13時');
    expect(japaneseMarkup('１３時', { '３時': 'さんじ' })).toBe('１３時');
    expect(japaneseMarkup('13時', { '13時': 'じゅうさんじ', '3時': 'さんじ' })).toBe('<ruby>13時<rt>じゅうさんじ</rt></ruby>');
  });
  it('collects glyph requests from actual product attributes and runtime messages, beyond tag-stripped body text', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'manabi-n3-glyph-request-'));
    try {
      fs.writeFileSync(path.join(directory, 'index.html'), '<p>本</p><input placeholder="約束 · やくそく · 약속" title="聲"><img alt="図"><button aria-label="読"></button><input value="選">');
      fs.writeFileSync(path.join(directory, 'app.js'), "const failure = '失敗';");
      const result = JSON.parse(execFileSync('python3', ['scripts/textbooks/prepare-n3-fonts.py', '--out', directory, '--inspect-text'], { encoding: 'utf8' }));
      for (const glyph of '本約束や속聲図読選失敗') expect(result.codepoints).toContain(glyph.codePointAt(0));
      expect(result.codepoints).not.toContain('🧠'.codePointAt(0));
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });

  it('rejects artifact symlinks before opening even the bundle JSON', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'manabi-n3-symlink-'));
    try {
      fs.writeFileSync(path.join(directory, 'canary.txt'), 'PUBLIC_SYNTHETIC_CANARY');
      const artifact = path.join(directory, 'artifact'); fs.mkdirSync(artifact);
      fs.symlinkSync('../canary.txt', path.join(artifact, 'bundle.json'));
      const failure = await validateArtifact(artifact).then(() => null, error => error.message);
      expect(failure).toContain('Symlink rejected: bundle.json');
      expect(failure).not.toContain('CANARY');
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
  it('rejects special files in artifact preflight without blocking on an attempted FIFO read', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'manabi-n3-fifo-'));
    try {
      execFileSync('mkfifo', [path.join(directory, 'bundle.json')]);
      await expect(validateArtifact(directory)).rejects.toThrow('Regular file required: bundle.json');
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });

});
