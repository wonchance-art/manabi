import { callGemini } from './gemini';
import { langNameKo } from './constants';

const HAS_HANZI = /[一-鿿]/;

/**
 * 상세 설명의 중국어 예문(굵은 원문 줄) 아래에 병음 줄을 삽입한다(순수 — 오너 확정:
 * 예문/병음/뜻 3줄). 마커 ⟪py⟫는 formatDetail이 흐린 스타일로 렌더한다.
 * 저장 원문(크라우드소싱 필드)은 불변 — 표시 시점 합성이라 기존 캐시에도 소급 적용.
 * @param {string} text
 * @param {(s: string) => string} pyFn - 한자 문장 → 병음 문자열
 */
export function injectExamplePinyin(text, pyFn) {
  const lines = String(text || '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    const m = lines[i].trim().match(/^-?\s*\*\*(.+?)\*\*[.。]?$/);
    if (!m || !HAS_HANZI.test(m[1])) continue;
    const next = (lines[i + 1] || '').trim();
    if (next.startsWith('⟪py⟫')) continue; // 이미 삽입됨(로컬 캐시 재통과 등)
    const py = pyFn(m[1]);
    if (py) out.push(`⟪py⟫${py}`);
  }
  return out.join('\n');
}

/** 중국어면 병음 줄 합성(pinyin-pro 지연 로드 — 실패 시 원문 그대로), 그 외 언어는 무변경. */
async function withExamplePinyin(text, language) {
  if (language !== 'Chinese' || !text || !HAS_HANZI.test(text)) return text;
  try {
    const { pinyin } = await import('pinyin-pro');
    return injectExamplePinyin(text, (s) => pinyin(s, { toneType: 'symbol' }));
  } catch {
    return text;
  }
}

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
    try { const parsed = JSON.parse(local); if (parsed) return await withExamplePinyin(parsed, language); } catch {}
  }

  // 2. DB
  try {
    const res = await fetch(`/api/word-detail?base_form=${encodeURIComponent(baseForm)}&language=${encodeURIComponent(language)}`);
    const { detail } = await res.json();
    if (detail) {
      localSet(cacheKey, detail);
      return await withExamplePinyin(detail, language);
    }
  } catch {}

  // 3. Gemini
  const langName = langNameKo(language);
  const prompt = `"${token.text}" (${token.pos || ''})

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

  // DB + localStorage에 저장 (서버가 requireUser로 검증하므로 세션 토큰 첨부)
  localSet(cacheKey, detail);
  let authHeader = {};
  try {
    const { supabase } = await import('./supabase');
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) authHeader = { Authorization: `Bearer ${session.access_token}` };
  } catch {}
  fetch('/api/word-detail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ base_form: baseForm, language, detail_text: detail }),
  }).catch(() => {}); // fire-and-forget — 저장은 원문(병음 합성 전)

  return withExamplePinyin(detail, language);
}
