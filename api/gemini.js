export default async function handler(req, res) {
    // 1. CORS 처리 (다른 출처 요청 허용, Vercel 기본 설정 보완)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // OPTIONS 요청에 대한 빠른 응답 (CORS Preflight)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("GEMINI_API_KEY is not set in environment variables");
            return res.status(500).json({ error: { message: "Server Configuration Error: API Key missing" } });
        }

        // 클라이언트로부터 전달받은 설정 추출
        const { contents, generationConfig, model = 'models/gemini-3.1-flash-lite' } = req.body;
        
        if (!contents) {
            return res.status(400).json({ error: { message: "Bad Request: No contents provided" } });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;

        const requestBody = { contents };
        if (generationConfig) {
            requestBody.generationConfig = generationConfig;
        }

        // 구글 Gemini 서버로 요청 전달
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        // 5. 결과를 클라이언트에게 반환
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.status(200).json(data);

    } catch (error) {
        console.error("Gemini API Proxy Error:", error);
        res.status(500).json({ error: { message: 'Internal Server Error' } });
    }
}
