import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUserMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
}));

vi.mock('@/lib/supabaseServer', () => ({
  requireUser: requireUserMock,
}));

vi.mock('@/lib/world/session', async () => (
  vi.importActual('../../../../lib/world/session.js')
));

import { GET, POST } from './route';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const EMEA_POSITION = Object.freeze({ scene: 'overworld:emea', x: 768, y: 253 });

function createSupabase({ role = 'member', savedPosition = null } = {}) {
  const upsert = vi.fn(async () => ({ error: null }));
  const from = vi.fn((table) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { role } }),
          }),
        }),
      };
    }
    if (table === 'world_positions') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: savedPosition }),
          }),
        }),
        upsert,
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
  return { from, upsert };
}

function authorize(supabase) {
  requireUserMock.mockResolvedValue({ supabase, user: { id: USER_ID } });
}

function postPosition(position) {
  return POST(new Request('http://localhost/api/world/position', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(position),
  }));
}

describe('/api/world/position released EMEA role boundary', () => {
  beforeEach(() => {
    requireUserMock.mockReset();
  });

  it('allows a released EMEA position for a non-admin user', async () => {
    const supabase = createSupabase({ role: 'member' });
    authorize(supabase);

    const response = await postPosition(EMEA_POSITION);

    expect(response.status).toBe(204);
    expect(supabase.upsert).toHaveBeenCalledOnce();
  });

  it('preserves admin access to a released EMEA position', async () => {
    const supabase = createSupabase({ role: 'admin' });
    authorize(supabase);

    const response = await postPosition(EMEA_POSITION);

    expect(response.status).toBe(204);
    expect(supabase.upsert).toHaveBeenCalledOnce();
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, ...EMEA_POSITION }),
      { onConflict: 'user_id' },
    );
  });

  it('returns a saved released EMEA position to a non-admin user', async () => {
    const supabase = createSupabase({ role: 'member', savedPosition: EMEA_POSITION });
    authorize(supabase);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ position: EMEA_POSITION });
  });

  it('returns a saved released EMEA position to an admin user', async () => {
    const supabase = createSupabase({ role: 'admin', savedPosition: EMEA_POSITION });
    authorize(supabase);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ position: EMEA_POSITION });
  });
});
