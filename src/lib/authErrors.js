/**
 * Supabase 영어 에러 메시지 → 한국어 변환
 */
import { isUserFacingMessage } from './errorMessage';

// 화면이 문구에 맞춰 보조 안내(Google 로그인 힌트·인증 메일 재발송)를 붙이는 기준값.
export const INVALID_CREDENTIALS_MESSAGE = '이메일 또는 비밀번호가 올바르지 않아요.';
export const EMAIL_NOT_CONFIRMED_MESSAGE = '이메일 인증이 필요해요. 받은 편지함을 확인해 주세요.';
// 번역하지 못한 오류의 고정 문구(WALL-STATES-001) — 화면 문구 표준(docs/design/copy-standard.md)의 실패 형태.
export const AUTH_FALLBACK_MESSAGE = '요청을 처리하지 못했어요. 다시 시도해 주세요.';

/**
 * 이메일 인증을 켠 Supabase는 이미 있는 이메일로 가입해도 오류 대신 성공처럼 응답한다(가입 여부 노출 방지).
 * 그때 user.identities가 빈 배열이다 — 새 가입이면 email identity가 1개 붙는다.
 */
export function isRepeatedSignup(data) {
  const identities = data?.user?.identities;
  return Array.isArray(identities) && identities.length === 0;
}

export function toKoreanError(message = '') {
  if (typeof message !== 'string') message = message == null ? '' : String(message);
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials') || m.includes('invalid_credentials'))
    return INVALID_CREDENTIALS_MESSAGE;
  if (m.includes('email not confirmed'))
    return EMAIL_NOT_CONFIRMED_MESSAGE;
  if (m.includes('user already registered') || m.includes('already been registered') || m.includes('already registered') || m.includes('email already') || m.includes('duplicate'))
    return 'ALREADY_REGISTERED';
  if (m.includes('password should be at least')) {
    // 서버 설정값을 그대로 옮긴다 — 고정 숫자를 쓰면 앱 규칙(8자)이나 대시보드 설정과 어긋난다.
    const min = /at least (\d+)/.exec(m)?.[1];
    return min ? `비밀번호는 최소 ${min}자 이상이어야 해요.` : '비밀번호가 너무 짧아요.';
  }
  if (m.includes('rate limit') || m.includes('too many requests'))
    return '시도 횟수가 너무 많아요. 잠시 후 다시 시도해 주세요.';
  if (m.includes('email address') && m.includes('invalid'))
    return '이메일 형식이 올바르지 않아요.';
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch'))
    return '인터넷 연결을 확인해 주세요. 연결되면 다시 시도해 주세요.';
  if (m.includes('signup is disabled'))
    return '지금은 회원가입을 받지 않아요.';
  if (m.includes('token has expired') || m.includes('token expired'))
    return '링크가 만료됐어요. 다시 요청해 주세요.';
  if (m.includes('user not found'))
    return '등록된 사용자를 찾을 수 없어요.';

  // 번역 불가 — 우리 한국어 안내만 그대로, 영어 원문은 화면에 내지 않고 콘솔로만 남긴다.
  if (isUserFacingMessage(message)) return message;
  if (message) console.warn('[toKoreanError] 원문은 화면에 내지 않음:', message);
  return AUTH_FALLBACK_MESSAGE;
}
