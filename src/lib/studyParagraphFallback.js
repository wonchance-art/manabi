// /study 오늘의 문단 생성 실패 → 기본 세션 문항으로 이어 갈 때 남기는 신호(STUDY-PARA-OBSERVE-001, 2026-11-08 KST).
// 화면은 그대로다(폴백 동작은 StudySessionPage applyFallback이 정한다) — 여기서는 「왜 폴백했는지」 사유 코드 하나만 운영 기록
// (observe.error_events, kind 'study.paragraph_fallback')으로 보낸다. 실어 보내는 칸: 종류 · 사유 코드 · 경로(쿼리 없음) · 배포 판뿐.
// 계정 · 토큰 · 재료(단어 · 문법) · 응답 본문은 싣지 않는다. 보내기는 reportError.sendErrorEvent(운영 빌드만 · 화면당 8건 · 같은 줄 1번).
import { CLIENT_SIGNALS } from './errorEvent';
import { sendErrorEvent } from './reportError';

export const PARAGRAPH_FALLBACK_KIND = 'study.paragraph_fallback';
const REASON = CLIENT_SIGNALS[PARAGRAPH_FALLBACK_KIND];

/** fetch가 throw했을 때 — 20초 시간 초과(AbortSignal.timeout)인지, 요청 자체가 실패했는지. */
export function fallbackReasonFromError(error) {
  return error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'network';
}

/** 응답을 받았을 때 — 폴백해야 하면 사유 코드, 문단이 있으면 null. */
export function fallbackReasonFromResponse(response, data) {
  if (!response?.ok) {
    const status = Number(response?.status);
    return Number.isInteger(status) && status >= 100 && status <= 599 ? `status_${status}` : 'network';
  }
  return data?.paragraph ? null : 'no_paragraph';
}

/** 사유 코드 하나를 보낸다. 정해진 코드가 아니면 보내지 않는다. 무엇이 잘못돼도 throw하지 않는다. */
export function reportParagraphFallback(reason, options) {
  if (typeof reason !== 'string' || !REASON.test(reason)) return false;
  return sendErrorEvent(reason, { kind: PARAGRAPH_FALLBACK_KIND }, options);
}
