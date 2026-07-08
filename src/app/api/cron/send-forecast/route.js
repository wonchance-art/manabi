/**
 * 발송자 = Vercel Cron (docs/plan-v4-eyes-and-voice.md §4.2).
 * 매시 실행, preferred_hour(UTC 0-23)가 현재 UTC 시와 같은 구독자만 발송.
 * 인증: 기존 cron 패턴(src/app/api/cron/fetch-suggestions/route.js)과 동일 — CRON_SECRET fail-closed Bearer.
 *
 * 흐름: 이번 시각 구독 조회 → 유저별로 묶어 → 오늘 이미 발송했으면 스킵(하루 1회 상한) →
 *       예보(forecast.js) + 새 화 판정 → buildPushCopy → null이면 스킵(침묵 원칙) →
 *       유저의 모든 구독 행에 발송 → 성공하면 review_events에 push_sent 1건 기록.
 *
 * vercel.json에는 이 라우트를 아직 등록하지 않는다 — Hobby 플랜 cron 2건 제한(docs/deployment-checklist.md 참고).
 * 그 전까지는 /api/push/test로 수동 검증한다.
 */
import {
  hasVapidConfig,
  serverSupabase,
  fetchForecastRows,
  detectNewEpisode,
  hasSentToday,
  recordPushSent,
  buildPushCopy,
  sendToSubscription,
} from '@/lib/server/pushSend';
import { buildForecast } from '@/lib/forecast';

async function handle(request) {
  // CRON_SECRET 미설정 시 "Bearer undefined" 통과 방지 — fail-closed.
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // VAPID 서버 키 부재 — fail-soft: 200으로 "발송 자체를 시도하지 않았다"만 알린다.
  if (!hasVapidConfig()) {
    return Response.json({ skipped: 'no-vapid' }, { status: 200 });
  }

  const supabase = serverSupabase();
  const hourUtc = new Date().getUTCHours();

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('preferred_hour', hourUtc);

  const byUser = new Map();
  for (const sub of subs || []) {
    if (!byUser.has(sub.user_id)) byUser.set(sub.user_id, []);
    byUser.get(sub.user_id).push(sub);
  }

  let checked = 0, sent = 0, silent = 0, cleaned = 0;

  for (const [userId, userSubs] of byUser) {
    checked++;
    const lang = userSubs[0]?.lang;

    // 하루 1회 상한 — 오늘 이미 발송했으면 스킵.
    if (await hasSentToday(supabase, userId)) { silent++; continue; }

    const [forecastRows, newEpisode] = await Promise.all([
      fetchForecastRows(supabase, userId, lang),
      detectNewEpisode(supabase, userId, lang),
    ]);
    const forecast = buildForecast(forecastRows, new Date());
    const copy = buildPushCopy({
      falling: forecast.falling,
      top3: forecast.top3,
      hasNewEpisode: newEpisode,
      userNextReflected: newEpisode,
    });

    // 침묵 원칙 — 보낼 가치(새 화 또는 예보)가 없으면 보내지 않는다.
    if (!copy) { silent++; continue; }

    const payload = { title: copy.title, body: copy.body, url: '/study?src=push' };
    let anySent = false;
    for (const sub of userSubs) {
      const result = await sendToSubscription(supabase, sub, payload);
      if (result.expired) cleaned++;
      if (result.ok) anySent = true;
    }

    if (anySent) {
      sent++;
      const kind = newEpisode && forecast.falling.length > 0
        ? 'episode+forecast'
        : newEpisode ? 'episode' : 'forecast';
      await recordPushSent(supabase, userId, lang, kind);
    } else {
      silent++;
    }
  }

  return Response.json({ checked, sent, silent, cleaned });
}

export async function POST(request) { return handle(request); }
export async function GET(request) { return handle(request); }
