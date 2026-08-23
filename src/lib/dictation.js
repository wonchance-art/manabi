/**
 * 받아쓰기 채점 엔진 (#1077 제안 6 — 발주 5386786944 회수분, Claude 직접 수행).
 * 순수 모듈: 브라우저 API·네트워크 0. 문장을 듣고 타이핑한 입력을 정답과
 * 글자 단위로 비교한다(diffChars LCS 재사용). UI·TTS 배선은 별도 라운드.
 */
import { diffChars } from './diffChars';

// 채점에서 무시하는 구두점 — CJK 문장부호·라틴 구두점·인용부호·괄호·줄표.
const PUNCT_RE = /[。、！？!?.,·…‥「」『』“”"'’‘:;，．（）()[\]—–~〜]/g;

/**
 * 채점 전 정규화 — 앞뒤 공백 trim·연속 공백 1개·구두점 제거.
 * en/fr은 소문자화(대소문자는 듣기 능력이 아니다), fr 악상 합성은 NFC로 통일.
 * ja/zh는 표기 그대로(가나/한자 구분 자체가 채점 대상).
 */
export function normalizeDictation(text, lang) {
  let s = String(text || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  s = s.replace(PUNCT_RE, '');
  const l = String(lang || '').toLowerCase();
  if (l.startsWith('en') || l.startsWith('fr')) s = s.toLowerCase();
  return s;
}

/**
 * 채점 — 정규화 후 diffChars(입력, 정답).
 * @returns {{ correct: boolean, accuracy: number|null, segments: Array }}
 *   correct  정규화 후 완전 일치
 *   accuracy 정규화된 정답 글자 수 대비 일치 글자 수(0~1, 소수 그대로 — 반올림은 UI 몫).
 *            정답이 비면 null.
 *   segments diffChars 산출 그대로(eq=일치, del=입력 잉여, ins=정답 누락)
 */
export function gradeDictation(expected, typed, lang) {
  const e = normalizeDictation(expected, lang);
  const t = normalizeDictation(typed, lang);
  const segments = diffChars(t, e);
  if (!e) return { correct: false, accuracy: null, segments };
  let eqCount = 0;
  for (const s of segments) if (s.type === 'eq') eqCount += s.text.length;
  // diffChars는 내부에서 공백을 걷어내므로 분모도 공백 제외 글자 수로 맞춘다.
  const expectedLen = e.replace(/\s/g, '').length;
  return {
    correct: t === e,
    accuracy: expectedLen > 0 ? eqCount / expectedLen : null,
    segments,
  };
}
