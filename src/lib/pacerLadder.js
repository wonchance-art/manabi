'use client';

/**
 * 점진 상승 사다리 + 이해도 가드 — 순수 로직 (v2-I R1b R3, #1077 설계 §9).
 *
 * 속도만 올라가고 이해가 무너지면 훈련이 아니라 **훑기**다. Nation의 원칙(이해 70%
 * 유지)을 그대로 가져와, 사다리는 이해도가 확인됐을 때만 오르고 미달이면 되돌아간다.
 *
 * 설계가 정한 두 축을 하나로 묶는다:
 *   점진 상승  페이서로 읽고 이해도가 받쳐 주면 회당 +5%
 *   이해도 가드 70% 미만이면 한 칸 되돌림
 *
 * ── 왜 목표 속도를 직접 올리지 않고 '단계'를 따로 두는가
 *
 * 목표의 바탕값(base)은 R2의 자동 제안이 내 실측 속도를 따라 스스로 움직인다. 거기에
 * 직접 5%를 더해 저장하면 두 상승이 섞여 무엇이 실력이고 무엇이 훈련 강도인지 알 수
 * 없게 된다. 그래서 사다리는 **배수(1.05^step)** 로만 남기고 바탕값과 분리한다 —
 * 실력이 오르면 바탕이 오르고, 훈련을 밀면 단계가 오른다.
 *
 * ── 증거가 없을 때는 오르지 않는다
 *
 * 이해도 확인 없이 매 회 5%씩 올리면 가드가 있으나 마나다(재보지 않으면 영영 미달을
 * 모른다). 증거가 없으면 **제자리**가 이 설계의 기본값이다.
 */
import { PACE_STEP_UNIT, clampCpm } from './readingPacer';

/** 한 칸의 크기 — 회당 +5%(설계 §9). */
export const LADDER_STEP = 0.05;
/** 사다리 상한. 무한히 오르면 어떤 이해도 검사도 못 따라잡는 속도가 된다. */
export const LADDER_MAX_STEPS = 10;
/** Nation의 이해 유지선 — 이 아래로 떨어지면 훈련이 아니라 훑기다. */
export const COMPREHENSION_FLOOR = 0.7;

/** 채점 결과 → 정답률(0~1). 문항이 없거나 값이 망가졌으면 null(=증거 없음). */
export function comprehensionRatio({ score, total } = {}) {
  if (!Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(score) || score < 0) return null;
  return Math.min(1, score / total);
}

/**
 * 다음 단계와 판정.
 * @param {number} step   현재 단계(0 이상)
 * @param {number|null} ratio  이해도 정답률 — null이면 증거 없음
 * @returns {{step:number, verdict:'up'|'down'|'hold'|'cap'}}
 *   up   올랐다 · down 되돌렸다 · hold 증거가 없어 그대로 · cap 상한이라 그대로
 */
export function nextLadderStep(step, ratio) {
  const cur = Number.isFinite(step) && step > 0 ? Math.min(LADDER_MAX_STEPS, Math.floor(step)) : 0;
  if (ratio == null) return { step: cur, verdict: 'hold' };
  if (ratio < COMPREHENSION_FLOOR) {
    // 바닥에서 더 내릴 곳이 없으면 되돌림이 아니라 제자리다 — "낮췄어요"는 거짓말이 된다.
    return cur === 0 ? { step: 0, verdict: 'hold' } : { step: cur - 1, verdict: 'down' };
  }
  if (cur >= LADDER_MAX_STEPS) return { step: LADDER_MAX_STEPS, verdict: 'cap' };

  return { step: cur + 1, verdict: 'up' };
}

/** 사다리 배수 — 1.05^step. */
export function ladderMultiplier(step) {
  const cur = Number.isFinite(step) && step > 0 ? Math.min(LADDER_MAX_STEPS, Math.floor(step)) : 0;
  return (1 + LADDER_STEP) ** cur;
}

/** "+15%" 같은 표기. 0단계면 null(설정 화면이 그 조각을 생략한다). */
export function ladderLabel(step) {
  const m = ladderMultiplier(step);
  if (m === 1) return null;
  return `+${Math.round((m - 1) * 100)}%`;
}

/**
 * 바탕값에 사다리를 얹은 실제 목표(자/분).
 * 조절 버튼과 같은 눈금에 앉힌다 — 사다리로 오른 값에서 [빠르게 +]를 눌렀을 때
 * 한 칸이 예측 가능해야 한다(R2가 세운 관례를 그대로 잇는다).
 */
export function ladderTargetCpm(baseCpm, step) {
  const base = clampCpm(baseCpm);
  if (base == null) return null;
  const raised = clampCpm(base * ladderMultiplier(step));
  if (raised == null) return null;
  return clampCpm(Math.round(raised / PACE_STEP_UNIT) * PACE_STEP_UNIT);
}
