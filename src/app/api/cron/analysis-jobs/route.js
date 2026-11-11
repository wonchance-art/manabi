// 서버 분석 작업 tick(CANON-SERVER-ANALYSIS-001) — 도는 작업 하나를 잡아 몇 장을 분석하고, 남았으면 다음 tick을 스스로 부른다.
// 부르는 쪽: 관리자 화면(시작 · 끊긴 사슬 다시 깨우기 — /api/admin/analysis-jobs), 직전 tick, 하루 한 번 예약 실행(vercel.json — 안전망).
// 인증은 CRON_SECRET뿐(기존 예약 실행과 같은 시크릿 — 새 환경 변수 없음). 응답은 곧바로 202 — 분석은 응답 뒤(after)에서 돈다.
import { after } from 'next/server';
import { SERVICE_KEY_MISSING_MESSAGE } from '@/lib/server/auth';
import { kickAnalysisTick, runAnalysisTick, serviceClient } from '@/lib/server/analysisJobs';
import { refreshPublicDifficulty } from '@/lib/server/materialDifficultyRefresh';
import { fillPublicEmptyMeanings } from '@/lib/server/materialMeaningFill';
import { recordCronRun, recordDailyHealth } from '@/lib/server/cronRuns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handle(request) {
  // CRON_SECRET 미설정 시 "Bearer undefined" 통과 방지 — 시크릿이 있을 때만 참.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = serviceClient();
  if (!supabase) return Response.json({ error: SERVICE_KEY_MISSING_MESSAGE }, { status: 503 });
  const origin = new URL(request.url).origin;
  after(async () => {
    // OPS-HEALTH-001: tick마다 실행 한 줄(observe.cron_runs). 사슬 끝 tick은 자기 줄을 먼저 남기고 일일 상태 점검을 기록한다.
    const run = { startedAt: Date.now(), ok: true, processed: 0, failed: 0, detail: {}, recorded: false };
    try {
      await analysisTick(supabase, origin, run);
    } finally {
      if (!run.recorded) await recordCronRun('analysis-jobs', run);
    }
  });
  return Response.json({ ok: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}

async function analysisTick(supabase, origin, run) {
  let jobDone = false;
  try {
    const { more, processed, jobId, done } = await runAnalysisTick({ supabase });
    run.processed += Number(processed) || 0;
    run.detail.job = jobId ?? null;
    jobDone = Boolean(done);
    // ANALYSIS-CHAIN-END-001(2026-11-12 KST): 사슬 끝 일은 「다음 tick이 할 일 없음을 보고」 하던 구조라, 마지막 kick이 닿지 않으면
    // (11/12 03:40 KST 실측 — 작업을 끝낸 tick 5가 부른 tick 6이 흔적 없음) 뜻 채움 · 난이도가 그날 통째로 빠졌다(A-2 일본어 25편 난이도 빈칸).
    // 그래서 ① 작업이 방금 끝난 tick은 사슬 끝 일을 여기서 먼저 하고, 맨 끝에 다음 작업을 위해 한 번 부른다.
    // ② 이어 갈 분석이 남았는데 kick이 실패하면 사슬 끝 일을 여기서 한다(남은 장은 다음 예약 실행이 잇는다). kick 결과는 detail에 남긴다.
    if (more && !jobDone) {
      const kicked = await kickAnalysisTick(origin);
      run.detail.kick = kicked;
      if (kicked) return;
      console.warn('[analysis-jobs] next tick kick failed — running chain-end steps in this tick');
    }
  } catch (error) {
    // 임대는 runAnalysisTick이 풀고, 작업은 다음 깨우기(관리자 화면 · 예약 실행)에서 잇는다.
    console.error('[analysis-jobs] tick failed', error?.message);
    run.ok = false;
    run.detail.tickError = String(error?.message || error).slice(0, 200);
  }
  // SEED-QA-002 C: 사슬 끝에서 공개 영어 자료의 빈 뜻 토큰을 공유 사전으로 채운다(한 번에 50편 · LLM 없음 · 실패는 줄에만 남긴다).
  // 난이도 앞에 둔다 — 채운 품사가 같은 tick의 난이도 셈에 들어가게.
  const meaningFill = await fillPublicEmptyMeanings(supabase);
  run.detail.meaningFill = meaningFill;
  if (meaningFill.error) { console.error('[analysis-jobs] meaning fill failed', meaningFill.error); run.ok = false; }
  else if (meaningFill.tokens) console.warn('[analysis-jobs] meaning fill', JSON.stringify(meaningFill));
  // MATERIAL-DIFFICULTY-002: 사슬 끝(또는 할 작업 없는 예약 실행)에서 공개 자료 난이도 요약을 채운다 — 한 tick 50편 상한,
  // 남았고 이번에 하나라도 썼으면 다음 tick을 부른다(진척 없으면 멈춘다 — 다음 예약 실행이 다시 본다). 실패는 분석과 무관하게 삼킨다.
  try {
    const result = await refreshPublicDifficulty(supabase);
    if (result.candidates) console.warn('[analysis-jobs] difficulty', JSON.stringify(result));
    run.detail.difficulty = result;
    run.failed += Number(result.failed) || 0;
    if (result.more && result.written > 0) await kickAnalysisTick(origin);
    if (result.more && result.written > 0) return;
  } catch (error) {
    console.error('[analysis-jobs] difficulty refresh failed', error?.message);
    run.ok = false;
  }
  // OPS-HEALTH-001: 사슬 끝 — 이 tick의 줄을 먼저 남겨야 점검이 「분석 작업 크론 미실행」으로 잘못 세지 않는다.
  await recordCronRun('analysis-jobs', run);
  run.recorded = true;
  const health = await recordDailyHealth();
  if (health && !health.ok) console.warn('[analysis-jobs] health', JSON.stringify(health.anomalies));
  // ① 작업이 방금 끝난 tick — 사슬 끝 일을 마친 뒤, 기다리는 다른 작업이 있으면 그 tick이 잡게 한 번 부른다(없으면 그 tick은 할 일 없이 끝난다).
  if (jobDone) await kickAnalysisTick(origin);
}

export const GET = handle;
export const POST = handle;
