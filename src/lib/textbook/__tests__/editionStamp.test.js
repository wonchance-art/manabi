import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readEdition, readEditionStamp } from '../server';

// 발행 확인 경로는 원고 jsonb(약 700KB)를 받지 않는다(2026-10-16 실측 — 배움 · 산책 탭 전환 2초 초과의 원인).
const EDITION = '7f572327dc67893e9453246c';
function fakeSupabase() {
  const calls = [];
  const chain = { eq: () => chain, maybeSingle: async () => ({ data: { edition_id: EDITION }, error: null }) };
  return { calls, from: (table) => ({ select: (columns) => { calls.push({ table, columns }); return chain; } }) };
}
const read = (file) => fs.readFileSync(path.resolve(__dirname, '../../../..', file), 'utf8');

describe('판본 발행 확인 — 원고 없이 해시만', () => {
  it('readEditionStamp는 manuscript를 고르지 않고, 대조에 쓰는 해시 두 개는 고른다', async () => {
    const db = fakeSupabase();
    await readEditionStamp(db, EDITION);
    const columns = db.calls[0].columns.split(',');
    expect(columns).not.toContain('manuscript');
    expect(columns).toEqual(expect.arrayContaining(['content_hash', 'artifact_manifest']));
  });
  it('원고가 필요한 readEdition은 그대로 manuscript를 받는다(교재 목록 · 관리자 복원)', async () => {
    const db = fakeSupabase();
    await readEdition(db, EDITION);
    expect(db.calls[0].columns.split(',')).toContain('manuscript');
  });
  it('화면용 publishedReading과 교재 표현 저장은 readEditionStamp를 쓴다', () => {
    expect(read('src/lib/server/bookReading.js')).toMatch(/await readEditionStamp\(db, id\)/);
    expect(read('src/lib/server/bookReading.js')).not.toMatch(/await readEdition\(/);
    expect(read('src/lib/server/learningContext.js')).toMatch(/await readEditionStamp\(supabase,source\.editionId\)/);
  });
});
