// HSK 3.0 급수 정본 조회 + 자료 난이도 프로필 (분석 개선 R3 — 오너 승인 2026-08-29).
// 데이터: src/lib/data/zhHskLevel.json — 10,935단어 {단어: 1~7} (7 = 7-9 통합밴드).
//   원천 ivankra/hsk30(MIT, 공식 HSK 3.0 목록 정리본), 생성 scripts/build-zh-hsk.mjs.
// 순수 모듈 — 조회 없음. materialFit(커버리지)과 같은 계층: 엔진 먼저, UI 노출은
// 텍스트 목업 합의 후(서재 i+1 R1→R2 선례). 클라이언트 화면에 붙일 때는 120KB
// 데이터를 지연 로드(hanjaEtym 선례)로 — 이 모듈을 정적 import하는 화면을 만들지 말 것.

import ZH_HSK_LEVEL from './data/zhHskLevel.json';

/** 단어의 HSK 급수(1~7, 7 = 7-9 밴드). 표면형 우선, 기본형 폴백. 미등재는 null. */
export function zhHskLevelOf(word) {
  const level = ZH_HSK_LEVEL[word];
  return Number.isInteger(level) ? level : null;
}

/**
 * 자료 난이도 프로필 — materialContentWords 산출(고유 내용어 {key,text,base_form})과
 * 저장어 집합(fetchUserVocabWords 반환형)을 받아 급수 분포를 센다.
 * - byLevel[1..7]: 전체 내용어의 급수 분포(미등재는 untagged).
 * - unknownByLevel[1..7]: 모르는 말(미담김)만의 분포 — "이 자료가 요구하는 다음 어휘"의 높이.
 * - unknownMedianLevel: 모르는 말 급수의 중앙값(등재분 기준) — 자료 대표 난이도 한 숫자.
 * 표본이 없으면 null 필드(0 무표기 결).
 */
export function zhHskProfile(contentWords, saved) {
  const surfaces = saved?.surfaces;
  const bases = saved?.bases;
  const byLevel = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((l) => [l, 0]));
  const unknownByLevel = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((l) => [l, 0]));
  let tagged = 0;
  let untagged = 0;
  const unknownLevels = [];
  for (const w of contentWords || []) {
    const level = zhHskLevelOf(w.text) ?? zhHskLevelOf(w.base_form);
    if (level == null) { untagged += 1; continue; }
    tagged += 1;
    byLevel[level] += 1;
    const known = (w.text && surfaces?.has(w.text)) || (w.base_form && bases?.has(w.base_form));
    if (!known) {
      unknownByLevel[level] += 1;
      unknownLevels.push(level);
    }
  }
  unknownLevels.sort((a, b) => a - b);
  const mid = unknownLevels.length
    ? unknownLevels[Math.floor((unknownLevels.length - 1) / 2)]
    : null;
  return { tagged, untagged, byLevel, unknownByLevel, unknownMedianLevel: mid };
}
