import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fetchSavedLevelKeysAll } from '../levelList.js';

// 계약: 레벨 목록 「저장됨」 조회 — 목록 전체는 그 언어 단어장을 id 순 1000행 page로 한 번에 읽어 대조한다
// (키 150개 × 표기 · 기본형으로 HSK 6에서 24요청이던 것을 단어장 크기만큼의 연속 page로). 한자 칩은 그대로 몇 단어만.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

/** PostgREST처럼 응답당 1000행에서 자르는 user_vocabulary 모의. */
function vocabClient(rows, { failAt = null } = {}) {
  const calls = [];
  const client = { from(table) {
    const call = { table, filters: [], orders: [], range: null, select: null };
    calls.push(call);
    const q = {
      select(cols, opts) { call.select = [cols, opts]; return q; },
      eq(col, value) { call.filters.push([col, value]); return q; },
      order(col, opts) { call.orders.push([col, opts]); return q; },
      async range(from, to) {
        call.range = [from, to];
        if (failAt === from) return { data: null, error: new Error('unavailable') };
        return { data: rows.slice(from, Math.min(to, from + 999) + 1), count: rows.length, error: null };
      },
    };
    return q;
  } };
  return { client, calls };
}

const rows = Array.from({ length: 2500 }, (_, i) => ({ id: `v${String(i).padStart(5, '0')}`, word_text: `w${i}`, base_form: i % 2 ? `b${i}` : null }));

describe('fetchSavedLevelKeysAll', () => {
  it('2,500행을 연속 range 세 번으로 끝까지 읽고 표기 · 기본형으로 대조한다', async () => {
    const { client, calls } = vocabClient(rows);
    const saved = await fetchSavedLevelKeysAll(client, 'u1', 'Chinese', ['w0', 'b2499', 'w2499', 'w9999', 'b1']);
    expect(calls).toHaveLength(3);
    expect(calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    for (const c of calls) {
      expect(c.table).toBe('user_vocabulary');
      expect(c.select).toEqual(['id, word_text, base_form', { count: 'exact' }]);
      expect(c.filters).toEqual([['user_id', 'u1'], ['language', 'Chinese']]);
      expect(c.orders).toEqual([['id', { ascending: true }]]);
    }
    expect(saved).toEqual(new Set(['w0', 'b2499', 'w2499', 'b1']));
  });

  it('중간 page 실패는 던진다 — 일부만 「저장됨」으로 그리지 않는다', async () => {
    const { client } = vocabClient(rows, { failAt: 1000 });
    await expect(fetchSavedLevelKeysAll(client, 'u1', 'Chinese', ['w0'])).rejects.toThrow('unavailable');
  });

  it('로그인 전 · 키 없음은 묻지 않는다', async () => {
    const { client, calls } = vocabClient(rows);
    expect(await fetchSavedLevelKeysAll(client, null, 'Chinese', ['w0'])).toEqual(new Set());
    expect(await fetchSavedLevelKeysAll(client, 'u1', 'Chinese', [])).toEqual(new Set());
    expect(calls).toHaveLength(0);
  });

  it('화면은 목록 전체에 이 조회를, 한자 칩에는 기존 키 조회를 쓴다', () => {
    const page = read('src/views/LevelListPage.jsx');
    expect(page).toContain('fetchSavedLevelKeysAll(supabase, userId, conf.language, allEntries.map((e) => e.key))');
    const loadSaved = page.match(/const loadSaved = useCallback\(\(keys\) => \{[\s\S]*?\n {2}\}, /)?.[0];
    expect(loadSaved).toContain('fetchSavedLevelKeys(supabase, userId, conf.language, keys)');
    // 그 밖에는 단어장 대조 전 O 한 곳뿐 — 공부 중인 단어인지 그 단어만 묻는다(LEVEL-ROUND-001).
    expect(page.match(/fetchSavedLevelKeys\(/g)).toHaveLength(2);
    expect(page.match(/const isStudying = async \(key\) => \{[\s\S]*?\n {2}\};/)?.[0]).toContain('fetchSavedLevelKeys(supabase, userId, conf.language, [key])');
    expect(read('src/lib/levelList.js')).toContain("import { readCompleteLegacyRows } from './legacyReviewSync';");
  });
});
