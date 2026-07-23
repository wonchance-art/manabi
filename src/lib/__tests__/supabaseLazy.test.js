import { describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
  const query = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.single = vi.fn(async () => ({ data: { id: 'profile-1' }, error: null }));

  return {
    state: { loaded: false },
    query,
    client: {
      from: vi.fn(() => query),
    },
  };
});

vi.mock('../supabaseClient', () => {
  mock.state.loaded = true;
  return { supabase: mock.client };
});

describe('lazy Supabase facade', () => {
  it('keeps the SDK deferred until a query is observed and replays the exact chain', async () => {
    const { getSupabase, supabase } = await import('../supabase');

    expect(mock.state.loaded).toBe(false);

    const result = await supabase
      .from('profiles')
      .select('*')
      .eq('id', 'profile-1')
      .single();

    expect(mock.state.loaded).toBe(true);
    expect(result).toEqual({ data: { id: 'profile-1' }, error: null });
    expect(mock.client.from).toHaveBeenCalledWith('profiles');
    expect(mock.query.select).toHaveBeenCalledWith('*');
    expect(mock.query.eq).toHaveBeenCalledWith('id', 'profile-1');
    expect(mock.query.single).toHaveBeenCalledOnce();

    await expect(getSupabase()).resolves.toBe(mock.client);
    await expect(getSupabase()).resolves.toBe(mock.client);
  });

  it('preserves fire-and-forget .then() query execution', async () => {
    const { supabase } = await import('../supabase');

    const result = await new Promise((resolve, reject) => {
      supabase
        .from('profiles')
        .select('id')
        .eq('id', 'profile-1')
        .single()
        .then(resolve, reject);
    });

    expect(result.data.id).toBe('profile-1');
  });
});
