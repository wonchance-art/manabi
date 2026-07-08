/**
 * 웹 푸시 구독 클라이언트 헬퍼 (기획 v4 §4.1 — docs/plan-v4-eyes-and-voice.md).
 *
 * 원칙:
 *  - env 키(NEXT_PUBLIC_VAPID_PUBLIC_KEY) 부재 시 모든 푸시 UI가 조용히 숨는다 → hasVapidKey().
 *  - 구독/해제 실패는 학습 흐름을 막지 않는다(전부 조용히 삼킨다).
 *  - preferred_hour는 발송 시각(UTC 0-23). 관측 세션 5개 이상이면 세션 시각 중앙값,
 *    아니면 사용자 로컬 20시를 UTC로 환산한 근사값(computePreferredHour).
 *
 * 서버(발송 회로)는 이 모듈을 쓰지 않는다 — 여기서 쓰는 env는 공개키(클라)뿐이다.
 */
import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** env에 VAPID 공개키가 있으면 true — 없으면 모든 푸시 표면이 숨어야 한다. */
export function hasVapidKey() {
  return typeof VAPID_PUBLIC_KEY === 'string' && VAPID_PUBLIC_KEY.length > 0;
}

/** 이 브라우저가 웹 푸시를 지원하는가(서비스워커·PushManager·Notification). */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

/**
 * 관측 세션 시각들로 발송 시각(UTC 0-23)을 정한다 — 순수함수(단위 테스트 대상).
 * @param {Array<string|number|Date>} timestamps 세션 대표 시각들(created_at 등)
 * @param {{ fallbackLocalHour?: number, tzOffsetMinutes?: number }} [opts]
 *   fallbackLocalHour 기본 20(로컬 20시). tzOffsetMinutes 기본 0 (= Date.getTimezoneOffset()).
 * @returns {number} 0-23 UTC 시
 */
export function computePreferredHour(timestamps, { fallbackLocalHour = 20, tzOffsetMinutes = 0 } = {}) {
  const hours = (Array.isArray(timestamps) ? timestamps : [])
    .map((t) => {
      if (t == null || t === '') return null; // new Date(null)이 epoch로 유효 처리되는 함정 회피
      const d = t instanceof Date ? t : new Date(t);
      return Number.isNaN(d.getTime()) ? null : d.getUTCHours();
    })
    .filter((h) => h !== null)
    .sort((a, b) => a - b);

  // 관측 5세션 이상일 때만 중앙값 사용(레드팀 §7: 추정이 빈약하면 기본값).
  if (hours.length >= 5) {
    const mid = Math.floor(hours.length / 2);
    const median =
      hours.length % 2 === 0
        ? Math.round((hours[mid - 1] + hours[mid]) / 2)
        : hours[mid];
    return ((median % 24) + 24) % 24;
  }

  // 폴백: 로컬 fallbackLocalHour시 → UTC. (local + tzOffsetMinutes = UTC)
  const utc = fallbackLocalHour + Math.round(tzOffsetMinutes / 60);
  return ((utc % 24) + 24) % 24;
}

/** VAPID 공개키(base64url)를 pushManager.subscribe가 요구하는 Uint8Array로 변환. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * 현재 구독 상태 조회.
 * @returns {Promise<{supported: boolean, permission: NotificationPermission|'default', subscribed: boolean}>}
 */
export async function getSubscriptionState() {
  const base = { supported: isPushSupported() && hasVapidKey(), permission: 'default', subscribed: false };
  if (!base.supported) return base;
  try {
    base.permission = Notification.permission;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    base.subscribed = !!sub;
  } catch {
    // 조회 실패는 미구독으로 간주
  }
  return base;
}

/** 최근 세션 대표 시각들(UTC ISO)을 가져온다 — 하루 1개(그 날 첫 이벤트)로 축약. */
async function fetchRecentSessionTimes(userId) {
  try {
    const sinceIso = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('review_events')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error || !Array.isArray(data)) return [];
    // 같은 달력일(UTC)의 여러 이벤트는 한 세션 → 날짜당 첫(가장 이른) 시각만 대표로.
    const perDay = new Map();
    for (const row of data) {
      const iso = row.created_at;
      if (!iso) continue;
      const day = iso.slice(0, 10);
      // desc 정렬이므로 나중에 오는 게 더 이른 시각 → 항상 덮어써 그 날 첫 세션 시각 유지
      perDay.set(day, iso);
    }
    return Array.from(perDay.values());
  } catch {
    return [];
  }
}

/**
 * 푸시 구독 — 권한 요청 → PushManager 구독 → push_subscriptions 행 upsert.
 * 실패(권한 거부·미지원·저장 실패)는 전부 조용히 false 반환.
 * @param {string} userId
 * @param {string} [lang] 학습 언어(카피 언어 선택용)
 * @returns {Promise<boolean>} 구독·저장까지 성공하면 true
 */
export async function subscribePush(userId, lang) {
  if (!userId || !isPushSupported() || !hasVapidKey()) return false;
  try {
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;
    } else if (Notification.permission !== 'granted') {
      return false;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON();
    if (!json?.endpoint || !json?.keys) return false;

    const times = await fetchRecentSessionTimes(userId);
    const preferredHour = computePreferredHour(times, {
      fallbackLocalHour: 20,
      tzOffsetMinutes: new Date().getTimezoneOffset(),
    });

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        keys: json.keys,
        lang: lang || null,
        preferred_hour: preferredHour,
      },
      { onConflict: 'endpoint' }
    );
    if (error) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * 푸시 구독 해제 — 브라우저 구독 해제 + push_subscriptions 행 삭제.
 * @returns {Promise<boolean>} 정상 해제되면 true
 */
export async function unsubscribePush() {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    const endpoint = sub?.endpoint;
    if (sub) {
      try { await sub.unsubscribe(); } catch {}
    }
    if (endpoint) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * iOS Safari인데 아직 홈 화면에 설치(PWA)되지 않은 상태인가.
 * true면 프라이밍 버튼 대신 "홈 화면에 추가" 안내 1줄을 노출한다(억지 유도 금지).
 */
export function isIosNeedsInstall() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+ 데스크톱 UA 위장
  if (!isIos) return false;
  const standalone =
    window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  return !standalone;
}
