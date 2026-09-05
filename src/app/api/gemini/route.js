import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/server/auth';
import { callLLM, resolveTier, LLMError } from '@/lib/server/llm';

// ── 프록시 잠금(비용 남용 방지) ──
// 클라는 모델이 아니라 **티어**(light/standard)를 고른다 — 모델·폴백·Groq는 llm.js의 TIERS가 정한다(AA R1).
// 구버전 클라 번들이 보내는 body.model(옛 이름)은 하위호환 힌트로 티어에 매핑하고, 목록 밖은 400(현행).
// 텍스트 파트 합계 바이트 상한. contents 전체가 아니라 text만 잰다 — PDF OCR 경로가
// inline_data(base64 이미지, 수백 KB)를 이 프록시로 보내므로 이미지는 캡에서 제외해야
// 회귀가 없다(pdfExtract.js). 32KB면 ReadingTest 발췌(2.5K자)·대화·긴 CJK 선택을 모두 통과.
const MAX_TEXT_BYTES = 32 * 1024;
// 출력 토큰 서버 상한 — 관측된 최대 사용처(단어상세·독해문항·문단번역)보다 넉넉, 출력 폭주 차단.
const MAX_OUTPUT_TOKENS = 8192;

// IP별 요청 카운터 (서버리스 인스턴스 재시작 시 초기화 — 충분한 억지력)
const rateLimitMap = new Map();
const RATE_LIMIT = 60; // 분당 요청 수 (사용자별) — 비용 남용 방지
const WINDOW_MS = 60 * 1000;
const MAX_ENTRIES = 10000;
let lastCleanup = Date.now();

// 사용량/에러 통계 (인스턴스 로컬, 서버리스 재시작 시 리셋)
const stats = {
  startedAt: Date.now(),
  total: 0,
  ok: 0,
  errors: 0,
  rateLimited: 0,
  fallbackUsed: 0,
  groqUsed: 0,     // Gemini 전체 실패 시 Groq로 살린 횟수
  latencySum: 0,
  errorByStatus: {},
};

function recordStat(key, inc = 1) {
  stats[key] = (stats[key] || 0) + inc;
}

function isRateLimited(ip) {
  const now = Date.now();

  // 5분마다 만료된 엔트리 정리 (메모리 누수 방지)
  if (now - lastCleanup > 5 * 60 * 1000 || rateLimitMap.size > MAX_ENTRIES) {
    for (const [key, val] of rateLimitMap) {
      if (now - val.start > WINDOW_MS) rateLimitMap.delete(key);
    }
    lastCleanup = now;
  }

  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

export async function POST(request) {
  const started = Date.now();
  recordStat('total');

  // 인증 확인 — Gemini 쿼터 남용 방지
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    recordStat('errors');
    stats.errorByStatus['401'] = (stats.errorByStatus['401'] || 0) + 1;
    return Response.json({ error: { message: '로그인이 필요합니다.' } }, { status: 401 });
  }
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const { data: { user: authUser }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authUser) {
    recordStat('errors');
    stats.errorByStatus['401'] = (stats.errorByStatus['401'] || 0) + 1;
    return Response.json({ error: { message: '세션이 만료됐어요. 다시 로그인해주세요.' } }, { status: 401 });
  }

  // 사용자 ID 기반 rate limit (IP보다 공정)
  const rateLimitKey = `u:${authUser.id}`;

  if (isRateLimited(rateLimitKey)) {
    recordStat('rateLimited');
    return Response.json(
      { error: { message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' } },
      { status: 429 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    recordStat('errors');
    stats.errorByStatus['500'] = (stats.errorByStatus['500'] || 0) + 1;
    return Response.json(
      { error: { message: 'Server Configuration Error: API Key missing' } },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    recordStat('errors');
    stats.errorByStatus['400'] = (stats.errorByStatus['400'] || 0) + 1;
    return Response.json(
      { error: { message: 'Bad Request: Invalid JSON' } },
      { status: 400 }
    );
  }

  const { contents, generationConfig } = body;
  const resolved = resolveTier({ tier: body.tier, model: body.model });
  if (!contents) {
    recordStat('errors');
    stats.errorByStatus['400'] = (stats.errorByStatus['400'] || 0) + 1;
    return Response.json(
      { error: { message: 'Bad Request: No contents provided' } },
      { status: 400 }
    );
  }

  // 티어 화이트리스트 — light/standard만(클라가 pro 등 고비용 모델을 강제하지 못하게). 옛 모델명은 매핑, 밖이면 400.
  if (resolved.error) {
    recordStat('errors');
    stats.errorByStatus['400'] = (stats.errorByStatus['400'] || 0) + 1;
    return Response.json(
      { error: { message: resolved.error === 'unsupported_tier' ? 'Bad Request: Unsupported tier' : 'Bad Request: Unsupported model' } },
      { status: 400 }
    );
  }

  // 텍스트 파트 바이트 상한 — inline_data(이미지)는 제외해 PDF OCR 경로 회귀를 막는다.
  let textBytes = 0;
  if (Array.isArray(contents)) {
    for (const c of contents) {
      for (const p of (c?.parts || [])) {
        if (typeof p?.text === 'string') textBytes += Buffer.byteLength(p.text, 'utf8');
      }
    }
  }
  if (textBytes > MAX_TEXT_BYTES) {
    recordStat('errors');
    stats.errorByStatus['400'] = (stats.errorByStatus['400'] || 0) + 1;
    return Response.json(
      { error: { message: 'Bad Request: Prompt too large' } },
      { status: 400 }
    );
  }

  // 출력 토큰 서버 상한 강제 — 클라가 maxOutputTokens를 키워 출력 비용을 폭주시키는 것 차단.
  const safeGenConfig = {
    ...(generationConfig || {}),
    maxOutputTokens: Math.min(
      Number(generationConfig?.maxOutputTokens) || MAX_OUTPUT_TOKENS,
      MAX_OUTPUT_TOKENS
    ),
  };

  try {
    const { text, meta } = await callLLM(resolved.tier, contents, {
      generationConfig: safeGenConfig,
      route: 'gemini-proxy',
    });
    const latency = Date.now() - started;
    stats.latencySum += latency;
    if (meta.fallbackDepth > 0) recordStat('fallbackUsed');
    if (meta.provider === 'groq') recordStat('groqUsed');
    recordStat('ok');
    // 클라(lib/gemini.js)는 Gemini candidates 형식을 읽는다 — Groq 결과도 같은 형식(_provider 표식)으로.
    return Response.json({
      candidates: [{
        content: { parts: [{ text }] },
        ...(meta.provider === 'groq' ? { _provider: 'groq' } : {}),
      }],
      usageMetadata: {
        promptTokenCount: meta.usage.in,
        candidatesTokenCount: meta.usage.out,
        thoughtsTokenCount: meta.usage.thinking,
      },
    }, { status: 200 });
  } catch (err) {
    const latency = Date.now() - started;
    stats.latencySum += latency;
    recordStat('errors');
    if (err instanceof LLMError) {
      // 마지막 Gemini 응답의 상태·본문을 그대로 되돌린다 — 클라 재시도 판정(isCapacityError)이 현행과 같다.
      const status = err.status >= 400 ? err.status : 502;
      const key = String(status);
      stats.errorByStatus[key] = (stats.errorByStatus[key] || 0) + 1;
      const detailErr = err.detail && typeof err.detail === 'object' ? err.detail.error : null;
      const data = detailErr && typeof detailErr === 'object'
        ? err.detail
        : { error: { message: (typeof detailErr === 'string' && detailErr) || err.message } };
      console.error('[gemini]', status, `${latency}ms`, JSON.stringify(data).slice(0, 300));
      return Response.json(data, { status });
    }
    stats.errorByStatus['500'] = (stats.errorByStatus['500'] || 0) + 1;
    console.error('[gemini] proxy error', `${latency}ms`, err?.message);
    return Response.json(
      { error: { message: 'Internal Server Error' } },
      { status: 500 }
    );
  }
}

// 관리자용 통계 확인 엔드포인트 (인스턴스 로컬) — 관리자 인증 필수(운영 통계 노출 방지).
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const uptimeMs = Date.now() - stats.startedAt;
  const avgLatency = stats.total > 0 ? Math.round(stats.latencySum / stats.total) : 0;
  const errorRate = stats.total > 0 ? ((stats.errors / stats.total) * 100).toFixed(1) : '0.0';

  return Response.json({
    uptimeMinutes: Math.round(uptimeMs / 60000),
    total: stats.total,
    ok: stats.ok,
    errors: stats.errors,
    rateLimited: stats.rateLimited,
    fallbackUsed: stats.fallbackUsed,
    groqUsed: stats.groqUsed,
    groqConfigured: !!process.env.GROQ_API_KEY,
    avgLatencyMs: avgLatency,
    errorRatePct: errorRate,
    errorByStatus: stats.errorByStatus,
  });
}
