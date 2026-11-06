import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import {
  DAILY_LIMITS, DAILY_LIMIT_CODE, DAILY_LIMIT_MESSAGE, __setQuotaClientForTest, consumeDailyQuota, dailyLimitResponse, dailyQuotaGate, quotaSubject,
} from '../dailyQuota';
import { friendlyError, friendlyToastMessage } from '../../errorMessage';
import { createServiceStop, fetchWithRateLimitRetry } from '../../analyzeText';

/**
 * 계약: 비싼 AI 경로의 하루 상한(AI-QUOTA-001 — 발매 준비 점검 1 · 2, 2026-11-06 KST).
 * DB 쪽(원자적 증가 · 상한 · 권한)은 supabase/tests/ai-daily-quota.mjs(PGlite, CI)가 본다 — 여기는 서버 도우미 · 라우트 배선 · 클라 멈춤.
 */
const rpcClient = (impl) => ({ rpc: vi.fn(impl) });
const req = (headers = {}) => new Request('http://x/api', { headers });

describe('dailyQuota — 서버 도우미', () => {
  afterEach(() => __setQuotaClientForTest(undefined));

  it('상한값은 실측 근거의 정상 사용을 막지 않는다(분석 ≥ 하루 최대 12의 20배 · 첨삭 ≥ 2의 20배 · 문단 ≥ 18의 5배 · 음성 ≥ 복습 894의 5배)', () => {
    expect(DAILY_LIMITS.analyze).toBeGreaterThanOrEqual(12 * 20);
    expect(DAILY_LIMITS.writing).toBeGreaterThanOrEqual(2 * 20);
    expect(DAILY_LIMITS.paragraph).toBeGreaterThanOrEqual(18 * 5);
    expect(DAILY_LIMITS.explain).toBeGreaterThanOrEqual(410 * 2);
    expect(DAILY_LIMITS.tts).toBeGreaterThanOrEqual(894 * 5);
    for (const [kind, limit] of Object.entries(DAILY_LIMITS)) {
      expect(kind).toMatch(/^[a-z_]{1,24}$/); // DB CHECK와 같은 모양
      expect(Number.isInteger(limit) && limit > 0).toBe(true);
    }
  });

  it('주체: 로그인은 u:<uid>, 아니면 IP 해시(원문 IP는 남기지 않는다)', () => {
    expect(quotaSubject(req(), 'a1b2c3d4-0000-4000-8000-000000000001')).toBe('u:a1b2c3d4-0000-4000-8000-000000000001');
    const s = quotaSubject(req({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }), null);
    expect(s).toMatch(/^ip:[0-9a-f]{64}$/);
    expect(s).not.toContain('203.0.113.7');
    expect(quotaSubject(req({ 'x-forwarded-for': '203.0.113.7' }), null)).toBe(s); // 첫 주소만 본다
  });

  it('한도 안이면 통과 · 넘으면 막는다 · 상한값을 DB에 함께 보낸다', async () => {
    const client = rpcClient(async () => ({ data: { ok: true, used: 3, limit: 300 }, error: null }));
    __setQuotaClientForTest(client);
    expect(await consumeDailyQuota({ kind: 'analyze', subject: 'u:x' })).toMatchObject({ ok: true, counted: true, used: 3 });
    expect(client.rpc).toHaveBeenCalledWith('consume_ai_daily_quota', { p_subject: 'u:x', p_kind: 'analyze', p_units: 1, p_limit: DAILY_LIMITS.analyze });
    __setQuotaClientForTest(rpcClient(async () => ({ data: { ok: false, used: 300, limit: 300 }, error: null })));
    expect(await consumeDailyQuota({ kind: 'analyze', subject: 'u:x' })).toMatchObject({ ok: false, counted: true });
  });

  it('셀 수 없으면 막지 않는다(fail-open): 키 없음 · RPC 오류 · 던짐', async () => {
    __setQuotaClientForTest(null);
    expect(await consumeDailyQuota({ kind: 'tts', subject: 'ip:x' })).toEqual({ ok: true, counted: false });
    __setQuotaClientForTest(rpcClient(async () => ({ data: null, error: { message: 'down' } })));
    expect((await consumeDailyQuota({ kind: 'tts', subject: 'ip:x' })).ok).toBe(true);
    __setQuotaClientForTest(rpcClient(async () => { throw new Error('network'); }));
    expect((await consumeDailyQuota({ kind: 'tts', subject: 'ip:x' })).ok).toBe(true);
    await expect(consumeDailyQuota({ kind: 'nope', subject: 'u:x' })).rejects.toThrow(/unknown daily quota kind/);
  });

  it('상한 응답: 429 + X-Daily-Limit + code daily_limit, 본문은 라우트가 쓰던 모양', async () => {
    const flat = dailyLimitResponse();
    expect(flat.status).toBe(429);
    expect(flat.headers.get('x-daily-limit')).toBe('1');
    expect(await flat.json()).toEqual({ error: DAILY_LIMIT_MESSAGE, code: DAILY_LIMIT_CODE });
    expect(await dailyLimitResponse('nested').json()).toEqual({ error: { message: DAILY_LIMIT_MESSAGE, code: DAILY_LIMIT_CODE }, code: DAILY_LIMIT_CODE });
    expect(await dailyLimitResponse('coded').json()).toEqual({ error: DAILY_LIMIT_CODE, message: DAILY_LIMIT_MESSAGE, code: DAILY_LIMIT_CODE });
    __setQuotaClientForTest(rpcClient(async () => ({ data: { ok: true }, error: null })));
    expect(await dailyQuotaGate('writing', 'u:x')).toBeNull();
    __setQuotaClientForTest(rpcClient(async () => ({ data: { ok: false }, error: null })));
    expect((await dailyQuotaGate('writing', 'u:x', { shape: 'nested' })).status).toBe(429);
  });
});

describe('dailyQuota — 라우트 배선', () => {
  // 로그인 · 분당 제한 뒤에 하루 상한을 센다(분당 제한에 걸린 요청은 세지 않는다). 서버 분석 작업(내부 요청)은 gate를 건너뛴다.
  const WIRED = {
    'src/app/api/analyze/route.js': "dailyQuotaGate('analyze'",
    'src/app/api/analyze/korean/route.js': "dailyQuotaGate('analyze'",
    'src/app/api/gemini/route.js': "dailyQuotaGate('gemini'",
    'src/app/api/explain/route.js': "dailyQuotaGate('explain'",
    'src/app/api/study-paragraph/route.js': "dailyQuotaGate('paragraph'",
    'src/app/api/writing-feedback/route.js': "dailyQuotaGate('writing'",
    'src/app/api/dict-correct/route.js': "dailyQuotaGate('dict'",
    'src/app/api/classroom/lookup/route.js': "dailyQuotaGate('lookup'",
    'src/app/api/classroom/recognize/route.js': "kind:'ink'",
    'src/app/api/notes/[id]/recognize/route.js': "kind:'ink'",
    'src/app/api/import/link/route.js': "dailyQuotaGate('import'",
    'src/app/api/tts/route.js': "dailyQuotaGate('tts'",
  };
  it.each(Object.entries(WIRED))('%s 는 하루 상한을 센다(분당 제한 뒤)', (file, needle) => {
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toContain(needle);
    const at = src.indexOf(needle);
    const rate = Math.max(src.indexOf('rateLimit('), src.indexOf('isRateLimited('));
    expect(rate).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(rate);
  });
  it('nested 모양 라우트(클라가 error.message를 읽는다)는 nested로 답한다', () => {
    for (const f of ['explain', 'study-paragraph', 'writing-feedback', 'gemini']) {
      expect(fs.readFileSync(`src/app/api/${f}/route.js`, 'utf8')).toMatch(/dailyQuotaGate\('[a-z]+', quotaSubject\(request, authUser\.id\), \{ shape: 'nested' \}\)/);
    }
  });
  it('DB 계약이 CI에서 돈다', () => {
    expect(fs.readFileSync('.github/workflows/ci.yml', 'utf8')).toContain('node supabase/tests/ai-daily-quota.mjs');
  });
});

describe('dailyQuota — 클라는 하루 상한에 다시 던지지 않는다(새 화면 요소 없음)', () => {
  beforeEach(() => vi.useRealTimers());

  it('안내 문구는 표준 정본(errorMessage)이 「1~2분 기다린 뒤」가 아닌 하루 상한 문구로 바꾼다', () => {
    expect(friendlyToastMessage(DAILY_LIMIT_MESSAGE)).toBe(DAILY_LIMIT_MESSAGE);
    expect(friendlyToastMessage('daily_limit')).toBe(DAILY_LIMIT_MESSAGE);
    expect(friendlyError('daily_limit').retry).toBeFalsy(); // 「다시 시도」로 바로 부르지 않는다
    expect(friendlyToastMessage('요청이 너무 많아요')).toMatch(/1~2분/); // 분당 제한 안내는 그대로
  });

  it('fetchWithRateLimitRetry: X-Daily-Limit 429는 기다리지 않고 바로 돌려준다(분당 429만 재시도)', async () => {
    let calls = 0;
    const transport = async () => { calls += 1; return dailyLimitResponse(); };
    const res = await fetchWithRateLimitRetry('/api/analyze', {}, undefined, transport);
    expect(res.status).toBe(429);
    expect(calls).toBe(1);
  });

  it('createServiceStop: daily_limit 코드 · 오류는 남은 요청을 멈춘다(남은 줄은 기존 「이어서 분석」 실패 길)', () => {
    expect(createServiceStop().note({ code: 'daily_limit' })).toBe(true);
    expect(createServiceStop().note({ error: Object.assign(new Error('x'), { code: 'daily_limit', status: 429 }) })).toBe(true);
    expect(createServiceStop().note({ code: 'rate_limited' })).toBe(false);
  });

  it('callGemini: 하루 상한 429는 붐빔 재시도(5/10/20초)를 하지 않는다', async () => {
    const { callGemini } = await import('../../gemini');
    let calls = 0;
    const transport = async () => { calls += 1; return dailyLimitResponse('nested'); };
    await expect(callGemini('p', undefined, { transport })).rejects.toMatchObject({ code: 'daily_limit', status: 429 });
    expect(calls).toBe(1);
  });
});
