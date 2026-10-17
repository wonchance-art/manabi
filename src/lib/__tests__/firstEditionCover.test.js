import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FIRST_EDITION_BINDINGS, romanYear, validateFirstEditionDisplay } from '../firstEditionCover.js';
import manifest from '../../content/literature/wikisource/manifest.generated.json';
import { sliceBetween } from './helpers/sliceBetween';

vi.mock('next/font/google', () => new Proxy({}, { get: (_, name) => (name === 'then' ? undefined : () => ({ variable: `fe-${String(name).toLowerCase()}` })), has: () => true }));
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
      expect(FIRST_EDITION_BINDINGS[work.display.binding].script.startsWith({ Chinese: 'zh', French: 'fr', Korean: 'ko', English: 'en' }[work.language])).toBe(true);
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
    expect(html).toMatch(/^<span class="fe-cover[^"]*" style="--fe-ground:#b5462f" data-binding="nahan" data-material="paper" aria-hidden="true">/u);
    expect(html).toContain('lang="zh-Hans"');
    expect(html).toContain('己　乙　孔');
    expect(html).toContain('迅　鲁');
    expect(html).not.toContain('孔　乙　己');
  });
  it('여섯 장정 모두 그린다 · 연도는 로마 숫자 · 모르는 장정·표기 없음은 그리지 않는다', () => {
    for (const [, work] of works) {
      const html = draw(work.display);
      expect(html).toContain(`data-binding="${work.display.binding}"`);
      // 연도는 그 판의 조판대로 — 띄움(「M DCCC LXXIII」) · 붙임(영국 1776 「MDCCLXXVI」 · 1935 「MCMXXXV」) · 마침표(제네바 1782 「M. DCC. LXXXII.」)
      if (work.display.coverYear) {
        const year = romanYear(work.display.coverYear);
        expect([year, year.replace(/ /gu, ''), `${year.split(' ').join('. ')}.`].some((form) => html.includes(form))).toBe(true);
      }
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
    const props = sliceBetween(page, 'const world = work || english || !canonicalCovers ? null : wikisourceWorkOfBook(b) || pdSiteWorkOfBook(b);', '} : null;');
    expect(props).toContain('art: <FirstEditionCover work={world} />');
    expect(props).toContain("world.unit === 'chars' ? '자' : '단어'");
    expect(page).toContain('{...worldProps}');
    expect(page).toContain(': world ? <span lang={worldLang}>{worldChapterOf(c)?.title || c.title}</span>');
    expect(page).toContain('!isCanonicalBookKey(b.key) && b.chapters[0]?.owner_id === user.id'); // 위키문헌 ws- · 전자책 사이트 pd-도 정본 key
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

describe('2차 묶음(오너 「원본 책 재구성 … 표지 만들기까지 완성」 · 「당시 글꼴로, 원본 대조하면서」 2026-10-17 KST)', () => {
  it('2차 19권 + 3차 10권이 저마다 초판 장정 하나 · 빅토리아 키와 겹치지 않는다 · 모두 그린다', async () => {
    const { VICTORIAN_BINDINGS } = await import('../victorianCover.js');
    const se = (await import('../../content/literature/standardebooks/manifest.generated.json')).default;
    const pd = (await import('../../content/literature/pdsite/manifest.generated.json')).default;
    const second = [
      ...works.filter(([, work]) => work.language === 'Korean'),
      ...Object.entries(se.works).filter(([, work]) => !Object.hasOwn(VICTORIAN_BINDINGS, work.display.binding)),
      ...Object.entries(pd.works),
      ...works.filter(([, work]) => ['sonnenschein-1887', 'geneve-1782', 'hartmann-1935'].includes(work.display.binding)), // 3차 위키문헌 영·불
    ];
    // 기미독립선언서 두 판(1919 원문 · 2019 「쉽고 바르게 읽는」)만 같은 문서의 얼굴(보성사 『宣言書』)을 함께 쓴다
    expect(second).toHaveLength(30);
    expect(new Set(second.map(([, work]) => work.display.binding)).size).toBe(29);
    expect(second.filter(([, work]) => work.display.binding === 'boseongsa-1919').map(([key]) => key).sort()).toEqual(['ws-ko-choe-nam-seon_gimi-dongnip-seoneonseo', 'ws-ko-samil-centennial_swipgo-bareuge-ingneun-dongnip-seoneonseo']);
    for (const key of Object.keys(FIRST_EDITION_BINDINGS)) expect(Object.hasOwn(VICTORIAN_BINDINGS, key)).toBe(false);
    for (const [, work] of second) {
      expect(validateFirstEditionDisplay(work.display)).toEqual(work.display);
      expect(draw(work.display)).toContain(`data-binding="${work.display.binding}"`);
    }
  });
  it('그리지 않는 것 — 왕자 그림 · 소행성 · 출판사 문장 · nrf · 실존 인물 서명 · 이정 목판화(근거를 코드 주석에 남긴다)', () => {
    const source = read('src/components/books/FirstEditionCoverSecond.jsx');
    for (const note of ['왕자 그림 · 소행성은 그리지 않는다', '가운데 출판사 문장은 그리지 않는다', 'nrf 모노그램은 그리지 않는다', '실존 인물 서명이라 형태 없는 흘림으로만']) expect(source).toContain(note);
    expect(read('src/lib/firstEditionCover.js')).toContain('이정(1924–1995)의 청색 목판화 표지는 한국에서 보호 중이라 쓰지 않는다');
    // 3차 — 출판사 도안(종 · 문장) · 초상 · 일본 황실 16엽 국화 문장 모양(국화는 고르지 않게 흩은 꽃잎)
    const third = read('src/components/books/FirstEditionCoverThird.jsx');
    for (const note of ['출판사 도안(Bell and Daldy 종 · Swan Sonnenschein 문장)', '초상(프랭클린 권두 초상 · 베네딕트 사진)', '일본 황실 16엽 국화 문장 모양은 그리지 않는다', '대칭 16엽 원판(황실 문장) 모양이 되지 않게']) expect(third).toContain(note);
  });
  it('글꼴 — 실물과 대조해 고른 당시 글꼴 · 글꼴 변수는 늘 대체 이름을 품는다(정의 안 된 var()는 font-family 전체를 무효로 만든다)', () => {
    const source = read('src/components/books/FirstEditionCoverSecond.jsx') + read('src/components/books/FirstEditionCover.jsx') + read('src/components/books/FirstEditionCoverThird.jsx');
    for (const family of ['EB_Garamond', 'Noto_Serif_KR', 'Kirang_Haerang', 'Song_Myung', 'East_Sea_Dokdo', 'Dokdo', 'Nanum_Myeongjo', 'Josefin_Sans', 'Jost', 'Kaushan_Script', 'Yellowtail', 'Gochi_Hand', 'Goudy_Bookletter_1911', 'IM_Fell_English', 'GFS_Didot']) expect(source).toContain(`${family}(`);
    const bare = [...source.matchAll(/var\((--font-[a-z-]+)\)/gu)].map((match) => match[1]);
    expect(bare).toEqual([]);
  });
});

describe('시리즈 공통 원칙 · 빈티지(오너 「일관성 줄 수 있는 원칙 일부와 빈티지 효과」 2026-10-17 KST)', () => {
  it('장정마다 재질 하나 · 낡음 네 겹(가장자리 바램 · 얼룩 · 모서리 닳음 · 인쇄 번짐)은 모든 책에 같고, 같은 책은 늘 같게 그린다', async () => {
    const { FIRST_EDITION_MATERIALS } = await import('../firstEditionCover.js');
    for (const binding of Object.values(FIRST_EDITION_BINDINGS)) expect(FIRST_EDITION_MATERIALS).toContain(binding.material);
    const [, gamja] = works.find(([key]) => key === 'ws-ko-kim-dong-in_gamja');
    const first = draw(gamja.display);
    expect(first).toBe(draw(gamja.display)); // 결정적
    expect(first).toContain('-toning)'); expect(first).toContain('-ink)'); expect(first).toContain('fill="#7a4a1e"'); // 종이라 얼룩이 있다
    const [, verne] = works.find(([key]) => key.includes('jules-verne'));
    expect(draw(verne.display)).not.toContain('fill="#7a4a1e"'); // 천 장정은 얼룩 대신 닳음만
  });
  it('왼쪽 접힘 그림자는 시리즈 A와 같은 값(CSS 한 곳) — 장정마다 따로 그린 책등 띠가 없다', () => {
    const css = read('src/components/books/first-edition-cover.css');
    expect(css).toContain('inset 3px 0 0 color-mix(in srgb,#000 16%,transparent),inset 3.6px 0 0 color-mix(in srgb,#fff 6%,transparent)');
    expect(read('src/components/books/literature-cover.css')).toContain('inset 3px 0 0 color-mix(in srgb,var(--ink) 16%,transparent),inset 3.6px 0 0 color-mix(in srgb,#fff 6%,transparent)');
  });
});
