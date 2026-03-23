const https = require('https');

async function testGemini() {
    const apiKey = 'AIzaSyDxFYhMH8QYLkEqLqVjRmVYAXUp_WT0Vp4';
    const escapedLine = "very incredible beautiful | ";

    const prompt = `[최우선 명령]
입력된 텍스트 " ${escapedLine} "를 반드시 가장 작은 단위의 단어(word)와 기호, 공백으로 완전히 분해(Tokenization)해야 합니다.

1. 데이터 구조 (Index Mapping):
   - "sequence": ["0", "1", "2"] 형태로 분해된 모든 요소를 순서대로 담을 것.
   - "dictionary": {"0": {...}, "1": {...}} 형태로 정보를 매핑.

2. 분석 규칙 (절대 엄수):
   - ⚠️ 두 개 이상의 단어를 절대 하나로 묶지 마세요! (예: "really super"를 하나의 객체로 만들면 안 됨. "really", " ", "super"로 반드시 나눌 것)
   - 띄어쓰기(공백 " ")도 반드시 독립된 텍스트 토큰으로 분리하세요. (pos: "공백" 처리)
   - 각 단어 토큰에는 'pos' (품사), 'meaning' (한국어 뜻), 'furigana' (영어는 발음기호 / / 형태) 필드를 100% 필수적으로 채워넣으세요. 빈 값은 허용되지 않습니다.

3. 예시: "a big | apple"
   sequence: ["0", "1", "2", "3", "4", "5", "6"]
   dictionary: {
     "0": {"text": "a", "pos": "관사", "furigana": "/ə/", "meaning": "하나의"},
     "1": {"text": " ", "pos": "공백", "furigana": "", "meaning": ""},
     "2": {"text": "big", "pos": "형용사", "furigana": "/bɪg/", "meaning": "큰"},
     "3": {"text": " ", "pos": "공백", "furigana": "", "meaning": ""},
     "4": {"text": "|", "pos": "기호", "furigana": "", "meaning": ""},
     "5": {"text": " ", "pos": "공백", "furigana": "", "meaning": ""},
     "6": {"text": "apple", "pos": "명사", "furigana": "/ˈæp.əl/", "meaning": "사과"}
   }

위 규칙을 완벽히 지켜 설명 없이 순수한 JSON 객체만 응답하세요.`;

    const data = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
            responseBody += chunk;
        });
        res.on('end', () => {
            const parsed = JSON.parse(responseBody);
            if (parsed.error) {
                console.error("API Error:", parsed.error.message);
            } else {
                console.log(parsed.candidates[0].content.parts[0].text);
            }
        });
    });

    req.on('error', (error) => {
        console.error(error);
    });

    req.write(data);
    req.end();
}

testGemini();
