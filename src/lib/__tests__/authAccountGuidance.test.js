import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sliceBetween } from './helpers/sliceBetween.js';
import { EMAIL_NOT_CONFIRMED_MESSAGE, INVALID_CREDENTIALS_MESSAGE, isRepeatedSignup, toKoreanError } from '../authErrors';

// AUTH-GUIDE-001(2026-10-11): 오너가 Google로 가입한 Gmail로 이메일 가입을 시도했다 —
// Supabase 로그는 user_repeated_signup, 화면은 「인증 이메일을 발송했습니다」, 메일은 오지 않았다.
describe('이미 가입된 이메일 판정', () => {
  it('이메일 인증을 켠 Supabase의 반복 가입 응답(identities=[])을 알아본다', () => {
    expect(isRepeatedSignup({ user: { id: 'u', identities: [] }, session: null })).toBe(true);
  });

  it('새 가입·형식 밖 응답은 반복 가입이 아니다', () => {
    expect(isRepeatedSignup({ user: { id: 'u', identities: [{ provider: 'email' }] }, session: null })).toBe(false);
    expect(isRepeatedSignup({ user: { id: 'u' }, session: null })).toBe(false);
    expect(isRepeatedSignup({ user: null, session: null })).toBe(false);
    expect(isRepeatedSignup(undefined)).toBe(false);
  });

  it('signUp이 반복 가입을 ALREADY_REGISTERED 경로로 돌린다 — 성공 처리(로그인 수용) 전에', () => {
    const src = readFileSync('src/lib/AuthContext.jsx', 'utf8');
    const body = sliceBetween(src, 'async function signUp', 'async function resendConfirmation');
    expect(body).toMatch(/if \(isRepeatedSignup\(data\)\) throw new Error\('User already registered'\);/);
    expect(body.indexOf('isRepeatedSignup')).toBeLessThan(body.indexOf('acceptExplicitLogin'));
    expect(toKoreanError('User already registered')).toBe('ALREADY_REGISTERED');
  });
});

describe('안내 기준 문구', () => {
  it('화면이 보조 안내를 붙이는 기준값과 번역 결과가 같다', () => {
    expect(toKoreanError('Invalid login credentials')).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(toKoreanError('Email not confirmed')).toBe(EMAIL_NOT_CONFIRMED_MESSAGE);
  });

  it('비밀번호 최소 길이는 서버가 알려 준 숫자를 옮긴다', () => {
    expect(toKoreanError('Password should be at least 8 characters.')).toBe('비밀번호는 최소 8자 이상이어야 해요.');
    expect(toKoreanError('Password should be at least 6 characters')).toBe('비밀번호는 최소 6자 이상이어야 해요.');
    expect(toKoreanError('Password should be at least')).toBe('비밀번호가 너무 짧아요.');
  });

  it('쓰이지 않던 email_confirm_failed 안내는 남기지 않는다', () => {
    expect(readFileSync('src/views/AuthPage.jsx', 'utf8')).not.toContain('email_confirm_failed');
  });
});
