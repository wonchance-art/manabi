/**
 * 즉시 발송 테스트 — 로그인 유저 본인 구독에만, 하루 1회 상한을 무시하고 즉시 1건 발송한다
 * (docs/plan-v4-eyes-and-voice.md §4.2, V4-3 로드맵). vercel.json에 send-forecast cron이
 * 아직 등록되지 않은 동안(Hobby 플랜 제약) 발송 회로 전체를 수동으로 검증하는 용도.
 *
 * 실제 예보·연재 데이터로 카피를 만들고, 보낼 가치가 없으면(buildPushCopy가 null) 폴백 문구로 대체한다
 * — 침묵 원칙은 자동 발송(cron)의 규칙이고, 이 라우트는 "이렇게 도착한다"를 보여주는 수동 확인이라
 *   침묵시키지 않는다. review_events 기록은 하지 않는다(cron의 하루 1회 상한 계측을 오염시키지 않기 위해).
 */
import { requireUser } from '@/lib/server/auth';
import {
  hasVapidConfig,
  serverSupabase,
  fetchForecastRows,
  detectNewEpisode,
  buildPushCopy,
  sendToSubscription,
} from '@/lib/server/pushSend';
import { buildForecast } from '@/lib/forecast';

const FALLBACK_BODY = '테스트 알림이에요. 이렇게 도착해요.';

export async function POST(request) {
  const auth = await requireUser(request);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  if (!hasVapidConfig()) {
    return Response.json({ skipped: 'no-vapid' }, { status: 503 });
  }

  const supabase = serverSupabase();
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', auth.user.id);

  if (!subs || subs.length === 0) {
    return Response.json({ error: '구독이 없어요.' }, { status: 404 });
  }

  const lang = subs[0]?.lang;
  const [forecastRows, newEpisode] = await Promise.all([
    fetchForecastRows(supabase, auth.user.id, lang),
    detectNewEpisode(supabase, auth.user.id, lang),
  ]);
  const forecast = buildForecast(forecastRows, new Date());
  const copy = buildPushCopy({
    falling: forecast.falling,
    top3: forecast.top3,
    hasNewEpisode: newEpisode,
    userNextReflected: newEpisode,
  }) || { title: 'manabi — 오늘의 이야기', body: FALLBACK_BODY };

  const payload = { title: copy.title, body: copy.body, url: '/study?src=push' };

  let sent = 0;
  for (const sub of subs) {
    const result = await sendToSubscription(supabase, sub, payload);
    if (result.ok) sent++;
  }

  return Response.json({ sent }, { status: 200 });
}
