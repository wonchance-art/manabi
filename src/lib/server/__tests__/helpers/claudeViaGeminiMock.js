// 시험 장치(LLM-PROVIDER-POLICY-001): 사용자 내용 경로는 Claude만 쓰므로, Gemini 응답 모양으로 쓴 기존 fetch 목을 Claude 요청에도
// 쓰게 잇는다. Claude 요청(/v1/messages)이 오면 → 같은 프롬프트를 Gemini 요청 모양(contents[].parts[].text)으로 바꿔 안쪽 목에 넘기고,
// 안쪽 목의 Gemini 응답(candidates · 오류 상태)을 Claude 응답 모양으로 되돌린다. Gemini · Groq 요청은 그대로 통과 — 정책이 그쪽으로
// 보내면 안쪽 목에 그대로 찍혀 시험이 잡는다. 프롬프트 의미 · 호출 수는 바꾸지 않는다(요청 하나 → 안쪽 목 호출 하나).

const isClaude = (url) => String(url).includes('/v1/messages');

function toGeminiRequest(init) {
  const body = JSON.parse(init?.body || '{}');
  const textOf = (content) => (typeof content === 'string' ? content
    : (content || []).map((b) => (b?.type === 'text' ? b.text : '')).join(''));
  const contents = (body.messages || []).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: textOf(m.content) }] }));
  return { ...init, body: JSON.stringify({ contents }) };
}

async function readGemini(res) {
  const status = res?.status ?? 200;
  const ok = res?.ok ?? (status >= 200 && status < 300);
  const body = typeof res?.json === 'function' ? await res.json().catch(() => ({})) : {};
  return { ok, status, body };
}

export function claudeViaGeminiMock(inner) {
  return async (url, init) => {
    if (!isClaude(url)) return inner(url, init);
    const { ok, status, body } = await readGemini(await inner('https://generativelanguage.googleapis.com/v1beta/models/claude-test:generateContent', toGeminiRequest(init)));
    const headers = { 'content-type': 'application/json', 'request-id': 'req_test' };
    if (!ok) {
      return new Response(JSON.stringify({ type: 'error', error: { type: status === 429 ? 'rate_limit_error' : 'api_error', message: body?.error?.message || `http ${status}` } }), { status, headers });
    }
    const text = (body?.candidates?.[0]?.content?.parts || []).map((p) => p?.text || '').join('');
    return new Response(JSON.stringify({
      id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-haiku-5-5',
      content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 },
    }), { status: 200, headers });
  };
}
