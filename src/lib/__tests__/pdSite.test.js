import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createPdSiteDraft, parsePdSiteHtml, pdSiteRightsPublishable, pdSiteSections } from '../pdSite.js';
import { pdSiteAttributionParts } from '../videoAttribution.js';
import { CANONICAL_LITERATURE_PROVIDERS } from '../literatureCanonical.js';
import { literatureBookPublishable } from '../literaturePublish.js';

// 퍼블릭 도메인 전자책 사이트 정본 책(LIT-SRC-PD-1, 오너 2026-10-17 KST) — Faded Page · Project Gutenberg Australia.
// 본문 경계(parse) · 부/장 제목 · 각주·삽화 빼기 · 닫지 않은 <p> · <pre> 노래 · 권리(한국 법) · 리포 7편.

const page = (inner) => `<html><head><title>x</title></head><body>${inner}</body></html>`;
const ROOT = 'src/content/literature/pdsite';

describe('parsePdSiteHtml — 본문 시작부터 끝 앞까지, 모르는 구조는 실패', () => {
  const parse = { chapter: '^h2:Chapter [IVX]+$', stop: '^h2:THE END$' };
  it('사이트 머리말·판권은 시작 앞이라 빠진다 · 각주 고리/표 · 삽화 · 장식 줄(* * *)', () => {
    const html = page([
      '<div><b>* A Distributed Proofreaders Canada Ebook *</b><br/>This work is in the Canadian public domain</div>',
      '<h2>Contents</h2><p>Chapter I. Chapter II.</p>',
      '<h2>Chapter I</h2>',
      '<p>Mr. Jones<a href="#f1"><sup><span>[1]</span></sup></a> had locked the hen-houses.<img src="x.jpg" alt=""/></p>',
      '<pre>Beasts of England, beasts of Ireland,\nBeasts of every land and clime,</pre>',
      '<h3>* * * * *</h3>',
      '<p>Old Major<sup>2</sup> spoke.',
      '<p>Unclosed paragraph — next block ends it.',
      '<table summary="footnote_1"><tr><td>[1]</td><td><p>A footnote.</p></td></tr></table>',
      '<h2>THE END</h2><p>This site is full of FREE ebooks</p>',
    ].join('\n'));
    const { blocks, notesOmitted } = parsePdSiteHtml(html, parse);
    expect(blocks.map((block) => block.text)).toEqual([
      'Chapter I', 'Mr. Jones had locked the hen-houses.', 'Beasts of England, beasts of Ireland,\nBeasts of every land and clime,', '⁂', 'Old Major spoke.', 'Unclosed paragraph — next block ends it.',
    ]);
    expect(notesOmitted).toBe(true);
  });
  it('본문 시작·끝을 못 찾으면 · 블록 밖 글자 · 모르는 태그 · 모르는 문자 참조는 throw', () => {
    expect(() => parsePdSiteHtml(page('<p>no chapters</p>'), parse)).toThrow(/본문 시작/u);
    expect(() => parsePdSiteHtml(page('<h2>Chapter I</h2><p>a</p>'), parse)).toThrow(/본문 끝/u);
    expect(() => parsePdSiteHtml(page('<h2>Chapter I</h2><div>bare text</div><h2>THE END</h2>'), parse)).toThrow(/블록 밖/u);
    expect(() => parsePdSiteHtml(page('<h2>Chapter I</h2><p>a <video>b</video></p><h2>THE END</h2>'), parse)).toThrow(/모르는 태그/u);
    expect(() => parsePdSiteHtml(page('<h2>Chapter I</h2><p>a &bogus; b</p><h2>THE END</h2>'), parse)).toThrow(/문자 참조/u);
  });
});

describe('pdSiteSections — 부(part) 제목은 다음 장 앞머리, 본문이 붙은 부 제목은 그 자체로 장', () => {
  it('1984형(PART ONE · Chapter 1) · 시지프형(부 바로 뒤 본문) · 장 제목 없는 중편(노인과 바다)', () => {
    const parse = { part: '^h1:(PART ONE|PART TWO|Le mythe)$', chapter: '^h[12]:', stop: 'x' };
    const blocks = [
      { tag: 'h1', text: 'PART ONE' }, { tag: 'h2', text: 'Chapter 1' }, { tag: 'p', text: 'a' }, { tag: 'h2', text: 'Chapter 2' }, { tag: 'p', text: 'b' },
      { tag: 'h1', text: 'Le mythe' }, { tag: 'p', text: 'c' },
    ];
    expect(pdSiteSections(blocks, parse, 'W')).toEqual([
      { title: 'PART ONE · Chapter 1', blocks: ['a'] }, { title: 'PART ONE · Chapter 2', blocks: ['b'] }, { title: 'Le mythe', blocks: ['c'] },
    ]);
    expect(pdSiteSections([{ tag: 'p', text: 'He was an old man' }], { stop: 'x' }, 'The Old Man and the Sea')).toEqual([{ title: 'The Old Man and the Sea', blocks: ['He was an old man'] }]);
  });
});

describe('리포 7편 — 원문 고정 · 한국 법 권리 · 장 모양', () => {
  const keys = readdirSync(ROOT).filter((name) => name.startsWith('pd-')).sort();
  it('작품 목록 · 권리 근거(헤밍웨이·카뮈·생텍쥐페리·오웰·울프 — 한국 보호기간 만료)', () => {
    expect(keys).toEqual([
      'pd-fp-albert-camus_l-etranger', 'pd-fp-albert-camus_le-mythe-de-sisyphe', 'pd-fp-ernest-hemingway_the-old-man-and-the-sea', 'pd-fp-virginia-woolf_a-room-of-ones-own',
      'pd-gau-antoine-de-saint-exupery_le-petit-prince', 'pd-gau-george-orwell_animal-farm', 'pd-gau-george-orwell_nineteen-eighty-four',
    ]);
    for (const key of keys) {
      const entry = JSON.parse(readFileSync(`${ROOT}/${key}/entry.json`, 'utf8'));
      const html = new TextDecoder(entry.file.encoding, { fatal: true }).decode(readFileSync(`${ROOT}/${key}/source/${entry.file.path}`));
      const draft = createPdSiteDraft(entry, html);
      const literature = draft.chapters[0].metadata.literature;
      expect(literature.rightsBasis).toBe('korea-term');
      expect(pdSiteRightsPublishable(literature)).toBe(true);
      expect(literatureBookPublishable(draft)).toBe(true);
      const text = draft.chapters.map((chapter) => chapter.rawText).join('\n');
      expect(text).not.toMatch(/Distributed Proofreaders|Project Gutenberg|public domain in Canada|\[\d+\]|THE END/u); // 사이트 머리말 · 각주 번호 · 끝 표시 없음
      expect(draft.chapters.every((chapter) => chapter.rawText.length > 200)).toBe(true);
    }
  });
  it('장 제목 — 부와 장(1984 · 이방인) · 시지프 부 앞머리 · 어린 왕자 헌사부터', () => {
    const draftOf = (key) => {
      const entry = JSON.parse(readFileSync(`${ROOT}/${key}/entry.json`, 'utf8'));
      return createPdSiteDraft(entry, new TextDecoder(entry.file.encoding).decode(readFileSync(`${ROOT}/${key}/source/${entry.file.path}`)));
    };
    expect(draftOf('pd-gau-george-orwell_nineteen-eighty-four').chapters[0].title).toMatch(/^PART ONE · Chapter 1/u);
    expect(draftOf('pd-fp-albert-camus_l-etranger').chapters[0].title).toMatch(/^PREMIÈRE PARTIE · I/u);
    expect(draftOf('pd-fp-albert-camus_le-mythe-de-sisyphe').chapters[0].title).toMatch(/^Un raisonnement absurde · L’ABSURDE ET LE SUICIDE/u);
    const prince = draftOf('pd-gau-antoine-de-saint-exupery_le-petit-prince');
    expect(prince.chapters[0].title).toBe('DEDICACE');
    expect(prince.chapters[0].rawText).toMatch(/LÉON WERTH/u);
  });
});

describe('배선', () => {
  it('정본 출처 목록 · 출처 줄(사이트 HTTPS 링크만 · 한국 판정 문구)', () => {
    expect(CANONICAL_LITERATURE_PROVIDERS).toContain('pdsite');
    const literature = { provider: 'pdsite', site: 'fp', author: 'Albert Camus', publishedYear: 1942, url: 'https://www.fadedpage.com/showbook.php?pid=20150715', rights: { status: 'approved', basis: 'public-domain' }, edits: ['chapter-split-by-manabi', 'typography-normalized', 'illustrations-omitted'] };
    expect(pdSiteAttributionParts(literature)).toMatchObject({ siteName: 'Faded Page', publicDomain: true, editNote: true, notesNote: false, url: 'https://www.fadedpage.com/showbook.php?pid=20150715' });
    expect(pdSiteAttributionParts({ ...literature, url: 'https://evil.example/x' }).url).toBe('');
    const viewer = readFileSync('src/views/ViewerPage.jsx', 'utf8');
    expect(viewer).toContain('const pd = pdSiteAttributionParts(canonicalLiterature);');
    expect(viewer).toContain('{vt("한국에서 퍼블릭 도메인")}');
  });
});
