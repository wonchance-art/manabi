// POST /api/media/word-context — 「듣고 읽기」 인라인 단어 팝오버의 "문맥 해석"(지연 로드).
// body: { sentence, surface, base, language }  → { context: string }
//
// 문장 맥락 속에서 표면형(문장 속 형태 그대로)의 의미·역할을 한국어 1~2문장으로 설명한다.
// 활용형이면 기본형에서 어떻게 변했는지 짧게 포함. 프롬프트/캡은 순수 헬퍼
// (lib/server/media.js: buildWordContextPrompt). 모델은 flash-lite 우선 → Groq 폴백
// (explain·translate 라우트의 호출·폴백 패턴 재사용). 실패 시 팝오버는 3행만 조용히 생략.
//
// 캐시: 라우트 내 메모리 LRU(상한 200). 키 = `${sentence}∥${surface}∥${language}`.
// 인증·rate limit은 다른 media 라우트 패턴을 따른다.

import { buildWordContextPrompt } from '@/lib/server/media';
import { rateLimit, getClientKey } from '@/lib/server/rateLimit';
import { requireAdmin } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

const GROQ_MODEL = 'qwen/qwen3-32b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_LEN = 300;

// ── 메모리 LRU 캐시(비영속, 상한 200) — 문장+표면형+언어 키 ──
const CACHE_MAX = 200;
const cache = new Map();
function cacheGet(key) {
  if (!cache.has(key)) return null;
  const v = cache.get(key);
  cache.delete(key); cache.set(key, v);
  return v;
}
function cacheSet(key, v) {
  cache.set(key, v);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

async function callGemini(promptText, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
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
  const auth = await requireAdmin(request);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const rl = rateLimit(getClientKey(request, auth.user.id), { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return Response.json(
      { error: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && !process.env.GROQ_API_KEY) {
    return Response.json({ error: '서버에 AI 키가 설정되지 않았어요.' }, { status: 500 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: '잘못된 요청이에요.' }, { status: 400 });
  }

  const sentence = typeof body?.sentence === 'string' ? body.sentence : '';
  const surface = typeof body?.surface === 'string' ? body.surface.trim() : '';
  const base = typeof body?.base === 'string' ? body.base.trim() : '';
  const language = typeof body?.language === 'string' ? body.language : '';
  if (!sentence.trim() || !surface) {
    return Response.json({ error: 'sentence·surface required' }, { status: 400 });
  }

  const cacheKey = `${sentence.trim()}∥${surface}∥${language}`;
  const cached = cacheGet(cacheKey);
  if (cached) return Response.json({ context: cached });

  const promptText = buildWordContextPrompt({ sentence, surface, base, language });

  try {
    let raw = null;
    if (apiKey) raw = await callGemini(promptText, apiKey).catch(() => null);
    if (!raw) raw = await callGroq(promptText).catch(() => null);

    const text = cleanText(raw);
    if (!text) {
      // 실패 — 클라는 3행(문맥 해석)만 조용히 생략. 캐시하지 않음(다음 탭 재시도 가능).
      return Response.json({ error: '해설 생성에 실패했어요.' }, { status: 502 });
    }
    cacheSet(cacheKey, text); // 성공만 캐시
    return Response.json({ context: text });
  } catch (err) {
    console.error('[media/word-context] error:', err?.message);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
