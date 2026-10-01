import { beforeEach, describe, expect, it, vi } from 'vitest';
const { authenticate } = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ requireUser: authenticate }));
import { GET, POST } from '../exclusions/route';
const owner = '10000000-0000-0000-0000-000000000001';
const id = '20000000-0000-0000-0000-000000000001';
let material, client, dbError;
const post = body => POST(new Request('https://fixture.test/api/learning/exclusions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: owner, excluded: true, ...body }) }));
beforeEach(() => {
  dbError = null;
  material = { id: 1, owner_id: owner, visibility: 'private', processed_json: { metadata: { language: 'English' }, sequence: ['a'], dictionary: { a: { text: 'books', base_form: 'book' } } } };
  client = { rpc: vi.fn(async () => ({ data: { excluded: true, entry: { id } }, error: dbError })), from: vi.fn(table => {
    const q = { select: () => q, eq: () => q, order: () => q,
      maybeSingle: async () => ({ data: material, error: dbError }), range: async () => ({ data: [], error: dbError }) };
    return q;
  }) };
  authenticate.mockResolvedValue({ user: { id: owner }, supabase: client });
});
describe('제외 API의 실제 사용자 범위', () => {
  it('익명 조회/쓰기를 원격 호출 전에 거부한다', async () => {
    authenticate.mockResolvedValue({ error: 'login', status: 401 });
    expect((await GET()).status).toBe(401); expect((await post({ vocabularyId: id })).status).toBe(401);
    expect(client.from).not.toHaveBeenCalled(); expect(client.rpc).not.toHaveBeenCalled();
  });
  it('오래된 계정의 요청은 현재 계정으로 쓰지 않는다', async () => {
    expect((await post({ vocabularyId: id, accountId: 'other' })).status).toBe(409);
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it('미저장 상태의 언어/기본형은 허용된 자료 토큰에서 얻는다', async () => {
    const response = await post({ materialId: 1, tokenId: 'a', language: 'Japanese', word: 'forged' });
    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith('set_vocabulary_exclusion', { p_language: 'English', p_word: 'book', p_vocabulary_id: null, p_excluded: true, p_exclusion_id: null });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('타인 비공개 자료와 없는 토큰을 거부한다', async () => {
    material.owner_id = 'other'; expect((await post({ materialId: 1, tokenId: 'a' })).status).toBe(404);
    material.owner_id = owner; expect((await post({ materialId: 1, tokenId: 'missing' })).status).toBe(400);
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it('저장된 카드/해제 ID의 소유권은 invoker RPC로 검사하며 owner를 받지 않는다', async () => {
    expect((await post({ vocabularyId: id })).status).toBe(200);
    expect(client.rpc.mock.calls[0][1]).toMatchObject({ p_vocabulary_id: id, p_language: null, p_word: null });
    expect((await post({ exclusionId: id, excluded: false })).status).toBe(200);
    expect(client.rpc.mock.calls[1][1]).toMatchObject({ p_exclusion_id: id, p_excluded: false });
    dbError = { code: '42501', message: 'word_not_available' };
    expect((await post({ vocabularyId: id })).status).toBe(404);
  });
  it('모호한 카드 결합은 409이며 서버 장애를 제외 없음으로 표시하지 않는다', async () => {
    dbError = { message: 'vocabulary_ambiguous_match' };
    expect((await post({ materialId: 1, tokenId: 'a' })).status).toBe(503); // 자료 조회 실패가 먼저다.
    expect((await post({ vocabularyId: id })).status).toBe(409);
    expect((await GET()).status).toBe(500);
  });
});
