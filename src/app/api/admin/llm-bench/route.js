// 관리자 전용 모델 비교 측정 — LLM-BENCH-001(#1077 AA R3-b). 스키마 0 · 쓰기 0.
// GET: 측정 모델 목록과 키 설정 여부(값은 읽지 않는다). POST {model}: 그 모델 하나로 고정 입력 전체를 돌려 결과를 돌려준다.
// POST {model, set:'quality'}: 품질 세트(회화 · 작문 첨삭 · 오늘의 문단 — LLM-BENCH-QUALITY-001)만 따로 돈다.
// 모델 하나씩 요청하는 이유: 함수 실행 시간 상한 안에 들게(화면이 모델을 차례로 부른다).
// 인증은 llm-stats와 같은 requireAdmin(비로그인 401 · 비관리자 403).
import { requireAdmin } from '../../../../lib/server/auth.js';
import { benchModelList, runBenchModel, runQualityBench } from '../../../../lib/server/llmBench.js';
import { BENCH_MODELS } from '../../../../lib/server/llm.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  return Response.json({ models: benchModelList() });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Bad JSON' }, { status: 400 }); }
  const model = body?.model;
  if (typeof model !== 'string' || !BENCH_MODELS[model]) return Response.json({ error: 'unknown model' }, { status: 400 });
  if (body?.set != null && body.set !== 'quality') return Response.json({ error: 'unknown set' }, { status: 400 });
  const result = body?.set === 'quality' ? await runQualityBench(model) : await runBenchModel(model);
  // 로그에는 요약 한 줄만(뜻·번역 · 첨삭 · 문단 본문 · 프롬프트 없음).
  const quality = result.set === 'quality' ? { conversation: result.conversation?.pass, writing: result.writing?.pass, paragraph: result.paragraph?.pass } : undefined;
  console.info('[llm-bench]', JSON.stringify({ model, set: body?.set ?? 'core', calls: result.calls, tokens: result.tokens, zh: result.zhSense?.verdicts?.all, quality, error: result.error ?? null }));
  return Response.json({ at: new Date().toISOString(), commit: process.env.VERCEL_GIT_COMMIT_SHA || null, result });
}
