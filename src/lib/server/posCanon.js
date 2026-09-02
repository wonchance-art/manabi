// 품사 정본(X — #1077 5504885559, 오너 지시 2026-09-02).
// LLM이 돌려준 문자열이 품사 칸에 그대로 들어가는 구멍이 넷 있었다 — ① 프랑스어 줄 분석 pos
// (일본어 프롬프트 폴백, 열거 없음, 복사 무검증) ② zh 문맥 판별 후보 all ③ 뜻별 meanings[].pos
// (영어만 fail-closed) ④ zh 상위 entry.pos(fetchMeanings). 셋째는 칩 → 교정 → user_verified로
// 승격돼 한 번 들어가면 자가 치유에서도 안 나온다. 토크나이저·수리 테이블은 깨끗(실측).
//
// 초기 집합은 **현재 코드가 실제로 생산하는 값**에서 뽑았다(추측 금지 — posCanon 계약이 원천
// 맵과 대조한다): zh = tokenizeZh POS_KO 값 37종, ja = tokenizeJa POS_MAP 값 14종,
// en = fetchMeanings ENGLISH_POS 11종, fr = 영어 집합 + 기호(관사·조동사는 영어와 같다).
// 집합 갱신 = 계약 갱신. 정본이 좁아 합법 품사가 null로 떨어지면 실측을 근거로 더한다.
// 순수 모듈(의존 0) — 서버 게이트와 클라이언트 2차 방어(TokenPosLabel)가 같은 집합을 본다.

const ZH = [
  '명사', '인명', '지명', '기관명', '고유명사',
  '동사', '부사성 동사', '명사성 동사',
  '형용사', '부사성 형용사', '명사성 형용사',
  '부사', '수사', '양사', '대명사', '전치사',
  '접속사', '조사', '허사', '어기조사', '의성어',
  '감탄사', '성어', '관용구', '약어', '처소사',
  '시간사', '방위사', '구별사', '상태사', '접두',
  '접미', '어소', '기호', '기타', '외국어', '수량사',
];
const JA = [
  '명사', '동사', '형용사', '형용동사', '부사', '연체사', '접속사',
  '감탄사', '조사', '조동사', '기호', '접두사', '간투사', '기타',
];
const EN = [
  '명사', '동사', '형용사', '부사', '전치사', '접속사',
  '관사', '대명사', '조동사', '감탄사', '수사',
];
const FR = [...EN, '기호'];

export const POS_CANON = Object.freeze({
  Chinese: Object.freeze(new Set(ZH)),
  Japanese: Object.freeze(new Set(JA)),
  English: Object.freeze(new Set(EN)),
  French: Object.freeze(new Set(FR)),
});

/** 네 언어의 합집합 — 언어를 모르는 자리(TokenPosLabel 2차 방어)용 */
export const POS_CANON_ALL = Object.freeze(new Set([...ZH, ...JA, ...EN, ...FR]));

/** '·' 다중 품사 → 조각 배열(공백 정리·빈 조각 제거) */
export function splitPosParts(value) {
  return String(value ?? '').split('·').map((s) => s.trim()).filter(Boolean);
}

/**
 * 정본 여부 — '·'로 갈라 **각 조각이 집합 안**이면 참. 빈 문자열은 거짓.
 * lang이 없거나 미지면 합집합으로 판정한다.
 */
export function isCanonPos(lang, value) {
  const set = POS_CANON[lang] ?? POS_CANON_ALL;
  const parts = splitPosParts(value);
  return parts.length > 0 && parts.every((p) => set.has(p));
}

/** 정본이면 정리된 문자열('·' 재결합), 아니면 null — 「미상」 관례(null)로 살아남는다 */
export function canonPosOrNull(lang, value) {
  return isCanonPos(lang, value) ? splitPosParts(value).join('·') : null;
}

/** 후보 목록에서 정본 밖 조각을 걷어낸다(zh 문맥 판별 all) */
export function filterCanonPosParts(lang, list) {
  return (Array.isArray(list) ? list : []).filter((p) => isCanonPos(lang, p));
}

/**
 * 줄 분석 토큰의 pos 게이트 — 정본 밖이면 토큰은 살리고 pos만 null(줄 실패·토큰 삭제로 번지지 않는다).
 * pos가 비어 있으면 손대지 않는다(레거시 관례 유지).
 */
export function canonizeTokenPos(token, lang) {
  if (!token || typeof token !== 'object') return token;
  const pos = token.pos;
  if (pos == null || pos === '') return token;
  return isCanonPos(lang, pos) ? token : { ...token, pos: null };
}
