// ⑤ 유의어·반의어(오너 승인 2026-08-19) — 단어 카드의 뜻 자리 아래 자동 표시.
// 공개 데이터는 검토 후 배제(일본어 WordNet: 수십 MB·일본어 한정, 하얼빈공대
// 同义词词林: 연구용 라이선스, CC-CEDICT: 유의어 필드 없음) — 기존 Gemini relay +
// 캐시 선례(wordDetail)의 축소판. DB 공유 캐시는 v1 보류(morpheme_dictionary
// 스키마 하드리밋 + detail_text 덮어쓰기 금지 정책이라 끼워 넣을 자리가 없다) —
// localStorage만 쓴다. 빈 결과도 캐시해 재호출 루프를 막는다.

import { callGemini, parseGeminiJSON } from './gemini';
import { langNameKo } from './constants';

// 내용어만 조회 — 기능어(조사·어미·기호·접속사 등)의 유의어는 무의미하고 호출 낭비다.
// pos가 겸류(pos_all '동사·명사')면 후보 중 하나라도 내용어면 허용.
const CONTENT_POS = ['명사', '동사', '형용사', '부사', '형용동사', '성어', '관용구', '숙어'];

export function synAntEligible(token, language) {
  if (!token?.text?.trim() || !token?.meaning || !language) return false;
  const posAll = `${token.pos || ''}·${token.pos_all || ''}`;
  return CONTENT_POS.some((p) => posAll.includes(p));
}

const CAP = { syn: 4, ant: 2 };

/** 모델 응답 → { syn, ant } — 형식이 어긋난 항목은 조용히 버린다(빈 배열 허용). */
export function parseSynAnt(raw) {
  let obj;
  try { obj = typeof raw === 'string' ? parseGeminiJSON(raw) : raw; } catch { return { syn: [], ant: [] }; }
  const clean = (list, cap) => (Array.isArray(list) ? list : [])
    .filter((x) => x && typeof x.w === 'string' && x.w.trim())
    .map((x) => ({
      w: x.w.trim(),
      r: typeof x.r === 'string' ? x.r.trim() : '',
      ko: typeof x.ko === 'string' ? x.ko.trim() : '',
    }))
    .slice(0, cap);
  return { syn: clean(obj?.syn, CAP.syn), ant: clean(obj?.ant, CAP.ant) };
}

// v1: 프롬프트·형식이 바뀌면 버전을 올려 낡은 캐시를 자연 폐기한다(재분석 캐시 선례).
export function synAntCacheKey(language, baseForm) {
  return `pdf_cache:synant:v1:${language}:${baseForm}`;
}

export function buildSynAntPrompt(token, language) {
  const langName = langNameKo(language);
  const readingLabel = language === 'Chinese' ? '성조 부호 병음'
    : language === 'Japanese' ? '요미가나' : '발음';
  return `"${token.base_form || token.text}" (${langName}, 뜻: ${token.meaning})의 유의어와 반의어.

JSON만 출력:
{"syn":[{"w":"단어","r":"읽기","ko":"한국어 뜻"}],"ant":[{"w":"단어","r":"읽기","ko":"한국어 뜻"}]}

규칙:
- ${langName} 단어만. syn 최대 4개, ant 최대 2개
- r는 ${readingLabel}
- 확실한 것만 — 마땅한 것이 없으면 빈 배열 []
- JSON 외 텍스트 금지`;
}

function cacheGet(key) {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function cacheSet(key, val) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/** 유의어·반의어 조회 — localStorage 캐시 → Gemini(초소형 프롬프트) 2단. */
export async function fetchSynAnt(token, language) {
  const key = synAntCacheKey(language, token.base_form || token.text);
  const cached = cacheGet(key);
  if (cached && Array.isArray(cached.syn) && Array.isArray(cached.ant)) return cached;
  const raw = await callGemini(buildSynAntPrompt(token, language));
  const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw || '';
  const parsed = parseSynAnt(text);
  cacheSet(key, parsed);
  return parsed;
}
