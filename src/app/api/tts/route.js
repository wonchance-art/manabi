/**
 * 고품질 TTS 프록시 — Gemini TTS (gemini-3.1-flash-tts-preview)
 * GET /api/tts?text=...&lang=Japanese|English|French
 * 응답: audio/wav (PCM 24kHz mono → WAV 래핑), 불변 캐시 헤더로 CDN·브라우저 캐싱.
 * 실패 시 클라이언트(useTTS)가 브라우저 내장 음성으로 폴백.
 */

const TTS_MODEL = 'models/gemini-3.1-flash-tts-preview'; // 2.5-preview-tts 승계 — 동일 요청·PCM 응답 실측

// 언어별 프리셋 음성 (Gemini prebuilt voices)
const VOICES = {
  Japanese: 'Kore',   // 또렷하고 차분한 톤 — 일본어 학습 예문에 적합
  English:  'Puck',   // 경쾌하고 명료한 톤
  French:   'Aoede',  // 부드러운 톤 — 프랑스어 억양과 잘 어울림
};

const LANG_NAMES = { Japanese: 'Japanese', English: 'English', French: 'French' };

// IP별 레이트 리밋 (비로그인 공개 레퍼런스에서도 쓰므로 IP 기준, 캐시 미스만 도달)
const rateLimitMap = new Map();
const RATE_LIMIT = 60; // 분당(IP별)
const WINDOW_MS = 60 * 1000;
// 서버리스에서 IP 맵은 인스턴스마다 따로 존재해 총량 제어가 되지 않는다. 외부 저장소 없이
// 할 수 있는 최소한의 방어로 인스턴스 단위 총량 차단기를 둔다(비용 폭주 상한).
const INSTANCE_BUDGET = 600; // 분당(전체 IP 합계)
let instanceWindowStart = 0;
let instanceCount = 0;

function isInstanceBudgetExceeded() {
  const now = Date.now();
  if (now - instanceWindowStart > WINDOW_MS) {
    instanceWindowStart = now;
    instanceCount = 0;
  }
  instanceCount += 1;
  return instanceCount > INSTANCE_BUDGET;
}

function isRateLimited(ip) {
  const now = Date.now();
  if (rateLimitMap.size > 5000) {
    for (const [k, v] of rateLimitMap) {
      if (now - v.start > WINDOW_MS) rateLimitMap.delete(k);
    }
  }
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

/** PCM16 mono → WAV 컨테이너 래핑 */
function pcmToWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  const dataSize = pcm.length;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);          // fmt chunk size
  header.writeUInt16LE(1, 20);           // PCM
  header.writeUInt16LE(1, 22);           // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (16bit mono)
  header.writeUInt16LE(2, 32);           // block align
  header.writeUInt16LE(16, 34);          // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const text = (searchParams.get('text') || '').trim().slice(0, 160);
  const lang = searchParams.get('lang') || 'English';

  if (!text) {
    return Response.json({ error: 'text required' }, { status: 400 });
  }
  // lang을 임의 값으로 바꾸면 URL이 매번 달라져 CDN 캐시를 우회하고 유료 호출이 그대로 발생한다.
  // 지원 목록 밖은 거절해 캐시 우회 경로를 닫는다.
  if (!Object.prototype.hasOwnProperty.call(VOICES, lang)) {
    return Response.json({ error: 'unsupported lang' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip) || isInstanceBudgetExceeded()) {
    return Response.json({ error: 'rate limited' }, { status: 429 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'API key missing' }, { status: 500 });
  }

  const voiceName = VOICES[lang] || 'Kore';
  const langName = LANG_NAMES[lang] || 'English';

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${TTS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              // 지시문은 발화되지 않고 스타일로 해석됨 (Gemini TTS 사양)
              text: `Read the following ${langName} text aloud naturally and clearly, at a pace suitable for a language learner: ${text}`,
            }],
          }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName } },
            },
          },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('[tts]', res.status, errBody.slice(0, 200));
      return Response.json({ error: 'tts upstream failed' }, { status: 502 });
    }

    const data = await res.json();
    const inline = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;
    if (!inline?.data) {
      return Response.json({ error: 'no audio in response' }, { status: 502 });
    }

    const pcm = Buffer.from(inline.data, 'base64');
    const rateMatch = /rate=(\d+)/.exec(inline.mimeType || '');
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
    const wav = pcmToWav(pcm, sampleRate);

    return new Response(wav, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        // 같은 문장은 영구 캐시 — 콘텐츠가 고정 문구라 비용·지연 모두 절약
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('[tts] error', err?.message);
    return Response.json({ error: 'internal error' }, { status: 500 });
  }
}
