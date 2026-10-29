// 단어 목록 하루 분량 알림(LEVEL-ROUND-001 ④)이 읽는 복습의 새 카드 자리 — 목록 화면은 처음 담을 때 import()로만 부른다
// (복습 한도 모듈을 첫 그림에 싣지 않는다 — levelListLazy 계약과 같은 이유). 자리 계산은 배움 칸 · 복습방과 같은 reviewScopeQuota 하나.
import { canUseLegacyAdmissionCompatibility } from './learningAdmission';
import { reviewScopeQuota } from './reviewScope';
import { createLearningAdmissionClient } from './useLearningAdmission';
import { loadIntroIds, loadNewPerDay } from './vocabStudy';

const FRESH_MS = 60_000;
let cached = null;

/** 남은 새 카드 자리 — { remaining, ... } 또는 null(읽지 못함). 연달아 담아도 1분에 한 번만 묻는다. */
export function levelNewQuota(accountId, nowMs = Date.now()) {
  if (!accountId) return Promise.resolve(null);
  if (cached?.accountId === accountId && nowMs - cached.at < FRESH_MS) return cached.promise;
  const promise = createLearningAdmissionClient({ accountId }).load()
    .then((quota) => reviewScopeQuota({ quota, compatibility: canUseLegacyAdmissionCompatibility(quota) },
      { newPerDay: loadNewPerDay(), introIds: loadIntroIds() }))
    .catch(() => null);
  cached = { accountId, at: nowMs, promise };
  return promise;
}
