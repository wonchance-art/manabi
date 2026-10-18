// CONV-SHELL-001 (오너 「권장대로」 목업 A, 2026-10-17 KST) — 새 대화는 로그인 확인 중에도 머리글 · 선택지를 먼저 그린다.
// 주제 칩은 바로 누를 수 있고, 언어 칩(상수 4개)은 그려 두되 선택 표시 · 누름은 확인 뒤(aria-disabled · 크기 그대로),
// 수준은 지금 언어의 칩 수 · 폭 그대로 글을 숨긴 골격(CONV-LEVEL-HOLD-001). 손님(세션 쿠키 없음)은 처음부터 손님 화면, 쿠키가 남았는데 세션이 끝났으면 같은 손님 화면(새 문구 없음).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const auth = vi.hoisted(() => ({ current: {}, query: '' }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => auth.current }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {} }), useSearchParams: () => new URLSearchParams(auth.query) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [] }) }));
vi.mock('@/lib/useOutputWords', () => ({ useOutputWords: () => [] }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
import NewConversationPage from '../NewConversationPage';
import { conversationLevels } from '@/lib/conversation/newConversation';

const GUEST_COPY = '대화는 내 서재에 비공개로 남아요. 로그인하고 시작해 주세요.';
const user = { id: 'u1' };
const render = ({ cookie = 'sb-proj-auth-token=x', query = '', ...state }) => {
  globalThis.document = { cookie }; auth.query = query;
  auth.current = { user: null, profile: null, loading: false, profileLoading: false, ...state };
  return renderToStaticMarkup(<NewConversationPage />);
};
const languageChips = (html) => html.match(/<button type="button" class="conv-chip"[^>]*>(중국어|일본어|영어|프랑스어)<\/button>/g) || [];
afterEach(() => { delete globalThis.document; });

describe('로그인 확인 중 — 머리글 · 선택지 먼저', () => {
  const html = render({ loading: true });
  it('제목 · 안내 · 주제 칩(누를 수 있음)은 바로, 손님 문구는 없다', () => {
    expect(html).toContain('<h1>새 대화</h1>');
    expect(html).toContain('AI 튜터와 목표어로 이야기해요');
    expect(html).toMatch(/<button type="button" class="conv-chip" aria-pressed="false">오늘 하루<\/button>/);
    expect(html).not.toContain(GUEST_COPY);
    expect(html).not.toContain('role="status">대화 불러오는 중…</p>'); // 예전 한 줄 대기 화면
  });
  it('언어 칩 넷은 그리되 선택 없음 · 누름 잠금(aria-disabled) — 수준은 실제 칩 폭의 골격 · 알림 한 줄 · 시작 잠김', () => {
    const chips = languageChips(html);
    expect(chips).toHaveLength(4);
    for (const chip of chips) { expect(chip).toContain('aria-pressed="false"'); expect(chip).toContain('aria-disabled="true"'); }
    // 수준 이름은 보이지 않는다 — 골격 칸(aria-hidden) 안 숨긴 글(.conv-chip__size)로 폭만 잡는다. 칸 수 · 순서 = 지금 언어(기본 중국어)의 실제 칩.
    expect(html).not.toMatch(/<button[^>]*>OT 입문/);
    expect([...html.matchAll(/<span class="conv-chip conv-chip--skeleton" aria-hidden="true"><span aria-hidden="true" class="skeleton-line skeleton-line--inline" style="width:100%;height:1em"><\/span><span class="conv-chip__size">([^<]+)<\/span><\/span>/g)].map((m) => m[1]))
      .toEqual(conversationLevels('Chinese'));
    // 주소로 언어가 정해져 있으면 그 언어의 칩 수 · 글 폭(일본어 5칸)
    expect(render({ loading: true, query: 'lang=Japanese' }).match(/class="conv-chip__size">[^<]+/g).map((m) => m.split('>')[1])).toEqual(conversationLevels('Japanese'));
    expect(html).toContain('<span class="skeleton-sr" role="status">대화 불러오는 중…</span>');
    expect(html).toMatch(/<button type="button" class="manabi-button" disabled="">대화 시작<\/button>/);
    // 주제까지 골라 시작 조건이 다 찼어도(주소 topic) 확인이 끝나기 전에는 잠겨 있다.
    expect(render({ loading: true, query: 'topic=%EC%97%AC%ED%96%89' })).toMatch(/<button type="button" class="manabi-button" disabled="">대화 시작<\/button>/);
    expect(render({ user, profile: { id: 'u1', learning_language: ['Japanese'] }, query: 'topic=%EC%97%AC%ED%96%89' })).toMatch(/<button type="button" class="manabi-button">대화 시작<\/button>/);
  });
  it('프로필을 받는 중(profileLoading)도 같은 골격이다 — 선택이 중국어로 붙었다가 옮겨 가지 않게', () => {
    const waiting = render({ user, loading: false, profileLoading: true });
    expect(languageChips(waiting).every(chip => chip.includes('aria-disabled="true"') && chip.includes('aria-pressed="false"'))).toBe(true);
    expect(waiting.match(/conv-chip--skeleton/g)).toHaveLength(conversationLevels('Chinese').length);
  });
});

describe('확인이 끝나면 — 선택만 붙고 자리는 그대로', () => {
  it('프로필 첫 학습 언어가 선택되고 잠금이 풀리며 수준 칩이 들어온다. 언어 칩은 글 · 클래스가 같다', () => {
    const before = render({ loading: true });
    const after = render({ user, profile: { id: 'u1', learning_language: ['Japanese'] } });
    const strip = (chip) => chip.replace(/ aria-pressed="[^"]*"| aria-disabled="[^"]*"/g, '');
    expect(languageChips(after).map(strip)).toEqual(languageChips(before).map(strip));
    expect(after).toContain('aria-pressed="true">일본어</button>');
    expect(after).not.toContain('aria-disabled');
    expect(after).not.toContain('conv-chip--skeleton');
    expect(after).toContain('>N5 기초</button>');
  });
});

describe('손님', () => {
  it('세션 쿠키가 없으면 확인 중에도 처음부터 손님 화면(골격 없음)', () => {
    const html = render({ loading: true, cookie: 'theme=dark' });
    expect(html).toContain(GUEST_COPY);
    expect(html).not.toContain('conv-chip');
  });
  it('쿠키가 남았는데 세션이 끝났으면(확인 끝 · 사용자 없음) 같은 손님 화면 — 새 문구 없음', () => {
    const html = render({ loading: false, cookie: 'sb-proj-auth-token=stale' });
    expect(html).toContain(GUEST_COPY);
    expect(html).toContain('<a href="/auth?from=/conversation/new" class="manabi-button">로그인</a>');
    expect(html).not.toContain('conv-chip');
  });
});
