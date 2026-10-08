import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { QueryClient } from '@tanstack/react-query';
import {
  TOKEN_DICT_CHUNK, TOKEN_DICT_COLUMNS, chunkKeys, collectTokenDictKeys, prefetchTokenDict,
  tokenDictEntriesFromRows, tokenDictKeyOf, tokenDictPrefetchEnabled, tokenDictQueryKey,
} from '../tokenDictPrefetch';

/**
 * 계약: 표제어 일괄 조회(AE-R1 설계서 §5.3 · VIEWER-V2-ROUNDS-001 §2.2 T2 → T0).
 * - 고유 표제어(sep_link ‖ base_form ‖ text)를 100개씩 .in('base_form')으로 받아 카드의 단건 조회와
 *   **같은 캐시 키·같은 값 모양**으로 채운다. 요청 수 = ⌈고유 표제어/100⌉.
 * - 행 없음 = null(maybeSingle과 같음). 실패·이상 응답이면 아무것도 채우지 않는다(단건 경로로 폴백).
 * - 이미 캐시에 있는 키는 덮지 않는다. 비로그인·한국어·분석 전에는 요청하지 않는다. 쓰기 0.
 */
const viewer = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');

function fakeSupabase(answer) {
  const calls = [];
  const supabase = {
    from(table) {
      const call = { table, filters: [], select: null };
      calls.push(call);
      const builder = {
        select(columns) { call.select = columns; return builder; },
        eq(column, value) { call.filters.push(['eq', column, value]); return builder; },
        in(column, values) { call.filters.push(['in', column, values]); return builder; },
        insert() { throw new Error('write attempted'); },
        update() { throw new Error('write attempted'); },
        upsert() { throw new Error('write attempted'); },
        then(resolve, reject) { return Promise.resolve().then(() => answer(call)).then(resolve, reject); },
      };
      return builder;
    },
  };
  return { supabase, calls };
}
const rowsFor = (db) => (call) => {
  const keys = call.filters.find((f) => f[0] === 'in')[2];
  return { data: keys.filter((k) => db[k]).map((k) => ({ base_form: k, ...db[k] })), error: null };
};
const material = (tokens) => {
  const sequence = [], dictionary = {};
  tokens.forEach((t, i) => { const id = `id_0_${i}`; sequence.push(id); dictionary[id] = t; });
  return { status: 'completed', metadata: { language: 'Chinese' }, sequence, dictionary };
};

describe('고유 표제어 수집', () => {
  it('카드 키와 같은 규칙(sep_link ‖ base_form ‖ text) · 첫 등장 순 · 개행·문장부호·위험 문자 제외', () => {
    const pj = material([
      { text: '道', base_form: '道', sep_link: '道歉' }, { text: '了', base_form: '了' }, { text: '歉', base_form: '歉', sep_link: '道歉' },
      { text: '\n', base_form: '', pos: '개행' }, { text: '。', base_form: '。', pos: '기호' }, { text: '体育场' },
      { text: '了', base_form: '了' }, { text: 'a"b' }, { text: '食べた', base_form: '食べる' }, { text: '3' },
    ]);
    expect(collectTokenDictKeys(pj)).toEqual(['道歉', '了', '体育场', '食べる', '3']);
    expect(tokenDictKeyOf({ text: '道', base_form: '道', sep_link: '道歉' })).toBe('道歉');
    expect(collectTokenDictKeys(null)).toEqual([]);
  });
  it('100개 단위로 나눈다', () => {
    const keys = Array.from({ length: 250 }, (_, i) => `k${i}`);
    expect(TOKEN_DICT_CHUNK).toBe(100);
    expect(chunkKeys(keys).map((c) => c.length)).toEqual([100, 100, 50]);
    expect(chunkKeys([])).toEqual([]);
  });
});

describe('카드 단건 조회와 같은 키·같은 모양 (ViewerPage 소스 계약)', () => {
  it('ViewerPage token-dict 쿼리 키와 select 열이 미리 받기와 같다', () => {
    expect(viewer).toContain("queryKey: ['token-dict', materialLang, selectedDictKey],");
    expect(tokenDictQueryKey('Chinese', '壮观')).toEqual(['token-dict', 'Chinese', '壮观']);
    expect(viewer).toContain(`.select('${TOKEN_DICT_COLUMNS.join(', ')}')`);
    expect(viewer).toContain('const selectedDictKey=selectedLexKey||selectedToken?.text;');
    expect(viewer).toContain('const selectedLexKey = selectedToken?.sep_link || selectedToken?.base_form;');
  });
  it('미리 받기 훅이 연결되고 조건 함수로 켜진다 — 카드 쿼리 자체는 그대로', () => {
    expect(viewer).toContain("import { useTokenDictPrefetch } from '../lib/useTokenDictPrefetch';");
    expect(viewer).toMatch(/useTokenDictPrefetch\(\{ supabase, queryClient, language: materialLang, processedJson: material\?\.processed_json,\s*enabled: tokenDictPrefetchEnabled\(\{ user, language: materialLang/);
    expect(viewer).toContain("enabled: materialLang !== 'Korean' && (isEditingToken || (isSheetOpen && materialLang === 'Chinese') || (!!selectedToken && !!selectedLexKey && selectedLexKey !== selectedToken.text)) && !!selectedDictKey,");
    expect(viewer).toContain('staleTime: 1000 * 60,');
  });
  it('응답 행 → 단건 결과와 같은 {meanings, reading, pos} · 행 없음 null', () => {
    const entries = tokenDictEntriesFromRows(['壮观', '体育场'], [
      { base_form: '壮观', meanings: [{ meaning: '웅장하다' }], reading: 'zhuàng guān', pos: '형용사', source: 'gemini' }]);
    expect(entries).toEqual([['壮观', { meanings: [{ meaning: '웅장하다' }], reading: 'zhuàng guān', pos: '형용사' }], ['体育场', null]]);
    expect(Object.keys(entries[0][1])).toEqual(['meanings', 'reading', 'pos']);
  });
  it('이상 응답(배열 아님·base_form 없음·중복 행)은 믿지 않는다', () => {
    expect(tokenDictEntriesFromRows(['a'], null)).toBeNull();
    expect(tokenDictEntriesFromRows(['a'], { meanings: [] })).toBeNull();
    expect(tokenDictEntriesFromRows(['a'], [{ meanings: [], reading: null, pos: null }])).toBeNull();
    expect(tokenDictEntriesFromRows(['a'], [{ base_form: 'a' }, { base_form: 'a' }])).toBeNull();
  });
});

describe('prefetchTokenDict — 요청 수와 캐시 채우기', () => {
  it('250개 → 요청 3회(⌈250/100⌉), 같은 언어·같은 표·읽기만, 모든 키가 캐시에 선다', async () => {
    const keys = Array.from({ length: 250 }, (_, i) => `词${i}`);
    const db = { 词0: { meanings: [{ meaning: '뜻0' }], reading: 'cí', pos: '명사' } };
    const { supabase, calls } = fakeSupabase(rowsFor(db));
    const queryClient = new QueryClient();
    const result = await prefetchTokenDict({ supabase, queryClient, language: 'Chinese', keys });
    expect(result).toEqual({ requests: 3, filled: 250, failed: false });
    expect(calls.map((c) => c.table)).toEqual(Array(3).fill('morpheme_dictionary'));
    for (const call of calls) {
      expect(call.select).toBe('base_form, meanings, reading, pos');
      expect(call.filters[0]).toEqual(['eq', 'language', 'Chinese']);
    }
    expect(calls.map((c) => c.filters[1][2].length)).toEqual([100, 100, 50]);
    expect(queryClient.getQueryData(['token-dict', 'Chinese', '词0'])).toEqual(db.词0);
    expect(queryClient.getQueryData(['token-dict', 'Chinese', '词1'])).toBeNull();
    expect(queryClient.getQueryState(['token-dict', 'Chinese', '词1']).dataUpdatedAt).toBeGreaterThan(0);
  });
  it('이미 캐시에 있는 키는 요청에서 빼고 덮지 않는다', async () => {
    const queryClient = new QueryClient();
    const corrected = { meanings: [{ meaning: '고친 뜻' }], reading: 'x', pos: '동사' };
    queryClient.setQueryData(['token-dict', 'Chinese', 'a'], corrected);
    const { supabase, calls } = fakeSupabase(rowsFor({ a: { meanings: [], reading: 'old', pos: null }, b: { meanings: [], reading: 'b', pos: null } }));
    await prefetchTokenDict({ supabase, queryClient, language: 'Chinese', keys: ['a', 'b'] });
    expect(calls[0].filters[1][2]).toEqual(['b']);
    expect(queryClient.getQueryData(['token-dict', 'Chinese', 'a'])).toBe(corrected);
  });
  it('그사이 단건 조회가 채운 키는 응답이 와도 덮지 않는다', async () => {
    const queryClient = new QueryClient();
    const single = { meanings: [{ meaning: '단건' }], reading: 'r', pos: null };
    const { supabase } = fakeSupabase((call) => {
      queryClient.setQueryData(['token-dict', 'Chinese', 'a'], single);
      return rowsFor({ a: { meanings: [], reading: 'bulk', pos: null } })(call);
    });
    const result = await prefetchTokenDict({ supabase, queryClient, language: 'Chinese', keys: ['a', 'b'] });
    expect(queryClient.getQueryData(['token-dict', 'Chinese', 'a'])).toBe(single);
    expect(result.filled).toBe(1);
  });
  it.each([
    ['오류 응답', () => ({ data: null, error: { message: 'boom' } })],
    ['예외', () => { throw new Error('network'); }],
    ['배열 아닌 응답', () => ({ data: { meanings: [] }, error: null })],
    ['base_form 없는 행', () => ({ data: [{ meanings: [], reading: null, pos: null }], error: null })],
  ])('%s → 조용히 멈추고 아무것도 채우지 않는다(카드는 단건 경로)', async (_name, answer) => {
    const queryClient = new QueryClient();
    const { supabase, calls } = fakeSupabase(answer);
    const keys = Array.from({ length: 150 }, (_, i) => `k${i}`);
    const result = await prefetchTokenDict({ supabase, queryClient, language: 'Japanese', keys });
    expect(result).toEqual({ requests: 1, filled: 0, failed: true });
    expect(calls).toHaveLength(1);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
  it('언어가 캐시 키에 들어간다 — 같은 표기라도 언어가 다르면 섞이지 않는다', async () => {
    const queryClient = new QueryClient();
    const { supabase } = fakeSupabase(rowsFor({ 天気: { meanings: [{ meaning: '날씨' }], reading: 'てんき', pos: '명사' } }));
    await prefetchTokenDict({ supabase, queryClient, language: 'Japanese', keys: ['天気'] });
    expect(queryClient.getQueryData(['token-dict', 'Chinese', '天気'])).toBeUndefined();
    expect(queryClient.getQueryData(['token-dict', 'Japanese', '天気']).reading).toBe('てんき');
  });
});

describe('동작 조건 — 로그인(RLS) · 한국어 아님 · 분석 완료', () => {
  const pj = material([{ text: '你好' }]);
  const user = { id: 'u' };
  it.each([
    [{ user, language: 'Chinese', processedJson: pj }, true],
    [{ user, language: 'Japanese', processedJson: { ...pj, status: 'partial' } }, true],
    [{ user, language: 'English', processedJson: pj }, true],
    [{ user: null, language: 'Chinese', processedJson: pj }, false],
    [{ user, language: 'Korean', processedJson: pj }, false],
    [{ user, language: 'Chinese', processedJson: { ...pj, status: 'analyzing' } }, false],
    [{ user, language: 'Chinese', processedJson: { ...pj, status: undefined }, status: 'completed' }, true],
    [{ user, language: 'Chinese', processedJson: null }, false],
  ])('%o → %s', (input, expected) => {
    expect(tokenDictPrefetchEnabled(input)).toBe(expected);
  });
  it('RLS: morpheme_dictionary 읽기 정책은 인증 사용자 SELECT 하나 — 일괄 조회도 같은 클라이언트·같은 정책', () => {
    const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260415000200_morpheme_dictionary.sql'), 'utf8');
    expect(sql).toContain("ON morpheme_dictionary FOR SELECT\n  USING (auth.role() = 'authenticated');");
    expect(sql).toContain('UNIQUE (base_form, language)');
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/tokenDictPrefetch.js'), 'utf8');
    expect(src).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/);
    expect(src).not.toMatch(/service_role|SERVICE_ROLE/);
  });
});
