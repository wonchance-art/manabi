'use client';
/**
 * 완독 창 「오늘 복습」(STATS-MAP-001 「복습 대기」 A안, 오너 2026-11-01 KST) — 배움 홈 칸 · 복습실과 같은 숫자.
 * 예전엔 모든 언어의 기한 지난 카드 전체를 따로 세서(isVocabularyReviewDue) 홈 「81개 대기」 옆에 「복습 대기 중 120」이 떴다.
 * 입력은 홈과 같다: 같은 snapshot · 서버 한도(useLearningAdmission) · 이 기기 하루 한도(reviewScopeQuota) → learnReviewCount.
 */
import { useMemo } from 'react';
import { useLearningAdmission } from './useLearningAdmission';
import { learnReviewCount, reviewScopeQuota } from './reviewScope';
import { loadIntroIds, loadNewPerDay } from './vocabStudy';

export function useTodayReviewCount({ accountId, learning, lang }) {
  const admission = useLearningAdmission({ accountId });
  const device = useMemo(() => ({ newPerDay: loadNewPerDay(), introIds: loadIntroIds() }), []);
  const quota = reviewScopeQuota(admission, { ...device, vocabIds: learning?.rows?.map(v => v.id) });
  const now = learning ? Math.max(Date.now(), Date.parse(learning.now) || 0) : Date.now();
  return learnReviewCount({ snapshot: learning, lang, quota, now });
}
