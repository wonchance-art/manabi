// [문장] 탭 내용이 지금 누른 단어의 줄 것인가 — 뷰어 v2 AE-R2 PR ①(§1.2).

/**
 * 본문 단어를 눌렀을 때 [문장] 탭 내용이 그 단어의 줄 것인가(§1.2 — 다른 줄 단어 카드의 [문장] 탭에
 * 앞 문장 번역이 남던 결함). 막대 문장은 원문 줄에서 제목 표지·앞뒤 공백만 걷은 것이고, 드래그 구절은
 * 그 줄의 일부라 「줄이 탭 문장(여러 줄이면 그 한 줄)을 품는가」로 가린다. 줄을 모르면 기존 동작을 둔다.
 */
export function sentencePanelBelongsToLine(panelText, line) {
  if (!panelText || typeof line !== 'string') return true;
  return String(panelText).split('\n').map((s) => s.trim()).filter(Boolean).some((seg) => line.includes(seg));
}
