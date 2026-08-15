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

  // 겸류사: 중국어는 Gemini pos(다중 '·' 연결 포함)를 저장해야 사전이 후보를 안다.
  // (기존엔 영어만 entry.pos를 쓰고 중국어는 프롬프트로 받고도 버렸다 — jieba 단일 태그 박제)
  it('중국어는 Gemini pos를 저장한다(겸류 다중 pos + 뜻별 pos 태그 보존)', async () => {
    const arr = [{
      pos: '동사·명사',
      reading: 'gōngzuò',
      meanings: [{ meaning: '일하다', pos: '동사' }, { meaning: '일, 직업', pos: '명사' }],
    }];
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(arr) }] } }] }),
    })));
    const { result } = await fetchMeaningsForMissing(
      [{ base_form: '工作', pos: '명사성 동사', reading: 'gōngzuò' }], 'Chinese', mockSupabase
    );
    const entry = result.get('工作');
    expect(entry.pos).toBe('동사·명사');
    expect(entry.meanings).toEqual([
      { meaning: '일하다', priority: 1, pos: '동사' },
      { meaning: '일, 직업', priority: 2, pos: '명사' },
    ]);
  });

  it('뜻에 pos가 없으면(레거시 형식 응답) pos 필드 없이 저장한다', async () => {
    const arr = [{ pos: '명사', reading: 'túshūguǎn', meanings: [{ meaning: '도서관' }] }];
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(arr) }] } }] }),
    })));
    const { result } = await fetchMeaningsForMissing(
      [{ base_form: '图书馆', pos: '명사', reading: 'túshūguǎn' }], 'Chinese', mockSupabase
    );
    expect(result.get('图书馆').meanings).toEqual([{ meaning: '도서관', priority: 1 }]);
  });

  it('일본어는 Gemini pos를 무시하고 kuromoji pos를 유지한다', async () => {
    const arr = [{ pos: '엉뚱품사', reading: 'たべる', meanings: [{ meaning: '먹다' }] }];
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(arr) }] } }] }),
    })));
    const { result } = await fetchMeaningsForMissing(
      [{ base_form: '食べる', pos: '동사', reading: 'たべる' }], 'Japanese', mockSupabase
    );
    expect(result.get('食べる').pos).toBe('동사');
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
