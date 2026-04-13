import { describe, it, expect, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));

import { getXPLevel, getLevelProgress, getXPToNextLevel, XP_LEVELS, XP_REWARDS, XP_BY_RATING, getReviewXP } from '../xp';

describe('getXPLevel', () => {
  it('0 XP → 레벨 1', () => {
    expect(getXPLevel(0)).toBe(1);
  });

  it('undefined → 레벨 1 (기본값)', () => {
    expect(getXPLevel()).toBe(1);
  });

  it('경계값: 정확히 임계값에 도달하면 다음 레벨', () => {
    expect(getXPLevel(100)).toBe(2);
    expect(getXPLevel(250)).toBe(3);
    expect(getXPLevel(500)).toBe(4);
    expect(getXPLevel(1000)).toBe(5);
    expect(getXPLevel(2000)).toBe(6);
  });

  it('임계값 직전은 이전 레벨', () => {
    expect(getXPLevel(99)).toBe(1);
    expect(getXPLevel(249)).toBe(2);
    expect(getXPLevel(999)).toBe(4);
  });

  it('최고 레벨(10) 초과 XP도 최고 레벨 유지', () => {
    expect(getXPLevel(15000)).toBe(10);
    expect(getXPLevel(99999)).toBe(10);
  });

  it('모든 XP_LEVELS 임계값에서 올바른 레벨 반환', () => {
    XP_LEVELS.forEach((threshold, i) => {
      expect(getXPLevel(threshold)).toBe(i + 1);
    });
  });
});

describe('getLevelProgress', () => {
  it('레벨 시작점 → 0%', () => {
    expect(getLevelProgress(0)).toBe(0);
    expect(getLevelProgress(100)).toBe(0);
    expect(getLevelProgress(250)).toBe(0);
  });

  it('레벨 중간 → 50%', () => {
    // 레벨 1: 0~100, 중간 = 50
    expect(getLevelProgress(50)).toBe(50);
  });

  it('최고 레벨 → 100%', () => {
    expect(getLevelProgress(15000)).toBe(100);
    expect(getLevelProgress(99999)).toBe(100);
  });

  it('undefined → 0% (기본값)', () => {
    expect(getLevelProgress()).toBe(0);
  });
});

describe('getXPToNextLevel', () => {
  it('레벨 1 시작 → 100 XP 필요', () => {
    expect(getXPToNextLevel(0)).toBe(100);
  });

  it('레벨 1에서 50 XP → 50 남음', () => {
    expect(getXPToNextLevel(50)).toBe(50);
  });

  it('정확히 임계값 → 다음 레벨까지 전체 필요', () => {
    expect(getXPToNextLevel(100)).toBe(150); // 250 - 100
  });

  it('최고 레벨 → null', () => {
    expect(getXPToNextLevel(15000)).toBeNull();
    expect(getXPToNextLevel(99999)).toBeNull();
  });

  it('undefined → 100 (기본값)', () => {
    expect(getXPToNextLevel()).toBe(100);
  });
});

describe('XP_BY_RATING / getReviewXP', () => {
  it('각 등급별 XP 값', () => {
    expect(XP_BY_RATING[1]).toBe(5);  // Again
    expect(XP_BY_RATING[2]).toBe(8);  // Hard
    expect(XP_BY_RATING[3]).toBe(12); // Good
    expect(XP_BY_RATING[4]).toBe(8);  // Easy
  });

  it('Good이 가장 높아 Easy 스팸 방지', () => {
    expect(XP_BY_RATING[3]).toBeGreaterThan(XP_BY_RATING[4]);
    expect(XP_BY_RATING[3]).toBeGreaterThan(XP_BY_RATING[2]);
    expect(XP_BY_RATING[3]).toBeGreaterThan(XP_BY_RATING[1]);
  });

  it('getReviewXP: 유효 등급 반환', () => {
    expect(getReviewXP(1)).toBe(5);
    expect(getReviewXP(3)).toBe(12);
  });

  it('getReviewXP: 알 수 없는 등급은 WORD_REVIEWED 폴백', () => {
    expect(getReviewXP(0)).toBe(XP_REWARDS.WORD_REVIEWED);
    expect(getReviewXP(99)).toBe(XP_REWARDS.WORD_REVIEWED);
    expect(getReviewXP(undefined)).toBe(XP_REWARDS.WORD_REVIEWED);
  });
});

describe('XP_REWARDS 상수', () => {
  it('Mastery 보너스 존재', () => {
    expect(XP_REWARDS.MASTERY_REACHED).toBeGreaterThan(0);
    expect(XP_REWARDS.MASTERY_REACHED).toBeGreaterThan(XP_BY_RATING[3]);
  });

  it('쓰기 고득점 보상 존재', () => {
    expect(XP_REWARDS.WRITING_HIGH_SCORE).toBeGreaterThan(0);
  });

  it('자료 완독 보상이 가장 큼 (단일 액션)', () => {
    expect(XP_REWARDS.MATERIAL_COMPLETED).toBeGreaterThanOrEqual(XP_REWARDS.MASTERY_REACHED);
    expect(XP_REWARDS.MATERIAL_COMPLETED).toBeGreaterThan(XP_REWARDS.WORD_SAVED);
  });
});
