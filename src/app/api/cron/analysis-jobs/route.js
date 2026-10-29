// 서버 분석 작업 tick(CANON-SERVER-ANALYSIS-001) — 도는 작업 하나를 잡아 몇 장을 분석하고, 남았으면 다음 tick을 스스로 부른다.
// 부르는 쪽: 관리자 화면(시작 · 끊긴 사슬 다시 깨우기 — /api/admin/analysis-jobs), 직전 tick, 하루 한 번 예약 실행(vercel.json — 안전망).
// 인증은 CRON_SECRET뿐(기존 예약 실행과 같은 시크릿 — 새 환경 변수 없음). 응답은 곧바로 202 — 분석은 응답 뒤(after)에서 돈다.
import { after } from 'next/server';
import { SERVICE_KEY_MISSING_MESSAGE } from '@/lib/server/auth';
import { kickAnalysisTick, runAnalysisTick, serviceClient } from '@/lib/server/analysisJobs';

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
    try {
      const { more } = await runAnalysisTick({ supabase });
      if (more) await kickAnalysisTick(origin);
    } catch (error) {
      // 임대는 runAnalysisTick이 풀고, 작업은 다음 깨우기(관리자 화면 · 예약 실행)에서 잇는다.
      console.error('[analysis-jobs] tick failed', error?.message);
    }
  });
  return Response.json({ ok: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}

export const GET = handle;
export const POST = handle;
