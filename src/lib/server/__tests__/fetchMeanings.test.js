import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMeaningsForMissing } from '../fetchMeanings.js';

// 계약(#969): 캐시가 빈 언어의 미싱 100개 순차 조회는 실측 94s로 Vercel 60s 캡을 넘겨
// 함수째 죽는다 — 병렬 웨이브 + deadline 중단(그레이스풀 디그레이드)이 이를 막는다.

const mockSupabase = { from: () => ({ upsert: async () => ({ error: null }) }) };

function makeMissing(n) {
  return Array.from({ length: n }, (_, i) => ({ base_form: `词${i}`, pos: '명사', reading: `cí${i}` }));
}

function geminiOkResponse(batchLen) {
  const arr = Array.from({ length: batchLen }, () => ({
    pos: '명사', reading: 'cí', meanings: [{ meaning: '뜻' }],
  }));
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(arr) }] } }] }),
  };
}

describe('fetchMeaningsForMissing — 병렬·deadline', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('GROQ_API_KEY', '');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('정상 경로: 배치 응답을 파싱해 result 맵을 채운다', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const batchLen = (JSON.parse(opts.body).contents[0].parts[0].text.match(/^\d+\. /gm) || []).length;
      return geminiOkResponse(batchLen);
    }));
    const { result, errors } = await fetchMeaningsForMissing(makeMissing(15), 'Chinese', mockSupabase);
    expect(result.size).toBe(15);
    expect(errors).toEqual([]);
  });

  it('배치를 concurrency개까지 동시에 보낸다 (순차 94s → 병렬로 60s 캡 회피)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      const batchLen = (JSON.parse(opts.body).contents[0].parts[0].text.match(/^\d+\. /gm) || []).length;
      return geminiOkResponse(batchLen);
    }));
    // 90개 = 15개씩 6배치, concurrency 3 → 2웨이브
    const { result } = await fetchMeaningsForMissing(makeMissing(90), 'Chinese', mockSupabase, { concurrency: 3 });
    expect(result.size).toBe(90);
    expect(maxInFlight).toBe(3);
  });

  it('deadline이 지나면 남은 웨이브를 시작하지 않고 중단한다', async () => {
    const fetchSpy = vi.fn(async (url, opts) => {
      const batchLen = (JSON.parse(opts.body).contents[0].parts[0].text.match(/^\d+\. /gm) || []).length;
      return geminiOkResponse(batchLen);
    });
    vi.stubGlobal('fetch', fetchSpy);
    // 이미 지난 deadline → 첫 웨이브 전에 중단, fetch 0회
    const { result, errors } = await fetchMeaningsForMissing(
      makeMissing(90), 'Chinese', mockSupabase, { deadlineMs: Date.now() - 1, concurrency: 3 }
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
    const deadlineErr = errors.find((e) => e.stage === 'deadline');
    expect(deadlineErr).toBeTruthy();
    expect(deadlineErr.remaining).toBe(90);
  });

  it('capacity 재시도 대기가 deadline을 넘기면 재시도를 포기한다', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: 'rate limited' }),
    }));
    vi.stubGlobal('fetch', fetchSpy);
    // deadline 여유 100ms < 첫 재시도 대기 5000ms → 1회 시도 후 즉시 포기(실대기 없음)
    const { result, errors } = await fetchMeaningsForMissing(
      makeMissing(15), 'Chinese', mockSupabase, { deadlineMs: Date.now() + 100, concurrency: 1 }
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.size).toBe(0);
    expect(errors.find((e) => e.stage === 'http')).toBeTruthy();
  });
});
