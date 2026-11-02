// 배움 제목 줄 「교재 →」(HOME-SHELF-LINK-001 — 오너 승인 목업 2026-11-02 KST).
// 이어 하기 카드는 그대로 두고, 제목 줄 오른쪽 글자 링크 하나로 책장(지금 학습 언어 탭)에 간다.
// 카드 안에 넣는 시안은 「이전의 심플함을 해친다」로 접었다 — 카드에 책장 링크가 다시 들어가지 않게 지킨다.
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';

vi.mock('next/link', () => ({ default: ({ children, prefetch, ...props }) => createElement('a', props, children) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined, isLoading: false, isPending: true, isPlaceholderData: false, refetch: () => {} }) }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: null, profile: null, loading: true }) }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import HomePage from '@/views/HomePage';
import { sliceBetween } from '@/lib/__tests__/helpers/sliceBetween';

const never = () => new Promise(() => {});
const top = html => sliceBetween(html, '<div class="learn-top">', '<div class="learn-grid">');

describe('배움 제목 줄 교재 링크', () => {
  it('손님: 「교재 →」 하나 — 일본어 책장', () => {
    const html = top(renderToString(createElement(HomePage, { bookPromise: never(), sessionHint: false })));
    expect(html).toContain('href="/lessons?lang=Japanese"');
    expect(html).toContain('>교재 →</a>');
    expect(html).not.toContain('현황 전체');
  });
  it('로그인: 「교재 · 현황 전체 →」 한 덩어리 — 교재가 먼저, 가운뎃점은 읽지 않는다', () => {
    const html = top(renderToString(createElement(HomePage, { bookPromise: never(), sessionHint: true })));
    const links = sliceBetween(html, '<div class="learn-toplinks">', null);
    expect(links).toMatch(/href="\/lessons\?lang=[A-Z][a-z]+"[^>]*>교재<\/a>/);
    expect(links).toContain('<span class="learn-toplinks__sep" aria-hidden="true">·</span>');
    expect(links.indexOf('>교재</a>')).toBeLessThan(links.indexOf('href="/progress"'));
  });
  it('이어 하기 카드(ResumeTile)에는 책장 링크를 넣지 않는다', () => {
    const tile = readFileSync('src/components/learn/ResumeTile.jsx', 'utf8');
    expect(tile).not.toContain('/lessons');
  });
});
