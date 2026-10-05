import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  slots: [], index: 0, effects: [], cleanups: [], listener: null,
  rows: new Map(), writes: [], session: null, login: null, clientGate: null, listenerSession: null,
}));

// Unit scheduling is controlled here; the companion browser probe uses real React and auth-js.
vi.mock('react', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual,
    useState(initial) {
      const index = h.index++;
      if (!(index in h.slots)) h.slots[index] = initial;
      return [h.slots[index], value => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value; }];
    },
    useRef(initial) {
      const index = h.index++;
      if (!(index in h.slots)) h.slots[index] = { current: initial };
      return h.slots[index];
    },
    useEffect(fn, deps) {
      const index = h.index++, previous = h.slots[index];
      if (!previous || deps?.some((value, i) => value !== previous[i])) {
        h.effects.push(fn);
        h.slots[index] = deps;
      }
    },
  };
});

vi.mock('../supabase', () => {
  const client = {
    from() {
      let actor, fields, payload;
      const query = {
        select(value) { fields = value; return query; },
        eq(_field, value) { actor = value; return query; },
        update(value) { payload = value; return query; },
        upsert(value) {
          h.writes.push({ kind: 'upsert', payload: value });
          for (const row of value) h.rows.set(row.id, { ...row });
          return Promise.resolve({ error: null });
        },
        single() {
          const row = h.rows.get(actor);
          return Promise.resolve(row
            ? { data: fields === 'id' ? { id: actor } : { ...row }, error: null }
            : { data: null, error: { code: 'PGRST116' } });
        },
        then(resolve, reject) {
          h.writes.push({ kind: 'update', actor, payload });
          h.rows.set(actor, { ...h.rows.get(actor), ...payload });
          return Promise.resolve({ error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    auth: {
      getSession: async () => ({ data: { session: h.session } }),
      onAuthStateChange(fn) {
        h.listener = fn;
        if (h.listenerSession) fn('INITIAL_SESSION', h.listenerSession);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signInWithPassword: (...args) => h.login(...args),
      signUp: (...args) => h.login(...args),
      signOut: async () => { await h.listener?.('SIGNED_OUT', null); return { error: null }; },
    },
  };
  return { supabase: client, getSupabase: async () => { await h.clientGate; return client; } };
});
vi.mock('../ToastContext', () => ({ useToast: () => vi.fn() }));
vi.mock('../refProgress', () => ({ pullProgress: async () => {} }));
vi.mock('../drillSrs', () => ({ migrateGuestDrillQueue: async () => {} }));
import { AuthProvider } from '../AuthContext';

const user = id => ({ id, user_metadata: { name: id } });
const session = id => ({ user: user(id) });
const result = id => ({ data: { session: session(id), user: user(id) }, error: null });
const row = id => ({ id, display_name: id, streak_count: 6, streak_freeze_count: 2, last_login_at: '2026-09-01T00:00:00Z' });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
function render() { h.index = 0; return AuthProvider({ children: null }).props.value; }
async function tick() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
async function mount(guest = false) {
  if (guest) { document.cookie = ''; h.session = null; }
  render();
  for (const fn of h.effects.splice(0)) { const cleanup = fn(); if (cleanup) h.cleanups.push(cleanup); }
  await tick();
  return render();
}
const invoke = (auth, method) => auth[method]('fixture@synthetic.invalid', 'unused', 'Fixture');

beforeEach(() => {
  Object.assign(h, { slots: [], index: 0, effects: [], cleanups: [], listener: null,
    rows: new Map([['A', row('A')], ['B', row('B')]]), writes: [], session: session('A'),
    login: async () => result('A'), clientGate: null, listenerSession: null });
  vi.stubGlobal('document', { cookie: 'sb-fixture-auth-token=synthetic' });
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn(),
    location: { origin: 'http://fixture', pathname: '/auth', search: '' } });
});
afterEach(() => { for (const fn of h.cleanups.splice(0)) fn(); vi.unstubAllGlobals(); });

describe.each(['signIn', 'signUp'])('explicit %s result ownership', method => {
  it('drops a result after the SDK has adopted a different actor', async () => {
    const auth = await mount(), gate = deferred();
    h.login = () => gate.promise;
    const pending = invoke(auth, method);
    await h.listener('SIGNED_IN', session('A'));
    await h.listener('SIGNED_IN', session('B'));
    gate.resolve(result('A'));
    await pending;
    expect(render().user.id).toBe('B');
    expect(render().profile.id).toBe('B');
    expect(h.writes).toEqual([]);
  });

  it('allows its own SIGNED_IN before the SDK result from a guest', async () => {
    const auth = await mount(true);
    await invoke(auth, method); // Attach the listener via a prior explicit success.
    await auth.signOut();
    h.writes = [];
    h.login = async () => { await h.listener('SIGNED_IN', session('A')); return result('A'); };
    await invoke(render(), method);
    expect(render().user.id).toBe('A');
    expect(h.writes).toHaveLength(1);
    expect(h.writes[0].actor).toBe('A');
    expect(Object.keys(h.writes[0].payload)).toEqual(['last_login_at']);
    expect(render().profile.streak_count).toBe(6);
    expect(render().profile.streak_freeze_count).toBe(2);
  });

  it('allows a valid guest result when no listener saw the SDK event yet', async () => {
    const auth = await mount(true);
    await invoke(auth, method);
    expect(render().user.id).toBe('A');
    expect(h.writes).toHaveLength(1);
    expect(h.writes[0].actor).toBe('A');
  });

  it('invalidates a pending result on explicit sign-out even while still a guest', async () => {
    const auth = await mount(true), gate = deferred();
    h.login = () => gate.promise;
    const pending = invoke(auth, method);
    await auth.signOut();
    gate.resolve(result('A'));
    await pending;
    expect(render().user).toBeNull();
    expect(h.writes).toEqual([]);
  });

  it('rechecks actor ownership after asynchronous guest listener setup', async () => {
    const auth = await mount(true), client = deferred();
    h.clientGate = client.promise;
    const pending = invoke(auth, method);
    await tick();
    h.listenerSession = session('B');
    client.resolve();
    await pending;
    expect(render().user.id).toBe('B');
    expect(render().profile.id).toBe('B');
    expect(h.writes).toEqual([]);
  });

  it('does not let an older explicit request override a newer result', async () => {
    const auth = await mount(), first = deferred();
    h.login = ({ email }) => email.startsWith('older') ? first.promise : Promise.resolve(result('B'));
    const pending = auth[method]('older@synthetic.invalid', 'unused', 'Fixture');
    await auth[method]('newer@synthetic.invalid', 'unused', 'Fixture');
    first.resolve(result('A'));
    await pending;
    expect(render().user.id).toBe('B');
    expect(h.writes.map(write => write.actor)).toEqual(['B']);
  });

  it('ignores a delayed result after provider unmount', async () => {
    const auth = await mount(), gate = deferred();
    h.login = () => gate.promise;
    const pending = invoke(auth, method);
    for (const fn of h.cleanups.splice(0)) fn();
    gate.resolve(result('B'));
    await pending;
    expect(render().user.id).toBe('A');
    expect(h.writes).toEqual([]);
  });
});

it('email-confirmation signup without a session never adopts or writes a user', async () => {
  const auth = await mount(true);
  h.login = async () => ({ data: { user: user('A'), session: null }, error: null });
  const data = await invoke(auth, 'signUp');
  expect(data.session).toBeNull();
  expect(render().user).toBeNull();
  expect(h.writes).toEqual([]);
});
