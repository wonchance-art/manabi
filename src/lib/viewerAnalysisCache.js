'use client';
// 드래그 지정 문장의 분석 결과 캐시(§C4 재정의 — 오너 승인 발주의 '판별 캐시' 목표를
// 더 상류에서 달성한다).
//
// 실측 근거: 문맥 판별(disambiguateZhPos/EnPos)은 요청당 최대 1회이고 뜻 조회와 병렬이라
// 벽시계 추가가 0이며, 요청 내 중복도 이미 제거된다. 즉 '판별만' 캐시해도 절감폭이 작다.
// 반면 드래그 경로는 좌측 번역(viewer_tx)만 캐시하고 /api/analyze는 매번 재호출하는
// 비대칭이 있었다 — 같은 문장을 다시 지정하면 판별 1회 + 뜻 조회 배치가 통째로 재실행된다.
// 요청 자체를 캐시하면 판별까지 함께 절감된다.
//
// 무효화(발주 필수 조건): 교정·승격으로 사전이 바뀌면 캐시된 뜻이 낡으므로 전량 비운다.
// 사전 정본(morpheme_dictionary)은 건드리지 않으므로 user_verified 보호 계약과 무관하다.

const PREFIX = 'viewer_an:';

export function analysisCacheKey(language, text) {
  return `${PREFIX}${language}:${String(text || '').slice(0, 200)}`;
}

/** 캐시된 토큰 배열 — 형식이 어긋나면 null(무시하고 새로 조회). */
export function readAnalysisCache(storage, key) {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((t) => t && typeof t.text === 'string') ? parsed : null;
  } catch {
    return null;
  }
}

/** 빈 결과는 저장하지 않는다(분석 실패를 캐시로 굳히지 않기 위해). */
export function writeAnalysisCache(storage, key, tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return false;
  try {
    storage.setItem(key, JSON.stringify(tokens));
    return true;
  } catch {
    return false; // 용량 초과 등은 무시 — 캐시는 부가 기능
  }
}

/** 교정·승격 후 무효화 — 이 프리픽스만 지운다(다른 캐시는 보존). */
export function clearAnalysisCache(storage) {
  let removed = 0;
  try {
    const keys = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) { storage.removeItem(k); removed++; }
  } catch { /* 접근 불가 환경은 무시 */ }
  return removed;
}
