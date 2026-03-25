// IP별 요청 카운터 (Vercel serverless는 인스턴스 재시작 시 초기화 — 충분한 억지력)
const rateLimitMap = new Map();
const RATE_LIMIT = 20;       // 허용 횟수
const WINDOW_MS = 60 * 1000; // 1분

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.start > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT) return true;
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: { message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' } });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set");
      return res.status(500).json({ error: { message: "Server Configuration Error: API Key missing" } });
    }

    const { contents, generationConfig, model = 'models/gemini-3.1-flash-lite-preview' } = req.body;
    if (!contents) return res.status(400).json({ error: { message: "Bad Request: No contents provided" } });

    const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
    const requestBody = { contents, ...(generationConfig ? { generationConfig } : {}) };

    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    let data = await response.json();

    // 폴백: 1차 실패 시 gemini-2.5-flash 재시도
    if (!response.ok && model !== 'models/gemini-2.5-flash') {
      console.log(`[Fallback] ${model} 실패 (${response.status}). gemini-2.5-flash 재시도`);
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      data = await response.json();
    }

    if (!response.ok) return res.status(response.status).json(data);
    res.status(200).json(data);

  } catch (error) {
    console.error("Gemini API Proxy Error:", error);
    res.status(500).json({ error: { message: 'Internal Server Error' } });
  }
}
