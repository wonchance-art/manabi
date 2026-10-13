/**
 * 앱을 열어 둔 브라우저의 로컬 복습 알림(내 정보 > 복습 알림 시각) 표시 (WALL-STATES-001 ⑧).
 *
 * - 안드로이드 크롬은 페이지에서 `new Notification()`을 부르면 TypeError를 던진다(서비스 워커의
 *   `registration.showNotification`만 허용). 그래서 서비스 워커 등록이 있으면 그 길을 먼저 쓰고,
 *   없거나 실패할 때만 `new Notification()`으로 내려간다(데스크톱 브라우저·SW 미등록 개발 환경).
 * - `navigator.serviceWorker.ready`는 등록이 없으면 영원히 기다려 폴백까지 막으므로
 *   `getRegistration()`(즉시 끝남)으로 등록 여부를 본다.
 * - 아이콘은 서버 푸시(public/sw.js)와 같은 파일 — public에 실제로 있는 것만 쓴다(예전 `/favicon.ico`는 없음).
 * - 클릭은 sw.js의 notificationclick이 data.url로 연다. 로컬 알림은 단어 복습으로 보낸다
 *   (기본값 `/study?src=push`로 가면 서버 푸시 열람으로 잘못 계측된다).
 *
 * @returns {Promise<boolean>} 알림을 띄웠으면 true
 */
export const REMINDER_ICON = '/icon-192.png';
export const REMINDER_BADGE = '/badge-96.png';
export const REMINDER_URL = '/vocab';

export async function showLocalReminder(title, { body, tag } = {}, env = globalThis) {
  const NotificationApi = env.Notification;
  if (typeof NotificationApi === 'undefined' || NotificationApi.permission !== 'granted') return false;
  const options = { body, tag, icon: REMINDER_ICON, badge: REMINDER_BADGE, data: { url: REMINDER_URL } };
  try {
    const registration = await env.navigator?.serviceWorker?.getRegistration?.();
    if (registration?.showNotification) {
      await registration.showNotification(title, options);
      return true;
    }
  } catch { /* 서비스 워커 경로 실패 → 아래 폴백 */ }
  try {
    new NotificationApi(title, options); // 생성 자체가 표시다
    return true;
  } catch {
    return false;
  }
}
