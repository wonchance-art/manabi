// IME 조합 중인 키 입력 판정 — 중국어·일본어 후보 확정 Enter를 전송·제출로 오인하지 않는다.
// Chrome/Firefox는 isComposing을, Safari는 조합 확정 Enter를 keyCode 229로 보낸다.
// `composing`은 compositionstart/end로 따로 추적하는 ref 값(없으면 생략).
export const isImeComposing = (event, composing) => !!(composing || event?.isComposing || event?.nativeEvent?.isComposing || event?.keyCode === 229 || event?.nativeEvent?.keyCode === 229);
