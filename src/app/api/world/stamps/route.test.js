import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUserMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
}));

vi.mock('@/lib/supabaseServer', () => ({
  requireUser: requireUserMock,
}));

vi.mock('@/lib/world/stampUniverse', async () => (
  vi.importActual('../../../../lib/world/stampUniverse.js')
));

import { POST } from './route';

const USER_ID = '00000000-0000-4000-8000-000000000003';

function authorize() {
  const upsert = vi.fn(async () => ({ error: null }));
  const supabase = { from: vi.fn(() => ({ upsert })) };
  requireUserMock.mockResolvedValue({ supabase, user: { id: USER_ID } });
  return { supabase, upsert };
}

function postStamp(nodeId) {
  return POST(new Request('http://localhost/api/world/stamps', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nodeId }),
  }));
}

describe('/api/world/stamps 앨범 정본 경계', () => {
  beforeEach(() => {
    requireUserMock.mockReset();
  });

  it.each(['seoul', 'hong-kong', 'paris', 'nice', 'strasbourg'])(
    '기존·지역 앨범 ID %s를 첫 방문 upsert한다',
    async (nodeId) => {
      const { upsert } = authorize();

      const response = await postStamp(nodeId);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true });
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: USER_ID, node_id: nodeId }),
        { onConflict: 'user_id,node_id', ignoreDuplicates: true },
      );
    },
  );

  it.each(['', 'no-such-node', 'fukuoka-konbini', 'grand-paris', 'cote-dazur'])(
    '앨범 밖 ID %j를 400으로 거부한다',
    async (nodeId) => {
      const { upsert } = authorize();

      const response = await postStamp(nodeId);

      expect(response.status).toBe(400);
      expect(upsert).not.toHaveBeenCalled();
    },
  );
});
