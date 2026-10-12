import { authReturnPath } from './authRedirect';

// 메일 링크(token_hash) 확인에 받는 종류 — Supabase verifyOtp의 이메일 OTP 종류와 같다.
export const EMAIL_OTP_TYPES = new Set(['signup', 'email', 'recovery', 'magiclink', 'invite', 'email_change']);

// 확인 뒤 갈 곳 — 재설정은 새 비밀번호 화면, 나머지는 /auth/callback 기본값과 같은 서재.
export function confirmDestination(type, next) {
  return authReturnPath(next, type === 'recovery' ? '/auth?mode=reset' : '/materials');
}
