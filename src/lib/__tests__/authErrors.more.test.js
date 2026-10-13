import { describe, expect, it, vi } from 'vitest';
import { toKoreanError, AUTH_FALLBACK_MESSAGE } from '../authErrors';

describe('toKoreanError additional contracts', () => {
  it.each([
    ['INVALID LOGIN CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.'],
    ['invalid_credentials', '이메일 또는 비밀번호가 올바르지 않습니다.'],
    ['Email not confirmed', '이메일 인증이 필요합니다. 받은 편지함을 확인해주세요.'],
    ['User already registered', 'ALREADY_REGISTERED'],
    ['has already been registered', 'ALREADY_REGISTERED'],
    ['already registered', 'ALREADY_REGISTERED'],
    ['email already used', 'ALREADY_REGISTERED'],
    ['duplicate account', 'ALREADY_REGISTERED'],
    ['Password should be at least 6 characters', '비밀번호는 최소 6자 이상이어야 합니다.'],
    ['rate limit exceeded', '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.'],
    ['too many requests', '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.'],
    ['invalid email address', '유효하지 않은 이메일 형식입니다.'],
    ['network unavailable', '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.'],
    ['fetch aborted', '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.'],
    ['Failed to fetch', '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.'],
    ['signup is disabled', '현재 회원가입이 비활성화되어 있습니다.'],
    ['token has expired', '링크가 만료되었습니다. 다시 요청해주세요.'],
    ['token expired', '링크가 만료되었습니다. 다시 요청해주세요.'],
    ['user not found', '등록된 사용자를 찾을 수 없습니다.'],
    // WALL-STATES-001: 번역하지 못한 영어 원문·빈 값은 원문 대신 로그인 화면의 기존 폴백 문구.
    ['unmapped detail', AUTH_FALLBACK_MESSAGE],
    ['', AUTH_FALLBACK_MESSAGE],
    ['이미 처리 중인 요청이에요.', '이미 처리 중인 요청이에요.'],
  ])('%j maps deterministically', (input, expected) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(toKoreanError(input)).toBe(expected);
    warn.mockRestore();
  });
});
