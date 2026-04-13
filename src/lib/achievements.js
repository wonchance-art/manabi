import { supabase } from './supabase';
import { getXPLevel } from './xp';

export const ACHIEVEMENTS = [
  // 어휘 수집
  { id: 'first_word',   icon: '🌱', name: '첫 씨앗',      desc: '첫 번째 단어를 저장했어요',       category: '어휘' },
  { id: 'vocab_10',     icon: '📚', name: '단어 10개',     desc: '단어 10개를 수집했어요',          category: '어휘' },
  { id: 'vocab_100',    icon: '📖', name: '단어 100개',    desc: '단어 100개를 수집했어요',         category: '어휘' },
  { id: 'vocab_500',    icon: '🗝️', name: '단어 500개',    desc: '단어 500개를 수집했어요',         category: '어휘' },
  { id: 'vocab_1000',   icon: '💎', name: '단어 1000개',   desc: '단어 1000개를 수집했어요',        category: '어휘' },
  { id: 'master_10',    icon: '🧠', name: '마스터 10개',   desc: '10개 단어를 완전히 마스터했어요', category: '어휘' },
  // 복습
  { id: 'first_review', icon: '🔄', name: '첫 복습',       desc: '처음으로 단어를 복습했어요',      category: '복습' },
  // 읽기
  { id: 'first_read',   icon: '📰', name: '첫 완독',       desc: '자료를 처음 완독했어요',          category: '읽기' },
  { id: 'read_10',      icon: '🏛️', name: '다독가',        desc: '자료 10편을 완독했어요',          category: '읽기' },
  { id: 'read_50',      icon: '🦉', name: '독서광',         desc: '자료 50편을 완독했어요',          category: '읽기' },
  // 스트릭
  { id: 'streak_7',     icon: '🔥', name: '7일 연속',       desc: '7일 연속 학습을 달성했어요',      category: '스트릭' },
  { id: 'streak_30',    icon: '⚡', name: '30일 연속',      desc: '30일 연속 학습을 달성했어요',     category: '스트릭' },
  { id: 'streak_100',   icon: '👑', name: '100일 연속',     desc: '100일 연속 학습을 달성했어요',    category: '스트릭' },
  // XP & 레벨
  { id: 'xp_100',       icon: '✨', name: 'XP 100',         desc: 'XP 100을 달성했어요',             category: 'XP' },
  { id: 'xp_1000',      icon: '💫', name: 'XP 1,000',       desc: 'XP 1,000을 달성했어요',           category: 'XP' },
  { id: 'xp_5000',      icon: '🌟', name: 'XP 5,000',       desc: 'XP 5,000을 달성했어요',           category: 'XP' },
  { id: 'level_5',      icon: '🎖️', name: '레벨 5',         desc: '레벨 5에 도달했어요',             category: 'XP' },
  { id: 'level_10',     icon: '🏆', name: '레벨 10',        desc: '최고 레벨에 도달했어요!',         category: 'XP' },
  // 특별
  { id: 'polyglot',     icon: '🌍', name: '폴리글랏',       desc: '일본어와 영어 단어를 모두 수집했어요', category: '특별' },
  { id: 'first_post',   icon: '💬', name: '첫 글',          desc: '커뮤니티에 첫 글을 올렸어요',    category: '특별' },
];

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

/** 순수 함수: 통계 기반으로 각 업적 달성 여부 맵 반환 */
export function buildConditions({ vocabCount = 0, masteredCount = 0, reviewedCount = 0, readCount = 0, xp = 0, streak = 0, firstPost = false, vocabSample = [] }) {
  const level = getXPLevel(xp);

  const hasJP = vocabSample.some(v =>
    v.language === 'Japanese' || /[\u3040-\u30ff\u4e00-\u9fff]/.test(v.word_text)
  );
  const hasEN = vocabSample.some(v =>
    v.language === 'English' ||
    (!v.language && !/[\u3040-\u30ff\u4e00-\u9fff]/.test(v.word_text) && /[a-zA-Z]/.test(v.word_text))
  );

  return {
    first_word:   vocabCount >= 1,
    vocab_10:     vocabCount >= 10,
    vocab_100:    vocabCount >= 100,
    vocab_500:    vocabCount >= 500,
    vocab_1000:   vocabCount >= 1000,
    master_10:    masteredCount >= 10,
    first_review: reviewedCount >= 1,
    first_read:   readCount >= 1,
    read_10:      readCount >= 10,
    read_50:      readCount >= 50,
    streak_7:     streak >= 7,
    streak_30:    streak >= 30,
    streak_100:   streak >= 100,
    xp_100:       xp >= 100,
    xp_1000:      xp >= 1000,
    xp_5000:      xp >= 5000,
    level_5:      level >= 5,
    level_10:     level >= 10,
    polyglot:     hasJP && hasEN,
    first_post:   firstPost,
  };
}

/**
 * 현재 통계를 기반으로 새로 달성한 뱃지를 확인하고 DB에 저장.
 * @returns {Array} 새로 획득한 achievement 객체 배열
 */
export async function checkAndAwardAchievements(userId, { xp = 0, streak = 0, firstPost = false } = {}) {
  if (!userId) return [];

  const { data: existing } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId);

  const earned = new Set((existing || []).map(e => e.achievement_id));
  const toCheck = ACHIEVEMENTS.filter(a => !earned.has(a.id));
  if (toCheck.length === 0) return [];

  const [
    { count: vocabCount },
    { count: masteredCount },
    { count: reviewedCount },
    { count: readCount },
    { data: vocabSample },
  ] = await Promise.all([
    supabase.from('user_vocabulary').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_vocabulary').select('*', { count: 'exact', head: true }).eq('user_id', userId).gt('interval', 14),
    supabase.from('user_vocabulary').select('*', { count: 'exact', head: true }).eq('user_id', userId).not('last_reviewed_at', 'is', null),
    supabase.from('reading_progress').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_completed', true),
    supabase.from('user_vocabulary').select('language, word_text').eq('user_id', userId).limit(500),
  ]);

  const CONDITIONS = buildConditions({
    vocabCount: vocabCount || 0,
    masteredCount: masteredCount || 0,
    reviewedCount: reviewedCount || 0,
    readCount: readCount || 0,
    xp, streak, firstPost,
    vocabSample: vocabSample || [],
  });

  const newOnes = toCheck.filter(a => CONDITIONS[a.id]);

  if (newOnes.length > 0) {
    await supabase.from('user_achievements').insert(
      newOnes.map(a => ({ user_id: userId, achievement_id: a.id }))
    );
    // 업적 알림 발송
    await supabase.from('notifications').insert(
      newOnes.map(a => ({
        user_id: userId,
        type: 'achievement',
        message: `${a.icon} 업적 달성: ${a.name} — ${a.desc}`,
      }))
    );
  }

  return newOnes;
}

/** MyPage용: 유저의 획득 뱃지 목록 조회 */
export async function fetchUserAchievements(userId) {
  const { data } = await supabase
    .from('user_achievements')
    .select('achievement_id, earned_at')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });
  return data || [];
}
