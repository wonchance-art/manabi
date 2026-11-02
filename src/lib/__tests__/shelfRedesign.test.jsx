// 책장 개편(SHELF-REDESIGN-001 — 오너 승인 목업 2026-11-02 KST) 계약.
// ① 탭 = 제목 바로 아래 · 일본어 · 중국어 · 영어 · 프랑스어 · 전체(맨 뒤) ② 큰 「공부 시작하기」 카드 없음 — 읽은 기록이 있을 때만 한 줄 「이어 하기」(가장 최근 책)
// ③ 「책」 → 「단어 · 문형」, 나온 책이 없는 언어는 타일이 먼저 · 책은 점선 「준비 중」 한 줄 ④ 표지 캡션 「N5 · 42과」 / 진도 「12/42과」
// ⑤ 공개 읽을거리 링크는 모든 언어 탭 ⑥ 표지 줄과 타일 줄은 같은 격자(PC 같은 열 · 간격, 좁은 셸 150px 가로 줄)
// ⑦ 정적 판 — 붙기 전(서버 · 첫 그림)에는 기록을 그리지 않고, 줄 자리는 그리기 전 한 줄(shelfResumeHintScript)이 잡는다. 실제 0밀림 · 좌표는 빌드 측정이 본다.
import fs from 'node:fs';
import vm from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

const state = vi.hoisted(() => ({ progress: {}, ready: true, profile: null }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ profile: state.profile, user: null, loading: false }) }));
// useReadingProgress의 돌려주는 꼴 그대로 — 판본별 기록(없으면 빈 기록 · hasProgress false).
vi.mock('@/components/books/useReadingProgress', () => ({ default: edition => {
  const record = state.progress[edition];
  if (!state.ready) return { progress: { page: 'u01-start', completed: [] }, hasProgress: false, ready: false, updatedAt: null };
  return record ? { progress: { page: record.page, completed: record.completed || [] }, hasProgress: true, ready: true, updatedAt: record.updatedAt ?? null }
    : { progress: { page: 'u01-start', completed: [] }, hasProgress: false, ready: true, updatedAt: null };
} }));

import Bookshelf, { latestReading } from '@/components/books/Bookshelf';
import { SHELF_RESUME_HINT_CSS, SHELF_RESUME_HINT_ID, shelfResumeHintScript } from '@/components/books/bookEntryGate';
import { readingProgressKey } from '@/lib/bookNavigation';

const lessons = n => Array.from({ length: n }, (_, i) => ({ id: `u${String(i + 1).padStart(2, '0')}`, number: i + 1, part: '파트', title: `${i + 1}과 제목` }));
const n5 = { bookId: 'japanese-n5', level: 'N5', edition: '1'.repeat(24), title: '작은 문장으로 시작하는 일본어', lessons: lessons(42), cultures: [] };
const n4 = { ...n5, bookId: 'japanese-n4', level: 'N4', edition: '2'.repeat(24), title: '문장을 이어, 내 이야기를 하는 일본어' };
const n3 = { ...n5, bookId: 'japanese-n3', level: 'N3', edition: '3'.repeat(24), title: '근거를 읽고, 내 생각을 전하는 일본어', lessons: lessons(48) };
const books = [n5, n4, n3];
const jaTiles = ['N5', 'N4', 'N3', 'N2', 'N1'].map(levelKey => ({ levelKey, vocab: 100, bunkei: 10 }));
const zhTiles = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7'].map((levelKey, i) => ({ levelKey, vocab: 100, ...(i < 6 ? { bunkei: 10 } : {}), ...(i < 2 ? { hanzi: 50 } : {}) }));
const levelTiles = { Japanese: jaTiles, Chinese: zhTiles, English: [{ levelKey: 'A1', vocab: 53 }], French: [{ levelKey: 'A1', vocab: 8 }] };
const render = (initialLang, props = {}) => renderToStaticMarkup(createElement(Bookshelf, { books, initialLang, levelTiles, ...props }));
const at = (html, needle) => { const i = html.indexOf(needle); expect(i, needle).toBeGreaterThanOrEqual(0); return i; };

beforeEach(() => { state.progress = {}; state.ready = true; state.profile = null; });

describe('① 탭 — 제목 바로 아래, 「전체」는 맨 뒤', () => {
  it('일본어 · 중국어 · 영어 · 프랑스어 · 전체 순서, 「전체 시리즈」 이름은 없다', () => {
    const html = render('Japanese');
    const tabs = sliceBetween(html, '<div class="shelf-language-tabs"', '</div>');
    expect([...tabs.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map(m => m[1])).toEqual(['일본어', '중국어', '영어', '프랑스어', '전체']);
    expect(html).not.toContain('전체 시리즈');
    expect(html).toMatch(/<\/h1><\/header><div class="shelf-language-tabs"/);
  });
  it('첫 탭은 ?lang(언어 판) 그대로, 없으면 「전체」', () => {
    expect(render('Chinese')).toMatch(/aria-pressed="true"[^>]*>중국어</);
    expect(render(undefined)).toMatch(/aria-pressed="true">전체</);
  });
});

describe('② 이어 하기 한 줄', () => {
  it('기록이 없으면(손님 첫 방문) 줄도, 옛 「공부 시작하기」 카드도 없다', () => {
    const html = render('Japanese');
    expect(html).not.toContain('class="shelf-continue');
    expect(html).not.toContain('공부 시작하기');
    expect(html).not.toContain('shelf-resume"');
  });
  it('기록이 있으면 가장 최근 책 하나 — 「이어 하기 · 일본어 N5」 · 「03과 · 제목」 · 「12/42」 · →, 그 자리로 가는 링크', () => {
    state.progress[n5.edition] = { page: 'u03-reading', completed: lessons(12).map(l => l.id), updatedAt: '2026-11-02T09:00:00.000Z' };
    state.progress[n4.edition] = { page: 'u07-start', updatedAt: '2026-11-01T09:00:00.000Z' };
    const html = render('Japanese');
    expect(html.match(/class="shelf-continue"/g)).toHaveLength(1);
    const row = sliceBetween(html, '<a class="shelf-continue"', '</a>');
    expect(row).toContain(`href="/books/japanese-n5?edition=${n5.edition}#u03-reading"`);
    expect(row).toContain('<small>이어 하기 · 일본어 N5</small><strong>03과 · 3과 제목</strong>');
    expect(row).toContain('<span aria-hidden="true">12/42</span>');
    expect(row).toContain('이 브라우저의 기록');
    // 줄은 탭 바로 아래, 「책」보다 앞
    expect(at(html, 'shelf-language-tabs')).toBeLessThan(at(html, 'class="shelf-continue"'));
    expect(at(html, 'class="shelf-continue"')).toBeLessThan(at(html, '>책</h2>'));
  });
  it('가장 최근 = updatedAt — 시각 없는 옛 기록은 가장 오래된 것, 기록 없는 책은 고르지 않는다', () => {
    const r = (name, updatedAt, resume = {}) => ({ name, updatedAt, resume });
    expect(latestReading([r('a', null), r('b', '2026-11-01T00:00:00Z'), r('c', '2026-10-01T00:00:00Z')]).name).toBe('b');
    expect(latestReading([r('a', null), r('b', null)]).name).toBe('a');
    expect(latestReading([{ name: 'x', updatedAt: '2026-11-02T00:00:00Z', resume: null }])).toBeNull();
  });
  it('책이 없는 언어 탭에는 줄이 없다(일본어 기록이 있어도)', () => {
    state.progress[n5.edition] = { page: 'u03-reading', updatedAt: '2026-11-02T09:00:00.000Z' };
    for (const lang of ['Chinese', 'English', 'French']) expect(render(lang)).not.toContain('shelf-continue');
  });
});

describe('③ 칸 순서 · ④ 캡션', () => {
  it('일본어: 「책」 → 「단어 · 문형」, 캡션 「N5」 + 「42과」(언어 이름은 탭이 말한다)', () => {
    const html = render('Japanese');
    expect(at(html, '>책</h2>')).toBeLessThan(at(html, '>단어 · 문형</h2>'));
    expect(html).toContain('<span class="manabi-series-caption"><strong>N5</strong><small>42과</small></span>');
    expect(html).toContain('<span class="manabi-series-caption"><strong>N3</strong><small>48과</small></span>');
    expect(html).toContain('aria-label="일본어 N5 책 둘러보기"');
    expect(html).not.toContain('shelf-pending');
  });
  it('진도가 있는 책만 「12/42과」(강조색 클래스) — 다른 책은 총 과 수', () => {
    state.progress[n5.edition] = { page: 'u03-reading', completed: lessons(12).map(l => l.id), updatedAt: '2026-11-02T09:00:00.000Z' };
    const html = render('Japanese');
    expect(html).toContain('<strong>N5</strong><small class="is-progress">12/42과</small>');
    expect(html).toContain('<strong>N4</strong><small>42과</small>');
  });
  it.each([['Chinese', '중국어', '단어 · 문형 · 한자'], ['English', '영어', '단어'], ['French', '프랑스어', '단어']])('%s: 타일이 먼저, 「책」은 점선 「준비 중」 한 줄(큰 빈 표지 없음)', (lang, name, heading) => {
    const html = render(lang);
    expect(at(html, `>${heading}</h2>`)).toBeLessThan(at(html, '>책</h2>'));
    expect(html).toContain(`<p class="shelf-pending"><span>${name} 교재</span><span>준비 중</span></p>`);
    expect(html).not.toContain('manabi-series-book');
    expect(html).not.toContain('is-unpublished');
  });
  it('영어 · 프랑스어 A1 단어 타일은 단어 페이지로', () => {
    expect(render('English')).toContain('href="/english/words/a1"');
    expect(render('French')).toContain('href="/french/words/a1"');
  });
  it('전체: 나온 책 표지(캡션에 언어 이름) + 나머지 언어는 「준비 중」 줄, 타일 없음', () => {
    const html = render(undefined);
    expect(html).toContain('<strong>일본어 N5</strong>');
    expect(html.match(/class="shelf-pending"/g)).toHaveLength(3);
    expect(html).not.toContain('lv-shelf');
  });
  it('교재를 못 받으면 「준비 중」이 아니라 다시 시도 안내', () => {
    const html = render('Japanese', { books: [] });
    expect(html).toContain('발행 교재를 불러오지 못했어요.');
    expect(html).not.toContain('일본어 교재</span>');
  });
});

describe('⑤ 공개 읽을거리 · 관리자 줄', () => {
  it.each(['Japanese', 'Chinese', 'English', 'French'])('%s 탭 — 평범한 링크(제목 아님)', lang => {
    const html = render(lang);
    expect(html).toContain(`<p class="shelf-public"><a class="shelf-public__link" href="/materials?tab=public&amp;lang=${lang}">이 언어의 공개 읽을거리<span aria-hidden="true">→</span></a></p>`);
  });
  it('전체 탭에는 없고, 관리자 줄은 관리자에게만', () => {
    expect(render(undefined)).not.toContain('공개 읽을거리');
    expect(render('Japanese')).not.toContain('manabi-admin-entry');
    state.profile = { role: 'admin' };
    expect(render('Japanese')).toContain('href="/admin/books/japanese-n3"');
  });
});

describe('⑥ 표지 줄과 타일 줄은 같은 격자', () => {
  const rowClass = (html, cls) => html.match(new RegExp(`class="${cls} (shelf-grid[^"]*)"`))?.[1];
  it('표지 줄 · 타일 줄의 격자 클래스가 같다(일본어 5열)', () => {
    const html = render('Japanese');
    expect(rowClass(html, 'manabi-series-shelf')).toBe('shelf-grid');
    expect(rowClass(html, 'lv-tiles')).toBe('shelf-grid');
    // 타일이 7개인 언어에 책이 생겨도 표지 줄이 같은 7열을 따른다
    const seven = render('Japanese', { levelTiles: { Japanese: zhTiles.map(t => ({ ...t })) } });
    expect(rowClass(seven, 'manabi-series-shelf')).toBe('shelf-grid shelf-grid--7');
    expect(rowClass(seven, 'lv-tiles')).toBe('shelf-grid shelf-grid--7');
  });
  const css = fs.readFileSync('src/components/web/web-shell.css', 'utf8');
  const levelCss = fs.readFileSync('src/components/levels/level-list.css', 'utf8');
  // 셸 640 접힘 블록 가운데 책장 규칙이 사는 블록(.shelf-intro와 같은 줄).
  const narrow = css.split('\n').find(line => line.startsWith('@container manabi-shell (max-width:640px){') && line.includes('.shelf-intro'));
  it('PC — 한 규칙(.shelf-grid)이 열 · 간격을 정한다: 5열 · 12px, 6 · 7열은 modifier', () => {
    expect(css).toContain('.manabi-app .shelf-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:0}');
    expect(css).toContain('.manabi-app .shelf-grid--6{grid-template-columns:repeat(6,minmax(0,1fr))}');
    expect(css).toContain('.manabi-app .shelf-grid--7{grid-template-columns:repeat(7,minmax(0,1fr))}');
    // 표지 · 타일이 각자 열 · 간격을 다시 정하지 않는다(어긋남의 원인)
    for (const sheet of [css, levelCss].map(text => text.replace(/\/\*[\s\S]*?\*\//g, ''))) {
      expect(sheet).not.toMatch(/\.manabi-series-shelf\{[^}]*(grid-template-columns|gap)/);
      expect(sheet).not.toMatch(/\.lv-tiles[^{}]*\{[^}]*(grid-template-columns|gap)/);
    }
  });
  it('좁은 셸(≤640) — 둘 다 150px 칸 · 12px 간격의 가로 줄(칸마다 멈춤)', () => {
    expect(narrow).toContain('.manabi-app .shelf-grid{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px}');
    expect(narrow).toContain('.manabi-app .shelf-grid>*{flex:0 0 150px;width:150px;scroll-snap-align:start}');
  });
  it('칸 이름은 한 규칙(.shelf-section-h) — 「책」과 「단어 · 문형」이 같은 모양', () => {
    const html = render('Japanese');
    expect(html).toContain('<h2 id="shelf-books-h" class="shelf-section-h">책</h2>');
    expect(html).toContain('<h2 id="lv-shelf-h" class="shelf-section-h">단어 · 문형</h2>');
    expect(levelCss).not.toMatch(/\.lv-shelf h2\{/);
  });
  it('누르는 자리 44px — 이어 하기 줄 · 공개 읽을거리 링크', () => {
    expect(css).toMatch(/\.shelf-continue\{[^}]*min-height:44px/);
    expect(css).toMatch(/\.shelf-public__link\{[^}]*min-height:44px/);
  });
});

describe('⑦ 정적 판 — 붙기 전에는 기록을 그리지 않고, 줄 자리는 그리기 전 한 줄이 잡는다', () => {
  it('붙기 전(!ready): 진짜 줄 · 진도 캡션 없이 그리기 전 한 줄 + 꺼진 빈 줄만 — 서버 · 첫 그림이 같다', () => {
    state.ready = false;
    state.progress[n5.edition] = { page: 'u03-reading', updatedAt: '2026-11-02T09:00:00.000Z' };
    const html = render('Japanese');
    expect(html).not.toContain('class="shelf-continue"');
    expect(html).not.toContain('is-progress');
    const hold = sliceBetween(html, '<div class="shelf-continue-hold">', '</div></div>');
    expect(hold).toContain(`<script>${shelfResumeHintScript(books)}</script>`);
    expect(hold).toContain('<div class="shelf-continue shelf-continue--ghost" aria-hidden="true">');
  });
  it('빈 줄은 평소 꺼져 있고, 그리기 전 한 줄의 style만 켠다(켜는 규칙이 이기는 특이도)', () => {
    const css = fs.readFileSync('src/components/web/web-shell.css', 'utf8');
    expect(css).toContain('\n.shelf-continue--ghost{display:none}');
    expect(SHELF_RESUME_HINT_CSS).toBe('.shelf-continue-hold>.shelf-continue--ghost{display:flex}');
    expect(css).not.toMatch(/\.manabi-app \.shelf-continue--ghost/);
    // 빈 자리에는 여백이 없다 — 손님(기록 없음)의 자리가 붙은 뒤 빠질 때 탭 아래 여백이 바뀌어 밀렸다(빌드 실측 3px, 2026-11-02 KST).
    expect(css).not.toMatch(/\.shelf-continue-hold\{/);
    expect(css).toMatch(/\n\.shelf-continue\{[^}]*margin:0 0 28px/);
  });

  const hintFor = (store, cookie = '', existing = false) => {
    const keys = Object.keys(store), appended = [];
    const localStorage = { get length() { return keys.length; }, key: i => keys[i] ?? null, getItem: k => (k in store ? store[k] : null) };
    const document = { cookie, getElementById: () => (existing ? {} : null), createElement: () => ({}), head: { appendChild: node => appended.push(node) } };
    vm.runInNewContext(shelfResumeHintScript(books), { localStorage, document });
    return appended;
  };
  const SESSION = 'sb-abcdef-auth-token=1';
  it('손님: 이 책들 중 하나라도 과 쪽 기록이 있으면 style 하나 — 망가진 · 범위 밖 기록은 넘긴다', () => {
    expect(hintFor({})).toHaveLength(0);
    expect(hintFor({ [readingProgressKey(n4.edition)]: '{"page":"u07-start"}' })).toEqual([{ id: SHELF_RESUME_HINT_ID, textContent: SHELF_RESUME_HINT_CSS }]);
    expect(hintFor({ [readingProgressKey(n3.edition)]: '{"page":"u48-review"}' })).toHaveLength(1);
    expect(hintFor({ [readingProgressKey(n5.edition)]: '{"page":"u48-review"}' })).toHaveLength(0); // N5는 42과까지
    expect(hintFor({ [readingProgressKey(n5.edition)]: '{' , [readingProgressKey(n4.edition)]: '{"page":"u02-start"}' })).toHaveLength(1);
    expect(hintFor({ [readingProgressKey(n5.edition)]: '{"page":"guide-start"}' })).toHaveLength(0);
    expect(hintFor({ [readingProgressKey('9'.repeat(24))]: '{"page":"u03-start"}' })).toHaveLength(0);
  });
  it('세션 쿠키가 있으면 계정 기록만, 없으면 손님 기록만 본다(계정 id는 읽지 않는다)', () => {
    const account = readingProgressKey(n5.edition, 'account-a'), guest = readingProgressKey(n5.edition);
    expect(hintFor({ [account]: '{"page":"u03-start"}' })).toHaveLength(0);
    expect(hintFor({ [account]: '{"page":"u03-start"}' }, SESSION)).toHaveLength(1);
    expect(hintFor({ [guest]: '{"page":"u03-start"}' }, SESSION)).toHaveLength(0);
  });
  it('이미 넣었으면 다시 넣지 않고, 저장소가 막혀도 조용히 · 판본 id가 아닌 책은 빼고 다 빠지면 한 줄 자체가 없다', () => {
    expect(hintFor({ [readingProgressKey(n5.edition)]: '{"page":"u03-start"}' }, '', true)).toHaveLength(0);
    const document = { cookie: '', getElementById: () => null, createElement: () => ({}), head: { appendChild: () => { throw new Error('no'); } } };
    expect(() => vm.runInNewContext(shelfResumeHintScript(books), { get localStorage() { throw new Error('blocked'); }, document })).not.toThrow();
    expect(shelfResumeHintScript([{ ...n5, edition: '";</script><script>bad' }])).toBe('');
    expect(shelfResumeHintScript([])).toBe('');
  });
});

// 서재 자료 줄(library.css .shelf-row)과 이름이 겹치면 서재 줄이 5열 격자가 된다(#1654 CI library-book-chapters 실패 — 「8과 더보기」를
// 링크가 덮음). 책장 격자는 .shelf-grid만 쓴다.
describe('책장 격자는 서재 줄(.shelf-row)과 이름을 나누어 쓴다', () => {
  it('web-shell.css의 책장 격자 규칙은 .shelf-grid — .shelf-row에 격자 · 가로 넘기기를 걸지 않는다', () => {
    const shell = fs.readFileSync('src/components/web/web-shell.css', 'utf8');
    expect(shell).toContain('.manabi-app .shelf-grid{display:grid;');
    expect(shell).not.toMatch(/\.shelf-row(?![-\w])\s*(>\s*\*)?\s*\{/);
  });
});
