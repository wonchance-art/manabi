// LCP-UNSUSPEND(조정 승인 2026-10-17 KST): /home은 교재 판본 조회(DB)를 기다리지 않는다.
// 실측(운영 f8d3bf48 · 390 · CPU 4배): 첫 진입 LCP = 「오늘 문단 · 맛보기」 문장인데, page.jsx가 판본을 await해서 화면 전체가
// 대기 화면(loading.jsx) 뒤 스트리밍 조각(<div hidden id="S:…"> → $RC)으로 늦게 끼워졌다 — 절반의 측정에서 LCP가 FCP보다
// 300–900ms 늦었다. 이제 판본은 약속(promise)으로 넘기고, 판본이 필요한 이어 읽기 칸 · 저장 불가 안내만 안쪽 Suspense에서 받는다.
// 데이터 경로(publishedReading → readingCatalog, 실패 = null)와 탭 이동 골격(loading.jsx, LOADING-SKELETON-001)은 그대로다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween';

vi.mock('next/link', () => ({ default: ({ children, prefetch, ...props }) => createElement('a', props, children) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined, isLoading: false, isPending: true, isPlaceholderData: false, refetch: () => {} }) }));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: null, profile: null, loading: true }) }));
vi.mock('../../lib/supabase', () => ({ supabase: {} }));

import HomePage from '../HomePage';

const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const code = (src) => src.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
const SENTENCE = '駅前の小さなパン屋で、今日も同じパンを買いました。';
const never = () => new Promise(() => {});

describe('/home 첫 HTML — 판본을 기다리지 않는다', () => {
  it('page.jsx: 판본 조회를 await하지 않고 약속으로 넘긴다 — 조회 · 실패 처리(null)는 그대로', () => {
    const page = code(read('src/app/(app)/home/page.jsx'));
    expect(page).toContain('const bookPromise = publishedReading().then(published => readingCatalog(published.book))');
    expect(page).toContain('.catch(() => null);');
    expect(page).toContain('<HomePage bookPromise={bookPromise} sessionHint={sessionHint} />');
    expect(page, '판본을 await하면 화면 전체가 다시 대기 화면 뒤 스트리밍 조각으로 밀린다').not.toMatch(/await\s+publishedReading/);
    expect(page).not.toMatch(/book=\{/);
  });

  it('손님: 판본이 오지 않아도 맛보기 문장 · 로그인 칸이 첫 HTML에 있고, 이어 읽기 칸만 대기 골격이다', () => {
    const html = renderToString(createElement(HomePage, { bookPromise: never(), sessionHint: false }));
    expect(html).toContain(SENTENCE);
    expect(html).toContain('learn-guest');
    const grid = sliceBetween(html, '<div class="learn-grid">', null);
    // 칸 순서(손님 골격과 같다): 이어 읽기(대기) → 맛보기 문단 → 로그인 칸
    expect(grid.indexOf('learn-resume')).toBeGreaterThanOrEqual(0);
    expect(grid.indexOf('learn-resume')).toBeLessThan(grid.indexOf(SENTENCE));
    expect(grid.indexOf(SENTENCE)).toBeLessThan(grid.indexOf('learn-guest'));
    expect(grid).toContain('읽던 위치'); // ResumeTile pending의 골격 영역 이름
  });

  it('로그인 배치도 판본을 기다리지 않는다 — 제목 · 현황 칸이 첫 HTML에 있다', () => {
    const html = renderToString(createElement(HomePage, { bookPromise: never(), sessionHint: true }));
    expect(html).toContain('learn-quad');
    expect(html).toContain('learn-toplink');
    expect(html).toContain('learn-resume');
  });

  it('이어 읽기 칸의 대기 그림 = 배움 대기 화면(loading.jsx)의 그 칸 — 자리 · 모양이 같다', () => {
    const home = code(read('src/views/HomePage.jsx'));
    expect(home).toContain('<Suspense fallback={<ResumeTile pending glyph={pendingGlyph} />}><ResumeSlot');
    expect(home).toContain('<Suspense fallback={null}><StorageNote');
    expect(code(read('src/app/(app)/home/loading.jsx'))).toContain('<ResumeTile pending />'); // 로그인 배치(손님은 장식 글자 — homeResumeGlyph.test)
  });

  it('판본이 필요한 판단(읽은 위치 · 목적지 고정 · 추천)은 모두 ResumeSlot 안에 있다 — 화면 본체는 판본을 읽지 않는다', () => {
    const home = code(read('src/views/HomePage.jsx'));
    const body = sliceBetween(home, 'export default function HomePage(', null);
    expect(body).not.toContain('useReadingProgress(');
    expect(body).not.toContain('bookResume(');
    expect(body).not.toContain('use(bookPromise)');
    const slot = sliceBetween(home, 'function ResumeSlot(', 'function StorageNote(');
    for (const part of ['useBook(bookPromise, bookValue)', 'useReadingProgress(book?.edition)', 'chooseResume(bookForLang, local.updatedAt, material)',
      'return <ResumeTile item={resumeItem} pending={resumePending} glyph={pendingGlyph} />;']) expect(slot).toContain(part);
    // 탭 이동 골격은 그대로(LOADING-SKELETON-001)
    expect(fs.existsSync(path.join(ROOT, 'src/app/(app)/home/loading.jsx'))).toBe(true);
  });
});
