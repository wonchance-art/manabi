// U R1 — 커버리지를 추천 랭킹에 잇는다 (#1077 5503520174, 오너 「일단 다 발주 ㄱㄱ」 2026-09-02).
// 홈은 이미 개인화하고 있었다(선호 언어 > 레벨 문자열 일치 > 같은 레벨군) — 다만 ⑴ 단어 **개수**로
// 레벨을 추측할 뿐 그 자료에 내가 아는 단어가 실제로 몇 %인지는 보지 않았고 ⑵ 상위 한 장만 쓰고
// 나머지 순위를 버렸고 ⑶ 왜 이 카드인지 화면에 없었다. 이 모듈은 셋을 고친다.
// 순수 모듈 — DB 조회 없음. 저장어 집합·커버리지(materialFit)는 호출부(HomePage)가 넣는다.
// 랭킹이지 필터가 아니다: 카드 수가 줄지 않고, 무작위·시간 의존이 없어 같은 입력이면 같은 순서.

import { FIT_MIN_TYPES } from './materialFit';

/** i+1 대역 — 미지어 비율 2%~15%. 대역 중앙에 가까울수록 높은 점수(계약 고정). */
export const FIT_BAND = Object.freeze({ min: 0.02, max: 0.15 });
/** 홈에 그리는 상위 장수 */
export const SUGGESTION_TOP_N = 4;
/** 사유 코드 — 문구는 뷰(HomePage) 소관, 여기는 코드만 */
export const REASON = Object.freeze({
  FIT: 'fit',            // 대역 안(커버리지 산정됨)
  FIT_EASY: 'fit_easy',  // 대역 아래 — 술술
  FIT_HARD: 'fit_hard',  // 대역 위 — 도전
  LEVEL: 'level',        // 커버리지 없음, 레벨 일치(현행 점수)
  LEVEL_NEAR: 'level_near',
  LANG: 'lang',
  OTHER: 'other',
});

const center = (FIT_BAND.min + FIT_BAND.max) / 2;
const half = (FIT_BAND.max - FIT_BAND.min) / 2;

/** 대역 근접도 — 대역 안은 0~1(중앙 1), 밖은 음수(멀수록 작다). 결정적. */
export function fitCloseness(unknownRatio) {
  if (typeof unknownRatio !== 'number' || Number.isNaN(unknownRatio)) return -Infinity;
  const d = Math.abs(unknownRatio - center);
  return d <= half ? 1 - d / half : -(d - half);
}

/** 커버리지 결과가 밴드를 달 자격이 있나 — FIT_MIN_TYPES 미만 표본은 잡음(기존 계약 재사용) */
export function usableFit(fit) {
  return !!fit && typeof fit.coverage === 'number' && fit.total >= FIT_MIN_TYPES;
}

/**
 * @param {Array} cards - 추천 카드(daily_suggestions 행)
 * @param {{ langs?: string[], fitOf?: (card) => ({total, coverage}|null), levelOf?: (card) => string|null }} deps
 *   fitOf: material_id가 있는 카드의 materialFit 결과(없으면 null). levelOf: 그 언어의 이상 레벨(getIdealLevel).
 * @returns {Array} 같은 카드들(개수 불변)에 rank {score, reason, unknownRatio, langMatch}를 붙여 정렬한 배열
 */
export function rankSuggestions(cards, { langs = [], fitOf = () => null, levelOf = () => null } = {}) {
  const list = Array.isArray(cards) ? cards : [];
  const decorated = list.map((card, index) => {
    const langMatch = langs.includes(card?.language) ? 1 : 0;
    const fit = fitOf(card);
    const hasFit = usableFit(fit);
    const unknownRatio = hasFit ? 1 - fit.coverage : null;
    const closeness = hasFit ? fitCloseness(unknownRatio) : null;
    const ideal = levelOf(card);
    const level = card?.level;
    const levelScore = ideal && level === ideal ? 2 : (ideal && typeof level === 'string' && level.startsWith(ideal[0]) ? 1 : 0);
    let reason;
    if (hasFit) reason = closeness >= 0 ? REASON.FIT : (unknownRatio < FIT_BAND.min ? REASON.FIT_EASY : REASON.FIT_HARD);
    else if (levelScore === 2) reason = REASON.LEVEL;
    else if (levelScore === 1) reason = REASON.LEVEL_NEAR;
    else reason = langMatch ? REASON.LANG : REASON.OTHER;
    return { card, index, langMatch, hasFit, closeness, levelScore, unknownRatio, reason, createdAt: String(card?.created_at || '') };
  });
  decorated.sort((a, b) =>
    (b.langMatch - a.langMatch)                          // ⑴ 선호 언어
    || (Number(b.hasFit) - Number(a.hasFit))             // ⑵ 커버리지 산정된 카드 우선
    // ⑶ 둘 다 산정됐으면 대역 근접, 아니면 ⑷ 현행 레벨 점수 — 조건을 a 하나로 걸면 비교자가 비대칭이 되어
    // (null - x는 NaN이 아니라 -x) 정렬 결과가 호출 순서에 따라 갈린다(변이 A가 살아남은 원인, 실측)
    || ((a.hasFit && b.hasFit) ? (b.closeness - a.closeness) : (b.levelScore - a.levelScore))
    || (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0)      // 동점: created_at 오름차순
    || (a.index - b.index));                              // 그래도 같으면 원래 순서(안정)
  return decorated.map((d) => ({
    ...d.card,
    rank: { reason: d.reason, langMatch: !!d.langMatch, unknownRatio: d.unknownRatio, score: d.hasFit ? d.closeness : d.levelScore },
  }));
}
