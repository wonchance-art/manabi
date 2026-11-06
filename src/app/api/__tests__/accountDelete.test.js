import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'node:fs';

/**
 * 계약: 계정 삭제는 저장소 파일 → FSRS 학습 기록 · 비공개 자료 → 계정 순서로 지운다
 * (ACCOUNT-DELETE-001 오너 승인 2026-11-01 KST · ACCOUNT-DELETE-002 2026-11-06 KST — 작성기 자료 · 저장소 잔존).
 * DB 쪽 동작은 supabase/tests/account-delete-learning-records.mjs · account-delete-owned-content.mjs(PGlite, CI)가 본다 —
 * 여기는 라우트 순서 · 실패 처리.
 */
const calls = [];
let rpcError = null, listError = null, removeError = null, objects = [];
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'u-1' } }, error: null }),
      admin: { deleteUser: async id => { calls.push(['deleteUser', id]); return { error: null }; } },
    },
    rpc: async (name, args) => {
      calls.push(['rpc', name, args]);
      if (name === 'account_storage_objects') return { data: listError ? null : objects, error: listError };
      return { data: null, error: rpcError };
    },
    storage: { from: bucket => ({ remove: async names => { calls.push(['remove', bucket, names]); return { data: [], error: removeError }; } }) },
  }),
}));

const post = async () => {
  const { POST } = await import('../account/delete/route.js');
  return POST(new Request('http://x/api/account/delete', { method: 'POST', headers: { authorization: 'Bearer t' } }));
};

describe('POST /api/account/delete', () => {
  beforeEach(() => { calls.length = 0; rpcError = null; listError = null; removeError = null; objects = []; });

  it('저장소 목록 → 학습 기록 · 비공개 자료 함수 → deleteUser 순서로 부른다(파일 없음)', async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(calls).toEqual([
      ['rpc', 'account_storage_objects', { p_user: 'u-1' }],
      ['rpc', 'delete_account_learning_records', { p_user: 'u-1' }],
      ['deleteUser', 'u-1'],
    ]);
  });

  it('저장소 파일은 버킷별로 100개씩 지운 뒤 DB를 지운다', async () => {
    const pdfs = Array.from({ length: 101 }, (_, i) => ({ bucket_id: 'user-pdfs', name: `u-1/p${i}.pdf` }));
    objects = [...pdfs, { bucket_id: 'material-originals', name: 'u-1/m/1.txt' }];
    const res = await post();
    expect(res.status).toBe(200);
    expect(calls.map(c => c[0] === 'remove' ? `remove:${c[1]}:${c[2].length}` : `${c[0]}:${c[1]}`)).toEqual([
      'rpc:account_storage_objects',
      'remove:user-pdfs:100', 'remove:user-pdfs:1', 'remove:material-originals:1',
      'rpc:delete_account_learning_records', 'deleteUser:u-1',
    ]);
    expect(calls.find(c => c[0] === 'remove' && c[1] === 'material-originals')[2]).toEqual(['u-1/m/1.txt']);
  });

  it('저장소 파일을 못 지우면 DB · 계정을 건드리지 않고 500', async () => {
    objects = [{ bucket_id: 'user-pdfs', name: 'u-1/a.pdf' }];
    removeError = new Error('storage down');
    const res = await post();
    expect(res.status).toBe(500);
    expect(calls.map(([name, what]) => `${name}:${what}`)).toEqual(['rpc:account_storage_objects', 'remove:user-pdfs']);
  });

  it('저장소 목록을 못 읽으면 아무것도 지우지 않고 500', async () => {
    listError = new Error('denied');
    const res = await post();
    expect(res.status).toBe(500);
    expect(calls.map(([name]) => name)).toEqual(['rpc']);
  });

  it('학습 기록을 못 지우면 계정을 지우지 않고 500', async () => {
    rpcError = new Error('denied');
    const res = await post();
    expect(res.status).toBe(500);
    expect(calls.map(([name, what]) => `${name}:${what}`)).toEqual(['rpc:account_storage_objects', 'rpc:delete_account_learning_records']);
  });

  it('DB 계약이 CI에서 돈다', () => {
    const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(ci).toContain('node supabase/tests/account-delete-learning-records.mjs');
    expect(ci).toContain('node supabase/tests/account-delete-owned-content.mjs');
  });
});
