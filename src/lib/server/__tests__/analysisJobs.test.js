import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  CHAPTER_ATTEMPTS, FAILURE_STOP, LEASE_MS, STALL_MS, TICK_START_BUDGET_MS,
  inProcessTransport, jobAfterChapter, kickAnalysisTick, pickChapter, runAnalysisTick, stalledJob,
} from '../analysisJobs';

// 서버 분석 작업(CANON-SERVER-ANALYSIS-001, 오너 「서버 분석 A안 승인, 권장대로 ㄱㄱ」 2026-10-24 KST).
const ROOT = path.resolve(__dirname, '../../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

/** canonical_analysis_jobs만 흉내 내는 아주 작은 표 — runAnalysisTick이 쓰는 질의 모양(eq · or · order · limit · single · update)만. */
function fakeJobs(rows) {
  const table = rows.map((row) => ({ ...row }));
  const writes = [];
  const leaseFree = (row, at) => row.lease_until == null || row.lease_until < at;
  const from = (name) => {
    expect(name).toBe('canonical_analysis_jobs');
    const q = { filters: [], patch: null, limit: Infinity };
    const run = () => {
      let hit = table.filter((row) => q.filters.every((test) => test(row)));
      hit = hit.slice(0, q.limit);
      if (q.patch) { for (const row of hit) Object.assign(row, q.patch); writes.push(q.patch); }
      return hit.map((row) => ({ ...row }));
    };
    const chain = {
      select: () => chain,
      update: (patch) => { q.patch = patch; return chain; },
      eq: (column, value) => { q.filters.push((row) => row[column] === value); return chain; },
      or: (expr) => { const at = expr.match(/lt\.(.+)$/)[1]; q.filters.push((row) => leaseFree(row, at)); return chain; },
      order: () => chain,
      limit: (n) => { q.limit = n; return chain; },
      single: () => Promise.resolve({ data: run()[0], error: null }),
      then: (resolve) => resolve({ data: run(), error: null }),
    };
    return chain;
  };
  return { supabase: { from }, table, writes };
}

const JOB = { id: 7, owner_id: 'admin', kind: 'literature', book_keys: ['aozora-a', 'aozora-b'], status: 'running', current_key: null,
  chapters_done: 0, chapters_failed: 0, attempts: {}, failure_streak: 0, last_error: null, lease_until: null, updated_at: '2026-10-24T00:00:00.000Z' };
const BOOKS = [{ book: { key: 'aozora-a' } }, { book: { key: 'aozora-b' } }];
const clock = (step = 1000) => { let t = Date.parse('2026-10-24T03:00:00Z'); return () => (t += step); };

describe('장 고르기 · 시도 수 · 끊긴 사슬', () => {
  it('분석 전이고 시도 상한 전인 장 중 장 순서가 앞선 것', () => {
    const chapters = [{ id: 3, order: '3', status: 'pending' }, { id: 1, order: '1', status: 'completed' }, { id: 2, order: '2', status: 'failed' }];
    expect(pickChapter(chapters)).toEqual({ id: 2, order: '2', status: 'failed' });
    expect(pickChapter(chapters, { 2: CHAPTER_ATTEMPTS })).toEqual({ id: 3, order: '3', status: 'pending' });
    expect(pickChapter([{ id: 1, order: '1', status: 'completed' }])).toBeNull();
  });
  it('성공은 끝난 장 +1 · 연달아 실패 0, 실패는 그 장 시도 +1 — 세 번째면 건너뛴 장 +1, 연달아 세 장이면 작업 실패', () => {
    expect(jobAfterChapter({ ...JOB, failure_streak: 2 }, 5, { ok: true })).toEqual({ chapters_done: 1, failure_streak: 0 });
    expect(jobAfterChapter(JOB, 5, { ok: false, error: new Error('quota') })).toEqual({ attempts: { 5: 1 }, chapters_failed: 0, failure_streak: 1, last_error: 'quota' });
    expect(jobAfterChapter({ ...JOB, attempts: { 5: 2 } }, 5, { ok: false, error: new Error('x') })).toMatchObject({ attempts: { 5: 3 }, chapters_failed: 1 });
    const stop = jobAfterChapter({ ...JOB, failure_streak: FAILURE_STOP - 1 }, 5, { ok: false, error: new Error('quota') });
    expect(stop).toMatchObject({ status: 'failed', failure_streak: FAILURE_STOP });
    expect(stop.last_error).toBe(`연달아 ${FAILURE_STOP}장을 분석하지 못해 멈췄어요 — quota`);
  });
  it('도는 작업인데 임대가 없거나 지났고 STALL_MS 넘게 조용하면 끊긴 사슬', () => {
    const now = Date.parse('2026-10-24T03:00:00Z');
    const quiet = new Date(now - STALL_MS - 1).toISOString();
    expect(stalledJob({ ...JOB, updated_at: quiet }, now)).toBe(true);
    expect(stalledJob({ ...JOB, updated_at: new Date(now - 1000).toISOString() }, now)).toBe(false);
    expect(stalledJob({ ...JOB, updated_at: quiet, lease_until: new Date(now + 1000).toISOString() }, now)).toBe(false);
    expect(stalledJob({ ...JOB, updated_at: quiet, status: 'paused' }, now)).toBe(false);
  });
});

describe('tick — 임대 · 책 차례 · 예산 · 멈춤 · 실패', () => {
  const chaptersOf = (map) => async (_, owner, key) => { expect(owner).toBe('admin'); return map[key] || []; };
  const prepare = vi.fn(async () => ({ status: 200, body: { ok: true } }));

  it('작업을 임대로 잡고 책 차례대로 장을 분석한다 — 남은 장이 없으면 끝 · 임대를 푼다', async () => {
    const { supabase, table } = fakeJobs([JOB]);
    const done = new Set();
    const map = { 'aozora-a': [{ id: 11, order: '1', status: 'pending' }], 'aozora-b': [{ id: 21, order: '1', status: 'pending' }, { id: 22, order: '2', status: 'pending' }] };
    const listChapters = async (client, owner, key) => (await chaptersOf(map)(client, owner, key)).map((c) => ({ ...c, status: done.has(c.id) ? 'completed' : c.status }));
    const analyze = vi.fn(async (_, job, id) => { expect(job.id).toBe(7); done.add(id); });
    const result = await runAnalysisTick({ supabase, now: clock(), getBooks: () => BOOKS, publishable: () => true, analyze, prepare, listChapters });
    expect(analyze.mock.calls.map((call) => call[2])).toEqual([11, 21, 22]);
    expect(prepare.mock.calls.map((call) => call[2].book.key)).toEqual(['aozora-a', 'aozora-b']); // 책마다 이 tick에서 한 번 「게시」
    expect(result).toEqual({ jobId: 7, processed: 3, more: true });
    expect(table[0]).toMatchObject({ status: 'done', chapters_done: 3, current_key: null, lease_until: null });
  });
  it('다른 tick이 임대 중인 작업은 잡지 않는다(같은 장을 둘이 분석하지 않게)', async () => {
    const { supabase } = fakeJobs([{ ...JOB, lease_until: '2026-10-24T09:00:00.000Z' }]);
    const analyze = vi.fn();
    expect(await runAnalysisTick({ supabase, now: clock(), getBooks: () => BOOKS, publishable: () => true, analyze, prepare, listChapters: chaptersOf({}) })).toEqual({ processed: 0, more: false });
    expect(analyze).not.toHaveBeenCalled();
  });
  it('임대는 tick 수명보다 길다 · 새 장은 시작 뒤 예산 안에서만 잡는다(남으면 다음 tick)', async () => {
    expect(LEASE_MS).toBeGreaterThanOrEqual(300_000);
    const { supabase, table } = fakeJobs([JOB]);
    const map = { 'aozora-a': [1, 2, 3, 4].map((id) => ({ id, order: String(id), status: 'pending' })) };
    const done = new Set();
    const listChapters = async (client, owner, key) => (await chaptersOf(map)(client, owner, key)).map((c) => ({ ...c, status: done.has(c.id) ? 'completed' : c.status }));
    const analyze = vi.fn(async (_, __, id) => { done.add(id); });
    const result = await runAnalysisTick({ supabase, now: clock(TICK_START_BUDGET_MS / 2), getBooks: () => BOOKS, publishable: () => true, analyze, prepare, listChapters });
    expect(result.more).toBe(true);
    expect(analyze.mock.calls.length).toBeLessThan(4);
    expect(table[0]).toMatchObject({ status: 'running', current_key: 'aozora-a', lease_until: null });
  });
  it('멈춤은 장 사이에서 듣는다 — 분석 중이던 장은 끝내 세고, 상태를 되돌리지 않는다', async () => {
    const { supabase, table } = fakeJobs([JOB]);
    const map = { 'aozora-a': [{ id: 1, order: '1', status: 'pending' }, { id: 2, order: '2', status: 'pending' }] };
    const analyze = vi.fn(async () => { table[0].status = 'paused'; });
    await runAnalysisTick({ supabase, now: clock(), getBooks: () => BOOKS, publishable: () => true, analyze, prepare, listChapters: chaptersOf(map) });
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(table[0]).toMatchObject({ status: 'paused', chapters_done: 1 });
  });
  it('연달아 세 장 실패면 작업을 실패로 멈춘다(남은 장을 헛되이 돌리지 않게)', async () => {
    const { supabase, table } = fakeJobs([JOB]);
    const map = { 'aozora-a': [1, 2, 3, 4, 5].map((id) => ({ id, order: String(id), status: 'pending' })) };
    const analyze = vi.fn(async () => { throw new Error('할당량'); });
    await runAnalysisTick({ supabase, now: clock(1), getBooks: () => BOOKS, publishable: () => true, analyze, prepare, listChapters: chaptersOf(map) });
    expect(analyze).toHaveBeenCalledTimes(FAILURE_STOP);
    expect(table[0]).toMatchObject({ status: 'failed', failure_streak: FAILURE_STOP, chapters_done: 0 });
    expect(table[0].last_error).toContain('할당량');
  });
  it('게시할 수 없는 책은 이유를 남기고 다음 책으로', async () => {
    const { supabase, table } = fakeJobs([JOB]);
    const map = { 'aozora-b': [{ id: 21, order: '1', status: 'pending' }] };
    const blocked = vi.fn(async (_, __, book) => (book.book.key === 'aozora-a' ? { status: 409, body: { error: '정본과 다른 장이 있어요.' } } : { status: 200, body: {} }));
    const done = new Set();
    const listChapters = async (client, owner, key) => (await chaptersOf(map)(client, owner, key)).map((c) => ({ ...c, status: done.has(c.id) ? 'completed' : c.status }));
    const analyze = vi.fn(async (_, __, id) => { done.add(id); });
    await runAnalysisTick({ supabase, now: clock(), getBooks: () => BOOKS, publishable: () => true, analyze, prepare: blocked, listChapters });
    expect(analyze.mock.calls.map((call) => call[2])).toEqual([21]);
    expect(table[0].last_error).toBe('aozora-a: 정본과 다른 장이 있어요.');
    expect(table[0].status).toBe('done');
  });
});

describe('같은 프로세스 안 분석 라우트 — 표식 요청만 로그인을 건너뛴다', () => {
  const body = (value) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  it('표식 요청은 로그인 없이 입력 검증까지 간다 · 바깥 요청은 401', async () => {
    const { POST } = await import('@/app/api/analyze/route');
    expect((await inProcessTransport('/api/analyze', body({ lines: [], language: 'Japanese' }))).status).toBe(400);
    expect((await POST(new Request('http://x/api/analyze', body({ lines: [], language: 'Japanese' })))).status).toBe(401);
    const korean = await import('@/app/api/analyze/korean/route');
    expect((await inProcessTransport('/api/analyze/korean', body({}))).status).toBe(400);
    expect((await korean.POST(new Request('http://x/api/analyze/korean', body({})))).status).toBe(401);
    const gemini = await import('@/app/api/gemini/route');
    expect((await gemini.POST(new Request('http://x/api/gemini', body({ contents: [] })))).status).toBe(401);
    expect((await inProcessTransport('/api/gemini', body({ contents: [] })))).not.toHaveProperty('status', 401);
  });
  it('헤더 · 본문으로는 표식을 흉내 낼 수 없다(WeakSet — Next가 만든 요청은 들어가지 않는다)', () => {
    const src = read('src/lib/server/internalAnalysisRequest.js');
    expect(src).toContain('const INTERNAL = new WeakSet();');
    for (const route of ['src/app/api/analyze/route.js', 'src/app/api/analyze/korean/route.js', 'src/app/api/gemini/route.js']) {
      expect(read(route), route).toMatch(/if \(!isInternalAnalysisRequest\(request\)\) \{\s*const denied = await gate\(request\);\s*if \(denied\) return denied;\s*\}/);
    }
  });
  it('모르는 경로는 부르지 않는다', async () => {
    await expect(inProcessTransport('/api/admin/literature', body({}))).rejects.toThrow(/부를 수 없는 경로/);
  });
});

describe('사슬 · 라우트 계약', () => {
  it('다음 tick은 같은 배포의 예약 실행 주소로 CRON_SECRET을 싣는다 — 시크릿이 없으면 잇지 않는다', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    vi.stubEnv('CRON_SECRET', 's3cret');
    expect(await kickAnalysisTick('https://manabi.co.kr', { fetchImpl })).toBe(true);
    expect(String(fetchImpl.mock.calls[0][0])).toBe('https://manabi.co.kr/api/cron/analysis-jobs');
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer s3cret' } });
    vi.stubEnv('CRON_SECRET', '');
    expect(await kickAnalysisTick('https://manabi.co.kr', { fetchImpl })).toBe(false);
    vi.unstubAllEnvs();
  });
  it('tick 라우트는 CRON_SECRET만 받고 곧바로 202 — 분석은 응답 뒤(after), 수명 300초', () => {
    const src = read('src/app/api/cron/analysis-jobs/route.js');
    expect(src).toContain("if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)");
    expect(src).toContain('after(async () => {');
    expect(src).toContain('export const maxDuration = 300;');
    expect(JSON.parse(read('vercel.json')).crons).toContainEqual({ path: '/api/cron/analysis-jobs', schedule: '45 17 * * *' });
  });
  it('관리자 API는 쿠키 세션 관리자만 · 작업 줄은 사용자 세션으로 쓴다(service role 없음)', () => {
    const src = read('src/app/api/admin/analysis-jobs/route.js');
    expect(src).toContain("import { requireAdmin } from '@/lib/supabaseServer';");
    expect(src).not.toMatch(/SERVICE_ROLE|serviceClient/);
  });
  it('서버 저장은 작업 확인 저장 함수로만(뷰어 저장과 같은 인자)', () => {
    const src = read('src/lib/server/analysisJobs.js');
    expect(src).toContain("client.rpc('canonical_analysis_save', {");
    expect(src).toContain('{ fullReset: true, replace: jobSave(job.id) }');
  });
});

describe('관리자 게시 화면 — 서버에서 분석 · 진행 · 멈춤', () => {
  const panel = read('src/components/LiteraturePublishPanel.jsx');
  it('작품 줄 · 일괄 줄에 「서버에서 분석」, 확인 창 뒤 작업 시작(책 key 차례 그대로)', () => {
    expect(panel).toContain("onClick={() => setConfirm({ action: 'server', books: [book] })}>서버에서 분석</Button>");
    expect(panel).toContain("onClick={() => setConfirm({ action: 'server', books: pending })}>{pending.length}{KIND[kind].unit} 모두 서버에서 분석</Button>");
    expect(panel).toContain("else if (action === 'server') serverStart.mutate(targets);");
    expect(panel).toContain("serverPost({ action: 'start', kind, keys: targets.map((book) => book.key) })");
  });
  it('도는 동안 진행을 다시 받고, 브라우저 분석 · 게시 단추는 잠근다(검수 · 공개는 그대로)', () => {
    expect(panel).toContain("refetchInterval: (query) => (query.state.data?.jobs?.[0]?.status === 'running' ? SERVER_POLL_MS : false),");
    expect(panel).toContain('const analysisBusy = !!running || !!batch || prepare.isPending || serverRunning || serverStart.isPending;');
    expect(panel).toContain("<Button size=\"sm\" disabled={release.isPending || !!running || !!batch} onClick={() => setConfirm({ action: 'release', book })}>공개</Button>");
    expect(panel).toContain("serverPost({ action: 'pause', id: job.id })");
  });
});
