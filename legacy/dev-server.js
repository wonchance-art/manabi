const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 모키(Mock) Vercel Serverless Function 라우팅
app.post('/api/gemini', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: { message: "API Key missing" } });
        }

        const { contents, generationConfig, model = 'models/gemini-2.5-flash' } = req.body;
        const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;

        const requestBody = { contents };
        if (generationConfig) requestBody.generationConfig = generationConfig;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        res.status(500).json({ error: { message: error.message } });
    }
});

// 정적 파일 서빙 (현 디렉토리)
app.use(express.static(path.join(__dirname, '')));

app.listen(8080, () => {
    console.log('Local test server running on http://localhost:8080');
});
