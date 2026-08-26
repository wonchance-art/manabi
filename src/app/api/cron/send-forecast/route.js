/**
 * 주간 예보 푸시 발송자 = Vercel Cron (docs/plan-v4-eyes-and-voice.md §4.2).
 *
 * **하루 1회 발송**(오너 확정 2026-08-26). 원래 설계는 매시 돌며 preferred_hour(UTC 0-23)가
 * 맞는 구독자만 골라 보내는 것이었지만, Vercel Hobby는 **cron 주기가 하루 1회 이하**로
 * 제한된다 — 매시 스케줄은 배포 단계에서 거부된다. 그래서 시각 매칭을 버리고 하루 한 번
 * 전원을 훑는다. 발송 시각은 11:00 UTC = KST 20시로, push.js의 preferred_hour 기본값
 * (사용자 로컬 20시)과 같은 시각이다.
 *
 * preferred_hour 컬럼은 지우지 않는다 — Pro로 올리면 매시 + 시각 매칭으로 되돌리는 것이
 * vercel.json 한 줄과 아래 필터 한 줄이다(cronRegistration.test.js가 둘을 함께 묶어 둔다).
 *
 * 중복 방지는 이제 hasSentToday 하나가 전담한다(하루 1회 상한) — Hobby의 "정시 보장 없음
 * (해당 시간 내 아무 때나)"이나 재시도로 두 번 돌아도 두 번 보내지 않는다.
 *
 * 인증: 기존 cron 패턴(fetch-suggestions)과 동일 — CRON_SECRET fail-closed Bearer.
 *
 * 흐름: 구독 전체 조회 → 유저별로 묶어 → 오늘 이미 발송했으면 스킵 → 예보(forecast.js) +
 *       새 화 판정 → buildPushCopy → null이면 스킵(침묵 원칙) → 유저의 모든 구독 행에
 *       발송 → 성공하면 review_events에 push_sent 1건 기록.
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

  // 하루 1회 크론이라 시각 매칭을 하지 않는다 — .eq('preferred_hour', ...)를 걸면 그 시각을
  // 가진 소수만 받고 나머지는 조용히 빠진다. 중복은 아래 hasSentToday가 막는다.
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*');

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
