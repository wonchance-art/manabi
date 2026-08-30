'use client';
// 탭 단어 문맥 설명 R1 클라이언트(오너 승인 2026-08-30) — 카드의 [이 문장에서는?] 버튼이
// 호출한다. 즉답 카드를 막지 않는 지연 로드이고, (언어, 문장, 단어) 단위 localStorage
// 캐시로 재탭·재독을 무호출로 만든다(wordDetail 3단 캐시의 경량형 — 문장별이라 공유
// 사전(DB) 층은 두지 않는다).

const keyOf = (language, sentence, word) =>
  `ctx_explain:${language}:${word}:${String(sentence).slice(0, 120)}`;

function localGet(key) {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function localSet(key, val) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* 용량 초과 등 무시 */ }
}

/**
 * 문맥 설명 조회 — 실패 시 throw(호출부가 재시도 버튼으로 수렴).
 * @returns {Promise<string>} 설명 텍스트
 */
export async function fetchCtxExplain({ language, sentence, token, materialId, tokenKey }) {
  const word = token.text;
  const cacheKey = keyOf(language, sentence, word);
  const cached = localGet(cacheKey);
  if (typeof cached === 'string' && cached) return cached;

  let authHeader = {};
  try {
    const { supabase } = await import('./supabase');
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) authHeader = { Authorization: `Bearer ${session.access_token}` };
  } catch { /* 미로그인 — 서버가 401로 답한다 */ }

  const res = await fetch('/api/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({
      language,
      token: { sentence, word, base: token.base_form || '', pos: token.pos || '' },
      materialId: materialId || '',
      tokenKey: tokenKey || '',
    }),
  });
  const data = await res.json().catch(() => null);
  const text = data?.explanation;
  if (!res.ok || !text) throw new Error(data?.error?.message || 'explain failed');
  localSet(cacheKey, text);
  return text;
}
