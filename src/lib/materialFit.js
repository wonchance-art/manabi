/**
 * 자료 맞춤도(i+1) 엔진 — 서재 자료의 어휘 커버리지 산정 (rfc-material-fit R1).
 * 결정적 계산·LLM 없음: Lute의 book unknown% 선례를 우리 담김 단어장으로 옮긴 것.
 * 입력은 자료의 processed_json(목록 쿼리가 이미 통짜로 로드)과 뷰어 관용구 그대로의
 * 저장어 집합({surfaces, bases} — fetchUserVocabWords 반환형). 순수 모듈 — 조회 없음.
 */

// 커버리지 분모에서 빼는 pos — 내용어가 아닌 토큰. 문법 기능어(조사류) 지식은 문법
// 진도의 소관이고, 타입 기준이라 포함하면 소수의 고정 타입이 모든 자료의 분모를 왜곡한다.
const EXCLUDED_POS = new Set(['개행', '기호', '수사', '조사', '어기조사']);

// 밴드 최소 표본(내용어 types) — 짧은 자료의 커버리지는 잡음이라 밴드를 달지 않는다
// (EWMA 최소 표본 20과 같은 결). 커버리지 수치 자체는 그대로 돌려준다.
export const FIT_MIN_TYPES = 20;

/** 토큰의 타입 키 — base_form 우선(뷰어 저장 대조와 동일), 없으면 표면형. */
function tokenTypeKey(token) {
  const key = token?.base_form || token?.text;
  return typeof key === 'string' && key ? key : null;
}

/**
 * processed_json → 고유 내용어(types) 목록. 각 항목은 { key, text, base_form } —
 * 대조는 뷰어 isSaved 관용구(surfaces.has(text) || bases.has(base_form))를 그대로 쓰기
 * 위해 표면형·기본형을 함께 보존한다. sequence 순서(첫 등장) 유지.
 */
export function materialContentWords(processedJson) {
  const dict = processedJson?.dictionary;
  if (!dict) return [];
  const out = [];
  const seen = new Set();
  for (const tokenId of processedJson.sequence || []) {
    const t = dict[tokenId];
    if (!t || EXCLUDED_POS.has(t.pos)) continue;
    const key = tokenTypeKey(t);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, text: t.text || '', base_form: t.base_form || '' });
  }
  return out;
}

/**
 * 커버리지 산정 — 아는 말 = 담김(surfaces ∪ bases 대조, 뷰어 관용구 동일).
 * @param {object} processedJson - 자료 processed_json
 * @param {{surfaces?: Set<string>, bases?: Set<string>}} saved - fetchUserVocabWords 반환형
 * @returns {{total, known, unknown, coverage: number|null}} total 0이면 coverage null
 */
export function materialFit(processedJson, saved) {
  const words = materialContentWords(processedJson);
  const surfaces = saved?.surfaces;
  const bases = saved?.bases;
  let known = 0;
  for (const w of words) {
    if ((w.text && surfaces?.has(w.text)) || (w.base_form && bases?.has(w.base_form))) known += 1;
  }
  const total = words.length;
  return {
    total,
    known,
    unknown: total - known,
    coverage: total > 0 ? known / total : null,
  };
}

/**
 * i+1 밴드 — comfort(≥0.95 술술) · fit(0.90~0.95 스윗스팟) · stretch(0.75~0.90 도전) ·
 * hard(<0.75). 표본 부족·계산 불가는 null(무표기 — 0 무표기 결).
 * 임계값은 확장 독서 연구의 95~98%(인스턴스 기준)를 타입 기준으로 보수 조정한 저작 상수.
 */
export function fitBand(coverage, total) {
  if (coverage == null || !(total >= FIT_MIN_TYPES)) return null;
  if (coverage >= 0.95) return 'comfort';
  if (coverage >= 0.9) return 'fit';
  if (coverage >= 0.75) return 'stretch';
  return 'hard';
}

// 정렬 우선순위(목업 B [내 수준 맞춤]) — 스윗스팟 먼저, 도전, 술술, 아직, 밴드 없음 순.
const BAND_ORDER = { fit: 0, stretch: 1, comfort: 2, hard: 3 };

/** 밴드 → 정렬 랭크. 밴드 없음(null)은 맨 뒤(기존 순서 유지 조각). */
export function fitSortRank(band) {
  return band in BAND_ORDER ? BAND_ORDER[band] : 4;
}

/** 목업 B [내 수준 맞춤] — 밴드 랭크 안정 정렬(동순위·무밴드는 원래 순서 유지). 순수. */
export function sortByFit(items, bandOf) {
  return (items || [])
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (fitSortRank(bandOf(a.item)) - fitSortRank(bandOf(b.item))) || (a.index - b.index))
    .map((entry) => entry.item);
}
