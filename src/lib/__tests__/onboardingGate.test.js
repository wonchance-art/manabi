import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isAuthRoute, shouldShowOnboarding } from '../onboardingGate';

// AUTH-GUIDE-001 M09 실검수 FAIL(2026-10-11): 온보딩 전 계정의 비밀번호 재설정 화면을 온보딩 오버레이가 덮었다.
describe('온보딩 모달 노출 조건', () => {
  it('인증 화면(/auth, /auth/*)에서는 띄우지 않는다', () => {
    expect(isAuthRoute('/auth')).toBe(true);
    expect(isAuthRoute('/auth/confirm')).toBe(true);
    expect(shouldShowOnboarding({ onboarded: false }, '/auth')).toBe(false);
  });

  it('그 밖의 화면에서는 온보딩 전 계정에만 띄운다', () => {
    expect(shouldShowOnboarding({ onboarded: false }, '/home')).toBe(true);
    expect(shouldShowOnboarding({ onboarded: false }, '/authors')).toBe(true);
    expect(isAuthRoute('/authors')).toBe(false);
    expect(shouldShowOnboarding({ onboarded: true }, '/home')).toBe(false);
    expect(shouldShowOnboarding({}, '/home')).toBe(false);
    expect(shouldShowOnboarding(null, '/home')).toBe(false);
  });

  it('Layout이 이 조건으로만 모달을 띄운다', () => {
    const src = readFileSync('src/components/Layout.jsx', 'utf8');
    expect(src).toContain('{shouldShowOnboarding(profile, pathname) && <OnboardingModal />}');
    expect(src).not.toContain('profile.onboarded === false && <OnboardingModal');
  });
});
