// /api/study-paragraph가 문단을 못 만든 서버 경로를 운영 기록(observe.error_events)에 사유 코드 한 줄로 남긴다
// (STUDY-PARA-OBSERVE-001, 2026-11-08 KST). 지금까지 이 실패는 console.error로만 사라져 /study 폴백 비율을 셀 수 없었다.
// 싣는 것: kind 'study.paragraph_error' · 사유 코드 · 라우트 · 배포 판. 계정 ID · 재료(단어 · 문법) · 모델 출력 · 오류 원문은 싣지 않는다.
// 응답을 늦추지 않는다 — after()로 응답 뒤에 쓰고, 요청 밖(테스트 등)이면 기다리지 않고 바로 쓴다. 무엇이 실패해도 throw하지 않는다.
import { after } from 'next/server';
import { buildErrorEvent } from '../errorEvent';
import { recordErrorEvent } from './errorEvents';

export const PARAGRAPH_ERROR_KIND = 'study.paragraph_error';
export const PARAGRAPH_ERROR_ROUTE = '/api/study-paragraph';
// no_llm_key = AI 키 없음(500) · unusable_output = 재시도 뒤에도 쓸 수 없는 출력(502 · 프리페치는 200 ok:false) ·
// exception = 생성 · 저장 중 예외(500 · 프리페치는 200 ok:false) · assemble_error = 프리페치 재료 조립 예외.
export const PARAGRAPH_ERROR_REASON = /^(?:no_llm_key|(?:unusable_output|exception):(?:live|prefetch)|assemble_error:prefetch)$/;

/** 사유 코드 하나를 기록한다(정해진 코드만). 기록 약속(Promise)을 돌려준다 — 부르는 쪽은 기다리지 않는다. */
export function noteParagraphError(reason, { env = process.env, record = recordErrorEvent, schedule = after } = {}) {
  try {
    if (typeof reason !== 'string' || !PARAGRAPH_ERROR_REASON.test(reason)) return null;
    const event = buildErrorEvent({ kind: PARAGRAPH_ERROR_KIND, message: reason, route: PARAGRAPH_ERROR_ROUTE, release: env.NEXT_PUBLIC_BUILD_SHA });
    if (!event) return null;
    const write = () => Promise.resolve(record({ ...event, source: 'server' })).catch(() => 'failed');
    try { schedule(write); return 'scheduled'; } catch { write(); return 'direct'; }
  } catch {
    return null;
  }
}
