import { describe, expect, it, vi } from 'vitest';
import { toKoreanError, AUTH_FALLBACK_MESSAGE } from '../authErrors';

describe('toKoreanError additional contracts', () => {
  it.each([
    ['INVALID LOGIN CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않아요.'],
    ['invalid_credentials', '이메일 또는 비밀번호가 올바르지 않아요.'],
    ['Email not confirmed', '이메일 인증이 필요해요. 받은 편지함을 확인해 주세요.'],
    ['User already registered', 'ALREADY_REGISTERED'],
    ['has already been registered', 'ALREADY_REGISTERED'],
    ['already registered', 'ALREADY_REGISTERED'],
    ['email already used', 'ALREADY_REGISTERED'],
    ['duplicate account', 'ALREADY_REGISTERED'],
    ['Password should be at least 6 characters', '비밀번호는 최소 6자 이상이어야 해요.'],
    ['rate limit exceeded', '시도 횟수가 너무 많아요. 잠시 후 다시 시도해 주세요.'],
    ['too many requests', '시도 횟수가 너무 많아요. 잠시 후 다시 시도해 주세요.'],
    ['invalid email address', '이메일 형식이 올바르지 않아요.'],
    ['network unavailable', '인터넷 연결을 확인해 주세요. 연결되면 다시 시도해 주세요.'],
    ['fetch aborted', '인터넷 연결을 확인해 주세요. 연결되면 다시 시도해 주세요.'],
    ['Failed to fetch', '인터넷 연결을 확인해 주세요. 연결되면 다시 시도해 주세요.'],
    ['signup is disabled', '지금은 회원가입을 받지 않아요.'],
    ['token has expired', '링크가 만료됐어요. 다시 요청해 주세요.'],
    ['token expired', '링크가 만료됐어요. 다시 요청해 주세요.'],
    ['user not found', '등록된 사용자를 찾을 수 없어요.'],
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
