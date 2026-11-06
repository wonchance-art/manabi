// 비싼 AI 경로의 사용자별 일일 상한(AI-QUOTA-001 — 발매 준비 점검 1 · 2, 2026-11-06 KST). 카운터는 DB(usage_private.ai_daily_usage —
// public.consume_ai_daily_quota, service_role 전용)라 Vercel 인스턴스가 여럿이어도 하나로 센다. 분당 제한(rateLimit.js 등)은 그대로 둔다
// (짧은 폭주용) — 이것은 하루 지출 상한이다. 학습일 경계는 KST 04시(학습 기록과 같다).
//
// 상한값 근거 — 운영 실측(2026-11-06 KST, 사용자별 학습일 최대 · p90). 정상 사용을 막지 않게 관측 최대치보다 여러 배 둔다(종류별 배수 표기):
//   analyze   300 요청 — 자료 분석 요청(일 800 · 중 400 · 영 2,000 · 한 1,600자 묶음)의 하루 추정 최대 12 · p90 6 → 25배
//             (분석 완료 자료의 생성일 · 언어별 묶음 크기로 추산). 300 = 일본어 약 24만 자(책 장 45,000자 다섯 장)
//   gemini    600 호출 — 줄 단위 분석 · 보조 호출(/api/gemini). 기록이 없어 analyze의 두 배
//   explain  1000 호출 — 단어 설명. 기록 없음 — 단어 저장 하루 최대 410(p90 77)보다 넉넉히(저장마다 설명을 불러도 2.4배)
//   paragraph 150 호출 — 공부 문단. 하루 최대 18 · p90 7 → 최대의 8배 · p90의 21배
//   writing    60 호출 — 작문 첨삭. 하루 최대 2 → 30배
//   dict       60 호출 — 사전 뜻 고침 요청(분당 10). 기록 없음
//   lookup    600 호출 — 수업 화면 단어 찾기(분당 20). 기록 없음 — 단어 설명과 같은 규모
//   ink       120 호출 — 손글씨 인식(분당 6, 이미지 포함 표준 모델). 기록 없음
//   import     60 호출 — 링크 가져오기. 기록 없음
//   tts      5000 호출 — 음성(로그인 없이 쓴다 — 주체는 IP 해시, 같은 IP를 쓰는 여러 명이 나눠 쓴다). 복습 기록 하루 최대 894 → 5.6배.
//             캐시(1년 immutable)에 맞은 문구는 세지 않고, 넘어도 useTTS가 브라우저 음성으로 넘어가 소리는 난다
// 대화는 이미 DB 기반 하루 150턴(src/lib/conversation/turnModel.js)이라 여기 넣지 않는다.
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { DAILY_LIMIT_MESSAGE } from '@/lib/errorMessage';

export const DAILY_LIMITS = Object.freeze({
  analyze: 300, gemini: 600, explain: 1000, paragraph: 150, writing: 60, dict: 60, lookup: 600, ink: 120, import: 60, tts: 5000,
});

export const DAILY_LIMIT_CODE = 'daily_limit';
export const DAILY_LIMIT_HEADER = 'X-Daily-Limit';
export { DAILY_LIMIT_MESSAGE };

let cachedClient;
function quotaClient() {
  if (cachedClient !== undefined) return cachedClient;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  cachedClient = key && url ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return cachedClient;
}

/** 테스트 전용 — 클라이언트를 바꿔 끼운다(null이면 키 없음과 같다). */
export function __setQuotaClientForTest(client) { cachedClient = client; }

/** 로그인 사용자는 `u:<uid>`, 아니면 `ip:<sha256(첫 x-forwarded-for)>` — IP 원문은 DB에 남기지 않는다. */
export function quotaSubject(request, userId) {
  if (userId) return `u:${userId}`;
  const ip = (request?.headers?.get?.('x-forwarded-for') || '').split(',')[0].trim() || request?.headers?.get?.('x-real-ip') || 'unknown';
  return `ip:${createHash('sha256').update(ip).digest('hex')}`;
}

/**
 * 하루 상한 하나를 쓴다. 한도 안이면 { ok:true }, 넘으면 { ok:false }.
 * DB · 키 문제로 셀 수 없으면 막지 않는다(fail-open — 상한 장애가 학습을 멈추게 하지 않는다. 분당 제한은 그대로 남는다).
 */
export async function consumeDailyQuota({ kind, subject, units = 1 }) {
  const limit = DAILY_LIMITS[kind];
  if (!limit) throw new Error(`unknown daily quota kind: ${kind}`);
  const client = quotaClient();
  if (!client || !subject) return { ok: true, counted: false };
  try {
    const { data, error } = await client.rpc('consume_ai_daily_quota', { p_subject: subject, p_kind: kind, p_units: Math.max(1, Math.round(units)), p_limit: limit });
    if (error || !data) { console.warn('[dailyQuota] not counted', kind, error?.message); return { ok: true, counted: false }; }
    return { ok: data.ok !== false, counted: true, used: data.used, limit };
  } catch (error) {
    console.warn('[dailyQuota] not counted', kind, error?.message);
    return { ok: true, counted: false };
  }
}

/**
 * 상한 도달 응답 — 기존 오류 안내(본문 문구 · 429)를 그대로 쓰고, 클라의 429 재시도가 하루짜리 벽에 다시 던지지 않게 표식을 단다
 * (헤더 X-Daily-Limit · code daily_limit). 본문 모양은 라우트가 원래 쓰던 것을 따른다 — 클라가 읽는 자리에 문구가 들어가야 한다:
 *   flat   { error: 문구, code }                (analyze · korean · dict-correct · classroom lookup)
 *   nested { error: { message: 문구, code }, code }  (writing-feedback · study-paragraph · explain · gemini — callGemini는 error.message를 읽는다)
 *   coded  { error: 'daily_limit', message: 문구, code }  (import/link)
 */
export function dailyLimitResponse(shape = 'flat') {
  const body = shape === 'nested' ? { error: { message: DAILY_LIMIT_MESSAGE, code: DAILY_LIMIT_CODE }, code: DAILY_LIMIT_CODE }
    : shape === 'coded' ? { error: DAILY_LIMIT_CODE, message: DAILY_LIMIT_MESSAGE, code: DAILY_LIMIT_CODE }
    : { error: DAILY_LIMIT_MESSAGE, code: DAILY_LIMIT_CODE };
  return Response.json(body, { status: 429, headers: { [DAILY_LIMIT_HEADER]: '1' } });
}

/** 한 번에: 한도 안이면 null, 넘으면 응답. 라우트는 `const over = await dailyQuotaGate(...); if (over) return over;` */
export async function dailyQuotaGate(kind, subject, { units = 1, shape = 'flat' } = {}) {
  const result = await consumeDailyQuota({ kind, subject, units });
  return result.ok ? null : dailyLimitResponse(shape);
}
