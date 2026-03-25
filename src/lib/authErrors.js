/**
 * Supabase 영어 에러 메시지 → 한국어 변환
 */
export function toKoreanError(message = '') {
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials') || m.includes('invalid_credentials'))
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (m.includes('email not confirmed'))
    return '이메일 인증이 필요합니다. 받은 편지함을 확인해주세요.';
  if (m.includes('user already registered') || m.includes('already been registered'))
    return '이미 가입된 이메일 주소입니다.';
  if (m.includes('password should be at least'))
    return '비밀번호는 최소 6자 이상이어야 합니다.';
  if (m.includes('rate limit') || m.includes('too many requests'))
    return '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.';
  if (m.includes('email address') && m.includes('invalid'))
    return '유효하지 않은 이메일 형식입니다.';
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch'))
    return '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
  if (m.includes('signup is disabled'))
    return '현재 회원가입이 비활성화되어 있습니다.';
  if (m.includes('token has expired') || m.includes('token expired'))
    return '링크가 만료되었습니다. 다시 요청해주세요.';
  if (m.includes('user not found'))
    return '등록된 사용자를 찾을 수 없습니다.';

  // 원문 반환 (번역 불가 시)
  return message;
}
