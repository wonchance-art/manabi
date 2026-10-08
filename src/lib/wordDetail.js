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
 * 로컬 캐시만 본다(네트워크·AI 0) — 단어창 「더 알아보기」가 이미 받은 설명을 버튼 대신 바로 보이기 위해
 * (VIEWER-V2-ROUNDS-001 §2.1 · AE-R1 설계서 §3.3). 키는 fetchWordDetailText와 같다. 없으면 null.
 */
export async function peekWordDetailText(token, language) {
  const key = `${language}:${token.base_form || token.text}`;
  const local = localGet(key);
  if (local) {
    try { const parsed = JSON.parse(local); if (parsed) return await withExamplePinyin(parsed, language); } catch { /* 아래 메모리 캐시 */ }
  }
  const shared = sharedDetailMemo.get(key);
  return shared ? withExamplePinyin(shared, language) : null;
}

// 공유 detail_text 메모리 캐시 — `${language}:${base_form‖text}` → 설명 문자열 또는 null(없음). 실패는 담지 않는다.
const sharedDetailMemo = new Map();
const sharedDetailInflight = new Map();
/** 테스트 전용 — 메모리 캐시 비우기. */
export function resetSharedDetailMemo() { sharedDetailMemo.clear(); sharedDetailInflight.clear(); }

/**
 * 「더 알아보기」의 공유 설명 지연 조회(AE-R1 PR③ · VIEWER-V2-ROUNDS-001 §2.1 「이미 만든 결과(공유 detail_text)가 있으면
 * 버튼 대신 내용」). morpheme_dictionary.detail_text 한 열만 읽는다 — AI·/api/word-detail 0, 쓰기 0.
 * 키는 fetchWordDetailText와 같은 base_form ‖ text(그 경로가 이 행에 설명을 채운다). 같은 단어는 메모리 캐시로 다시
 * 묻지 않고(없음 포함), 실패는 조용히 null이며 기억하지 않는다(다음 열람에 다시 시도). 원문을 그대로 돌려준다
 * (병음 합성은 peekWordDetailText가 표시 때 한다).
 * @returns {Promise<string|null>}
 */
export async function fetchSharedDetailText(client, token, language) {
  const baseForm = token?.base_form || token?.text;
  if (!client || !baseForm || !language) return null;
  const key = `${language}:${baseForm}`;
  if (sharedDetailMemo.has(key)) return sharedDetailMemo.get(key);
  if (sharedDetailInflight.has(key)) return sharedDetailInflight.get(key);
  const request = (async () => {
    try {
      const { data, error } = await client.from('morpheme_dictionary').select('detail_text')
        .eq('language', language).eq('base_form', baseForm).maybeSingle();
      if (error) return null;
      const detail = typeof data?.detail_text === 'string' && data.detail_text.trim() ? data.detail_text : null;
      sharedDetailMemo.set(key, detail);
      return detail;
    } catch {
      return null;
    } finally {
      sharedDetailInflight.delete(key);
    }
  })();
  sharedDetailInflight.set(key, request);
  return request;
}

/**
 * 단어 상세 설명 가져오기 — DB → localStorage → Gemini (3단 캐시)
 * @returns {Promise<string>} detail text
 */
export async function fetchWordDetailText(token, language) {
  // 어휘 키 = sep_link ?? base_form — 이합사 O 조각(道了歉의 歉)은 VO(道歉)로 조회·저장한다. 카드 조회·
  // 단어장 저장·만남과 같은 규칙(뷰어 v2 AE-R2 §5.3). 예전 歉 키(localStorage·DB 행)는 읽지 않을 뿐 지우지 않는다.
  const baseForm = token.sep_link || token.base_form || token.text;
  const cacheKey = `${language}:${baseForm}`;
  // 프롬프트 표제: 중국어는 굴절이 없어 어휘 키가 곧 표제(이합사 두 조각 모두 VO). 그 밖의 언어는 기존대로 표면형.
  const headword = (token.sep_link || language === 'Chinese') ? baseForm : token.text;

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
  const prompt = `"${headword}" (${token.pos || ''})

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
