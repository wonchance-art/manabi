import { createClient } from '@supabase/supabase-js';

/**
 * 오답 해설 "왜?" — 오답 직후(인코딩 최강 순간) 왜 정답이 맞고 학습자의 선택이
 * 안 되는지 한국어 1~2문장으로 설명한다. /api/writing-feedback와 같은 인증·폴백
 * 패턴을 따르되, 구조화 JSON 없이 plain text만 돌려준다(가볍게).
 */

const GROQ_MODEL = 'qwen/qwen3-32b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_LEN = 300;

// 사용자별 rate limit — 해설도 저빈도라 분당 20회면 충분
const rateLimitMap = new Map();
const RATE_LIMIT = 20;
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
        generationConfig: { temperature: 0.3 },
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callGroq(promptText) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return null;
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: promptText }],
      temperature: 0.3,
      stream: false,
      reasoning_effort: 'none',
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

/** plain text 정리 — 펜스·앞뒤 공백 제거 후 300자 절단 */
function cleanText(text) {
  if (!text) return '';
  let t = String(text).trim();
  const fence = t.match(/```(?:\w*)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  return t.slice(0, MAX_LEN);
}

export async function POST(request) {
  // 인증 — /api/writing-feedback와 동일한 Bearer 검증
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

  // Gemini 키가 없어도 Groq만으로 진행 — 하드 실패는 두 키 모두 없을 때만
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && !process.env.GROQ_API_KEY) {
    return Response.json(
      { error: { message: '서버에 AI 키가 설정되지 않았어요.' } },
      { status: 500 }
    );
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: { message: 'Bad Request: Invalid JSON' } }, { status: 400 });
  }

  const { language, question } = body || {};
  const type = question?.type;
  if (!language || !question || !['cloze', 'vocab', 'comprehension'].includes(type)) {
    return Response.json({ error: { message: '잘못된 요청입니다.' } }, { status: 400 });
  }
  // 프롬프트 주입 방어 — 각 필드 길이 캡
  const cap = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const sentence = cap(question.sentence, 200);
  const correct = cap(question.correct, 120);
  const picked = cap(question.picked, 120);
  const ko = cap(question.ko, 200);
  if (!sentence || !correct) {
    return Response.json({ error: { message: '잘못된 요청입니다.' } }, { status: 400 });
  }

  const promptText =
    `한국인 학습자가 ${cap(language, 20)} 문제를 틀렸다. 문장: ${sentence} / 정답: ${correct} / 학습자의 선택: ${picked} / 문장 뜻: ${ko}. ` +
    `왜 정답이 맞고 학습자의 선택이 안 되는지 한국어 1~2문장으로, 문법 용어 최소로 설명.`;

  try {
    // flash-lite 우선 → Groq (Gemini 키 없으면 바로 Groq)
    let raw = null;
    if (apiKey) {
      raw = await callGemini('gemini-2.5-flash-lite', promptText, apiKey).catch(() => null);
    }
    if (!raw) raw = await callGroq(promptText).catch(() => null);

    const text = cleanText(raw);
    if (!text) {
      return Response.json({ error: { message: '해설 생성에 실패했어요.' } }, { status: 502 });
    }
    return Response.json({ explanation: text }, { status: 200 });
  } catch (err) {
    console.error('[explain] error', err?.message);
    return Response.json({ error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
