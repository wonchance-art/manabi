// Fixed valid syllables: malformed analysis cannot widen the entire document.
export const PINYIN_MEASURE_SYLLABLES = ['chuāng','chuáng','chuǎng','chuàng','shuāng','shuǎng','shuàng','zhuāng','zhuàng','xiōng','qióng','jiǒng','huáng','guǎng','chóng','shēng','rèng','lüè','nǚ','lǚ'];
// 칸이 병음 폭으로 정해질 때(병음이 한자보다 넓을 때)는 여유를 2px 더 둔다 — 캔버스 측정과 실제 글꼴이 조금 달라
// 이웃 낱말의 병음 사이가 1px로 붙어 「chángzhuàng」 한 단어처럼 읽혔다(뷰어 점검 결정 1, 오너 승인 2026-10-23 KST).
// 칸 폭을 늘리는 것이라 격자 열은 그대로 맞는다. 한자가 더 넓으면 병음끼리 닿지 않으므로 예전 그대로다.
export function pinyinCellWidth(measure,hanziPx) {
  const widths=PINYIN_MEASURE_SYLLABLES.map(s=>measure(s)).filter(Number.isFinite);
  return Math.ceil(Math.max(hanziPx+2,...widths.map(w=>w+4)));
}
