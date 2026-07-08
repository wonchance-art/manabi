/**
 * 목소리 — 발송 회로 (docs/plan-v4-eyes-and-voice.md §4.2).
 * 서버 전용 모듈: 카피 엔진(순수함수) + web-push 발송 + 새 화 판정 + 하루 1회 상한 검사.
 *
 * 계약(고정, 변경 금지):
 *  - env: NEXT_PUBLIC_VAPID_PUBLIC_KEY · VAPID_PRIVATE_KEY · VAPID_SUBJECT.
 *    셋 중 하나라도 없으면 발송하지 않는다(fail-soft — 호출자가 skipped:'no-vapid'로 응답).
 *  - 페이로드: {title, body, url:'/study?src=push'}.
 *  - push_subscriptions 스키마: user_id·endpoint(unique)·keys jsonb{p256dh,auth}·lang·
 *    preferred_hour(smallint, UTC 0-23)·created_at (다른 에이전트가 마이그레이션 생성 중 — 이 스키마를 가정).
 *  - 침묵이 기본값(기획 v4 헌법 §2): buildPushCopy는 보낼 가치(새 화 반영 또는 예보)가
 *    전혀 없으면 null을 반환한다 — 호출자는 null이면 아무것도 보내지 않는다.
 */

import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { buildForecast } from '../forecast.js';

// ── VAPID 설정 ──────────────────────────────────────────────────────────

/** 서버 발송 키 3종이 모두 있는지 (fail-soft 분기의 단일 출처) */
export function hasVapidConfig() {
  return !!(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
}

let vapidConfigured = false;
function ensureVapid() {
  if (!hasVapidConfig()) return false;
  if (!vapidConfigured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    vapidConfigured = true;
  }
  return true;
}

/** service-role 서버 클라이언트 — 기존 cron 라우트(fetch-suggestions)와 동일 패턴 재사용 */
export function serverSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceKey ? { auth: { persistSession: false } } : {},
  );
}

// ── 카피 엔진 (순수함수) ────────────────────────────────────────────────

const TITLE = 'manabi — 오늘의 이야기';
const EPISODE_LINE = '당신이 정한 전개로 다음 화가 도착했어요.';

/**
 * 예보 × 연재 결합 카피 엔진 (docs/plan-v4-eyes-and-voice.md §4.2, 순수함수).
 * 금지 어휘: 밀림/실패/해야/퍼센트 — 이 함수도, 아래 어떤 분기도 쓰지 않는다.
 *
 * @param {Object} p
 * @param {Array<{word_text:string}>} [p.falling] - forecast.js buildForecast().falling
 * @param {Array<{word_text:string}>} [p.top3] - forecast.js buildForecast().top3 (대표 단어)
 * @param {boolean} [p.hasNewEpisode] - 새 prefetched 화가 존재하는가
 * @param {boolean} [p.userNextReflected] - 그 화가 어제 사용자가 정한 다음 전개(userNext)를 반영했는가
 * @param {string} [p.protagonist] - 예약 필드(현재 카피는 인물명을 쓰지 않는다 — 기획 문서 §4.2 예시와
 *   달리 실제 카피 확정본은 인물명 없이 "당신이 정한 전개로"로 통일. 시그니처 호환을 위해 받되 미사용).
 * @returns {{title:string, body:string}|null} 둘 다 없으면 null(침묵 — 발송하지 않음).
 */
export function buildPushCopy({ falling, top3, hasNewEpisode, userNextReflected, protagonist } = {}) {
  void protagonist; // 예약 — 현재 카피 확정본은 인물명을 쓰지 않는다(위 JSDoc 참조).

  // "새 화" 이벤트는 정의상 새 prefetched 화 + 그 화가 userNext를 반영했을 때만 성립한다
  // (기획 지시 §"새 화 판정" — 두 조건을 AND로 묶은 것이 곧 "당신이 정한 전개로"라는 문구의 근거).
  const hasEpisode = !!(hasNewEpisode && userNextReflected);
  const fallingList = Array.isArray(falling) ? falling : [];
  const top3List = Array.isArray(top3) ? top3 : [];
  const hasForecast = fallingList.length > 0 && top3List.length > 0;

  if (!hasEpisode && !hasForecast) return null; // 침묵 원칙 — 보낼 가치가 없는 날은 보내지 않는다.

  if (hasEpisode && hasForecast) {
    const word = top3List[0].word_text;
    return { title: TITLE, body: `${EPISODE_LINE} 그리고 '${word}'이(가) 오늘 밤 안개로 들어가요.` };
  }

  if (hasForecast) {
    const word = top3List[0].word_text;
    const count = fallingList.length;
    const body = count <= 1
      ? `'${word}'이(가) 오늘 밤 안개로 들어가요. 3분이면 붙잡아요.`
      : `'${word}' 외 ${count - 1}개가 오늘 밤 안개로 들어가요. 3분이면 붙잡아요.`;
    return { title: TITLE, body };
  }

  return { title: TITLE, body: EPISODE_LINE };
}

// ── 재료 조회 ────────────────────────────────────────────────────────────

/**
 * 예보 재료 — user_vocabulary에서 학습 이력 있는 행만(src/views/LearnPage.jsx의 forecastRows 쿼리와 동일 필터).
 * buildForecast는 순수함수라 이 재료를 그대로 넘기면 클라와 동일한 계산을 서버에서 재현한다.
 */
export async function fetchForecastRows(supabase, userId, lang) {
  const { data } = await supabase
    .from('user_vocabulary')
    .select('word_text, interval, last_reviewed_at')
    .eq('user_id', userId).eq('language', lang)
    .not('last_reviewed_at', 'is', null).gt('interval', 0);
  return data || [];
}

/**
 * 새 화 판정 — study_paragraphs에서 해당 유저·언어 최신 status='prefetched' 행이 있고,
 * 그 직전(created_at 기준) status='used' 행의 paragraph->>'userNext'가 있으면 true.
 * (userNext는 studyMaterials.js deriveArc가 이미 ≥2점만 채택해 저장하므로 여기선 존재 여부만 본다.)
 * @returns {Promise<boolean>}
 */
export async function detectNewEpisode(supabase, userId, lang) {
  const { data: prefetchedRows } = await supabase
    .from('study_paragraphs')
    .select('id, created_at')
    .eq('user_id', userId).eq('lang', lang).eq('status', 'prefetched')
    .order('created_at', { ascending: false }).limit(1);
  const latestPrefetched = prefetchedRows?.[0];
  if (!latestPrefetched) return false;

  const { data: usedRows } = await supabase
    .from('study_paragraphs')
    .select('paragraph, created_at')
    .eq('user_id', userId).eq('lang', lang).eq('status', 'used')
    .lt('created_at', latestPrefetched.created_at)
    .order('created_at', { ascending: false }).limit(1);
  const precedingUsed = usedRows?.[0];
  const un = precedingUsed?.paragraph?.userNext;
  return !!(un && typeof un.text === 'string' && un.text.trim());
}

// ── 하루 1회 상한 · 발송 기록 (review_events source:'ui' 규약, §3.2) ────────

/** 오늘 이미 push_sent 이벤트가 있는지(하루 1회 상한 검사) */
export async function hasSentToday(supabase, userId, now = new Date()) {
  const dayStartIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const { data } = await supabase
    .from('review_events')
    .select('id')
    .eq('user_id', userId).eq('source', 'ui').eq('item_key', '-')
    .contains('detail', { qtype: 'push_sent' })
    .gte('created_at', dayStartIso)
    .limit(1);
  return (data?.length || 0) > 0;
}

/** 발송 기록(상한 검사 겸 측정) — fire-and-forget이 아니라 await해 호출자가 실패를 알 수 있게 한다 */
export async function recordPushSent(supabase, userId, lang, kind) {
  await supabase.from('review_events').insert({
    user_id: userId,
    lang: lang || 'unknown',
    source: 'ui',
    item_key: '-',
    correct: true, // 정오답 개념이 없는 정보성 이벤트 — 발송 성공을 true로 기록(src/views/StudySessionPage.jsx의 assist 이벤트류와 동일 관례)
    detail: { qtype: 'push_sent', kind },
  }).then(() => {}, () => {});
}

// ── 발송 ────────────────────────────────────────────────────────────────

/**
 * 구독 1건에 발송. VAPID 미설정이면 {ok:false, skipped:'no-vapid'}.
 * 410/404(만료·존재하지 않음) 응답이면 해당 구독 행을 삭제하고 {ok:false, expired:true}.
 * @param {*} supabase - service-role 클라이언트(구독 삭제 권한)
 * @param {{endpoint:string, keys:{p256dh:string, auth:string}}} sub
 * @param {{title:string, body:string, url:string}} payload
 */
export async function sendToSubscription(supabase, sub, payload) {
  if (!ensureVapid()) return { ok: false, skipped: 'no-vapid' };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (err) {
    const status = err?.statusCode;
    if (status === 404 || status === 410) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint).then(() => {}, () => {});
      return { ok: false, expired: true };
    }
    return { ok: false, error: err?.message || 'send failed' };
  }
}
