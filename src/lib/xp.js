import { supabase } from './supabase';

export const XP_REWARDS = {
  WORD_SAVED: 5,
  WORD_REVIEWED: 10, // 기본값 (rating 모를 때 fallback)
  MATERIAL_COMPLETED: 50,
  MASTERY_REACHED: 25,   // 단어가 마스터(interval >= 30일)에 도달했을 때 1회성 보너스
  WRITING_HIGH_SCORE: 15, // 쓰기 AI 점수 70+ 달성 시
};

// 복습 평가 등급별 XP (질적 가중)
// - Again(1): 최소 XP — 참여는 했으니 5
// - Hard(2):  8 — 기억 복구에 애씀
// - Good(3):  12 — 가장 높음 (올바른 복습의 핵심)
// - Easy(4):  8 — Good보다 낮게 설정해 Easy 스팸 방지
export const XP_BY_RATING = { 1: 5, 2: 8, 3: 12, 4: 8 };

export function getReviewXP(rating) {
  return XP_BY_RATING[rating] ?? XP_REWARDS.WORD_REVIEWED;
}

// 각 레벨의 누적 XP 임계값
export const XP_LEVELS = [0, 100, 250, 500, 1000, 2000, 3500, 6000, 10000, 15000];

export function getXPLevel(xp = 0) {
  let level = 1;
  for (let i = 0; i < XP_LEVELS.length; i++) {
    if (xp >= XP_LEVELS[i]) level = i + 1;
    else break;
  }
  return Math.min(level, XP_LEVELS.length);
}

/** 현재 레벨 내 진행도 (0~100) */
export function getLevelProgress(xp = 0) {
  const level = getXPLevel(xp);
  const currentFloor = XP_LEVELS[level - 1] ?? 0;
  const nextCeiling = XP_LEVELS[level];
  if (!nextCeiling) return 100; // 최고 레벨
  return Math.round(((xp - currentFloor) / (nextCeiling - currentFloor)) * 100);
}

/** 다음 레벨까지 남은 XP */
export function getXPToNextLevel(xp = 0) {
  const level = getXPLevel(xp);
  const nextCeiling = XP_LEVELS[level];
  if (!nextCeiling) return null;
  return nextCeiling - xp;
}

/** XP 원자적 증가 (Supabase RPC) + 레벨업 감지 시 알림 */
export async function awardXP(userId, amount, prevXP = null) {
  if (!userId || typeof amount !== 'number' || amount <= 0 || amount > 1000) return;
  await supabase.rpc('award_xp', { uid: userId, amount });

  // 레벨업 감지: prevXP를 전달받은 경우에만 확인
  if (prevXP !== null) {
    const prevLevel = getXPLevel(prevXP);
    const newLevel  = getXPLevel(prevXP + amount);
    if (newLevel > prevLevel) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'levelup',
        message: `🎉 레벨 ${newLevel} 달성! 계속 성장하고 있어요.`,
      });
    }
  }
}
