import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { levelMapFromIndex, materialDifficulty } from '../../materialDifficulty';
import { DIFFICULTY_PER_TICK, DIFFICULTY_VERSION, difficultySummary, levelMaps, refreshPublicDifficulty } from '../materialDifficultyRefresh';
import { runPreservedReanalysis } from '../../reanalysisPreservation';
import { sliceBetween } from '../../__tests__/helpers/sliceBetween.js';

// MATERIAL-DIFFICULTY-002 계약 — 공개 자료 난이도 요약(metadata.difficulty). 셈은 정본 materialDifficulty(#1743)만, 쓰기는 좁은 RPC만.
const json = (tokens, metadata = {}) => {
  const sequence = []; const dictionary = {};
  tokens.forEach((t, i) => { sequence.push(`id_0_${i}_1`); dictionary[`id_0_${i}_1`] = t; });
  return { status: 'completed', sequence, dictionary, metadata: { updated_at: '2026-11-07T10:00:00.000Z', ...metadata } };
};
const zh = json([
  { text: '我', base_form: '我', pos: '대명사' }, { text: '喜欢', base_form: '喜欢', pos: '동사' },
  { text: '咖啡', base_form: '咖啡', pos: '명사' }, { text: '外滩', base_form: '外滩', pos: '명사' },
], { language: 'Chinese' });
const zhMap = levelMapFromIndex([['我', 'wǒ', '나', 1], ['喜欢', 'xǐhuan', '좋아하다', 1], ['咖啡', 'kāfēi', '커피', 2]]);
const en = json([{ text: 'cats', base_form: 'cat', pos: '명사' }, { text: 'run', base_form: 'run', pos: '동사' }], { language: 'English' });

describe('difficultySummary — 디자인 세션과 맞춘 이름 그대로', () => {
  it('중국어: HSK · 정본 결과의 중앙 · 90번째 · 고유어 · 표 비율(소수 둘째 자리)', () => {
    const d = materialDifficulty(zh, zhMap, 'Chinese');
    expect(difficultySummary(zh, zhMap, 'Chinese')).toEqual({
      version: DIFFICULTY_VERSION, scale: 'HSK', medianLevel: d.medianLevel, p90Level: d.p90Level, types: 4, listedShare: 0.75,
    });
  });
  it('영어 · 급수 지도 없음: 고유어만, 급수 칸은 null', () => {
    expect(difficultySummary(en, null, 'English')).toEqual({ version: DIFFICULTY_VERSION, scale: null, medianLevel: null, p90Level: null, types: 2, listedShare: null });
    expect(difficultySummary(zh, null, 'Chinese').scale).toBeNull();
  });
  it('요약은 RPC 길이 상한(2000자) 안이고 키는 여섯뿐', () => {
    const s = difficultySummary(zh, zhMap, 'Chinese');
    expect(Object.keys(s).sort()).toEqual(['listedShare', 'medianLevel', 'p90Level', 'scale', 'types', 'version']);
    expect(JSON.stringify(s).length).toBeLessThan(2000);
  });
});

describe('levelMaps — 일본어는 읽기 키 · 쉬운 급수(N 숫자 큰 쪽)', () => {
  it('주입한 색인으로 언어별 지도를 만든다', async () => {
    const maps = await levelMaps({
      japaneseLevelIndex: async () => [['映画', 'えいが', '영화', 5], ['橋', 'はし', '다리', 3], ['箸', 'はし', '젓가락', 4]],
      chineseLevelIndex: async () => [['我', 'wǒ', '나', 1]],
    });
    expect(maps.Japanese.get('えいが')).toBe(5);
    expect(maps.Japanese.get('はし')).toBe(4);
    expect(maps.Chinese.get('我')).toBe(1);
  });
});

function fakeSupabase(rows, { rpcResult = () => ({ data: true, error: null }) } = {}) {
  const calls = { list: [], read: [], rpc: [] };
  const from = vi.fn(() => {
    const q = { filters: [] };
    q.select = (cols) => { q.cols = cols; return q; };
    q.eq = (k, v) => { q.filters.push(['eq', k, v]); return q; };
    q.order = () => q;
    q.limit = async () => { calls.list.push(q); return { data: rows.map((r) => ({ id: r.id, version: r.processed_json.metadata?.difficulty?.version != null ? String(r.processed_json.metadata.difficulty.version) : null })), error: null }; };
    q.in = async (k, ids) => { calls.read.push(ids); return { data: rows.filter((r) => ids.includes(r.id)), error: null }; };
    return q;
  });
  const rpc = vi.fn(async (name, args) => { calls.rpc.push([name, args]); return rpcResult(args); });
  return { client: { from, rpc }, calls };
}
const maps = { Chinese: zhMap, Japanese: new Map() };

describe('refreshPublicDifficulty', () => {
  it('공개 · completed만 고르고, 요약이 없거나 version이 다른 행만 셈해 RPC로 쓴다(updated_at을 함께 넘긴다)', async () => {
    const rows = [
      { id: 1, processed_json: zh },
      { id: 2, processed_json: { ...en, metadata: { ...en.metadata, difficulty: { version: DIFFICULTY_VERSION } } } },
      { id: 3, processed_json: { ...en, metadata: { ...en.metadata, difficulty: { version: DIFFICULTY_VERSION - 1 } } } },
    ];
    const { client, calls } = fakeSupabase(rows);
    const out = await refreshPublicDifficulty(client, { maps, log: () => {} });
    expect(calls.list[0].filters).toEqual([['eq', 'visibility', 'public'], ['eq', 'processed_json->>status', 'completed']]);
    expect(calls.read).toEqual([[1, 3]]);
    expect(calls.rpc.map(([n, a]) => [n, a.p_id, a.p_expected_updated_at])).toEqual([
      ['material_set_difficulty', 1, '2026-11-07T10:00:00.000Z'], ['material_set_difficulty', 3, '2026-11-07T10:00:00.000Z'],
    ]);
    expect(calls.rpc[0][1].p_difficulty).toEqual(difficultySummary(zh, zhMap, 'Chinese'));
    expect(calls.rpc[1][1].p_difficulty.scale).toBeNull();
    expect(out).toEqual({ candidates: 2, written: 2, stale: 0, failed: 0, more: false });
  });
  it('셈하는 사이 재분석(false)은 stale, 쓰기 실패는 failed — 크론을 멈추지 않는다', async () => {
    const rows = [{ id: 1, processed_json: zh }, { id: 2, processed_json: en }];
    const { client } = fakeSupabase(rows, { rpcResult: (a) => (a.p_id === 1 ? { data: false, error: null } : { data: null, error: { code: '22023' } }) });
    expect(await refreshPublicDifficulty(client, { maps, log: () => {} })).toEqual({ candidates: 2, written: 0, stale: 1, failed: 1, more: false });
  });
  it('할 일이 없으면 급수 색인을 읽지도 않는다', async () => {
    const { client, calls } = fakeSupabase([]);
    expect(await refreshPublicDifficulty(client, { log: () => {} })).toEqual({ candidates: 0, written: 0, stale: 0, failed: 0, more: false });
    expect(calls.read).toEqual([]);
  });
  it('limit · batch를 지키고, 상한 밖에 남으면 more', async () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ id: i + 1, processed_json: zh }));
    const { client, calls } = fakeSupabase(rows);
    const out = await refreshPublicDifficulty(client, { maps, limit: 5, batch: 2, log: () => {} });
    expect(calls.read).toEqual([[1, 2], [3, 4], [5]]);
    expect([out.written, out.more]).toEqual([5, true]);
  });
  it('기본 상한은 한 tick 50편 — 공개 132편 백필은 세 tick(50 · 50 · 32)', async () => {
    expect(DIFFICULTY_PER_TICK).toBe(50);
    const rows = Array.from({ length: 132 }, (_, i) => ({ id: i + 1, processed_json: zh }));
    const { client } = fakeSupabase(rows);
    const first = await refreshPublicDifficulty(client, { maps, log: () => {} });
    expect([first.candidates, first.more]).toEqual([50, true]);
  });
});

describe('재분석은 옛 난이도 요약을 옮기지 않는다', () => {
  it('runPreservedReanalysis 저장본의 metadata에 difficulty가 없다(다른 칸은 그대로)', async () => {
    const old = { id: 4, owner_id: 'o', raw_text: '盛粥。', processed_json: { status: 'completed', metadata: { language: 'Chinese', difficulty: { version: 1, types: 9 }, title: 'keep' }, sequence: ['id_0_0_old'], dictionary: { id_0_0_old: { text: '盛粥。', meaning: '죽' } } } };
    const q = { select: () => q, eq: () => q, order: () => q, range: async () => ({ data: [], error: null }) };
    const client = { from: vi.fn(() => q), rpc: vi.fn(async (name, p) => ({ data: { material: { ...old, raw_text: p.p_raw, processed_json: p.p_json } } })) };
    let seenMeta;
    await runPreservedReanalysis(client, old, new AbortController().signal, async (text, signal, { metadata }) => {
      seenMeta = metadata;
      return { status: 'completed', failed_indices: [], sequence: ['id_0_0_new'], dictionary: { id_0_0_new: { text: '盛粥。', meaning: '죽' } } };
    });
    expect(seenMeta).not.toHaveProperty('difficulty');
    expect(seenMeta.title).toBe('keep');
    const saved = client.rpc.mock.calls[0][1].p_json;
    expect(saved.metadata).not.toHaveProperty('difficulty');
    expect(old.processed_json.metadata.difficulty).toEqual({ version: 1, types: 9 }); // 원본 객체는 건드리지 않는다
  });
});

describe('배선', () => {
  it('분석 작업 크론이 사슬 끝에서 refreshPublicDifficulty를 부른다', () => {
    const src = fs.readFileSync('src/app/api/cron/analysis-jobs/route.js', 'utf8');
    expect(src).toMatch(/import \{ refreshPublicDifficulty \} from '@\/lib\/server\/materialDifficultyRefresh'/);
    expect(src).toMatch(/if \(more\) \{ await kickAnalysisTick\(origin\); return; \}[\s\S]*refreshPublicDifficulty\(supabase\)/);
  });
  it('난이도는 fail-soft — 자기 try 안에서 돌고, 남은 것은 진척이 있을 때만 다음 tick을 부른다', () => {
    const src = fs.readFileSync('src/app/api/cron/analysis-jobs/route.js', 'utf8');
    const tail = sliceBetween(src, 'MATERIAL-DIFFICULTY-002');
    expect(tail).toMatch(/try \{[\s\S]*refreshPublicDifficulty\(supabase\)[\s\S]*\} catch \(error\) \{[\s\S]*difficulty refresh failed/);
    expect(tail).toMatch(/if \(result\.more && result\.written > 0\) await kickAnalysisTick\(origin\);/);
  });
  it('급수 색인은 서버 모듈만 들인다 — 클라이언트 쪽(src/views · src/components)은 이 모듈을 import하지 않는다', () => {
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
    const offenders = ['src/views', 'src/components'].flatMap(walk).filter((f) => /\.(jsx?|tsx?)$/.test(f) && /materialDifficultyRefresh/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
