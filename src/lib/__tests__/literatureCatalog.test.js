import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { breakTitle, CATALOG_CATEGORIES, CATALOG_GROUPS, catalogCoverDisplay, categoryPath, catalogEntryProblems, catalogRightsVerdict, checkedCover, providerOfKey } from '../../../scripts/lib/literature-catalog.mjs';
import { TEMPLATE_BINDINGS, TEMPLATE_PALETTES, validateFirstEditionDisplay } from '../firstEditionCover.js';
import { createPdSiteDraft, inferPdSiteParse, pdSiteParseReport } from '../pdSite.js';

vi.mock('next/font/google', () => new Proxy({}, { get: (_, name) => (name === 'then' ? undefined : () => ({ variable: `fe-${String(name).toLowerCase()}` })), has: () => true }));
const { default: FirstEditionCover } = await import('../../components/books/FirstEditionCover.jsx');

// 정본 책 카탈로그 · 가져오기(LIT-IMPORT-1, 오너 「불러올 수 있는 나라별 인기 있는 작가나 작품 중심으로 리스트 정리 … 언제든 불러오고
// 사용자들이 실사용 할 수 있을 정도로 다듬는 과정까지 모두 프로세스 최적화」 2026-10-17 KST). 카탈로그 한 줄이 가져오기의 입력 전부이고,
// 수록 줄은 작품 폴더를 가리키기만 한다 — 아래 계약이 둘을 맞춰 본다(작품을 넣을 때 테스트 목록을 손으로 고치지 않는다).

const ROOT = 'src/content/literature';
const PROVIDER_DIRS = { aozora: 'aozora', standardebooks: 'standardebooks', wikisource: 'wikisource', pdsite: 'pdsite' };
const catalog = JSON.parse(readFileSync(`${ROOT}/catalog.json`, 'utf8'));
const folders = Object.values(PROVIDER_DIRS).flatMap((dir) => readdirSync(`${ROOT}/${dir}`).filter((key) => existsSync(`${ROOT}/${dir}/${key}/entry.json`)));
const folderOf = (key) => `${ROOT}/${PROVIDER_DIRS[providerOfKey(key)]}/${key}`;

describe('카탈로그 한 파일 — 줄 검사 · 작품 폴더와 맞물림', () => {
  it('모든 줄이 규칙을 통과한다 · id와 key는 겹치지 않는다', () => {
    for (const entry of catalog.works) expect([entry.id, catalogEntryProblems(entry)]).toEqual([entry.id, []]);
    expect(new Set(catalog.works.map((entry) => entry.id)).size).toBe(catalog.works.length);
    const keys = catalog.works.filter((entry) => entry.key).map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('작품 폴더 = 수록 줄(빠짐 · 남는 줄 없음) — 불러올 줄의 key는 아직 폴더가 없다', () => {
    const shelved = catalog.works.filter((entry) => entry.status === '수록').map((entry) => entry.key);
    expect([...shelved].sort()).toEqual([...folders].sort());
    for (const entry of catalog.works.filter((item) => item.status === 'loadable')) expect([entry.id, existsSync(folderOf(entry.key))]).toEqual([entry.id, false]);
  });
  it('수록 줄은 가리키기만 — 사실 칸이 있으면 entry.json과 갈릴 수 있어 막는다', () => {
    expect(catalogEntryProblems({ id: 'gb-x', key: 'se-a_b', status: '수록', country: 'GB', category: 'novel' })).toEqual([]);
    expect(catalogEntryProblems({ id: 'gb-x', key: 'se-a_b', status: '수록', country: 'GB', category: 'novel', title: 'X' })).toEqual([expect.stringContaining('title')]);
    expect(catalogEntryProblems({ id: 'gb-x', key: 'xx-a', status: '수록', country: 'GB', category: 'novel' })).toEqual([expect.stringContaining('key')]);
  });
  it('카테고리 — 큰 갈래 셋 › 작은 갈래 열 · 모든 줄에 작은 갈래 하나(수록 줄도) · 빠지거나 모르는 값은 막는다 · 갈래마다 책이 있다', () => {
    expect(Object.keys(CATALOG_GROUPS)).toEqual(['literature', 'young', 'nonfiction']);
    expect(Object.keys(CATALOG_CATEGORIES)).toEqual(['novel', 'short', 'poetry', 'drama', 'tale', 'youth', 'essay', 'life', 'thought', 'society']);
    for (const [key, { group, label }] of Object.entries(CATALOG_CATEGORIES)) expect([key, Object.hasOwn(CATALOG_GROUPS, group), label.length > 0]).toEqual([key, true, true]);
    expect(categoryPath('novel')).toBe('문학 › 장편소설');
    expect(categoryPath('children')).toBe(null); // 옛 한 단계 값은 모르는 값
    for (const entry of catalog.works) expect([entry.id, Object.hasOwn(CATALOG_CATEGORIES, entry.category)]).toEqual([entry.id, true]);
    expect(catalogEntryProblems({ id: 'gb-x', key: 'se-a_b', status: '수록', country: 'GB' })).toEqual([expect.stringContaining('category')]);
    expect(catalogEntryProblems({ id: 'gb-x', key: 'se-a_b', status: '수록', country: 'GB', category: 'literature' })).toEqual([expect.stringContaining('category')]); // 큰 갈래 key는 줄 값이 아니다
    for (const key of Object.keys(CATALOG_CATEGORIES)) expect([key, catalog.works.some((entry) => entry.category === key)]).toEqual([key, true]);
    const shelvedIn = (group) => catalog.works.filter((entry) => entry.status === '수록' && CATALOG_CATEGORIES[entry.category].group === group).length;
    for (const group of Object.keys(CATALOG_GROUPS)) expect([group, shelvedIn(group) > 0]).toEqual([group, true]);
  });
  it('불러올 줄은 오늘 한국 공개 가능 · 표지 표기가 장정 규칙을 통과한다(아오조라는 시리즈 A 문양 — 사람이 고른다)', () => {
    for (const entry of catalog.works.filter((item) => item.status === 'loadable')) {
      const verdict = catalogRightsVerdict(entry, '2026-10-17');
      expect([entry.id, verdict.ok, verdict.reasons]).toEqual([entry.id, true, []]);
      if (entry.source.provider !== 'aozora') expect(() => checkedCover(entry)).not.toThrow();
    }
  });
  it('막힌 줄은 이유를 적는다 · 나라마다 줄이 있다', () => {
    expect(catalogEntryProblems({ id: 'ru-x', country: 'RU', category: 'novel', language: 'English', title: 'X', author: 'Y', titleKo: 'X', authorKo: 'Y', status: 'blocked', source: { provider: 'standardebooks' } })).toEqual(['blocker(막힌 이유)']);
    expect(new Set(catalog.works.map((entry) => entry.country)).size).toBeGreaterThanOrEqual(8);
  });
});

describe('표지 기본값 — 실물 조사가 없으면 시대 · 언어 틀(지어낸 출판사 · 출판지 없음)', () => {
  const base = { id: 'gb-x', key: 'se-jane-austen_emma', titleKo: '엠마', authorKo: '제인 오스틴', author: 'Jane Austen' };
  it('언어 · 연도마다 틀 하나 · 모두 장정 규칙 통과', () => {
    const cases = [
      [{ ...base, language: 'English', title: 'Gulliver’s Travels', publishedYear: 1726 }, 'tpl-title-page'],
      [{ ...base, language: 'English', title: 'Middlemarch', publishedYear: 1871 }, 'tpl-cloth'],
      [{ ...base, language: 'English', title: 'The Call of the Wild', publishedYear: 1923 }, 'tpl-jacket'],
      [{ ...base, key: 'ws-fr-x_y', language: 'French', title: 'Madame Bovary', author: 'Gustave Flaubert', publishedYear: 1857 }, 'tpl-wrapper'],
      [{ ...base, key: 'ws-zh-x_y', language: 'Chinese', title: '阿Q正传', author: '鲁迅', publishedYear: 1921 }, 'tpl-cjk-vertical'],
      [{ ...base, key: 'ws-ko-x_y', language: 'Korean', title: '무정', author: '이광수', publishedYear: 1917 }, 'tpl-cjk-vertical'],
    ];
    for (const [entry, binding] of cases) {
      const display = catalogCoverDisplay(entry);
      expect([entry.title, display.binding]).toEqual([entry.title, binding]);
      expect(() => validateFirstEditionDisplay(display)).not.toThrow();
      for (const field of ['coverPlace', 'coverImprint']) expect(display).not.toHaveProperty(field);
    }
  });
  it('번역본의 표지 연도는 번역 판의 해 · 실물 조사(cover)가 있으면 그것', () => {
    const translated = { ...base, key: 'ws-fr-x_y', language: 'French', title: 'Les Pensées', author: 'Marc Aurèle', publishedYear: 180, translator: { publishedYear: 1876 } };
    expect(catalogCoverDisplay(translated).coverYear).toBe(1876);
    const surveyed = { ...base, cover: { binding: 'tpl-cloth', coverTitle: 'Emma', coverPalette: 'blue', coverOrnament: 'blind-panel' } };
    expect(catalogCoverDisplay(surveyed)).toMatchObject({ binding: 'tpl-cloth', coverPalette: 'blue', titleKo: '엠마' });
  });
  it('제목 줄 나누기는 단어 경계에서 · 못 나누면 null(사람이 cover를 적는다)', () => {
    expect(breakTitle('The Call of the Wild', 16, 3)).toBe('The Call of the\nWild');
    expect(breakTitle('Incomprehensibilities', 16, 3)).toBe(null);
  });
});

describe('틀 장정 — 다섯 틀을 그린다 · 색은 재질에 맞아야', () => {
  const samples = {
    'tpl-cloth': { coverTitle: 'Emma', coverPalette: 'blue', coverOrnament: 'gilt-title' },
    'tpl-title-page': { coverTitle: 'Gulliver’s\nTravels', coverAuthor: 'By Lemuel Gulliver', coverPalette: 'cream', coverYear: 1726 },
    'tpl-wrapper': { coverTitle: 'Madame\nBovary', coverAuthor: 'Gustave Flaubert', coverPalette: 'yellow', coverOrnament: 'double-rule', coverYear: 1857 },
    'tpl-jacket': { coverTitle: 'The Call\nof the Wild', coverAuthor: 'Jack London', coverPalette: 'buff' },
    'tpl-cjk-vertical': { coverTitle: '阿Q正传', coverAuthor: '鲁迅', coverPalette: 'cream' },
  };
  it('목록의 모든 틀에 표본이 있고, 그리면 제목 글자가 나온다', () => {
    expect(Object.keys(samples).sort()).toEqual(Object.keys(TEMPLATE_BINDINGS).sort());
    for (const [binding, fields] of Object.entries(samples)) {
      const display = validateFirstEditionDisplay({ binding, titleKo: '제목', authorKo: '작가', ...fields });
      const html = renderToStaticMarkup(createElement(FirstEditionCover, { work: { display } }));
      const first = fields.coverTitle.split('\n')[0];
      expect([binding, html.includes(binding === 'tpl-cjk-vertical' ? first : first.toUpperCase())]).toEqual([binding, true]);
    }
  });
  it('천 틀에 종이 색 · 종이 장식은 안 된다', () => {
    const paper = Object.keys(TEMPLATE_PALETTES).find((key) => TEMPLATE_PALETTES[key].material === 'paper');
    expect(() => validateFirstEditionDisplay({ binding: 'tpl-cloth', titleKo: '엠마', authorKo: '오스틴', coverTitle: 'Emma', coverPalette: paper, coverOrnament: 'gilt-title' })).toThrow(/coverPalette/u);
    expect(() => validateFirstEditionDisplay({ binding: 'tpl-cloth', titleKo: '엠마', authorKo: '오스틴', coverTitle: 'Emma', coverPalette: 'blue', coverOrnament: 'double-rule' })).toThrow(/coverOrnament/u);
  });
});

describe('전자책 사이트 parse 추정 — 리포 판으로 맞춰 본다', () => {
  const pd = folders.filter((key) => key.startsWith('pd-')).map((key) => {
    const entry = JSON.parse(readFileSync(`${folderOf(key)}/entry.json`, 'utf8'));
    const html = new TextDecoder(entry.file.encoding).decode(readFileSync(`${folderOf(key)}/source/${entry.file.path}`));
    return { key, entry, html, built: JSON.parse(readFileSync(`${folderOf(key)}/chapters.json`, 'utf8')).chapters };
  });
  it('머리글이 고른 판은 추정 parse가 손으로 쓴 parse와 같은 장을 낸다 · 버린 머리글은 보고한다', () => {
    const same = pd.filter(({ entry, html, built }) => {
      const parse = inferPdSiteParse(html);
      return parse && JSON.stringify(createPdSiteDraft({ ...entry, parse }, html).chapters.map((c) => c.rawText)) === JSON.stringify(built.map((c) => c.rawText));
    }).map(({ key }) => key);
    expect(same.length).toBeGreaterThanOrEqual(3);
    const prince = pd.find(({ key }) => key.includes('petit-prince'));
    expect(pdSiteParseReport(prince.html, inferPdSiteParse(prince.html)).leadHeadings).toContain('PREMIER CHAPITRE'); // 사람이 보게 남는다
  });
  it('머리글이 고르지 않으면 추정하지 않는다(null — 카탈로그 source.parse를 사람이 쓴다)', () => {
    expect(inferPdSiteParse('<p>one</p><p>two</p>')).toBe(null);
  });
});
