// Fixed valid syllables: malformed analysis cannot widen the entire document.
export const PINYIN_MEASURE_SYLLABLES = ['chuāng','chuáng','chuǎng','chuàng','shuāng','shuǎng','shuàng','zhuāng','zhuàng','xiōng','qióng','jiǒng','huáng','guǎng','chóng','shēng','rèng','lüè','nǚ','lǚ'];
export function pinyinCellWidth(measure,hanziPx) {
  const widths=PINYIN_MEASURE_SYLLABLES.map(s=>measure(s)).filter(Number.isFinite);
  return Math.ceil(Math.max(hanziPx,...widths)+2);
}
