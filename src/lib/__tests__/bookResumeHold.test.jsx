// 표지 이어 읽기 줄 자리(BOOK-RESUME-HOLD-001): 읽던 기록이 과 첫머리가 아니면 붙은 뒤 「NN과 이어 읽기 → · NN과 처음부터」 두 칸이 되어
// 390폭에서 책 머리가 49px 자랐다(담기 버튼 · 목차 밀림, N4 CLS 0.024–0.029 · N5 0.028–0.029 — 빌드 실측 2026-10-18 KST).
// 계약 = ① 그리기 전 한 줄(resumeHintScript)의 판정이 BookHome의 「처음부터」 칸 판정(bookResume)과 같다 ② 붙기 전 마크업에 그 한 줄과
// 보이지 않는 두 칸이 같은 칸에 함께 가고, 붙은 뒤에는 둘 다 없다 ③ 두 칸은 평소 꺼져 있고 판본별 style만 켠다. 실제 0밀림은 빌드 측정이 본다.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/components/library/LibrarySaveButton', () => ({ default: () => null }));

import BookHome from '@/components/books/BookHome';
import { RESUME_HINT_ID, resumeHintCss, resumeHintScript } from '@/components/books/bookEntryGate';
import { readingProgressKey, validReadingProgress } from '@/lib/bookNavigation';
import { bookResume } from '@/lib/webNavigation';
import { sliceBetween } from './helpers/sliceBetween';

const ROOT = path.resolve(__dirname, '../../..');
const edition = 'f4a6411c0945bbd3f8767af7';
const lessons = Array.from({ length: 42 }, (_, i) => ({ id: `u${String(i + 1).padStart(2, '0')}`, number: i + 1, part: i < 7 ? '첫 파트' : '다음 파트', title: `${i + 1}과` }));
const book = { bookId: 'japanese-n4', level: 'N4', edition, title: '문장을 이어, 내 이야기를 하는 일본어', lessons, cultures: [] };

/** 정본 문자열을 vm에서 그대로 돌린다 — 넣은 style들. */
const hintFor = (store, session = false, existing = false) => {
  const keys = Object.keys(store), appended = [];
  const localStorage = { get length() { return keys.length; }, key: (i) => keys[i] ?? null, getItem: (k) => (k in store ? store[k] : null) };
  const document = { getElementById: () => (existing ? {} : null), createElement: () => ({}), head: { appendChild: (node) => appended.push(node) } };
  vm.runInNewContext(resumeHintScript(edition, session), { localStorage, document });
  return appended;
};
/** BookHome이 붙은 뒤 「NN과 처음부터」 칸을 그리는가 — useReadingProgress와 같은 식(hasProgress = 기록의 page가 유효한 그대로). */
const twoCells = (raw) => {
  let value = null;
  try { value = JSON.parse(raw ?? 'null'); } catch { /* 망가진 기록은 새로 시작 */ }
  const progress = validReadingProgress(value);
  const resume = bookResume(book, progress, !!value && value.page === progress.page);
  return resume.started && resume.page !== `${resume.lesson.id}-start`;
};
const RECORDS = [undefined, 'null', '{', '[]', '{"page":5}', '{"page":"u03-start"}', '{"page":"u03-patterns","completed":["u01"]}', '{"page":"u03"}',
  '{"page":"u42-review"}', '{"page":"u43-start"}', '{"page":"guide-start"}', '{"page":"U03-patterns"}', '{"page":"u03-start-x"}', '{"page":"u01-start","completed":["u01","u02"]}'];

describe('그리기 전 한 줄 — resumeHintScript', () => {
  it('손님: 이 판본 손님 기록으로 「처음부터」 칸을 그릴 때만 판본별 style 하나를 넣는다(BookHome 판정과 같다)', () => {
    for (const raw of RECORDS) {
      const store = raw === undefined ? {} : { [readingProgressKey(edition)]: raw };
      const nodes = hintFor(store);
      expect(nodes.length, raw).toBe(twoCells(raw) ? 1 : 0);
      if (nodes.length) expect(nodes[0]).toEqual({ id: `${RESUME_HINT_ID}-${edition}`, textContent: resumeHintCss(edition) });
    }
    expect(RECORDS.filter(twoCells)).toEqual(['{"page":"u03-patterns","completed":["u01"]}', '{"page":"u03"}', '{"page":"u42-review"}', '{"page":"u03-start-x"}']);
  });
  it('다른 판본 · 계정 기록은 손님 판정에 쓰지 않는다', () => {
    const mid = '{"page":"u03-patterns"}';
    expect(hintFor({ [readingProgressKey('a'.repeat(24))]: mid })).toHaveLength(0);
    expect(hintFor({ [readingProgressKey(edition, '00000000-0000-4000-8000-000000000042')]: mid })).toHaveLength(0);
  });
  it('세션 쿠키가 있으면 이 판본의 계정 기록이 하나일 때만 본다 — 계정 id는 읽지 않는다, 손님 기록은 넘긴다', () => {
    const mid = '{"page":"u03-patterns"}', a = readingProgressKey(edition, 'account-a'), b = readingProgressKey(edition, 'account-b');
    expect(hintFor({ [a]: mid }, true)).toHaveLength(1);
    expect(hintFor({ [a]: '{"page":"u03-start"}' }, true)).toHaveLength(0);
    expect(hintFor({ [a]: mid, [b]: mid }, true)).toHaveLength(0); // 누구 기록인지 모르면 잡지 않는다(전과 같은 한 번의 밀림)
    expect(hintFor({ [readingProgressKey(edition)]: mid }, true)).toHaveLength(0);
    expect(hintFor({ [a]: mid, [readingProgressKey(edition)]: mid }, true)).toHaveLength(1);
  });
  it('이미 넣었으면 다시 넣지 않고, 저장소가 막혀도 조용히 지나간다 · 판본 id가 아니면 한 줄 자체가 없다', () => {
    expect(hintFor({ [readingProgressKey(edition)]: '{"page":"u03-patterns"}' }, false, true)).toHaveLength(0);
    const document = { getElementById: () => null, createElement: () => ({}), head: { appendChild: () => { throw new Error('no'); } } };
    expect(() => vm.runInNewContext(resumeHintScript(edition), { get localStorage() { throw new Error('blocked'); }, document })).not.toThrow();
    for (const bad of ['', 'x', '";}</style><script>bad</script>', 'F4A6411C0945BBD3F8767AF7']) expect(resumeHintScript(bad)).toBe('');
  });
});

describe('BookHome 줄 자리', () => {
  const render = (props) => renderToStaticMarkup(createElement(BookHome, { book, progress: { page: 'u03-patterns', completed: ['u01', 'u02'] }, ...props }));
  it('붙기 전(!ready): 같은 칸(.book-resume-hold)에 그리기 전 한 줄 · 진짜 줄 · 보이지 않는 두 칸 — N4 · N5 같은 줄', () => {
    for (const level of ['N4', 'N5']) {
      const html = renderToStaticMarkup(createElement(BookHome, { book: { ...book, level }, progress: { page: 'u01-start', completed: [] }, ready: false }));
      const hold = sliceBetween(html, '<div class="book-resume-hold">', '</section>');
      expect(hold.startsWith('<div class="book-resume-hold"><script>')).toBe(true);
      expect(hold).toContain('<div class="manabi-row"><a class="manabi-button"');
      expect(hold).toContain(`<div class="manabi-row book-resume-ghost" data-edition="${edition}" aria-hidden="true"><span class="manabi-button">00과 이어 읽기 →</span><span class="manabi-link">00과 처음부터</span></div>`);
      expect(hold).not.toMatch(/<span class="manabi-(button|link)"[^>]*(href|tabindex)/);
    }
  });
  it('보이지 않는 두 칸의 글 = 붙은 뒤 진짜 두 칸의 글(숫자만 00)', () => {
    const html = render({ ready: true, hasProgress: true });
    const real = [...html.matchAll(/<a class="manabi-(?:button|link)" href="[^"]*">([^<]*)<\/a>/g)].slice(0, 2).map(m => m[1].replace(/\d/g, '0').replace(/<!-- -->/g, ''));
    expect(real).toEqual(['00과 이어 읽기 →', '00과 처음부터']);
  });
  it('붙은 뒤(ready): 한 줄도 두 칸도 없다 — 진짜 줄만', () => {
    const html = render({ ready: true, hasProgress: true });
    expect(html).toContain('<div class="book-resume-hold"><div class="manabi-row">');
    expect(html).not.toContain('book-resume-ghost');
    expect(html).not.toContain('<script');
  });
  it('두 칸은 평소 꺼짐 · 진짜 줄과 한 칸에 위로 붙어 겹친다 · 판본별 style만 켠다', () => {
    const css = fs.readFileSync(path.join(ROOT, 'src/components/books/reading-shell.css'), 'utf8');
    expect(css).toContain('\n.book-resume-hold{display:grid;grid-template-columns:minmax(0,1fr)}\n.book-resume-hold>.manabi-row{grid-area:1/1;align-self:start}\n.book-resume-hold>.book-resume-ghost{display:none;visibility:hidden;pointer-events:none}\n');
    expect(resumeHintCss(edition)).toBe(`.book-resume-hold>.book-resume-ghost[data-edition="${edition}"]{display:flex}`);
  });
});
