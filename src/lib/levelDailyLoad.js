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

/**
 * 단어 페이지(HSK · JLPT)의 오늘 새 단어 몫(LEVEL-SAVED-TAG-001) — { limit, used, remaining } 또는 null.
 * 첫 문제에서 몫을 쓰는 것은 서버(fsrs_new_receipts)라 서버 입장 한도가 정본이다. 기기가 센 수(newStartedToday — 오늘 생긴 행만)는
 * 전에 담고 오늘 처음 공부한 단어를 빠뜨렸다(운영 2026-10-30 KST 서버 15/15 · 화면 0). remaining은 배움 칸 · 복습방과 같은
 * reviewScopeQuota 값(새 셈을 만들지 않는다). 호환(사전 활성) 모드 · 미설치 · 못 읽음이면 null — 화면은 지금처럼 기기 셈으로.
 * 채점마다 다시 읽어야 해서 위 1분 묶음은 쓰지 않는다(화면 질의 캐시가 맡는다).
 */
export function levelNewSlots(accountId) {
  if (!accountId) return Promise.resolve(null);
  return createLearningAdmissionClient({ accountId }).load().then((quota) => {
    if (canUseLegacyAdmissionCompatibility(quota) || !Number.isInteger(quota?.used) || !Number.isInteger(quota.limit)) return null;
    return { limit: quota.limit, used: quota.used, remaining: reviewScopeQuota({ quota, compatibility: false }).remaining };
  }).catch(() => null);
}
