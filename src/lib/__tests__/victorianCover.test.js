import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VICTORIAN_BINDINGS, VICTORIAN_CLOTHS, validateVictorianDisplay } from '../victorianCover.js';
import manifest from '../../content/literature/standardebooks/manifest.generated.json';
import aozora from '../../content/literature/aozora/manifest.generated.json';
import { sliceBetween } from './helpers/sliceBetween';

vi.mock('next/font/google', () => ({ Libre_Caslon_Display: () => ({ variable: 'vic-font' }), Shippori_Mincho_B1: () => ({ variable: '' }) }));
const { default: VictorianCover } = await import('../../components/books/VictorianCover.jsx');

// 영어 정본 책 표지 「빅토리아 천 장정」(LIT-SRC-EN-1, 오너 「그럼 B로」 → 「실물에 가깝게」 2026-10-16 KST) — 표기 검사·초판 실물 구성·
// 색 구분·금박 대비·그리기(앞표지 글자는 실물에 있는 것만 · id 겹침 없음)·서재 카드/게시 화면 배선.

const read = (file) => readFileSync(path.join(process.cwd(), file), 'utf8');
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const cielab = (value) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047); const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722); const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const works = Object.values(manifest.works);

describe('표지 표기 — 빌드가 entry.json display를 검사한다', () => {
  const alice = { titleKo: '이상한 나라의 앨리스', authorKo: '루이스 캐럴', coverTitle: 'Alice in\nWonderland', cloth: 'madder-red', binding: 'medallion' };
  const carol = { titleKo: '크리스마스 캐럴', authorKo: '찰스 디킨스', coverKicker: 'A', coverTitle: 'Christmas\nCarol', coverAuthor: 'Charles Dickens', cloth: 'cinnamon', binding: 'wreath' };
  it('정본 키만 받는다 — 천·장정 구성 · 표지 제목 한두 줄(줄마다 12자)', () => {
    expect(validateVictorianDisplay(alice)).toEqual(alice);
    expect(validateVictorianDisplay(carol)).toEqual(carol);
    expect(() => validateVictorianDisplay({ ...alice, cloth: 'purple' })).toThrow(/cloth/u);
    expect(() => validateVictorianDisplay({ ...alice, binding: 'original-cover-scan' })).toThrow(/binding/u); // 원본을 옮겨 붙이는 키는 없다
    expect(() => validateVictorianDisplay({ ...alice, coverTitle: 'Alice’s Adventures in Wonderland' })).toThrow(/coverTitle/u);
    expect(() => validateVictorianDisplay({ ...alice, coverTitle: 'A\nB\nC' })).toThrow(/coverTitle/u);
    expect(() => validateVictorianDisplay({ ...carol, coverKicker: 'A\nB' })).toThrow(/coverKicker/u);
    expect(() => validateVictorianDisplay(undefined)).toThrow(/display/u);
  });

  it('앞표지 글자는 실물대로 — 작가가 있는 장정은 coverAuthor 필수, 글자 없는 장정(medallion)은 작가·작은 글자 없음', () => {
    expect(() => validateVictorianDisplay({ ...carol, coverAuthor: undefined })).toThrow(/앞표지에 작가가 있다/u);
    expect(() => validateVictorianDisplay({ ...alice, coverAuthor: 'Lewis Carroll' })).toThrow(/앞표지에 작가가 없다/u);
    expect(() => validateVictorianDisplay({ ...alice, coverKicker: 'The' })).toThrow(/글자가 없다/u);
    expect(Object.fromEntries(Object.entries(VICTORIAN_BINDINGS).map(([key, binding]) => [key, [binding.title, binding.author]]))).toEqual({
      medallion: [false, false], pictorial: [true, true], wreath: [true, true],
    });
  });

  it('리포 3편 — 초판 장정 실물 구성(Macmillan 붉은 천·원형 그림 / Newnes 청록빛 연파랑·거리 그림 / Chapman & Hall 계피색·화환)', () => {
    expect(Object.fromEntries(works.map((work) => [work.title, [work.display.cloth, work.display.binding, work.display.coverAuthor ?? null]]))).toEqual({
      'Alice’s Adventures in Wonderland': ['madder-red', 'medallion', null],
      'The Adventures of Sherlock Holmes': ['pale-blue', 'pictorial', 'A. Conan Doyle'],
      'A Christmas Carol': ['cinnamon', 'wreath', 'Charles Dickens'],
    });
    expect(VICTORIAN_CLOTHS['pale-blue'].cloth).toBe('#5a999e'); // 실물 사진 실측(서지 기록의 light blue — 청록에 가깝다)
  });
});

describe('색 — 서재에서 구분되고 금박 제목이 읽힌다', () => {
  it('천 색끼리, 그리고 일본 책(시리즈 A) 천 색과 CIELAB 색차 12 이상', () => {
    const css = read('src/components/books/literature-cover.css');
    const japanese = Object.fromEntries([...css.matchAll(/\.lit-cover--([a-z]+)\{--cover-color:(#[0-9a-f]{6})/gu)].map((m) => [m[1], m[2]]));
    const used = new Set(Object.values(aozora.works).map((work) => work.display.cover));
    const all = [...works.map((work) => [work.title, VICTORIAN_CLOTHS[work.display.cloth].cloth]), ...[...used].map((key) => [key, japanese[key]])];
    const close = [];
    for (const [i, [a, x]] of all.entries()) {
      for (const [b, y] of all.slice(i + 1)) {
        if (i >= works.length) continue; // 일본 책끼리는 literatureDisplay.test가 본다
        const [p, q] = [cielab(x), cielab(y)];
        const distance = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
        if (distance < 12) close.push(`${a} ↔ ${b} ${distance.toFixed(1)}`);
      }
    }
    expect(close).toEqual([]);
  });

  it('금박 글자(가운데 색 #ecc96c)가 읽힌다 — 천과 3:1 이상, 안 되면(밝은 천) 글자 테(deep)와 3:1 이상이고 실제로 테를 그린다', () => {
    const source = read('src/components/books/VictorianCover.jsx');
    for (const work of works.filter((w) => VICTORIAN_BINDINGS[w.display.binding].title)) {
      const tone = VICTORIAN_CLOTHS[work.display.cloth];
      if (contrast('#ecc96c', tone.cloth) >= 3) continue;
      expect(contrast('#ecc96c', tone.deep), work.title).toBeGreaterThanOrEqual(3);
      expect(work.display.binding, work.title).toBe('pictorial');
      expect(sliceBetween(source, 'function Pictorial', '\n}\n')).toContain('outline={tone.deep}');
    }
  });
});

describe('그리기', () => {
  const render = (key) => renderToStaticMarkup(createElement(VictorianCover, { work: manifest.works[key] }));
  it('장식(aria-hidden) · 앞표지 글자는 실물에 있는 것만 · 영어 lang', () => {
    const alice = render('se-lewis-carroll_alices-adventures-in-wonderland');
    expect(alice).toContain('aria-hidden="true"');
    expect(alice).toContain('data-binding="medallion"');
    expect(alice).not.toContain('<text'); // Macmillan 앞표지에는 글자가 없다
    expect(alice).toContain('vic-font');
    const holmes = render('se-arthur-conan-doyle_the-adventures-of-sherlock-holmes');
    expect(holmes).toContain('lang="en"');
    for (const text of ['THE ADVENTURES OF', 'SHERLOCK', 'HOLMES', 'A. CONAN DOYLE']) expect(holmes).toContain(`>${text}</text>`);
    expect(holmes).not.toMatch(/Strand/iu); // 총서 이름(출판사 표지)은 그리지 않는다
    const carol = render('se-charles-dickens_a-christmas-carol');
    for (const text of ['A', 'CHRISTMAS', 'CAROL', 'BY', 'CHARLES DICKENS']) expect(carol).toContain(`>${text}</text>`);
    expect(renderToStaticMarkup(createElement(VictorianCover, { work: { display: { cloth: 'nope' } } }))).toBe('');
    expect(renderToStaticMarkup(createElement(VictorianCover, { work: null }))).toBe('');
  });

  it('따로 그린 표지끼리도 무늬·금박 id가 겹치지 않는다(천·장정을 id에 붙인다)', () => {
    const ids = works.flatMap((work) => [...renderToStaticMarkup(createElement(VictorianCover, { work })).matchAll(/ id="([^"]+)"/gu)].map((m) => m[1]));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('배선 — 서재 카드·게시 화면', () => {
  it('서재 카드: Standard Ebooks 책은 빅토리아 표지 + 원제(영어) + 한국어 제목 · 단어 수 · 장 이름, 「다음 과 적기」 없음', () => {
    const page = read('src/views/MaterialsPage.jsx');
    expect(page).toContain('const english = work || !canonicalCovers ? null : standardEbooksWorkOfBook(b);'); // 공개 목록은 정본 표지 닫음(fail closed — bookMeta.test.js)
    expect(page).toContain('art: <VictorianCover work={english} />,');
    expect(page).toContain("english.words && `${english.words.toLocaleString()}단어`");
    expect(page).toContain('footer={!work && !english && b.chapters[0]?.owner_id === user?.id ? (');
  });

  it('게시 화면 표지: 아오조라는 시리즈 A, 영어 정본은 빅토리아 표지', () => {
    const cover = sliceBetween(read('src/components/LiteraturePublishPanel.jsx'), 'export function BookCover', '\n}\n');
    expect(cover).toContain('const english = work ? null : standardEbooksWork(bookKey);');
    expect(cover).toContain('{work ? <LiteratureCover work={work} /> : <VictorianCover work={english} />}');
  });
});
