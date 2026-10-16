import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VICTORIAN_CLOTHS, VICTORIAN_MOTIFS, validateVictorianDisplay } from '../victorianCover.js';
import manifest from '../../content/literature/standardebooks/manifest.generated.json';
import aozora from '../../content/literature/aozora/manifest.generated.json';
import { sliceBetween } from './helpers/sliceBetween';

vi.mock('next/font/google', () => ({ Libre_Caslon_Display: () => ({ variable: 'vic-font' }), Shippori_Mincho_B1: () => ({ variable: '' }) }));
const { default: VictorianCover } = await import('../../components/books/VictorianCover.jsx');

// 영어 정본 책 표지 「빅토리아 천 장정」(LIT-SRC-EN-1, 오너 「그럼 B로」 2026-10-16 KST) — 표기 검사·초판 고증 값·색 구분·금박 대비·
// 그리기(장식 · 제목만 · id 겹침 없음)·서재 카드/게시 화면 배선.

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
  const ok = { titleKo: '이상한 나라의 앨리스', authorKo: '루이스 캐럴', coverTitle: 'Alice in\nWonderland', cloth: 'madder-red', border: 'triple-gilt', stamping: 'gilt', motif: 'pocket-watch' };
  it('정본 키만 받는다 — 천·테두리·찍는 방식·문양 · 표지 제목 한두 줄(줄마다 12자)', () => {
    expect(validateVictorianDisplay(ok)).toEqual(ok);
    expect(() => validateVictorianDisplay({ ...ok, cloth: 'purple' })).toThrow(/cloth/u);
    expect(() => validateVictorianDisplay({ ...ok, motif: 'tenniel-alice' })).toThrow(/motif/u); // 초판 그림을 옮기는 키는 없다
    expect(() => validateVictorianDisplay({ ...ok, coverTitle: 'Alice’s Adventures in Wonderland' })).toThrow(/coverTitle/u);
    expect(() => validateVictorianDisplay({ ...ok, coverTitle: 'A\nB\nC' })).toThrow(/coverTitle/u);
    expect(() => validateVictorianDisplay(undefined)).toThrow(/display/u);
  });

  it('리포 3편 — 초판 장정 기록을 따른 값(Macmillan 붉은 천·금박 삼중 줄 / Newnes 연한 파랑·금박+먹 / Chapman & Hall 계피색·민압)', () => {
    expect(Object.fromEntries(works.map((work) => [work.title, [work.display.cloth, work.display.border, work.display.stamping, work.display.motif]]))).toEqual({
      'Alice’s Adventures in Wonderland': ['madder-red', 'triple-gilt', 'gilt', 'pocket-watch'],
      'The Adventures of Sherlock Holmes': ['pale-blue', 'black', 'gilt-black', 'magnifier'],
      'A Christmas Carol': ['cinnamon', 'blind', 'gilt', 'holly-candle'],
    });
    expect(new Set(works.map((work) => work.display.motif)).size).toBe(works.length);
    expect(works.every((work) => VICTORIAN_MOTIFS.includes(work.display.motif))).toBe(true);
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

  it('금박(가운데 색 #ecc96c)과 바탕의 대비 3:1 이상 — 금박만이면 천, 금박+먹이면 먹 판', () => {
    for (const work of works) {
      const ground = work.display.stamping === 'gilt-black' ? '#1c1a19' : VICTORIAN_CLOTHS[work.display.cloth].cloth;
      expect(contrast('#ecc96c', ground), work.title).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('그리기', () => {
  it('장식(aria-hidden) · 앞표지는 제목만(작가 없음) · 표지 제목 줄 · 영어 lang', () => {
    const html = renderToStaticMarkup(createElement(VictorianCover, { work: manifest.works['se-lewis-carroll_alices-adventures-in-wonderland'] }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('lang="en"');
    expect(html.match(/class="vic-cover__line"/gu)).toHaveLength(2);
    expect(html).toContain('Alice in</span>');
    expect(html).not.toContain('Lewis Carroll');
    expect(html).toContain('vic-font');
    expect(renderToStaticMarkup(createElement(VictorianCover, { work: { display: { cloth: 'nope' } } }))).toBe('');
    expect(renderToStaticMarkup(createElement(VictorianCover, { work: null }))).toBe('');
  });

  it('따로 그린 표지끼리도 무늬·금박 id가 겹치지 않는다(천·문양을 id에 붙인다)', () => {
    const ids = works.flatMap((work) => [...renderToStaticMarkup(createElement(VictorianCover, { work })).matchAll(/ id="([^"]+)"/gu)].map((m) => m[1]));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('배선 — 서재 카드·게시 화면', () => {
  it('서재 카드: Standard Ebooks 책은 빅토리아 표지 + 원제(영어) + 한국어 제목 · 단어 수 · 장 이름, 「다음 과 적기」 없음', () => {
    const page = read('src/views/MaterialsPage.jsx');
    expect(page).toContain('const english = work ? null : standardEbooksWorkOfBook(b);');
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
