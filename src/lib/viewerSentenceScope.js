// [문장] 탭의 문장 키 결과(더 쉽게·자세히·노트 저장)는 그 결과를 만든 문장에만 붙는다 — 뷰어 v2 AE-R2 PR ①.
// 문장이 바뀌는 길(막대·이동·드래그·단어창 「번역」·수업 출처 복원·언어 변경)마다 reset()을 흩어 부르면
// 빠뜨린 길에서 앞 문장 결과가 남는다(설계서 §5.1 — 초기화가 드래그 경로에만 있었다). 표시를 한 자리에서
// 「결과의 문장 === 지금 탭 문장」으로 판정하면 빠뜨릴 길이 없다.

/** 결과를 만든 문장(forText)이 지금 탭 문장일 때만 열린 것으로 그린다(§5.1). */
export function openForSentence(state, sentence) {
  return !!state?.open && !!sentence && state.forText === sentence;
}

/**
 * 본문 단어를 눌렀을 때 [문장] 탭 내용이 그 단어의 줄 것인가(§1.2 — 다른 줄 단어 카드의 [문장] 탭에
 * 앞 문장 번역이 남던 결함). 막대 문장은 원문 줄에서 제목 표지·앞뒤 공백만 걷은 것이고, 드래그 구절은
 * 그 줄의 일부라 「줄이 탭 문장(여러 줄이면 그 한 줄)을 품는가」로 가린다. 줄을 모르면 기존 동작을 둔다.
 */
export function sentencePanelBelongsToLine(panelText, line) {
  if (!panelText || typeof line !== 'string') return true;
  return String(panelText).split('\n').map((s) => s.trim()).filter(Boolean).some((seg) => line.includes(seg));
}
