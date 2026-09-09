// 관리자용 LLM 사용 집계 — v2-AA R2(#1077 5551860999 §R2). 스키마 0.
// llm.js의 인메모리 티어·모델별 집계를 읽는다. 인스턴스 재시작에 초기화되므로 **로그(`[llm]` 1줄/호출)가 정본이고
// 이건 창** — 응답의 `since`가 창의 시작. 인증은 api/admin/dictionary 관용구(profiles.role==='admin', service role)
// 를 그대로 쓰는 requireAdmin(비로그인 401 · 비관리자 403).
// 상대 경로 import — vitest 하네스(api/ai-relay 선례)에서 alias 없이 그대로 import되도록.

import { requireAdmin } from '../../../../lib/server/auth.js';
import { getLLMStats } from '../../../../lib/server/llm.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const { since, tiers } = getLLMStats();
  return Response.json({
    since,
    tiers,
    groqConfigured: !!process.env.GROQ_API_KEY,
    note: '인메모리 창 — 인스턴스 재시작에 초기화. 정본은 Vercel 로그의 [llm] 줄.',
  });
}
