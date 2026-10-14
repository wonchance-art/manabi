// HSK 단어 급수 — 화면 표시 정본 (ZH-LEVEL-2026-001 — 오너 결정 2026-10-13 KST: 급수 기준은 HSK 2026).
// 데이터: src/lib/data/zhHsk2026Level.json — 10,896단어 {단어: 1~7} (7 = 7–9 통합 밴드).
//   원천 《中文水平考试 HSK 考试大纲》(中外语言交流合作中心, 2025-11 발표 · 2026-07 시행) 词汇大纲,
//   설계 정본 docs/design/hsk2026/words.json, 생성 scripts/build-zh-hsk2026.mjs.
//
// 화면에 단어의 HSK 급수를 보이는 곳은 전부 이 모듈 하나를 쓴다 — 뷰어 단어창 메타 줄, 단어장 행·급수 필터,
// 그리고 앞으로 붙을 레벨 화면 중국어 목록(LEVEL-LIST-AJ-001)과 한자 탭(HANZI-TAB-AL-001)도
// zhHskLevelOf + zhHskLevelLabel을 쓴다(자리마다 표를 따로 읽으면 급수가 갈린다 — zhHskLevelSites 계약).
// 우리 사전 vocab 세트 파일의 위치(h1~h6 = 옛 급수)는 표시 급수가 아니다. 2026 표에 없는 단어는 급수 없음(null).
//
// 분절 방벽은 이 표를 쓰지 않는다 — server/zhTokenFix.js의 isZhRealWord는 2021 표(zhHskLevel.json)
// 그대로다(바꾸면 분절이 달라진다).
//
// 120KB 표라 정적 import하지 않고 지연 로드한다(viewerHanjaPanel·hanjaEtym 선례) — 중국어 화면에서만 1회 받는다.

import { useEffect, useState } from 'react';

export const ZH_HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7];

let levelsPromise = null;

/** 2026 급수 표 로드 — 1회 받아 캐시. */
export function loadZhHskLevels() {
  // 실패한 로드는 캐시하지 않는다 — 복습 급수 범위의 「다시 시도」가 다시 받을 수 있게(REV-SCOPE-R1A).
  levelsPromise ||= import('./data/zhHsk2026Level.json').then((m) => m.default || m)
    .catch((error) => { levelsPromise = null; throw error; });
  return levelsPromise;
}

/** 표 훅 — enabled(중국어 화면)일 때만 받는다. 꺼져 있거나 받는 중이면 null. */
export function useZhHskLevels(enabled) {
  const [levels, setLevels] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    loadZhHskLevels().then((t) => { if (alive) setLevels(t); }).catch(() => {});
    return () => { alive = false; };
  }, [enabled]);
  return enabled ? levels : null;
}

/** 단어의 HSK 2026 급수(1~7, 7 = 7–9 밴드). 표에 없거나 표가 아직 없으면 null. */
export function zhHskLevelOf(word, levels) {
  if (!word || !levels || !Object.hasOwn(levels, word)) return null;
  const level = levels[word];
  return Number.isInteger(level) ? level : null;
}

/** 급수 → 화면 라벨. 1~6 = 「HSK n」, 7 = 「HSK 7–9」, 그 외 null(표시 없음). */
export function zhHskLevelLabel(level) {
  if (level === 7) return 'HSK 7–9';
  return Number.isInteger(level) && level >= 1 && level <= 6 ? `HSK ${level}` : null;
}

/**
 * 자료 난이도 프로필 — materialContentWords 산출(고유 내용어 {key,text,base_form})과
 * 저장어 집합(fetchUserVocabWords 반환형), 급수 표(loadZhHskLevels 결과)를 받아 급수 분포를 센다.
 * 표면형 우선, 기본형 폴백.
 * - byLevel[1..7]: 전체 내용어의 급수 분포(미등재는 untagged).
 * - unknownByLevel[1..7]: 모르는 말(미담김)만의 분포 — "이 자료가 요구하는 다음 어휘"의 높이.
 * - unknownMedianLevel: 모르는 말 급수의 중앙값(등재분 기준) — 자료 대표 난이도 한 숫자.
 * 표본이 없으면 null 필드(0 무표기 결).
 */
export function zhHskProfile(contentWords, saved, levels) {
  const surfaces = saved?.surfaces;
  const bases = saved?.bases;
  const byLevel = Object.fromEntries(ZH_HSK_LEVELS.map((l) => [l, 0]));
  const unknownByLevel = Object.fromEntries(ZH_HSK_LEVELS.map((l) => [l, 0]));
  let tagged = 0;
  let untagged = 0;
  const unknownLevels = [];
  for (const w of contentWords || []) {
    const level = zhHskLevelOf(w.text, levels) ?? zhHskLevelOf(w.base_form, levels);
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
