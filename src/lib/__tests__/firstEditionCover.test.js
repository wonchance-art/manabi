import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FIRST_EDITION_BINDINGS, romanYear, validateFirstEditionDisplay } from '../firstEditionCover.js';
import manifest from '../../content/literature/wikisource/manifest.generated.json';
import { sliceBetween } from './helpers/sliceBetween';

vi.mock('next/font/google', () => ({
  Noto_Serif_SC: () => ({ variable: 'ws-song' }), Bodoni_Moda: () => ({ variable: 'ws-didone' }),
  Metamorphous: () => ({ variable: 'ws-pointed' }), Rye: () => ({ variable: 'ws-ornate' }),
}));
const { default: FirstEditionCover, FIRST_EDITION_GROUNDS } = await import('../../components/books/FirstEditionCover.jsx');

// 중국어·프랑스어 정본 책 표지 「초판 장정」(LIT-SRC-WS-1, 오너 「권장대로」 2026-10-17 KST) — 표기 검사 · 초판 구성 · 그리기 · 배선.

const read = (file) => readFileSync(path.join(process.cwd(), file), 'utf8');
const works = Object.entries(manifest.works);
const draw = (display) => renderToStaticMarkup(createElement(FirstEditionCover, { work: { display } }));

describe('표지 표기 — 빌드가 entry.json display를 검사한다', () => {
  const nahan = { titleKo: '쿵이지', authorKo: '루쉰', binding: 'nahan', coverTitle: '孔乙己', coverAuthor: '鲁迅' };
  const lemerre = { titleKo: '마지막 수업', authorKo: '알퐁스 도데', binding: 'lemerre', coverAuthor: 'Alphonse Daudet', coverTitle: 'La dernière\nClasse', coverPlace: 'Paris', coverImprint: 'Alphonse Lemerre, éditeur', coverYear: 1873 };
  it('정본 키만 받는다 — 장정마다 앞표지에 있는 글자 칸만', () => {
    expect(validateFirstEditionDisplay(nahan)).toEqual(nahan);
    expect(validateFirstEditionDisplay(lemerre)).toEqual(lemerre);
    expect(() => validateFirstEditionDisplay({ ...nahan, binding: 'original-cover-scan' })).toThrow(/binding/u); // 원본을 옮겨 붙이는 키는 없다
    expect(() => validateFirstEditionDisplay({ ...nahan, coverImprint: '新潮社' })).toThrow(/이 장정의 앞표지에는 없다/u);
    expect(() => validateFirstEditionDisplay({ ...nahan, coverTitle: 'Kong' })).toThrow(/한자만/u);
    expect(() => validateFirstEditionDisplay({ ...nahan, coverTitle: '孔乙己孔' })).toThrow(/coverTitle/u);
    expect(() => validateFirstEditionDisplay({ ...lemerre, coverYear: undefined })).toThrow(/연도가 있다/u);
    expect(() => validateFirstEditionDisplay({ ...nahan, coverYear: 1923 })).toThrow(/연도가 없다/u);
    expect(() => validateFirstEditionDisplay({ ...lemerre, coverTitle: 'A\nB\nC' })).toThrow(/coverTitle/u);
    expect(() => validateFirstEditionDisplay({ ...lemerre, coverLogo: 'x' })).toThrow(/모르는 칸/u);
    expect(() => validateFirstEditionDisplay({ ...lemerre, titleKo: ' ' })).toThrow(/titleKo/u);
  });
  it('로마 숫자 연도 — 천 · 백 · 나머지 두 자리(Lemerre 1873 · Pagnerre 1862 실물)', () => {
    expect(romanYear(1873)).toBe('M DCCC LXXIII');
    expect(romanYear(1862)).toBe('M DCCC LXII');
    expect(romanYear(1900)).toBe('M CM');
    expect(() => romanYear(873)).toThrow();
  });
  it('리포 11편 — 초판 장정(『呐喊』 두 편 · 『背影』 · Lemerre · Marpon · Hetzel · Pagnerre 다섯 권)', () => {
    const byBinding = (binding) => works.filter(([, work]) => work.display.binding === binding).map(([key]) => key).sort();
    expect(byBinding('nahan')).toEqual(['ws-zh-lu-xun_gu-xiang', 'ws-zh-lu-xun_kong-yi-ji']);
    expect(byBinding('kaiming')).toEqual(['ws-zh-zhu-ziqing_bei-ying']);
    expect(byBinding('lemerre')).toEqual(['ws-fr-alphonse-daudet_la-derniere-classe']);
    expect(byBinding('marpon')).toEqual(['ws-fr-guy-de-maupassant_la-parure']);
    expect(byBinding('hetzel')).toEqual(['ws-fr-jules-verne_le-tour-du-monde-en-quatre-vingts-jours']);
    expect(byBinding('pagnerre')).toHaveLength(5);
    for (const [, work] of works) {
      expect(validateFirstEditionDisplay(work.display)).toEqual(work.display);
      expect(FIRST_EDITION_BINDINGS[work.display.binding].script.startsWith(work.language === 'Chinese' ? 'zh' : 'fr')).toBe(true);
    }
    // 레미제라블 다섯 권은 같은 장정 · 부(part)만 다르다
    const tomes = works.filter(([, work]) => work.display.binding === 'pagnerre').map(([, work]) => work.display.coverPart);
    expect(new Set(tomes).size).toBe(5);
  });
});

describe('그리기', () => {
  it('장식(aria-hidden) · 글자 언어 · 『呐喊』은 실물대로 오른쪽→왼쪽(「己乙孔」)', () => {
    const [, kongYiJi] = works.find(([key]) => key === 'ws-zh-lu-xun_kong-yi-ji');
    const html = draw(kongYiJi.display);
    expect(html).toMatch(/^<span class="fe-cover[^"]*" style="--fe-ground:#b5462f" data-binding="nahan" aria-hidden="true">/u);
    expect(html).toContain('lang="zh-Hans"');
    expect(html).toContain('己　乙　孔');
    expect(html).toContain('迅　鲁');
    expect(html).not.toContain('孔　乙　己');
  });
  it('여섯 장정 모두 그린다 · 연도는 로마 숫자 · 모르는 장정·표기 없음은 그리지 않는다', () => {
    for (const [, work] of works) {
      const html = draw(work.display);
      expect(html).toContain(`data-binding="${work.display.binding}"`);
      if (work.display.coverYear) expect(html).toContain(romanYear(work.display.coverYear));
      if (work.language === 'French') expect(html).toContain('lang="fr"');
    }
    expect(draw({ binding: 'unknown' })).toBe('');
    expect(renderToStaticMarkup(createElement(FirstEditionCover, { work: null }))).toBe('');
    expect(Object.keys(FIRST_EDITION_GROUNDS).sort()).toEqual(Object.keys(FIRST_EDITION_BINDINGS).sort());
  });
  it('사람·출판사 도안은 그리지 않는다 — 앞표지 글자에 출판사 표지·모노그램 칸이 없다', () => {
    const source = read('src/components/books/FirstEditionCover.jsx');
    expect(source).toContain('모노그램 대신 별');
    expect(source).toContain('도안은 그리지 않는다');
    expect(source).toContain('날개 단 여인은 사람이라 빼고');
  });
  it('따로 그린 표지끼리도 정의 id가 겹치지 않는다(장정 이름을 id에 붙인다)', () => {
    const [, verne] = works.find(([key]) => key.includes('jules-verne'));
    const html = renderToStaticMarkup(createElement('div', null, createElement(FirstEditionCover, { work: verne }), createElement(FirstEditionCover, { work: verne })));
    const ids = [...html.matchAll(/ id="([^"]+)"/gu)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(4);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('배선 — 서재 카드·게시 화면·빌드', () => {
  it('서재 카드: 위키문헌 책은 초판 장정 표지 + 원제 + 한국어 제목 · 글자/단어 수 · 장 제목, 「다음 과 적기」 없음', () => {
    const page = read('src/views/MaterialsPage.jsx');
    const props = sliceBetween(page, 'const world = work || english ? null : wikisourceWorkOfBook(b) || pdSiteWorkOfBook(b);', '} : null;');
    expect(props).toContain('art: <FirstEditionCover work={world} />');
    expect(props).toContain("world.unit === 'chars' ? '자' : '단어'");
    expect(page).toContain('{...worldProps}');
    expect(page).toContain(': world ? <span lang={worldLang}>{worldChapterOf(c)?.title || c.title}</span>');
    expect(page).toContain('!work && !english && !world && b.chapters[0]?.owner_id === user.id');
  });
  it('게시 화면 표지: 위키문헌 책은 초판 장정', () => {
    const cover = sliceBetween(read('src/components/LiteraturePublishPanel.jsx'), 'export function BookCover', '\n}\n');
    expect(cover).toContain('wikisourceWork(bookKey) || pdSiteWork(bookKey)');
    expect(cover).toContain('<FirstEditionCover work={world} />');
  });
  it('빌드는 기본으로 초판 장정 표기를 검사한다', () => {
    expect(read('scripts/lib/wikisource-build.mjs')).toContain("validateCover ?? (await import('../../src/lib/firstEditionCover.js')).validateFirstEditionDisplay");
  });
});
