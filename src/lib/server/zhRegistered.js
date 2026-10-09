// 서버 전용 — 중국어 경계 근거로 쓰는 「등재」의 정의(AD-R4, 설계서 docs/manabi-viewer-v2-ad-r4.md §5.1).
//
// 포함: HSK 표(zhHskLevel.json) · 병합 유지 목록(ZH_KEEP_MERGED — HSK 표의 구멍 这个류) · 이합사 사전 ·
//       사전 행 중 source ∈ {user_verified, jmdict, jmdict_en}. (AD-R3 공유 규칙은 그 PR이 병합된 뒤 더한다.)
// 제외: source 'gemini' 행 — 분석기가 사전에 없는 토큰마다 뜻을 받아 쌓는 자리라 우연 병합(笔在·这宗)과
//       한 사람이 묶은 꼴까지 들어온다. 이를 등재로 치면 한 사람이 잘못 묶은 꼴이 모두의 자동 경계가 된다(§0.6).
//       refVocab 생활 어휘(expansion.js)의 구 표제어(交通卡余额 등) — 학습 표제어로는 맞지만 경계 근거로는 넓다(§2.2).
//
// 등재만으로 자동으로 묶지 않는다: 오병합 꼴(个人·得了·完了·多方面)도 모두 HSK 표에 있다(§0.5). 자동 묶기는
// 「등재 + 이 문장에서 AI가 한 단어라고 판정」일 때만이고, 그 적용은 경계 PR④가 한다. 이 모듈은 정의만 둔다.
// 목록을 새로 세우지 않고 기존 방벽(isZhRealWord = HSK + ZH_KEEP_MERGED)과 이합사 사전을 재사용한다.

import { isZhRealWord, isZhSeparableWord } from './zhTokenFix';

export const ZH_REGISTERED_SOURCES = new Set(['user_verified', 'jmdict', 'jmdict_en']);

/**
 * @param {string} form 이은 꼴(중국어는 base_form === 표면형)
 * @param {{source?: string}|null} [row] 그 꼴의 morpheme_dictionary 행(있으면)
 */
export function isZhRegisteredWord(form, row = null) {
  if (typeof form !== 'string' || !form) return false;
  if (isZhRealWord(form) || isZhSeparableWord(form)) return true;
  return ZH_REGISTERED_SOURCES.has(row?.source);
}
