// 단어 상태 하이라이트 캐논 (B안·기본 꺼짐·파랑 2단계 — 오너 확정 2026-08-27, 목업 아티팩트 합의).
// 뷰어 본문 토큰의 상태 판정을 한 곳에 고정한다. 데이터는 전부 기존 정본에서 파생:
// 저장/복습(user vocabulary), 앎(user_known_words), 만남(user_vocab_encounters 스냅샷).
//
// 우선순위 계약: due > saved > known > met > new.
// - known이 saved보다 아래인 이유: '이미 앎'은 저장 단어에는 숨겨지는 상호 배타 제품 계약이라
//   동시 성립이 정상 경로에 없고, 혹시 겹쳐도 학습 중(복습 가능) 표시가 살아야 한다.
// - known은 표시 클래스가 없지만(앎 = 무표시 — 링큐 철학) met/new 마킹을 차단하는 상태다.

/** 어휘 토큰 판정 — 기호·글자 없는 토큰(숫자만·공백 등)은 상태 마킹 대상이 아니다. */
export function isWordToken(token) {
  if (!token || token.failed) return false;
  if (token.pos === '기호') return false;
  return /\p{L}/u.test(String(token.text || ''));
}

/**
 * 상태 판정. 입력은 호출부가 기존 정본으로 계산한 불리언(판정 로직을 여기 한 곳에 고정).
 * @returns {'due'|'saved'|'known'|'met'|'new'|null} null = 비어휘(마킹 없음)
 */
export function wordStateOf({ isWord, isSaved, isDue, isKnown, isMet }) {
  if (!isWord) return null;
  if (isSaved && isDue) return 'due';
  if (isSaved) return 'saved';
  if (isKnown) return 'known';
  if (isMet) return 'met';
  return 'new';
}

/**
 * 하이라이트 모드에서 토큰에 추가할 클래스 — met/new만 새 클래스를 쓴다.
 * saved/due는 기존 word-token--saved/--due 클래스를 CSS가 하이라이트 모드에서
 * 배경으로 재해석하고, known/비어휘는 무표시.
 */
export function wordStateExtraClass(state) {
  if (state === 'met') return 'word-token--met';
  if (state === 'new') return 'word-token--new';
  return '';
}
