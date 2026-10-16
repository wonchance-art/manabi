import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  createStandardEbooksDraft, parseStandardEbooksXhtml, SE_PROVIDER, splitBlocksByWords, standardEbooksBookKey,
  standardEbooksRightsPublishable, standardEbooksRightsVerdict, wordCount,
} from '../standardEbooks.js';
import { buildStandardEbooks, STANDARD_EBOOKS_ROOT } from '../../../scripts/lib/standard-ebooks-build.mjs';
import { STANDARD_EBOOKS_BOOKS } from '../../content/literature/standardebooks/index.generated.js';
import manifest from '../../content/literature/standardebooks/manifest.generated.json';
import { standardEbooksChapter, verifiedStandardEbooksLiterature } from '../standardEbooksCanonical.js';
import { isCanonicalLiteratureMaterial } from '../literatureCanonical.js';
import { standardEbooksAttributionParts } from '../videoAttribution.js';
import { literatureBookPublishable, literatureBookSummary, literatureRubyCoverage } from '../literaturePublish.js';

// Standard Ebooks 정본 책(LIT-SRC-EN-1, 오너 「ㄱㄱ」 2026-10-16 KST — 영어 시범 3편) — 판 XHTML 파서·장 나눔·권리 선·
// 리포 산출물(--check)·뷰어 대조(원문 해시가 같을 때만 크레딧)·게시 판정.

const xhtml = (body, title = 'II: The Pool of Tears') => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${title}</title></head>
<body epub:type="bodymatter z3998:fiction"><section id="chapter-2" epub:type="chapter">${body}</section></body></html>`;

describe('parseStandardEbooksXhtml — 판 XHTML → 문단', () => {
  it('제목은 <title>, 장 머리(hgroup)·삽화(figure)는 빼고, 인라인 태그는 글자만, 시는 행을 \\n으로 한 블록', () => {
    const { title, blocks } = parseStandardEbooksXhtml(xhtml(`
      <hgroup><h2 epub:type="z3998:ordinal">II</h2><p epub:type="title">The Pool of Tears</p></hgroup>
      <figure id="illustration-5"><img alt="Alice grows." src="../images/i.svg"/></figure>
      <p>“Curiouser and curiouser!” cried Alice; I’m sure <em>I</em> shan’t be able;⁠—but, <abbr>Esq.</abbr> done.</p>
      <blockquote epub:type="z3998:verse"><p>
        <span>Alice’s Right Foot,</span>
        <br/>
        <span class="i1">Hearthrug,</span>
      </p></blockquote>
      <p>Tom &amp; Jerry &#8212; fin.</p>`));
    expect(title).toBe('II: The Pool of Tears');
    expect(blocks).toEqual([
      '“Curiouser and curiouser!” cried Alice; I’m sure I shan’t be able;—but, Esq. done.',
      'Alice’s Right Foot,\nHearthrug,',
      'Tom & Jerry — fin.',
    ]);
  });

  it('단편 절 번호(h3)는 문단으로 남기되 맨 앞이면 뺀다 · 문단을 품은 목록 항목(일지)은 안쪽 문단 그대로', () => {
    const { blocks } = parseStandardEbooksXhtml(xhtml(`
      <h2 epub:type="title">A Case of Identity</h2>
      <section><h3>I</h3><p>One.</p></section><section><h3>II</h3><p>Two.</p>
      <ol><li><p>4th. Hudson came.</p></li><li>Plain item</li></ol></section>`, 'A Case of Identity'));
    expect(blocks).toEqual(['One.', 'II', 'Two.', '4th. Hudson came.', 'Plain item']);
  });

  it('모르는 구조는 흘려보내지 않는다(fail-closed) — 블록 밖 글자·모르는 태그·모르는 문자 참조·빈 본문', () => {
    expect(() => parseStandardEbooksXhtml(xhtml('<div>stray text</div><p>ok</p>'))).toThrow(/블록 밖/u);
    expect(() => parseStandardEbooksXhtml(xhtml('<p>see <object data="x">note</object></p>'))).toThrow(/모르는 태그/u);
    // 책 안 상호참조(명상록 「[Book IV]」)는 글자만 — 고리는 뷰어에서 갈 데가 없다
    expect(parseStandardEbooksXhtml(xhtml('<p>a director [<a href="book-4.xhtml">Book <span epub:type="z3998:roman">IV</span></a>].</p>')).blocks).toEqual(['a director [Book IV].']);
    expect(() => parseStandardEbooksXhtml(xhtml('<p>&nbsp;x</p>'))).toThrow(/문자 참조/u);
    expect(() => parseStandardEbooksXhtml(xhtml('<figure><img src="x"/></figure>'))).toThrow(/본문 문단이 없다/u);
    expect(() => parseStandardEbooksXhtml('<html></html>')).toThrow(/<title>/u);
  });
});

describe('splitBlocksByWords — 문단 경계로 고르게', () => {
  const para = (words) => Array.from({ length: words }, () => 'w').join(' ');
  it('목표의 몇 배인지로 묶음 수를 정하고 문단 사이에서만 자른다 — 빈 묶음 없음', () => {
    const blocks = Array.from({ length: 40 }, () => para(110)); // 4,400단어
    const groups = splitBlocksByWords(blocks, 2200);
    expect(groups).toHaveLength(2);
    expect(groups.flat()).toEqual(blocks);
    expect(groups.map((group) => wordCount(group.join(' ')))).toEqual([2200, 2200]);
    expect(splitBlocksByWords([para(3000)], 2200)).toEqual([[para(3000)]]); // 한 문단은 자르지 않는다
    expect(splitBlocksByWords([para(500), para(400)], 2200)).toHaveLength(1);
  });
});

describe('권리 선(원산국 만료 — 한국은 상호주의 · 미국 선은 미국 원산에만) — 검토 연도 기준, 결정적', () => {
  const base = { publishedYear: 1865, authorDeathYear: 1898, countryOfOrigin: 'GB', rights: { reviewedAt: '2026-10-16' } };
  it('2026년 검토: 영국 원산은 1955년 이전 사망만(출판 연도로 막지 않는다) · 미국 원산은 1930년 이전 출판', () => {
    expect(standardEbooksRightsVerdict(base)).toEqual({ ok: true, reasons: [], reviewYear: 2026, basis: 'korea-term' });
    expect(standardEbooksRightsVerdict({ ...base, authorDeathYear: 1955 }).ok).toBe(true);
    expect(standardEbooksRightsVerdict({ ...base, authorDeathYear: 1956 }).ok).toBe(true); // 영국은 보호 중이어도 한국은 1962년 이전 사망 만료
    expect(standardEbooksRightsVerdict({ ...base, authorDeathYear: 1970 }).reasons).toEqual(['작가 1970 사망 — 한국 보호기간이 끝나지 않았다(1962년 이전 사망 또는 사후 70년)', '작가 1970 사망 — 원산국 보호기간(사후 70년)이 끝나지 않았다']);
    expect(standardEbooksRightsVerdict({ ...base, publishedYear: 1940, authorDeathYear: 1950 }).ok).toBe(true); // 미국 선 없음(오너 2026-10-17)
    const us = { ...base, countryOfOrigin: 'US', authorDeathYear: 1970 };
    expect(standardEbooksRightsVerdict({ ...us, publishedYear: 1930 }).ok).toBe(true); // 미국 원산 — 본국 출판 95년 만료
    expect(standardEbooksRightsVerdict({ ...us, publishedYear: 1931 }).ok).toBe(false); // 본국 보호 중 · 한국도 보호 중(1970 사망)
  });
  it('번역본·판정 규칙 없는 원산국(프랑스 전쟁 연장 등)·기록 누락은 불가(fail-closed)', () => {
    expect(standardEbooksRightsVerdict({ ...base, translator: 'X' }).ok).toBe(false);
    expect(standardEbooksRightsVerdict({ ...base, countryOfOrigin: 'DE', authorDeathYear: 1990 }).ok).toBe(false);
    expect(standardEbooksRightsVerdict({ ...base, rights: {} }).ok).toBe(false);
    expect(standardEbooksRightsVerdict({ ...base, authorDeathYear: undefined }).ok).toBe(false);
  });
});

const FIRST_THREE = ['se-arthur-conan-doyle_the-adventures-of-sherlock-holmes', 'se-charles-dickens_a-christmas-carol', 'se-lewis-carroll_alices-adventures-in-wonderland'];

describe('리포 정본 3편 — 산출물·장 모양', () => {
  it('build-literature --check와 같은 검사가 통과한다(원문 해시·chapters.json·목록·대조표)', async () => {
    const { works, errors } = await buildStandardEbooks({ root: STANDARD_EBOOKS_ROOT, check: true });
    expect(errors).toEqual([]);
    // 1차 3편 + 2차 묶음 5편(오너 2026-10-17 KST — 초판 장정 표지) + 3차 묶음 5편(「되는 언어로만」 — 표지 대기 동안은 목록 밖)
    expect(works.map((work) => [work.key, work.chapters, work.status])).toEqual([
      ['se-adam-smith_the-theory-of-moral-sentiments', 86, 'cover-pending'],
      ['se-adam-smith_the-wealth-of-nations', 173, 'cover-pending'],
      ['se-arthur-conan-doyle_the-adventures-of-sherlock-holmes', 47, 'checked'],
      ['se-benjamin-franklin_the-autobiography-of-benjamin-franklin', 28, 'cover-pending'],
      ['se-charles-dickens_a-christmas-carol', 13, 'checked'],
      ['se-f-scott-fitzgerald_the-great-gatsby', 22, 'checked'],
      ['se-henry-david-thoreau_walden', 50, 'checked'],
      ['se-herman-melville_moby-dick', 150, 'checked'],
      ['se-james-joyce_a-portrait-of-the-artist-as-a-young-man', 39, 'checked'],
      ['se-jane-austen_pride-and-prejudice', 65, 'checked'],
      ['se-john-stuart-mill_on-liberty', 22, 'cover-pending'],
      ['se-lewis-carroll_alices-adventures-in-wonderland', 12, 'checked'],
      ['se-marcus-aurelius_meditations_george-long', 20, 'cover-pending'],
    ]);
  });

  it('장: 영어 · 레벨 · 책 묶음 · 출처 기록, 원문은 문단 사이 빈 줄 · 장당 1,500–3,000단어', () => {
    for (const book of STANDARD_EBOOKS_BOOKS) {
      expect(literatureBookPublishable(book)).toBe(true);
      for (const chapter of book.chapters) {
        expect(chapter.metadata).toMatchObject({ language: 'English', level: book.book.level, book: { key: book.book.key, order: chapter.order, total: book.book.total } });
        expect(chapter.metadata.literature).toMatchObject({ provider: SE_PROVIDER, license: 'CC0-1.0', translator: null, rights: { status: 'approved' } });
        expect(chapter.materialTitle).toBe(`${book.book.title} — ${chapter.title}`);
        expect(chapter.rawText).not.toMatch(/[<>⁠ ]|\n{3}/u);
        const words = wordCount(chapter.rawText);
        // 판의 장 하나가 짧으면 짧은 대로 둔다(모비 딕 「The Prairie」 등) — 긴 장만 2,200단어 안팎으로 나눈다
        if (FIRST_THREE.includes(book.book.key)) expect(words).toBeGreaterThan(1500);
        expect(words).toBeGreaterThan(0);
        expect(words).toBeLessThan(3300);
      }
    }
    const alice = STANDARD_EBOOKS_BOOKS.find((book) => book.book.key === 'se-lewis-carroll_alices-adventures-in-wonderland');
    expect(alice.book).toMatchObject({ title: 'Alice’s Adventures in Wonderland', author: 'Lewis Carroll', level: 'B1 중급', total: 12 });
    expect(alice.chapters[1].title).toBe('II: The Pool of Tears');
    expect(alice.chapters[1].rawText).toContain('Alice’s Right Foot, Esq.\nHearthrug,');
    const holmes = STANDARD_EBOOKS_BOOKS.find((book) => book.book.key.includes('sherlock'));
    expect(holmes.chapters[0].title).toBe('A Scandal in Bohemia (1/4)');
  });

  it('원문이 바뀌면(파일 해시) 빌드가 실패한다 — 초안 함수도 entry.files와 다른 파일 목록을 거부', () => {
    const base = path.join(STANDARD_EBOOKS_ROOT, 'se-charles-dickens_a-christmas-carol');
    const entry = JSON.parse(readFileSync(path.join(base, 'entry.json'), 'utf8'));
    const files = entry.files.map((file) => ({ path: file.path, text: readFileSync(path.join(base, 'source', file.path), 'utf8') }));
    expect(entry.files.every((file, index) => createHash('sha256').update(files[index].text, 'utf8').digest('hex') === file.sha256)).toBe(true);
    expect(() => createStandardEbooksDraft(entry, files.slice(1))).toThrow(/entry\.files/u);
    expect(() => createStandardEbooksDraft({ ...entry, authorDeathYear: 1990 }, files)).toThrow(/권리 판정 불가/u);
    expect(standardEbooksBookKey(entry.repo)).toBe('se-charles-dickens_a-christmas-carol');
  });
});

describe('뷰어 대조·출처 줄 · 게시', () => {
  const book = STANDARD_EBOOKS_BOOKS.find((item) => item.book.key === 'se-lewis-carroll_alices-adventures-in-wonderland');
  const chapter = book.chapters[0];
  const material = (rawText, metadata = chapter.metadata) => ({ raw_text: rawText, processed_json: { metadata } });

  it('원문이 정본 장과 같을 때만 대조표 크레딧 — 꾸민 metadata·고친 원문은 null', async () => {
    expect(standardEbooksChapter(chapter.metadata)).toMatchObject({ work: { title: book.book.title }, chapter: { order: 1 } });
    expect(await verifiedStandardEbooksLiterature(material(chapter.rawText))).toEqual(manifest.works[book.book.key].literature);
    expect(await verifiedStandardEbooksLiterature(material(`${chapter.rawText} `))).toBe(null);
    expect(await verifiedStandardEbooksLiterature(material(chapter.rawText, { ...chapter.metadata, book: { ...chapter.metadata.book, key: 'se-x_y' } }))).toBe(null);
    expect(await verifiedStandardEbooksLiterature(material(chapter.rawText, { ...chapter.metadata, literature: { provider: 'aozora' } }))).toBe(null);
  });

  it('정본 책이라 원문 수정은 막는다(아오조라와 같은 판정)', () => {
    expect(isCanonicalLiteratureMaterial(material(chapter.rawText))).toBe(true);
    expect(isCanonicalLiteratureMaterial(material(chapter.rawText, { literature: { provider: 'other' } }))).toBe(false);
  });

  it('출처 줄 재료 — 작가·출판 연도·퍼블릭 도메인(승인일 때만)·판 링크(standardebooks.org HTTPS만)·바꾼 점', () => {
    const literature = manifest.works[book.book.key].literature;
    expect(standardEbooksAttributionParts(literature)).toEqual({
      author: 'Lewis Carroll', publishedYear: 1865, url: 'https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/john-tenniel', publicDomain: true, editNote: true, notesNote: false, translator: null,
    });
    // 번역본(명상록 롱 역) — 출처 줄에 「번역 George Long, 1862」
    expect(standardEbooksAttributionParts({ ...literature, translator: { name: ' George Long ', deathYear: 1879, publishedYear: 1862, countryOfOrigin: 'GB' } }).translator)
      .toEqual({ name: 'George Long', publishedYear: 1862 });
    expect(standardEbooksAttributionParts({ ...literature, translator: 'George Long' }).translator).toBe(null); // 이름뿐인 기록은 크레딧이 아니다
    expect(standardEbooksAttributionParts({ ...literature, url: 'javascript:alert(1)' }).url).toBe('');
    expect(standardEbooksAttributionParts({ ...literature, rights: { status: 'reviewing' } }).publicDomain).toBe(false);
    expect(standardEbooksAttributionParts({ ...literature, provider: 'aozora' })).toBe(null);
    expect(manifest.works[book.book.key].chapters[0]).not.toHaveProperty('rawText');
  });

  it('관리자 요약: 권리 근거 칸(아오조라와 같은 모양, 링크는 판 페이지) · 루비·쪼개진 낱말 0', () => {
    expect(literatureBookSummary(book).rights).toEqual({
      basis: 'public-domain', reviewedBy: 'claude', reviewedAt: book.chapters[0].metadata.literature.rights.reviewedAt, reviewedJurisdictions: ['GB', 'US', 'KR'],
      evidenceUrl: book.chapters[0].metadata.literature.url, publishedYear: 1865, authorDeathYear: 1898, charset: 'Standard Ebooks · CC0-1.0', evidenceLabel: 'Standard Ebooks 판',
    });
    const analyzed = { sequence: ['a'], dictionary: { a: { text: 'Alice' } } };
    expect(literatureRubyCoverage(book, [{ order: '1', processed_json: analyzed }])[0]).toMatchObject({ rubyLocks: 0, remaining: 0, boundary: 0 });
    const tampered = { ...book, chapters: book.chapters.map((item) => ({ ...item, metadata: { ...item.metadata, literature: { ...item.metadata.literature, authorDeathYear: 1990 } } })) };
    expect(literatureBookPublishable(tampered)).toBe(false);
    expect(standardEbooksRightsPublishable({ ...book.chapters[0].metadata.literature, license: 'CC-BY-4.0' })).toBe(false);
  });
});
