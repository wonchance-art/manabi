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

/**
 * 책 단위 커버리지(R2) — 챕터들의 내용어 types를 **합집합**으로 모아 산정한다.
 *
 * 챕터별 coverage의 평균이 아니다: 같은 단어가 여러 과에 나오면 한 번만 세야
 * "1,300단어 중 몇 개를 아는가"가 참말이 된다. 어휘 교재는 의도적으로 단어를 재출현시키므로
 * 평균을 쓰면 아는 단어가 반복 가산돼 커버리지가 부풀려진다.
 *
 * 미분석 챕터(dictionary 없음)는 자연히 0개를 기여한다 — 그래서 analyzed를 함께 돌려
 * 소비 화면이 "분석한 3과 기준"이라고 말할 수 있게 한다(부분 분석 상태를 전체인 척
 * 말하지 않기 위한 것 — 0 무표기와 같은 결).
 *
 * @param {Array<{processed_json?: object}>} chapters - 같은 책의 자료 행들
 * @param {{surfaces?: Set<string>, bases?: Set<string>}} saved - materialFit과 같은 인덱스
 * @returns {{total, known, unknown, coverage: number|null, analyzed: number, chapters: number}}
 */
export function bookFit(chapters, saved) {
  const list = chapters || [];
  const seen = new Map();
  let analyzed = 0;
  for (const ch of list) {
    const words = materialContentWords(ch?.processed_json);
    if (words.length > 0) analyzed += 1;
    for (const w of words) if (!seen.has(w.key)) seen.set(w.key, w);
  }
  const surfaces = saved?.surfaces;
  const bases = saved?.bases;
  let known = 0;
  for (const w of seen.values()) {
    if ((w.text && surfaces?.has(w.text)) || (w.base_form && bases?.has(w.base_form))) known += 1;
  }
  const total = seen.size;
  return {
    total,
    known,
    unknown: total - known,
    coverage: total > 0 ? known / total : null,
    analyzed,
    chapters: list.length,
  };
}
