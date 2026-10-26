// PWNED-PASSWORD-001 (2026-10-26 KST) — 유출 비밀번호 확인이 Supabase보다 먼저 도는 자리 · 돌지 않는 자리.
// 가입 · 재설정 새 비밀번호 · 내 정보 비밀번호 바꾸기/만들기는 확인 → (true면 멈춤) → Supabase. 로그인은 확인하지 않는다.
// 확인하지 못함(null)은 막지 않는다(열린 실패). 화면은 훅을 가짜로 바꿔 함수 그대로 그리고, 폼 onSubmit을 직접 부른다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PWNED_PASSWORD_MESSAGE } from '../authErrors';

const h = vi.hoisted(() => ({ slots: [], index: 0, effects: [], log: [], pwned: null, auth: null, router: null, params: null, supabaseAuth: null }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual,
    useState(initial) { const i = h.index++; if (!(i in h.slots)) h.slots[i] = initial; return [h.slots[i], value => { h.slots[i] = typeof value === 'function' ? value(h.slots[i]) : value; }]; },
    useRef(initial) { const i = h.index++; if (!(i in h.slots)) h.slots[i] = { current: initial }; return h.slots[i]; },
    useEffect(fn, deps) { const i = h.index++; const previous = h.slots[i]; if (!previous || deps?.some((value, j) => value !== previous[j])) { h.effects.push(fn); h.slots[i] = deps || []; } },
  };
});
vi.mock('next/navigation', () => ({ useRouter: () => h.router, useSearchParams: () => h.params }));
vi.mock('../AuthContext', () => ({ useAuth: () => h.auth }));
vi.mock('../supabase', () => ({ supabase: { auth: new Proxy({}, { get: (_t, key) => h.supabaseAuth[key] }) } }));
vi.mock('../pwnedPassword', () => ({ isPasswordPwned: (...args) => h.pwned(...args) }));
import AuthPage from '../../views/AuthPage';
import AccountSettings from '../../components/AccountSettings';

function* walk(node) {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const child of node) yield* walk(child); return; }
  yield node;
  yield* walk(node.props?.children);
  yield* walk(node.props?.actions);
}
const textOf = node => (typeof node === 'string' ? node : Array.isArray(node) ? node.map(textOf).join('') : node?.props ? textOf(node.props.children) : '');
const find = (tree, test) => [...walk(tree)].find(test);
const byId = (tree, id) => find(tree, el => el.props?.id === id);
const type = (tree, id, value) => byId(tree, id).props.onChange({ target: { value } });
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

const PASSWORD = 'correct horse battery staple manabi 2026';
const record = (name, result) => vi.fn(async (...args) => { h.log.push(name); return typeof result === 'function' ? result(...args) : result; });

beforeEach(() => {
  h.slots = []; h.index = 0; h.effects = []; h.log = [];
  h.pwned = record('check', null);
  h.router = { push: vi.fn(), refresh: vi.fn() };
  h.params = new URLSearchParams('');
  h.auth = { signIn: record('signIn'), signUp: record('signUp'), signInWithGoogle: vi.fn(), resetPassword: vi.fn(), resendConfirmation: vi.fn() };
  h.supabaseAuth = { updateUser: record('updateUser', { error: null }), signInWithPassword: record('reauth', { error: null }) };
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('AuthPage', () => {
  // AuthPage는 질의 훅 없이 AuthForm을 바로 그린다(ROUTE-AUDIT-2 P1) — 질의는 마운트 뒤 window.location에서 읽는다.
  const AuthForm = AuthPage().type;
  const render = () => { h.index = 0; return AuthForm(); };
  async function mount(search = '') {
    h.params = new URLSearchParams(search);
    vi.stubGlobal('window', { location: { search: search ? `?${search}` : '' } });
    render();
    for (const fn of h.effects.splice(0)) fn();
    return render();
  }
  async function submit() {
    const pending = find(render(), el => el.type === 'form').props.onSubmit({ preventDefault() {} });
    await pending; await tick();
    return render();
  }
  const alertText = tree => textOf(find(tree, el => el.props?.role === 'alert'));
  const submitButton = tree => find(tree, el => el.type === 'button' && el.props.type === 'submit');

  async function openSignup() {
    let tree = await mount();
    find(tree, el => el.type === 'button' && el.props.onClick && textOf(el) === '회원가입').props.onClick();
    tree = render();
    type(tree, 'auth-nickname', '학습자');
    type(tree, 'auth-email', 'learner@example.com');
    type(tree, 'auth-password', PASSWORD);
    return render();
  }

  it('가입: 유출 목록에 있으면 signUp을 부르지 않고 오류 칸에 안내한다', async () => {
    h.pwned = record('check', true);
    await openSignup();
    const tree = await submit();
    expect(h.log).toEqual(['check']);
    expect(h.pwned).toHaveBeenCalledWith(PASSWORD);
    expect(h.auth.signUp).not.toHaveBeenCalled();
    expect(alertText(tree)).toBe(PWNED_PASSWORD_MESSAGE);
    expect(submitButton(tree).props.disabled).toBe(false);
  });

  it('가입: 목록에 없거나(false) 확인하지 못하면(null) 확인 뒤 signUp', async () => {
    for (const result of [false, null]) {
      h.slots = []; h.log = []; h.pwned = record('check', result);
      await openSignup();
      const tree = await submit();
      expect(h.log).toEqual(['check', 'signUp']);
      expect(alertText(tree)).toBe('');
    }
  });

  it('가입: 확인하는 동안 제출 버튼은 기존 처리 중 상태로 막힌다', async () => {
    let resolveCheck;
    h.pwned = vi.fn(() => new Promise(resolve => { resolveCheck = resolve; }));
    await openSignup();
    const pending = find(render(), el => el.type === 'form').props.onSubmit({ preventDefault() {} });
    await tick();
    const busy = submitButton(render());
    expect(busy.props.disabled).toBe(true);
    expect(textOf(busy)).toBe('처리 중…');
    expect(h.auth.signUp).not.toHaveBeenCalled();
    resolveCheck(false); await pending; await tick();
    expect(h.auth.signUp).toHaveBeenCalledTimes(1);
    expect(submitButton(render()).props.disabled).toBe(false);
  });

  it('로그인은 확인하지 않는다', async () => {
    let tree = await mount();
    type(tree, 'auth-email', 'learner@example.com');
    type(tree, 'auth-password', 'password');
    tree = await submit();
    expect(h.log).toEqual(['signIn']);
    expect(h.pwned).not.toHaveBeenCalled();
  });

  it('재설정 새 비밀번호: 유출이면 updateUser 전에 멈추고, 확인하지 못하면 그대로 바꾼다', async () => {
    vi.useFakeTimers();
    try {
      h.pwned = record('check', true);
      let tree = await mount('mode=reset');
      type(tree, 'auth-new-pw', PASSWORD); type(render(), 'auth-new-pw2', PASSWORD);
      tree = await submit();
      expect(h.log).toEqual(['check']);
      expect(h.supabaseAuth.updateUser).not.toHaveBeenCalled();
      expect(alertText(tree)).toBe(PWNED_PASSWORD_MESSAGE);

      h.log = []; h.pwned = record('check', null);
      tree = await submit();
      expect(h.log).toEqual(['check', 'updateUser']);
      expect(h.supabaseAuth.updateUser).toHaveBeenCalledWith({ password: PASSWORD });
    } finally { vi.useRealTimers(); }
  });
});

describe('내 정보 비밀번호 바꾸기 · 만들기', () => {
  const emailUser = { id: 'u1', email: 'a@example.com', identities: [{ provider: 'email' }] };
  const googleUser = { id: 'u2', email: 'b@example.com', identities: [{ provider: 'google' }] };
  let toast;
  const render = user => { h.index = 0; return AccountSettings({ user, toast, signOut: vi.fn() }); };
  async function fillAndSubmit(user) {
    find(render(user), el => el.props?.label === '비밀번호').props.onClick();
    let tree = render(user);
    if (byId(tree, 'pf-current-password')) type(tree, 'pf-current-password', 'old-password-1');
    type(render(user), 'pf-new-password', PASSWORD);
    type(render(user), 'pf-confirm-password', PASSWORD);
    await byId(render(user), 'pf-password-form').props.onSubmit({ preventDefault() {} });
    await tick();
    return render(user);
  }
  beforeEach(() => { toast = vi.fn(); });

  it('유출이면 현재 비밀번호 확인 · 변경 전에 멈추고, 시트와 입력을 그대로 둔다', async () => {
    h.pwned = record('check', true);
    const tree = await fillAndSubmit(emailUser);
    expect(h.log).toEqual(['check']);
    expect(toast).toHaveBeenCalledWith(PWNED_PASSWORD_MESSAGE, 'warning');
    expect(h.supabaseAuth.signInWithPassword).not.toHaveBeenCalled();
    expect(h.supabaseAuth.updateUser).not.toHaveBeenCalled();
    expect(byId(tree, 'pf-new-password').props.value).toBe(PASSWORD);
    expect(find(tree, el => el.props?.form === 'pf-password-form').props.disabled).toBe(false);
  });

  it('확인하지 못하면(null) 막지 않는다 — 확인 → 현재 비밀번호 확인 → 변경 순서', async () => {
    await fillAndSubmit(emailUser);
    expect(h.log).toEqual(['check', 'reauth', 'updateUser']);
    expect(h.pwned).toHaveBeenCalledWith(PASSWORD);
  });

  it('Google 계정의 「만들기」도 같은 확인을 거친다', async () => {
    h.pwned = record('check', true);
    await fillAndSubmit(googleUser);
    expect(h.log).toEqual(['check']);
    h.slots = []; h.log = []; h.pwned = record('check', false);
    await fillAndSubmit(googleUser);
    expect(h.log).toEqual(['check', 'updateUser']);
  });
});
