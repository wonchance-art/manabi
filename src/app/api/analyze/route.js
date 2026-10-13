// 하이브리드 분석 엔드포인트:
// 1. kuromoji로 형태소 분할 (서버 로컬)
// 2. 공유 morpheme_dictionary에서 의미 조회
// 3. 미싱 base_form들만 Gemini에 의미 요청 (Day 2에서 구현)
// 4. 새 의미 DB 저장
// 5. processed_json 호환 포맷으로 응답

import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientKey } from '@/lib/server/rateLimit';
import { readRequestBoundaries } from '@/lib/server/analyzeBoundaries';
// 분석 핵심은 analyzeCore로 꺼냈다(v2-Z Z-R1 ① — 대화 턴 경로와 함께 쓴다). 이 라우트는 인증·한도·입력 검증만 맡는다.
import { analyzeLines } from '@/lib/server/analyzeCore';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel Node.js 함수: 최대 60초

// 입력 캡(비용 남용 방지). 자료 분석(analyzeText)은 여러 문단을 한 요청에 묶되 이 캡과 요청당 글자 예산 안으로 나눠 보낸다.
const MAX_LINES = 100;      // 요청당 줄 수
const MAX_LINE_LEN = 200;   // 줄당 문자 수

export async function POST(request) {
  const startedAt = Date.now();
  // 인증 확인 — 로그인 사용자만 분석 가능 (Gemini 쿼터 남용 방지)
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return Response.json({ error: '로그인이 필요해요.' }, { status: 401 });
  }
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const { data: { user }, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !user) {
    return Response.json({ error: '세션이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }

  // Rate limit — 사용자별 분당 20회
  const key = getClientKey(request, user.id);
  const rl = rateLimit(key, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return Response.json(
      { error: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Bad JSON' }, { status: 400 });
  }

  const { lines: rawLines, language, boundaries } = body;
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return Response.json({ error: 'lines required' }, { status: 400 });
  }
  if (!['Japanese', 'English', 'Chinese'].includes(language)) {
    return Response.json({ error: 'language must be Japanese, English or Chinese' }, { status: 400 });
  }
  // 줄 수·줄 길이 캡 — 토큰화·Gemini 팬아웃 비용을 상한. 정상 세션(수 줄)은 영향 없음.
  // 캡을 넘은 줄은 잘라 분석하되 결과에 truncated 표식을 단다 — 조용히 자르면 뒷부분 토큰이 사라진 채
  // 자료가 '완료'로 저장됐다(EPUB 문단·자막 8줄 합치기). 자료 분석(analyzeText)은 미리 문장 단위로 나눠 보내고,
  // 표식이 온 줄은 실패(복구 가능)로 남긴다. 빠른 분석·드래그 분석은 앞부분 단어만 보여 주는 지금 동작 그대로다.
  const truncatedLines = new Set();
  const lines = rawLines.slice(0, MAX_LINES).map((l, i) => {
    const line = String(l ?? '');
    if (line.length > MAX_LINE_LEN) truncatedLines.add(i);
    return line.slice(0, MAX_LINE_LEN);
  });
  // AD-R3: 이 자료의 단어 경계 기록(줄 = 요청 안 번호). 없으면 기존 경로 그대로(기록 0 = 동작 동일).
  const boundaryRequest = readRequestBoundaries(boundaries, lines.length);
  if (!boundaryRequest.ok) {
    return Response.json({ error: 'boundaries invalid' }, { status: 400 });
  }

  try {
    const { results, stats } = await analyzeLines({ lines, language, boundaryRequest, truncatedLines, startedAt });
    return Response.json({ results, stats });
  } catch (err) {
    console.error('[api/analyze] error:', err);
    return Response.json(
      { error: 'Internal Server Error' }, // 내부 err.message 노출 금지
      { status: 500 }
    );
  }
}
