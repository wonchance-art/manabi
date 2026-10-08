// 「뜻 확인 필요 N개」 목록(뷰어 v2 AD-R4 PR③ — 설계서 docs/manabi-viewer-v2-ad-r4.md §6·§7) — 순수 함수.
// 재료는 분석 결과 토큰의 내부 표식 `meaningCheck`('ctx' | 'doubt')뿐이다. 서버(PR②)가 상수 ZH_SENSE_REVIEW를 켰을 때만
// 붙이므로, 상수가 꺼져 있는 지금은 운영 자료에 표식이 없어 목록·줄·카드 ⓘ가 모두 0이다.
// 「AI」 표시는 없다(오너 결정 2026-10-07 23:45 KST). 표식은 화면 안내(줄·목록·카드 ⓘ)에만 쓴다.
// 쓰기는 이 파일에 없다 — 목록 교정은 기존 correctTokenMutation(AE-R1 PR③ 사전 뜻 교정 경로)이 한다.

import { buildSenseList } from './viewerSenseList.js';

const CHECKS = new Set(['ctx', 'doubt']);

/** 토큰이 「뜻 확인 필요」인가 — 알려진 표식 값만(모르는 값은 무시). */
export function needsMeaningCheck(token) {
  return !!token && CHECKS.has(token.meaningCheck);
}

/**
 * 이 자료의 「뜻 확인 필요」 토큰 — 문장(분석 순서) 순. 중국어만(한국어·일본어·영어 무변경, 설계서 §8).
 * 사용자가 뜻을 교정한 토큰(재분석 보존 표시 viewerCorrections에 meaning)은 빠진다(§6.1·§7) — 교정 경로가 표식을
 * 지우지만, 표식이 남은 옛 데이터에서도 교정값이 이긴다.
 * @returns {Array<{id:string, token:object}>}
 */
export function senseReviewItems(processedJson, language) {
  if (language !== 'Chinese') return [];
  const dictionary = processedJson?.dictionary;
  const sequence = Array.isArray(processedJson?.sequence) ? processedJson.sequence : [];
  if (!dictionary) return [];
  const corrected = processedJson?.metadata?.viewerCorrections || {};
  const out = [];
  for (const id of sequence) {
    const token = dictionary[id];
    if (!token || token.pos === '개행' || token.failed || !needsMeaningCheck(token)) continue;
    if (Array.isArray(corrected[id]) && corrected[id].includes('meaning')) continue;
    out.push({ id, token: { ...token, id } });
  }
  return out;
}

/**
 * 닫기 기억 키(설계서 §6.1 · §12.2) — 그 자료의 그 viewerRevision 동안. 재분석하면 revision이 바뀌어 다시 보인다.
 * localStorage는 개인 편의(실패해도 동작 지장 없음)라 호출 쪽이 try/catch로 감싼다.
 */
export function senseReviewDismissKey(materialId, processedJson) {
  return `viewer_sense_review_dismissed:${materialId}:${processedJson?.metadata?.viewerRevision || '0'}`;
}

/**
 * 목록 한 줄의 사전 뜻 후보(라디오 자리) — 카드 사전 뜻 목록(buildSenseList)의 사전 행 줄과 같은 정규화·같은 칠함 규칙.
 * 후보는 서버가 프롬프트에 실은 것과 같은 사전 행 뜻(≤3, §4.1)만 — refVocab 줄은 목록에 넣지 않는다.
 * @returns {Array<{meaning:string, pos:string|null, current:boolean}>}
 */
export function senseReviewOptions(dictEntry, token) {
  return buildSenseList({ dictEntry, refWord: null, token, language: 'Chinese' })
    .flatMap((group) => group.items)
    .map(({ meaning, pos, current }) => ({ meaning, pos, current }));
}

/**
 * [이대로 둘게요] — 지금 뜻을 확정 교정으로 저장(§6.2). 같은 correctTokenMutation으로 쓰므로 token_corrections 이력이
 * 남고, 재분석 때 이 뜻이 보존된다(preserveReanalysisTokens). 뜻이 비어 있으면 확정할 것이 없다(null).
 */
export function keepSenseCorrection(token) {
  const meaning = String(token?.meaning || '').trim();
  return meaning ? { meaning } : null;
}
