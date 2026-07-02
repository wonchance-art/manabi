import { createClient } from '@supabase/supabase-js';
import { buildParagraphPrompt, validateParagraph, PARAGRAPH_SCHEMA } from '@/lib/studyParagraph';

/**
 * 오늘의 문단 생성 — 공부 모드의 재료(새 문법·새 어휘·복습 문법·복습 어휘)를
 * 하나의 문단으로 녹이고 파생 문항까지 만든다.
 * /api/writing-feedback과 동일한 인증·폴백(flash → flash-lite → Groq JSON) 구조.
 */

const GROQ_MODEL = 'qwen/qwen3-32b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const rateLimitMap = new Map();
const RATE_LIMIT = 15;               // 세션 시작마다 1회 — 분당 15면 충분
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
          temperature: 0.6,            // 문단은 약간의 다양성
          responseMimeType: 'application/json',
          responseSchema: PARAGRAPH_SCHEMA,
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
      temperature: 0.6,
      stream: false,
      reasoning_effort: 'none',
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

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
    return Response.json({ error: { message: '요청이 너무 잦아요. 잠시 후 다시 시도해주세요.' } }, { status: 429 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && !process.env.GROQ_API_KEY) {
    return Response.json(
      { error: { message: '서버에 AI 키가 설정되지 않았어요 (GEMINI_API_KEY 또는 GROQ_API_KEY).' } },
      { status: 500 }
    );
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: { message: 'Bad Request: Invalid JSON' } }, { status: 400 });
  }

  // 재료는 클라이언트가 서버 페이지에서 받은 것을 그대로 되돌려준다 (문자열 길이만 방어)
  const materials = {
    language: body?.language,
    level: String(body?.level || '').slice(0, 8),
    newPattern: body?.newPattern && typeof body.newPattern.pattern === 'string'
      ? { pattern: body.newPattern.pattern.slice(0, 120), patternKo: String(body.newPattern.patternKo || '').slice(0, 120) }
      : null,
    duePatterns: (Array.isArray(body?.duePatterns) ? body.duePatterns : []).slice(0, 3)
      .filter(p => p && typeof p.pattern === 'string')
      .map(p => ({ pattern: p.pattern.slice(0, 120), patternKo: String(p.patternKo || '').slice(0, 120) })),
    dueWords: (Array.isArray(body?.dueWords) ? body.dueWords : []).slice(0, 4)
      .filter(w => w && typeof w.word === 'string' && typeof w.meaning === 'string')
      .map(w => ({ word: w.word.slice(0, 60), meaning: w.meaning.slice(0, 80) })),
    newWords: (Array.isArray(body?.newWords) ? body.newWords : []).slice(0, 2)
      .filter(w => w && typeof w.word === 'string' && typeof w.meaning === 'string')
      .map(w => ({ word: w.word.slice(0, 60), meaning: w.meaning.slice(0, 80) })),
  };

  const promptText = buildParagraphPrompt(materials);
  if (!promptText) {
    return Response.json({ error: { message: '문단을 만들 재료가 없어요.' } }, { status: 400 });
  }

  try {
    let raw = null;
    if (apiKey) {
      raw = await callGemini('gemini-2.5-flash', promptText, apiKey).catch(() => null);
      if (!raw) raw = await callGemini('gemini-2.5-flash-lite', promptText, apiKey).catch(() => null);
    }
    if (!raw) raw = await callGroqJson(promptText).catch(() => null);

    const paragraph = validateParagraph(parseModelJson(raw));
    if (!paragraph) {
      console.error('[study-paragraph] unusable model output', String(raw).slice(0, 200));
      return Response.json(
        { error: { message: '문단 생성에 실패했어요.' } },
        { status: 502 }
      );
    }
    return Response.json({ paragraph }, { status: 200 });
  } catch (err) {
    console.error('[study-paragraph] error', err?.message);
    return Response.json({ error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
