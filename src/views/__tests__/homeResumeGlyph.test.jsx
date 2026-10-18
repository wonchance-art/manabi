// HOME-GLYPH-LCP-001(2026-10-18 KST): /home 이어 읽기 칸의 장식 글자(learn-resume__glyph, 130px)가 붙은 뒤에야 끼어
// 화면에서 가장 큰 글이 되어 LCP를 늦췄다(실측 1280 손님 1004ms · 로그인 1148ms, 요소 = span.learn-resume__glyph 「あ」).
// 손님의 글자는 늘 「あ」(학습 언어 = 일본어)라 서버가 안다 — 골격이 같은 글자를 첫 그림부터 그린다. 최종 화면은 그대로.
// 로그인은 글자가 학습 언어 · 고른 칩 · 서재 자료로 정해져 서버가 모른다 — 골격에 글자를 넣지 않는다(틀린 글자 → 바뀜 금지).
// 실측: 로그인 LCP는 인증 SDK 준비(CPU×4 약 2.1초) 직후 실제 칸과 함께라, 붙은 뒤 언어로 일찍 그려도 이득이 없었다.
// LCP 후보에서 빼는 표현(::before 글 · SVG text · background-clip:text · aria-hidden)은 Chromium이 모두 후보로 셌다(보이지 않는 글만 빠짐).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';

vi.mock('next/link', () => ({ default: ({ children, prefetch, ...props }) => createElement('a', props, children) }));
const h = vi.hoisted(() => ({ cookies: [] }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => h.cookies }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined, isLoading: false, isPending: true, isPlaceholderData: false, refetch: () => {} }) }));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: null, profile: null, loading: true }) }));
vi.mock('../../lib/supabase', () => ({ supabase: {} }));

import HomePage from '../HomePage';
import HomeLoading from '../../app/(app)/home/loading';
import ResumeTile from '../../components/learn/ResumeTile';
import { GUEST_RESUME_GLYPH, RESUME_GLYPH, learnLanguages } from '../../lib/learnDashboard';

const ROOT = path.resolve(__dirname, '../../..');
const code = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
const never = () => new Promise(() => {});
const GLYPH_RE = /<span class="learn-resume__glyph"[^>]*>[^<]*<\/span>/g;
const glyphs = (html) => html.match(GLYPH_RE) || [];
const GUEST_GLYPH_HTML = '<span class="learn-resume__glyph" lang="ja" aria-hidden="true">あ</span>';

describe('이어 읽기 장식 글자 — 손님은 첫 그림부터', () => {
  it('손님 글자 = 일본어 글자: 손님 학습 언어는 늘 일본어뿐이다', () => {
    expect(learnLanguages(null)).toEqual(['Japanese']);
    expect(GUEST_RESUME_GLYPH).toBe(RESUME_GLYPH.Japanese);
    expect(GUEST_RESUME_GLYPH).toBe('あ');
  });

  it('손님 서버 HTML(판본 대기 중): 골격 칸에 최종 칸과 같은 장식 글자 하나', () => {
    const html = renderToString(createElement(HomePage, { bookPromise: never(), sessionHint: false }));
    expect(html).toContain('읽던 위치'); // 아직 골격
    expect(glyphs(html)).toEqual([GUEST_GLYPH_HTML]);
  });

  it('골격의 글자 = 실제 칸의 글자(요소 · 클래스 · lang · 글 같음) — 붙은 뒤 바뀌는 것은 칸 내용뿐', () => {
    const skeleton = renderToStaticMarkup(createElement(ResumeTile, { pending: true, glyph: GUEST_RESUME_GLYPH }));
    const item = { lang: 'Japanese', kicker: '일본어 N5', glyph: RESUME_GLYPH.Japanese, title: 't', href: '/books/x', cta: '첫 페이지 열기' };
    const real = renderToStaticMarkup(createElement(ResumeTile, { item }));
    expect(glyphs(skeleton)).toEqual([GUEST_GLYPH_HTML]);
    expect(glyphs(real)).toEqual(glyphs(skeleton));
  });

  it('로그인 배치(세션 쿠키 있음)는 골격에 글자 없음 — 서버가 글자를 모른다', () => {
    const html = renderToString(createElement(HomePage, { bookPromise: never(), sessionHint: true }));
    expect(html).toContain('learn-quad');
    expect(glyphs(html)).toEqual([]);
    expect(glyphs(renderToStaticMarkup(createElement(ResumeTile, { pending: true })))).toEqual([]);
  });

  it('배움 대기 화면(loading.jsx)도 같다 — 손님 골격만 글자', async () => {
    h.cookies = [];
    expect(glyphs(renderToStaticMarkup(await HomeLoading()))).toEqual([GUEST_GLYPH_HTML]);
    h.cookies = [{ name: 'sb-e2e-auth-token', value: 'x' }];
    expect(glyphs(renderToStaticMarkup(await HomeLoading()))).toEqual([]);
    h.cookies = [];
  });

  it('배선: 손님 판정 하나로 골격 글자를 고르고, 손님 실제 칸의 글자 경로는 모두 일본어 글자', () => {
    const home = code('src/views/HomePage.jsx');
    expect(home).toContain('const guestLayout = !user && (!authLoading || sessionHint === false);');
    expect(home).toContain('const pendingGlyph = guestLayout ? GUEST_RESUME_GLYPH : null;');
    expect(home).toContain('if (guestLayout) {');
    expect(home).toContain('const GLYPH = RESUME_GLYPH;');
    // 손님(서재 자료 없음)의 칸 = 교재(bookItem) 또는 교재 정보 실패 칸 — 둘 다 GLYPH.Japanese
    expect(home).toMatch(/function bookItem[\s\S]*?glyph: GLYPH\.Japanese/);
    expect(home).toMatch(/lang === 'Japanese' && !book\) resumeItem = \{[^}]*glyph: GLYPH\.Japanese/);
    // 장식 글자는 칸 기준 absolute — 골격에 넣어도 자리를 밀지 않는다(CLS 0)
    expect(fs.readFileSync(path.join(ROOT, 'src/components/learn/learn.css'), 'utf8')).toMatch(/\.learn-resume__glyph\{position:absolute;/);
  });
});
