import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { MAX_MATERIALS, TTL_MS, pickEvictions } from '../offlineCache.js';
import { objectParticle } from '../../components/OfflineNotice.jsx';

/**
 * 계약: v2-N R1 오프라인 읽기 (#1077 설계, 오너 착수 승인 2026-08-30 "N R1 ㄱㄱ").
 * R1에 해당하는 설계 §5 계약 4종을 심는다:
 * ① 캐시 상한·TTL 준수(용량 폭주 금지) ④ 오프라인 쓰기 실패가 학습 흐름을 막지 않음
 * ⑤ 캐시 부재 시 조용한 폴백(빈 화면 대신 안내) ⑥ 온라인은 네트워크 우선(캐시는 폴백 전용)
 * (계약 ②③은 동기화 큐가 생기는 R2 몫 — 여기선 쓰기 경로 자체가 없다.)
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('① 상한·TTL — 용량 폭주 금지', () => {
  const now = Date.UTC(2026, 7, 30, 0, 0, 0);
  const at = (daysAgo) => ({ id: `m${daysAgo}`, savedAt: now - daysAgo * 86400000 });

  it('TTL(7일) 지난 항목은 전부 축출된다', () => {
    const entries = [at(1), at(8), at(30)];
    expect(pickEvictions(entries, { now, max: 99 })).toEqual(['m8', 'm30']);
  });

  it('상한을 넘으면 오래된 것부터 — 자료는 3개까지(processed_json이 크다)', () => {
    const entries = [at(0), at(1), at(2), at(3), at(4)];
    expect(pickEvictions(entries, { now, max: MAX_MATERIALS })).toEqual(['m4', 'm3']);
    expect(MAX_MATERIALS).toBe(3);
    expect(TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('만료분을 먼저 걷어낸 뒤 상한을 센다 — 산 것만 자리를 차지한다', () => {
    const entries = [at(0), at(1), at(9), at(2)];
    const evicted = pickEvictions(entries, { now, max: 3 });
    expect(evicted).toEqual(['m9']);           // 만료 1건 제거로 상한 충족 — 산 것은 안 지운다
  });

  it('빈 입력·상한 미달은 아무것도 지우지 않는다(무해성)', () => {
    expect(pickEvictions([], { now, max: 3 })).toEqual([]);
    expect(pickEvictions(undefined, { now, max: 3 })).toEqual([]);
    expect(pickEvictions([at(0), at(1)], { now, max: 3 })).toEqual([]);
  });

  it('스냅샷 스토어는 key 경로로 축출한다(자료는 id — keyPath 혼선 방지)', () => {
    const rows = [{ key: 'vocab:a', savedAt: now - 40 * 86400000 }];
    expect(pickEvictions(rows, { now, max: 4, keyPath: 'key' })).toEqual(['vocab:a']);
  });
});

/* 네트워크·캐시 경계는 실동작으로 — supabase와 캐시를 모두 세워 두고 fetchVocab을 돌린다. */
const supabaseMock = { from: vi.fn() };
const cacheMock = { cacheVocabSnapshot: vi.fn(), getCachedVocabSnapshot: vi.fn() };
vi.mock('../supabase', () => ({ supabase: supabaseMock }));
vi.mock('../offlineCache', async (importOriginal) => ({
  ...(await importOriginal()),
  cacheVocabSnapshot: (...a) => cacheMock.cacheVocabSnapshot(...a),
  getCachedVocabSnapshot: (...a) => cacheMock.getCachedVocabSnapshot(...a),
}));

/** user_vocabulary 조회 한 번을 흉내내는 최소 체인. */
function stubVocabQuery(result) {
  supabaseMock.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({ order: () => Promise.resolve(result) }),
      in: () => Promise.resolve({ data: [], error: null }),
    }),
  }));
}

describe('④⑤⑥ 네트워크 우선 · 조용한 폴백', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheMock.getCachedVocabSnapshot.mockResolvedValue(null);
  });

  it('⑥ 온라인이면 네트워크가 정본 — 캐시는 읽지도 않는다(스테일 불가)', async () => {
    const { fetchVocab } = await import('../vocabIO.js');
    stubVocabQuery({ data: [{ id: 1, word_text: '猫', language: 'Japanese' }], error: null });
    const rows = await fetchVocab('u1');
    expect(rows).toHaveLength(1);
    expect(cacheMock.getCachedVocabSnapshot).not.toHaveBeenCalled();
    expect(rows.__offline).toBeUndefined();
  });

  it('성공분은 스냅샷으로 남는다 — 사용자 조작 0', async () => {
    const { fetchVocab } = await import('../vocabIO.js');
    const row = { id: 1, word_text: 'chat', language: 'French', next_review_at: '2026-08-30T00:00:00Z' };
    stubVocabQuery({ data: [row], error: null });
    await fetchVocab('u1');
    expect(cacheMock.cacheVocabSnapshot).toHaveBeenCalledWith('u1', [row]);
    // next_review_at을 품은 행이라 '오늘 due'가 스냅샷에서 파생된다(별도 캐시 불요)
    expect(cacheMock.cacheVocabSnapshot.mock.calls[0][1][0].next_review_at).toBeTruthy();
  });

  it('④ 캐시 쓰기가 실패해도 학습 흐름은 그대로 — 예외가 새지 않는다', async () => {
    const { fetchVocab } = await import('../vocabIO.js');
    cacheMock.cacheVocabSnapshot.mockImplementation(() => { throw new Error('quota'); });
    stubVocabQuery({ data: [{ id: 1, word_text: 'a', language: 'English' }], error: null });
    await expect(fetchVocab('u1')).resolves.toHaveLength(1);
  });

  it('네트워크가 죽으면 스냅샷으로 살아나고 __offline 표식이 붙는다', async () => {
    const { fetchVocab } = await import('../vocabIO.js');
    stubVocabQuery({ data: null, error: new Error('Failed to fetch') });
    cacheMock.getCachedVocabSnapshot.mockResolvedValue([{ id: 9, word_text: '雨' }]);
    const rows = await fetchVocab('u1');
    expect(rows).toHaveLength(1);
    expect(rows.__offline).toBe(true);
    // 표식은 열거 불가 — 순회·직렬화 결과가 온라인과 같아야 소비처가 무개입이다
    expect(Object.keys(rows)).toEqual(['0']);
    expect(JSON.parse(JSON.stringify(rows))).toEqual([{ id: 9, word_text: '雨' }]);
  });

  it('⑤ 캐시도 없으면 원래 에러 그대로 — 조용히 빈 화면을 만들지 않는다', async () => {
    const { fetchVocab } = await import('../vocabIO.js');
    stubVocabQuery({ data: null, error: new Error('boom') });
    cacheMock.getCachedVocabSnapshot.mockResolvedValue(null);
    await expect(fetchVocab('u1')).rejects.toThrow('boom');
  });
});

describe('배선 — 자료 경로와 안내', () => {
  const viewer = read('src/views/ViewerPage.jsx');

  it('자료도 네트워크 우선 + 실패 시에만 폴백', () => {
    const fn = sliceBetween(viewer, 'async function fetchMaterial(id)', 'async function fetchUserVocabWords');
    // 캐시 쓰기는 완전 격리된 fire-and-forget이어야 한다 — 동기 throw가 폴백으로 새면
    // 네트워크 성공분이 캐시로 대체된다(구현 중 실측해 잡은 결함).
    expect(fn).toContain('Promise.resolve().then(() => cacheMaterial(data)).catch(() => {});');
    expect(fn).toMatch(/const cached = await getCachedMaterial\(id\);/);
    expect(fn).toContain('if (!cached) throw err;');
  });

  it('삭제된 자료가 캐시로 되살아나지 않는다 — NOT_FOUND는 폴백 금지', () => {
    const fn = sliceBetween(viewer, 'async function fetchMaterial(id)', 'async function fetchUserVocabWords');
    expect(fn).toMatch(/if \(err\?\.code === 'NOT_FOUND'\) throw err;/);
  });

  it('캐시 사본 화면에는 안내가 붙는다(뷰어·단어장 공통 문구 1곳)', () => {
    expect(viewer).toContain('{material?.__offline && <OfflineNotice what="자료" />}');
    expect(read('src/views/VocabPage.jsx')).toContain('{vocab?.__offline && <OfflineNotice what="단어장" />}');
    expect(read('src/components/OfflineNotice.jsx')).toContain('저장해 둔 {what}{objectParticle(what)} 보여드리고 있어요');
  });
});

describe('안내 문구 — 한국어 조사', () => {
  it("받침에 따라 을/를을 고른다 — '자료를'·'단어장을'(렌더 검증에서 잡은 결함)", () => {
    expect(objectParticle('자료')).toBe('를');
    expect(objectParticle('단어장')).toBe('을');
    expect(objectParticle('내용')).toBe('을');
  });
});
