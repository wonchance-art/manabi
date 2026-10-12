import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));
import AccountSettings, { hasPasswordLogin } from '../AccountSettings';

// AUTH-GUIDE-001 H: 이메일 계정의 비밀번호 변경은 현재 비밀번호를 반드시 확인하고,
// Google로만 가입한 계정은 확인할 비밀번호가 없으니 「비밀번호 만들기」로 연다.
const emailUser = { id: 'u1', email: 'a@example.com', identities: [{ provider: 'email' }], app_metadata: { provider: 'email', providers: ['email'] } };
const googleUser = { id: 'u2', email: 'b@example.com', identities: [{ provider: 'google' }], app_metadata: { provider: 'google', providers: ['google'] } };
const bothUser = { id: 'u3', email: 'c@example.com', identities: [{ provider: 'google' }, { provider: 'email' }], app_metadata: { providers: ['google', 'email'] } };

describe('비밀번호 로그인 여부', () => {
  it('identities로 판정하고, 없으면 app_metadata로 판정한다', () => {
    expect(hasPasswordLogin(emailUser)).toBe(true);
    expect(hasPasswordLogin(googleUser)).toBe(false);
    expect(hasPasswordLogin(bothUser)).toBe(true);
    expect(hasPasswordLogin({ app_metadata: { providers: ['email'] } })).toBe(true);
    expect(hasPasswordLogin({ app_metadata: { provider: 'google' } })).toBe(false);
    expect(hasPasswordLogin(null)).toBe(false);
  });

  it('계정 종류에 따라 버튼 이름이 다르다', () => {
    const render = user => renderToStaticMarkup(<AccountSettings user={user} toast={() => {}} signOut={() => {}} />);
    expect(render(emailUser)).toContain('비밀번호 변경');
    expect(render(googleUser)).toContain('비밀번호 만들기');
    expect(render(googleUser)).not.toContain('비밀번호 변경');
  });

  it('이메일 계정은 현재 비밀번호 없이는 변경하지 않는다(선택 입력 부활 금지)', () => {
    const src = readFileSync('src/components/AccountSettings.jsx', 'utf8');
    expect(src).toContain("if (passwordLogin && !currentPw) { toast('현재 비밀번호를 입력해 주세요', 'warning'); return; }");
    expect(src).not.toContain('확인용, 선택');
    expect(src).toMatch(/if \(passwordLogin\) \{\s*const \{ error: reauthErr \} = await supabase\.auth\.signInWithPassword/);
  });
});

describe('임베드 위젯 안내', () => {
  it('Google 가입자에게 앱에서 비밀번호를 먼저 만들라고 알린다', () => {
    expect(readFileSync('src/app/embed/review/EmbedReviewClient.jsx', 'utf8'))
      .toContain('Google로 가입했다면 manabi 「내 계정」에서 「비밀번호 만들기」를 먼저 해 주세요.');
  });
});
