/**
 * 자료 난이도 지표(MATERIAL-DIFFICULTY-001 — 오케스트레이터 순회 2026-11-07 16:25 KST, 백엔드 · 데이터만, 화면 노출은 목업 대상).
 * 사용자와 무관한 자료 자체의 숫자 — 토큰 수 · 고유 내용어 수 · 레벨 표 기준 분포. 순수 모듈(조회 없음, LLM 없음).
 *
 * 새 계산식을 세우지 않는다(제품 나침반 3문 ⑵):
 *   - 「고유 내용어」는 맞춤도 엔진의 정본 materialContentWords(materialFit.js — 같은 제외 품사 · 같은 base_form 우선 키)를 그대로 쓴다.
 *   - 레벨은 단어 페이지 찾기 색인의 정본 행([표제어, 읽기, 뜻, 급수] — levelListData.chineseLevelIndex · japaneseLevelIndex)을 그대로 쓴다.
 *   - 사용자별 i+1 판정(materialFit · fitBand · suggestionRank FIT_BAND)은 바꾸지 않는다 — 이 지표는 그 옆의 자료 쪽 사실이다.
 * 레벨 숫자는 색인 그대로 둔다: 중국어 HSK 1~7(클수록 어려움), 일본어 JLPT 5~1(작을수록 어려움). 언어 사이 비교는 하지 않는다.
 */
import { materialContentWords } from './materialFit';

/**
 * 색인 행 → Map(표제어 → 급수). 같은 표제어가 여러 번 있으면 처음 것.
 * withReadings: 일본어 — 읽기(가나)도 키로 싣는다. 초급 자료는 えいが처럼 가나로 쓰여 한자 표제어(映画)와 맞지 않는다.
 *   표제어가 먼저 이기고, 같은 읽기가 여럿이면(동음이의) 쉬운 급수를 쓴다 — 자료 난이도 집계용이라 보수적(쉬운 쪽) 판정이다.
 */
export function levelMapFromIndex(rows, { withReadings = false, easier = (a, b) => a < b } = {}) {
  const map = new Map();
  for (const row of rows || []) {
    const [word, , , level] = row || [];
    if (typeof word === 'string' && word && Number.isFinite(level) && !map.has(word)) map.set(word, level);
  }
  if (withReadings) {
    const byReading = new Map();
    for (const row of rows || []) {
      const [, reading, , level] = row || [];
      if (typeof reading !== 'string' || !reading || !Number.isFinite(level)) continue;
      const prev = byReading.get(reading);
      if (prev == null || easier(level, prev)) byReading.set(reading, level);
    }
    for (const [reading, level] of byReading) if (!map.has(reading)) map.set(reading, level);
  }
  return map;
}

/** 쉬움 → 어려움 순으로 급수를 늘어놓는 비교 — 중국어는 오름차순, 일본어(N5 → N1)는 내림차순. */
export function levelOrder(language) {
  return language === 'Japanese' ? (a, b) => b - a : (a, b) => a - b;
}

/** 최근접 순위 분위수(nearest-rank) — 정렬된 배열에서 ⌈q·n⌉번째. */
function quantile(sorted, q) {
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil(q * sorted.length - 1e-9) - 1)];
}

/**
 * @param {object} processedJson - 자료 processed_json(분석 완료본)
 * @param {Map<string, number>} levelMap - levelMapFromIndex 결과(언어마다 하나). 없으면 분포 없이 토큰 · 고유어만.
 * @param {string} [language] - 'Chinese' | 'Japanese' | 그 밖 — 급수 정렬 방향만 정한다
 * @returns {{ tokens, types, listed, unlisted, listedShare, byLevel, medianLevel, p90Level }}
 *   tokens = 개행 · 기호를 뺀 토큰 수(인스턴스), types = 고유 내용어 수(맞춤도 엔진과 같은 분모),
 *   byLevel = { 급수: 고유어 수 }, listedShare = 표에 있는 고유어 비율, median/p90 = 표에 있는 고유어 급수의 중앙 · 90번째(쉬움 → 어려움 순).
 */
export function materialDifficulty(processedJson, levelMap, language) {
  const dict = processedJson?.dictionary || {};
  let tokens = 0;
  for (const id of processedJson?.sequence || []) {
    const t = dict[id];
    if (t && t.pos !== '개행' && t.pos !== '기호' && typeof t.text === 'string' && t.text.trim()) tokens += 1;
  }
  const words = materialContentWords(processedJson);
  const byLevel = {};
  const levels = [];
  for (const w of words) {
    const level = levelMap?.get(w.base_form) ?? levelMap?.get(w.text) ?? null;
    if (level == null) continue;
    byLevel[level] = (byLevel[level] || 0) + 1;
    levels.push(level);
  }
  levels.sort(levelOrder(language));
  const types = words.length;
  return {
    tokens,
    types,
    listed: levels.length,
    unlisted: types - levels.length,
    listedShare: types > 0 ? levels.length / types : null,
    byLevel,
    medianLevel: quantile(levels, 0.5),
    p90Level: quantile(levels, 0.9),
  };
}
