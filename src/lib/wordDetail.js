import { callGemini } from './gemini';

function localGet(key) {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(`pdf_cache:detail:${key}`); } catch { return null; }
}
function localSet(key, val) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(`pdf_cache:detail:${key}`, JSON.stringify(val)); } catch {}
}

/**
 * 단어 상세 설명 가져오기 — DB → localStorage → Gemini (3단 캐시)
 * @returns {Promise<string>} detail text
 */
export async function fetchWordDetailText(token, language) {
  const baseForm = token.base_form || token.text;
  const cacheKey = `${language}:${baseForm}`;

  // 1. localStorage
  const local = localGet(cacheKey);
  if (local) {
    try { const parsed = JSON.parse(local); if (parsed) return parsed; } catch {}
  }

  // 2. DB
  try {
    const res = await fetch(`/api/word-detail?base_form=${encodeURIComponent(baseForm)}&language=${encodeURIComponent(language)}`);
    const { detail } = await res.json();
    if (detail) {
      localSet(cacheKey, detail);
      return detail;
    }
  } catch {}

  // 3. Gemini
  const langName = language === 'Japanese' ? '일본어' : '영어';
  const prompt = `"${token.text}" (${token.pos || ''})
${language === 'English' ? '\n**발음**\nIPA 발음 기호\n' : ''}
**뜻**
1. 간결한 뜻 (3~5단어)
2. 간결한 뜻

**뉘앙스**
1~2문장. 비슷한 단어와 차이.

**예문**
- **원문 예문.**
한국어 번역
- **원문 예문.**
한국어 번역

위 형식 정확히 따라 출력. 규칙:
- 도입/인사/설명 문구 금지. 바로 시작
- 뜻은 괄호 보충 없이 짧게
- 예문은 **굵은 원문** 다음 줄에 한국어 번역
- ${langName} → 한국어`;

  const raw = await callGemini(prompt);
  const detail = raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw || '';

  // DB + localStorage에 저장
  localSet(cacheKey, detail);
  fetch('/api/word-detail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_form: baseForm, language, detail_text: detail }),
  }).catch(() => {}); // fire-and-forget

  return detail;
}
