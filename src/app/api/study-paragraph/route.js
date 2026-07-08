import { createClient } from '@supabase/supabase-js';
import { buildParagraphPrompt, validateParagraph, verifyParagraph, PARAGRAPH_SCHEMA } from '@/lib/studyParagraph';
import { assembleStudyMaterials, deriveArc } from '@/lib/studyMaterials';

/**
 * 오늘의 문단 생성 — 공부 모드의 재료(새 문법·새 어휘·복습 문법·복습 어휘)를
 * 하나의 문단으로 녹이고 파생 문항까지 만든다.
 * /api/writing-feedback과 동일한 인증·폴백(flash → flash-lite → Groq JSON) 구조.
 *
 * 두 모드:
 *  - 일반: 클라가 보낸 재료로 생성 → 검증·2차검증 → {paragraph} 응답 + study_paragraphs 저장('used').
 *  - prefetch(body.prefetch===true): 재료를 클라가 안 보냄 — 라우트가 assembleStudyMaterials(36h)로
 *    직접 조립해 생성·저장('prefetched')하고 { ok, preview }만 응답(다음 세션 즉시 시작용).
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

/** 1회 생성 시도 — flash → flash-lite → Groq → validate → verify(결정적 2차검증) */
async function generateOnce(promptText, apiKey) {
  let raw = null;
  if (apiKey) {
    raw = await callGemini('gemini-2.5-flash', promptText, apiKey).catch(() => null);
    if (!raw) raw = await callGemini('gemini-2.5-flash-lite', promptText, apiKey).catch(() => null);
  }
  if (!raw) raw = await callGroqJson(promptText).catch(() => null);
  const validated = validateParagraph(parseModelJson(raw));
  if (!validated) return { paragraph: null, raw };
  return { paragraph: verifyParagraph(validated), raw };
}

/**
 * study_paragraphs 보존 정책 — 유저당·언어당 최근 100행만 남기고 정리(best-effort).
 * 응답 지연 없이 발사만 하고 await하지 않으며, 테이블 부재 등 실패는 조용히 무시한다.
 */
function pruneOldParagraphs(userClient, userId, lang) {
  userClient.from('study_paragraphs')
    .select('id')
    .eq('user_id', userId)
    .eq('lang', lang)
    .order('created_at', { ascending: false })
    .range(100, 149)
    .then(({ data }) => {
      const ids = (data || []).map(r => r.id);
      if (!ids.length) return;
      userClient.from('study_paragraphs').delete().in('id', ids).then(() => {}, () => {});
    }, () => {});
}

/** 재료 방어 정리 — 클라가 보낸 것을 그대로 되돌려받되 길이만 캡 */
function cleanMaterials(body) {
  return {
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
    knownWords: (Array.isArray(body?.knownWords) ? body.knownWords : []).slice(0, 30)
      .filter(w => typeof w === 'string' && w.trim()).map(w => w.slice(0, 60)),
    whitelistWords: (Array.isArray(body?.whitelistWords) ? body.whitelistWords : []).slice(0, 40)
      .filter(w => typeof w === 'string' && w.trim()).map(w => w.slice(0, 60)),
    theme: typeof body?.theme === 'string' ? body.theme.slice(0, 40) : '',
    // 내 자료 — 사용자가 붙여넣은 소재(주입 방어: 길이 1500자 캡). 있으면 단발 세션(연재·테마 밖).
    ...(typeof body?.sourceText === 'string' && body.sourceText.trim()
      ? { sourceText: body.sourceText.slice(0, 1500) } : {}),
    avoidThemes: (Array.isArray(body?.avoidThemes) ? body.avoidThemes : []).slice(0, 5)
      .filter(t => typeof t === 'string' && t.trim()).map(t => t.slice(0, 40)),
    // 연재 — 클라가 직접 보낸 경우만 채택(대개는 route가 서버에서 보강한다).
    ...(typeof body?.prevArc === 'string' && body.prevArc.trim()
      ? { prevArc: body.prevArc.trim().slice(0, 200) } : {}),
    ...(Number(body?.episode) >= 2 && Number(body?.episode) <= 20
      ? { episode: Math.floor(Number(body.episode)) } : {}),
  };
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return Response.json({ error: { message: '로그인이 필요합니다.' } }, { status: 401 });
  }
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
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

  // RLS 조회·저장용 사용자 토큰 클라이언트 (모든 요청에 Authorization 헤더 부착)
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const isPrefetch = body?.prefetch === true;

  // ── 재료 결정 — prefetch는 라우트가 직접 조립(36h), 아니면 클라가 보낸 것 ──
  let materials;
  if (isPrefetch) {
    const lang = body?.language;
    if (!lang) return Response.json({ ok: false }, { status: 200 });
    try {
      // 관심사 쿠키(온보딩에서 고른 취향) — 프리페치 테마도 같은 가중을 받게. 없으면 기존 동작.
      const interestGroup = request.cookies.get('study_interest')?.value || null;
      const assembled = await assembleStudyMaterials(userClient, authUser.id, lang, { horizonHours: 36, interestGroup });
      if (!assembled.canGenerate) return Response.json({ ok: false }, { status: 200 });
      materials = assembled.paragraphMaterials;
    } catch (err) {
      console.error('[study-paragraph] prefetch assemble error', err?.message);
      return Response.json({ ok: false }, { status: 200 });
    }
  } else {
    materials = cleanMaterials(body);
    // ── 연재 서버 보강 ──
    // 클라(StudySessionPage)는 재료 필드를 명시 나열해 보내므로 prevArc/episode가 body에 실리지 않는다.
    // 프리페치가 아닌 라이브 경로에서는 route가 직접 최근 used 행에서 다음 화를 유도한다
    // (약점 세션 제외·클라가 이미 보낸 경우 존중). 실패·부재는 조용히 무시 → 독립 문단.
    if (!materials.prevArc && !materials.sourceText && materials.theme !== '약점 복습' && materials.language) {
      let latestUsedRow = null;
      await userClient.from('study_paragraphs')
        .select('paragraph, materials, used_at, created_at')
        .eq('user_id', authUser.id).eq('lang', materials.language).eq('status', 'used')
        .order('used_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }).limit(1)
        .then(({ data }) => { latestUsedRow = (data && data[0]) || null; }, () => {});
      const arc = deriveArc(latestUsedRow, { weekly: materials.theme === '약점 복습' });
      if (arc) {
        materials.prevArc = arc.prevArc; materials.episode = arc.episode;
        // 공동 작가 — 직전 화에 사용자가 정한 다음 전개(≥2점)를 소재로 이어받는다(주입은 buildParagraphPrompt에서 정화·인용).
        if (arc.userNext) materials.userNext = arc.userNext;
      }
    }
  }

  const promptText = buildParagraphPrompt(materials);
  if (!promptText) {
    if (isPrefetch) return Response.json({ ok: false }, { status: 200 });
    return Response.json({ error: { message: '문단을 만들 재료가 없어요.' } }, { status: 400 });
  }

  try {
    // 생성 → 결정적 2차검증. null이면 동일 프롬프트로 1회 재생성.
    let { paragraph } = await generateOnce(promptText, apiKey);
    if (!paragraph) {
      ({ paragraph } = await generateOnce(promptText, apiKey));
    }
    if (!paragraph) {
      console.error('[study-paragraph] unusable model output after retry');
      if (isPrefetch) return Response.json({ ok: false }, { status: 200 });
      return Response.json({ error: { message: '문단 생성에 실패했어요.' } }, { status: 502 });
    }

    // 내 자료 세션은 연재 밖(단발) — arcSummary를 제거해 다음 세션 deriveArc가 이 이야기를 이어받지 않게.
    if (materials.sourceText && paragraph && 'arcSummary' in paragraph) delete paragraph.arcSummary;

    // study_paragraphs 저장 (테이블 부재 등 실패는 무시 — 응답은 정상)
    const nowIso = new Date().toISOString();
    await userClient.from('study_paragraphs').insert({
      user_id: authUser.id,
      lang: materials.language,
      level: materials.level || null,
      status: isPrefetch ? 'prefetched' : 'used',
      theme: materials.theme || null,
      materials,
      paragraph,
      used_at: isPrefetch ? null : nowIso,
    }).then(() => {}, () => {});

    // 보존 정책 — 유저당·언어당 최근 100행만 유지(best-effort, 응답 지연 없음)
    pruneOldParagraphs(userClient, authUser.id, materials.language);

    if (isPrefetch) {
      const preview = String(paragraph.translation || '').slice(0, 60);
      return Response.json({ ok: true, preview }, { status: 200 });
    }
    return Response.json({ paragraph }, { status: 200 });
  } catch (err) {
    console.error('[study-paragraph] error', err?.message);
    if (isPrefetch) return Response.json({ ok: false }, { status: 200 });
    return Response.json({ error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
