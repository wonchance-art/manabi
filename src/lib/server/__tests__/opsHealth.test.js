import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import {
  CRON_JOBS, recordCronRun, recordDailyHealth, summarizeBackfillIpa, summarizeFetchSuggestions, summarizeSendForecast, withCronRun,
} from '../cronRuns';
import { sliceBetween } from '../../__tests__/helpers/sliceBetween.js';

// OPS-HEALTH-001 계약 — 크론 실행 한 줄 · 일일 상태 점검. 새 크론 · 새 환경 변수 없이 기존 크론 네 경로 끝에 붙는다.
// 이상 기준 자체(크론 미실행 · 실패 · 지문 · 서버 오류 · 소식 0 · 난이도 미채움)와 하루 1줄 경보는 PGlite supabase/tests/observe-daily-health.mjs.
const fakeDb = (impl = async () => ({ data: true, error: null })) => ({ rpc: vi.fn(impl) });
const read = (f) => fs.readFileSync(f, 'utf8');

describe('recordCronRun — fail-soft', () => {
  it('알맞은 인자로 RPC를 부른다(처리 · 실패 수는 0 이상 정수)', async () => {
    const db = fakeDb();
    expect(await recordCronRun('fetch-suggestions', { startedAt: 0, ok: true, processed: 6.4, failed: -2, detail: { a: 1 } }, { client: db })).toBe('recorded');
    expect(db.rpc).toHaveBeenCalledWith('observe_record_cron_run', {
      p_job: 'fetch-suggestions', p_started_at: '1970-01-01T00:00:00.000Z', p_ok: true, p_processed: 6, p_failed: 0, p_detail: { a: 1 },
    });
  });
  it('모르는 job · 키 없음 · RPC 오류 · throw · 시간 초과는 throw하지 않고 결과 문자열만', async () => {
    expect(await recordCronRun('unknown-job', {}, { client: fakeDb() })).toBe('skipped');
    expect(await recordCronRun('backfill-ipa', {}, { env: {} })).toBe('skipped');
    expect(await recordCronRun('backfill-ipa', {}, { client: fakeDb(async () => ({ error: { message: 'x' } })) })).toBe('failed');
    expect(await recordCronRun('backfill-ipa', {}, { client: fakeDb(async () => { throw new Error('down'); }) })).toBe('failed');
    expect(await recordCronRun('backfill-ipa', {}, { client: fakeDb(() => new Promise(() => {})), timeoutMs: 5 })).toBe('timeout');
  });
  it('job 이름은 마이그레이션의 크론 넷과 같다', () => {
    const sql = read('supabase/migrations/20261108050000_observe_daily_health.sql');
    expect(sql).toContain(`v_jobs text[] := ARRAY[${CRON_JOBS.map((j) => `'${j}'`).join(', ')}]`);
  });
});

describe('withCronRun — 응답은 그대로, 실행 한 줄만 덧붙인다', () => {
  it('200 → summarize 결과로 한 줄 · 응답 본문 그대로', async () => {
    const db = fakeDb();
    const route = withCronRun('fetch-suggestions', async () => Response.json({ saved: { English: 2, Japanese: 3 }, errors: [], runs: ['a'] }),
      summarizeFetchSuggestions, { client: db });
    const res = await route(new Request('https://x/'));
    expect(await res.json()).toEqual({ saved: { English: 2, Japanese: 3 }, errors: [], runs: ['a'] });
    const args = db.rpc.mock.calls[0][1];
    expect([args.p_job, args.p_ok, args.p_processed, args.p_failed]).toEqual(['fetch-suggestions', true, 5, 0]);
  });
  it('401(인증 실패)은 실행이 아니므로 남기지 않는다 · 5xx는 ok false', async () => {
    const db = fakeDb();
    await withCronRun('backfill-ipa', async () => Response.json({ error: 'Unauthorized' }, { status: 401 }), summarizeBackfillIpa, { client: db })(new Request('https://x/'));
    expect(db.rpc).not.toHaveBeenCalled();
    await withCronRun('backfill-ipa', async () => Response.json({ error: 'x' }, { status: 503 }), summarizeBackfillIpa, { client: db })(new Request('https://x/'));
    expect(db.rpc.mock.calls[0][1].p_ok).toBe(false);
  });
  it('처리기가 throw하면 ok false 한 줄을 남기고 그대로 던진다', async () => {
    const db = fakeDb();
    const route = withCronRun('send-forecast', async () => { throw new Error('boom'); }, summarizeSendForecast, { client: db });
    await expect(route(new Request('https://x/'))).rejects.toThrow('boom');
    expect(db.rpc.mock.calls[0][1]).toMatchObject({ p_job: 'send-forecast', p_ok: false, p_failed: 1 });
  });
  it('기록이 실패해도 응답은 그대로(크론 본체를 깨지 않는다)', async () => {
    const db = fakeDb(async () => { throw new Error('db down'); });
    const res = await withCronRun('send-forecast', async () => Response.json({ sent: 1 }), summarizeSendForecast, { client: db })(new Request('https://x/'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 1 });
  });
});

describe('경로별 요약 — 응답 모양 그대로', () => {
  it('오늘의 소식: 저장 합계 · 오류 수 → 실패', () => {
    expect(summarizeFetchSuggestions({ saved: { English: 1 }, errors: ['English: x'] })).toMatchObject({ ok: false, processed: 1, failed: 1 });
  });
  it('IPA 보충: 사전 + LLM 갱신 합계', () => {
    expect(summarizeBackfillIpa({ stage: 'complete', dictUpdated: 3, geminiUpdated: 2, remaining: 4 })).toMatchObject({ processed: 5, detail: { stage: 'complete', remaining: 4 } });
    expect(summarizeBackfillIpa({ stage: 'idle', dictUpdated: 0, geminiUpdated: 0, remaining: 0 }).processed).toBe(0);
    expect(summarizeBackfillIpa({ stage: 'complete', geminiUpdated: 0, failedBatches: 3, firstError: 'x' })).toMatchObject({ ok: false, failed: 3 }); // 조용한 0 금지
  });
  it('예보 푸시: 보낸 수 · 키 없으면 skipped 기록', () => {
    expect(summarizeSendForecast({ checked: 4, sent: 2, silent: 2 })).toMatchObject({ processed: 2 });
    expect(summarizeSendForecast({ skipped: 'no-vapid' }).detail).toEqual({ skipped: 'no-vapid' });
  });
});

describe('recordDailyHealth', () => {
  it('p_record true로 부르고 보고를 돌려준다 · 실패면 null', async () => {
    const db = fakeDb(async () => ({ data: { ok: true, anomalies: [] }, error: null }));
    expect(await recordDailyHealth({ client: db })).toEqual({ ok: true, anomalies: [] });
    expect(db.rpc).toHaveBeenCalledWith('observe_daily_health', { p_record: true });
    expect(await recordDailyHealth({ client: fakeDb(async () => ({ error: { message: 'x' } })) })).toBeNull();
    expect(await recordDailyHealth({ env: {} })).toBeNull();
  });
});

describe('배선 — 기존 크론 네 경로, 새 크론 없음', () => {
  it('세 경로는 withCronRun으로 감싼다', () => {
    expect(read('src/app/api/cron/fetch-suggestions/route.js')).toContain("export const GET = withCronRun('fetch-suggestions', fetchSuggestions, summarizeFetchSuggestions);");
    expect(read('src/app/api/cron/backfill-ipa/route.js')).toContain("export const GET = withCronRun('backfill-ipa', backfillIpa, summarizeBackfillIpa);");
    const forecast = read('src/app/api/cron/send-forecast/route.js');
    expect(forecast).toContain("const recorded = withCronRun('send-forecast', handle, summarizeSendForecast);");
    expect(forecast).toMatch(/export async function POST\(request\) \{ return recorded\(request\); \}/);
    expect(forecast).toMatch(/export async function GET\(request\) \{ return recorded\(request\); \}/);
  });
  it('분석 작업 크론: tick마다 한 줄 · 사슬 끝에서 자기 줄을 먼저 남기고 점검을 기록', () => {
    const src = read('src/app/api/cron/analysis-jobs/route.js');
    expect(src).toMatch(/finally \{\s*if \(!run\.recorded\) await recordCronRun\('analysis-jobs', run\);/);
    const tail = sliceBetween(src, 'OPS-HEALTH-001: 사슬 끝');
    expect(tail.indexOf("await recordCronRun('analysis-jobs', run);")).toBeLessThan(tail.indexOf('await recordDailyHealth();'));
    // 다음 tick을 부를 때는 점검하지 않는다(사슬 끝에서 한 번)
    expect(sliceBetween(src, 'async function analysisTick', 'OPS-HEALTH-001: 사슬 끝')).not.toContain('recordDailyHealth');
  });
  it('새 크론을 등록하지 않았다(vercel.json 크론 넷 그대로)', () => {
    const crons = JSON.parse(read('vercel.json')).crons.map((c) => c.path).sort();
    expect(crons).toEqual(CRON_JOBS.map((j) => `/api/cron/${j}`).sort());
  });
  it('PGlite 계약이 CI에 있다', () => {
    expect(read('.github/workflows/ci.yml')).toContain('node supabase/tests/observe-daily-health.mjs');
  });
});
