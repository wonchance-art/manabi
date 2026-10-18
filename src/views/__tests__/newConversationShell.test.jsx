// CONV-SHELL-001 (오너 「권장대로」 목업 A, 2026-10-17 KST)의 방 목록판(CONV-CHAT-001) — 대화 첫 화면은 로그인 확인 중에도
// 머리 · 방 줄을 먼저 그린다. 주제 방은 상수라 줄 자리가 그대로이고, 확인(프로필 포함)이 끝나면 미리보기만 채워지며 누를 수 있다.
// 손님(세션 쿠키 없음)은 처음부터 손님 화면, 쿠키가 남았는데 세션이 끝났으면 같은 손님 화면(새 문구 없음).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const auth = vi.hoisted(() => ({ current: {}, query: '' }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => auth.current }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {} }), useSearchParams: () => new URLSearchParams(auth.query) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [] }) }));
vi.mock('@/lib/useOutputWords', () => ({ useOutputWords: () => [] }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/components/learn/useLearnLanguage', () => ({ default: (profile) => ({ langs: profile?.learning_language || [], lang: profile?.learning_language?.[0] || 'Japanese', choose() {} }) }));
import NewConversationPage from '../NewConversationPage';

const GUEST_COPY = 'AI 튜터와 주제별 방에서 이야기해요. 로그인하고 시작해 주세요.';
const user = { id: 'u1' };
const render = ({ cookie = 'sb-proj-auth-token=x', query = '', ...state }) => {
  globalThis.document = { cookie }; auth.query = query;
  auth.current = { user: null, profile: null, loading: false, profileLoading: false, ...state };
  return renderToStaticMarkup(<NewConversationPage />);
};
const roomNames = (html) => [...html.matchAll(/<span class="conv-rooms__name">([^<]+)<\/span>/g)].map((m) => m[1]);
afterEach(() => { delete globalThis.document; });

describe('로그인 확인 중 — 머리 · 방 줄 먼저', () => {
  const html = render({ loading: true });
  it('제목 · 모두의 대화방 · 주제 방 여섯이 바로 그려지고, 손님 문구 · 예전 한 줄 대기 화면은 없다', () => {
    expect(html).toContain('<h1 class="conv-rooms__title">대화</h1>');
    expect(roomNames(html)).toEqual(['모두의 대화방', '오늘 하루', '주말 계획', '여행', '음식', '학교·일', '취미']);
    expect(html).not.toContain(GUEST_COPY);
    expect(html).not.toContain('role="status">대화 불러오는 중…</p>');
  });
  it('줄은 아직 누를 수 없다(링크 · 버튼 없음) — 미리보기는 골격, 알림은 한 줄', () => {
    expect(html).not.toMatch(/<a [^>]*class="conv-rooms__row|<button [^>]*class="conv-rooms__row/);
    expect(html.match(/class="skeleton-line /g)).toHaveLength(7);
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain('<span class="skeleton-sr" role="status">대화 불러오는 중…</span>');
  });
  it('프로필을 받는 중(profileLoading)도 같은 골격이다 — 언어가 옮겨 붙지 않게', () => {
    const waiting = render({ user, loading: false, profileLoading: true });
    expect(waiting).not.toMatch(/<button [^>]*class="conv-rooms__row/);
    expect(waiting.match(/class="skeleton-line /g)).toHaveLength(7);
  });
});

describe('확인이 끝나면 — 같은 줄이 누를 수 있게 된다', () => {
  it('방 이름 · 순서는 그대로, 주제 방은 버튼(누른 주제를 data-topic으로 기억), 골격 없음', () => {
    const before = roomNames(render({ loading: true }));
    const after = render({ user, profile: { id: 'u1', learning_language: ['Japanese'] } });
    expect(roomNames(after).slice(0, before.length)).toEqual(before);
    expect(after).toMatch(/<button type="button" class="conv-rooms__row" data-topic="오늘 하루">/);
    expect(after).not.toContain('skeleton-line');
  });
});

describe('손님', () => {
  it('세션 쿠키가 없으면 확인 중에도 처음부터 손님 화면(골격 없음)', () => {
    const html = render({ loading: true, cookie: 'theme=dark' });
    expect(html).toContain(GUEST_COPY);
    expect(html).not.toContain('skeleton');
  });
  it('쿠키가 남았는데 세션이 끝났으면(확인 끝 · 사용자 없음) 같은 손님 화면 — 새 문구 없음', () => {
    const html = render({ loading: false, cookie: 'sb-proj-auth-token=stale' });
    expect(html).toContain(GUEST_COPY);
    expect(html).toContain('<a href="/auth?from=/conversation/new" class="manabi-button">로그인</a>');
    expect(html).not.toContain('skeleton');
  });
});
