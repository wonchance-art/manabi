import { createClient } from '@supabase/supabase-js';
import { getRefLang } from '@/content/refLangs';
import { buildFeedbackPrompt, validateFeedback, FEEDBACK_SCHEMA, WRITING_LEVELS } from '@/lib/writingPrompts';

/**
 * 작문 AI 첨삭 — /api/gemini와 같은 3단 폴백(flash → flash-lite → Groq)이되,
 * rubric 프롬프트를 서버에서 조립하고 구조화 JSON(responseSchema)으로 받아
 * validateFeedback 검증까지 마친 결과만 돌려준다.
 */

const GROQ_MODEL = 'qwen/qwen3-32b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_TEXT = 600;
const MAX_PROMPT = 200;

// 사용자별 rate limit — 작문 첨삭은 무겁고 저빈도라 분당 10회면 충분
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const WINDOW_MS = 60 * 1000;

function isRateLimited(key) {
  const now = Date.now();
  if (rateLimitMap.size > 10000) {
    for (const [k, v] of rateLimitMap) {
      if (now - v.start > WINDOW_MS) rateLimitMap.delete(k);
    }
  }
  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, start: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

async function callGemini(model, promptText, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: FEEDBACK_SCHEMA,
        },
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callGroqJson(promptText) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return null;
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: promptText + '\n\nJSON 객체 하나로만 응답하세요.' }],
      temperature: 0.2,
      stream: false,
      reasoning_effort: 'none',
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

/** 모델 텍스트 → JSON 파싱 (```json 펜스·전후 잡음 방어) */
function parseModelJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch {}
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(t.slice(start, end + 1)); } catch {}
  }
  return null;
}

export async function POST(request) {
  // 인증 — /api/gemini와 동일한 Bearer 검증
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
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
    return Response.json({ error: { message: '세션이 만료됐어요. 다시 로그인해주세요.' } }, { status: 401 });
  }
  if (isRateLimited(`u:${authUser.id}`)) {
    return Response.json({ error: { message: '첨삭 요청이 너무 잦아요. 잠시 후 다시 시도해주세요.' } }, { status: 429 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: { message: 'Server Configuration Error: API Key missing' } }, { status: 500 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: { message: 'Bad Request: Invalid JSON' } }, { status: 400 });
  }

  const { language, level, text, promptType = 'free', prompt = '', chapterSlug = null } = body || {};
  if (!WRITING_LEVELS[language]) {
    return Response.json({ error: { message: '지원하지 않는 언어입니다.' } }, { status: 400 });
  }
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return Response.json({ error: { message: '작문을 입력해주세요.' } }, { status: 400 });
  }
  if (trimmed.length > MAX_TEXT) {
    return Response.json({ error: { message: `한 번에 ${MAX_TEXT}자까지 첨삭할 수 있어요.` } }, { status: 400 });
  }

  // 챕터 연동 — 패턴 목록은 서버에서만 연다 (클라이언트 번들 무오염)
  let chapterPatterns = null;
  if (promptType === 'chapter' && chapterSlug) {
    const ref = getRefLang(language);
    const ch = ref?.getChapter(chapterSlug)?.chapter;
    if (ch) {
      chapterPatterns = ch.sections
        .filter(s => s.pattern)
        .map(s => ({ pattern: s.pattern, patternKo: s.patternKo || '' }))
        .slice(0, 6);
    }
  }

  const promptText = buildFeedbackPrompt({
    language,
    level: String(level || WRITING_LEVELS[language][0]).toUpperCase(),
    text: trimmed,
    promptType,
    prompt: String(prompt || '').slice(0, MAX_PROMPT),
    chapterPatterns,
  });
  if (!promptText) {
    return Response.json({ error: { message: '지원하지 않는 언어입니다.' } }, { status: 400 });
  }

  try {
    // flash → flash-lite → Groq
    let raw = await callGemini('gemini-2.5-flash', promptText, apiKey).catch(() => null);
    if (!raw) raw = await callGemini('gemini-2.5-flash-lite', promptText, apiKey).catch(() => null);
    if (!raw) raw = await callGroqJson(promptText).catch(() => null);

    const feedback = validateFeedback(parseModelJson(raw));
    if (!feedback) {
      console.error('[writing-feedback] unusable model output', String(raw).slice(0, 200));
      return Response.json(
        { error: { message: '첨삭 생성에 실패했어요. 잠시 후 다시 시도해주세요.' } },
        { status: 502 }
      );
    }
    return Response.json({ feedback }, { status: 200 });
  } catch (err) {
    console.error('[writing-feedback] error', err?.message);
    return Response.json({ error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
