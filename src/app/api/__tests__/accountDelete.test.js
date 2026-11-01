import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'node:fs';

/**
 * 계약: 계정 삭제는 FSRS 학습 기록을 먼저 지운 뒤 계정을 지운다(ACCOUNT-DELETE-001 · STATS-MAP-001, 오너 승인 2026-11-01 KST).
 * DB 쪽 동작은 supabase/tests/account-delete-learning-records.mjs(PGlite, CI)가 본다 — 여기는 라우트 순서 · 실패 처리.
 */
const calls = [];
let rpcError = null;
vi.mock('@supabase/supabase-js', () => ({
  createClient: (url, key) => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'u-1' } }, error: null }),
      admin: { deleteUser: async id => { calls.push(['deleteUser', id]); return { error: null }; } },
    },
    rpc: async (name, args) => { calls.push(['rpc', name, args]); return { error: rpcError }; },
  }),
}));

describe('POST /api/account/delete', () => {
  beforeEach(() => { calls.length = 0; rpcError = null; });

  it('FSRS 학습 기록 함수 → deleteUser 순서로 부른다', async () => {
    const { POST } = await import('../account/delete/route.js');
    const res = await POST(new Request('http://x/api/account/delete', { method: 'POST', headers: { authorization: 'Bearer t' } }));
    expect(res.status).toBe(200);
    expect(calls).toEqual([['rpc', 'delete_account_learning_records', { p_user: 'u-1' }], ['deleteUser', 'u-1']]);
  });

  it('학습 기록을 못 지우면 계정을 지우지 않고 500', async () => {
    rpcError = new Error('denied');
    const { POST } = await import('../account/delete/route.js');
    const res = await POST(new Request('http://x/api/account/delete', { method: 'POST', headers: { authorization: 'Bearer t' } }));
    expect(res.status).toBe(500);
    expect(calls.map(([name]) => name)).toEqual(['rpc']);
  });

  it('DB 계약이 CI에서 돈다', () => {
    expect(fs.readFileSync('.github/workflows/ci.yml', 'utf8')).toContain('node supabase/tests/account-delete-learning-records.mjs');
  });
});
