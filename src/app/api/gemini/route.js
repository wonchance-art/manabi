import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/server/auth';

// ── 프록시 잠금(비용 남용 방지) ──
// 클라가 고를 수 있는 모델 화이트리스트 — flash·flash-lite만(pro 등 고비용 모델 차단).
const ALLOWED_MODELS = new Set([
  'models/gemini-2.5-flash',
  'models/gemini-2.5-flash-lite',
]);
const DEFAULT_MODEL = 'models/gemini-2.5-flash';
// 텍스트 파트 합계 바이트 상한. contents 전체가 아니라 text만 잰다 — PDF OCR 경로가
// inline_data(base64 이미지, 수백 KB)를 이 프록시로 보내므로 이미지는 캡에서 제외해야
// 회귀가 없다(pdfExtract.js). 32KB면 ReadingTest 발췌(2.5K자)·대화·긴 CJK 선택을 모두 통과.
const MAX_TEXT_BYTES = 32 * 1024;
// 출력 토큰 서버 상한 — 관측된 최대 사용처(단어상세·독해문항·문단번역)보다 넉넉, 출력 폭주 차단.
const MAX_OUTPUT_TOKENS = 8192;

// Qwen 3 — CJK 언어에 강하고 instruct 모드라 빠름
// Reasoning 버전이 아닌 function calling(instruct) 카테고리 버전 사용
const GROQ_MODEL = 'qwen/qwen3-32b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Groq 호출 + Gemini 호환 응답 형식으로 변환 */
async function callGroq(contents, generationConfig) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return null;

  // Gemini contents → OpenAI-compatible messages
  const promptText = contents.flatMap(c =>
    (c.parts || []).map(p => p.text || '')
  ).join('\n');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: promptText }],
      temperature: generationConfig?.temperature ?? 0,
      stream: false,
      // Qwen 3 thinking 모드 비활성화 (불필요한 추론 토큰 낭비 방지)
      reasoning_effort: 'none',
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) return null;

  // Gemini candidates 형식으로 포장
  return {
    candidates: [{
      content: { parts: [{ text }] },
      _provider: 'groq',
    }],
  };
}

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
  const model = body.model ?? DEFAULT_MODEL;
  if (!contents) {
    recordStat('errors');
    stats.errorByStatus['400'] = (stats.errorByStatus['400'] || 0) + 1;
    return Response.json(
      { error: { message: 'Bad Request: No contents provided' } },
      { status: 400 }
    );
  }

  // 모델 화이트리스트 — flash·flash-lite만(클라가 pro 등 고비용 모델을 강제하지 못하게).
  if (!ALLOWED_MODELS.has(model)) {
    recordStat('errors');
    stats.errorByStatus['400'] = (stats.errorByStatus['400'] || 0) + 1;
    return Response.json(
      { error: { message: 'Bad Request: Unsupported model' } },
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

  const requestBody = { contents, generationConfig: safeGenConfig };

  try {
    let url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    let data = await response.json();

    // 폴백 1: 1차 실패 시 gemini-2.5-flash-lite 재시도 (더 가볍고 용량 여유 있음)
    if (!response.ok && model !== 'models/gemini-2.5-flash-lite') {
      recordStat('fallbackUsed');
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
      response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      data = await response.json();
    }

    // 폴백 2: Gemini 두 번째도 실패 시 Groq (GROQ_API_KEY 설정됐을 때만)
    if (!response.ok) {
      const groqData = await callGroq(contents, generationConfig).catch(() => null);
      if (groqData) {
        recordStat('groqUsed');
        recordStat('ok');
        const latency = Date.now() - started;
        stats.latencySum += latency;
        return Response.json(groqData, { status: 200 });
      }
    }

    const latency = Date.now() - started;
    stats.latencySum += latency;

    if (response.ok) {
      recordStat('ok');
    } else {
      recordStat('errors');
      const key = String(response.status);
      stats.errorByStatus[key] = (stats.errorByStatus[key] || 0) + 1;
      console.error('[gemini]', response.status, `${latency}ms`, JSON.stringify(data).slice(0, 300));
    }
    return Response.json(data, { status: response.ok ? 200 : response.status });
  } catch (err) {
    const latency = Date.now() - started;
    stats.latencySum += latency;
    recordStat('errors');
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
