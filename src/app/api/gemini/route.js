// IP별 요청 카운터 (서버리스 인스턴스 재시작 시 초기화 — 충분한 억지력)
const rateLimitMap = new Map();
const RATE_LIMIT = 20;
const WINDOW_MS = 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

export async function POST(request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';

  if (isRateLimited(ip)) {
    return Response.json(
      { error: { message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' } },
      { status: 429 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: { message: 'Server Configuration Error: API Key missing' } },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { message: 'Bad Request: Invalid JSON' } },
      { status: 400 }
    );
  }

  const { contents, generationConfig, model = 'models/gemini-2.0-flash-lite-preview-02-05' } = body;
  if (!contents) {
    return Response.json(
      { error: { message: 'Bad Request: No contents provided' } },
      { status: 400 }
    );
  }

  const requestBody = { contents, ...(generationConfig ? { generationConfig } : {}) };

  try {
    let url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    let data = await response.json();

    // 폴백: 1차 실패 시 gemini-2.5-flash 재시도
    if (!response.ok && model !== 'models/gemini-2.5-flash') {
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      data = await response.json();
    }

    return Response.json(data, { status: response.ok ? 200 : response.status });
  } catch (err) {
    console.error('Gemini API Proxy Error:', err);
    return Response.json(
      { error: { message: 'Internal Server Error' } },
      { status: 500 }
    );
  }
}
