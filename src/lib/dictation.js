/**
 * 받아쓰기 채점 엔진 (#1077 제안 6 — 발주 5386786944 회수분, Claude 직접 수행).
 * 순수 모듈: 브라우저 API·네트워크 0. 문장을 듣고 타이핑한 입력을 정답과
 * 글자 단위로 비교한다(diffChars LCS 재사용). UI·TTS 배선은 별도 라운드.
 */
import { diffChars } from './diffChars';
import { normalizeAnswer } from './answerNormalize';

/**
 * 채점 전 정규화 — 정본 철자 모드(v2-M 수렴): NFC·공백 1칸·구두점 제거·소문자.
 * 받아쓰기는 철자 정확도가 목적이라 악상·성조 폴딩을 하지 않는다 — 부호만 다른
 * 입력은 gradeDictation의 accentOnly 표시가 담당(관용 대신 가르치기).
 * 가나/한자는 표기 그대로(구분 자체가 채점 대상 — 소문자화는 CJK 무해).
 */
export function normalizeDictation(text, lang) {
  return normalizeAnswer(text, lang);
}

/**
 * 채점 — 정규화 후 diffChars(입력, 정답).
 * @returns {{ correct: boolean, accuracy: number|null, accentOnly: boolean, segments: Array }}
 *   correct    정규화 후 완전 일치
 *   accuracy   정규화된 정답 글자 수 대비 일치 글자 수(0~1, 소수 그대로 — 반올림은 UI 몫).
 *              정답이 비면 null.
 *   accentOnly 오답이지만 악상·성조 부호만 다름(v2-M) — 폴딩 비교로만 판별
 *              (공백·구두점 규칙은 철자 모드 그대로라 정말 '부호만' 다를 때만 참).
 *   segments   diffChars 산출 그대로(eq=일치, del=입력 잉여, ins=정답 누락)
 */
export function gradeDictation(expected, typed, lang) {
  const e = normalizeDictation(expected, lang);
  const t = normalizeDictation(typed, lang);
  const segments = diffChars(t, e);
  if (!e) return { correct: false, accuracy: null, accentOnly: false, segments };
  let eqCount = 0;
  for (const s of segments) if (s.type === 'eq') eqCount += s.text.length;
  // diffChars는 내부에서 공백을 걷어내므로 분모도 공백 제외 글자 수로 맞춘다.
  const expectedLen = e.replace(/\s/g, '').length;
  const fold = { foldDiacritics: true };
  return {
    correct: t === e,
    accuracy: expectedLen > 0 ? eqCount / expectedLen : null,
    accentOnly: t !== e
      && normalizeAnswer(expected, lang, fold) === normalizeAnswer(typed, lang, fold),
    segments,
  };
}
