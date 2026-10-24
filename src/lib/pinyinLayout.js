// Fixed valid syllables: malformed analysis cannot widen the entire document.
export const PINYIN_MEASURE_SYLLABLES = ['chuāng','chuáng','chuǎng','chuàng','shuāng','shuǎng','shuàng','zhuāng','zhuàng','xiōng','qióng','jiǒng','huáng','guǎng','chóng','shēng','rèng','lüè','nǚ','lǚ'];
// 칸이 병음 폭으로 정해질 때(병음이 한자보다 넓을 때)는 여유를 2px 더 둔다 — 캔버스 측정과 실제 글꼴이 조금 달라
// 이웃 낱말의 병음 사이가 1px로 붙어 「chángzhuàng」 한 단어처럼 읽혔다(뷰어 점검 결정 1, 오너 승인 2026-10-23 KST).
// 칸 폭을 늘리는 것이라 격자 열은 그대로 맞는다. 한자가 더 넓으면 병음끼리 닿지 않으므로 예전 그대로다.
export function pinyinCellWidth(measure,hanziPx) {
  const widths=PINYIN_MEASURE_SYLLABLES.map(s=>measure(s)).filter(Number.isFinite);
  return Math.ceil(Math.max(hanziPx+2,...widths.map(w=>w+4)));
}

/**
 * 뷰어의 병음 칸 폭(--pinyin-cell)을 재고, 잴 글자의 글꼴 조각이 받아지면 다시 잰다(PINYIN-CELL-RACE-001). 해제 함수를 돌려준다.
 * · 글꼴 변수(--font-noto-sans)는 body에 있다(src/app/layout.jsx) — 본문(root())이 아직 없으면 body에서 읽고 그대로 잰다.
 *   예전에는 본문이 없으면 건너뛰었다. 비공개 자료가 계정보다 먼저 오면 「비공개 자료예요」가 잠깐 그려지고 본문은 늦게 붙는데,
 *   그때는 fonts.ready가 이미 끝나 다시 잴 계기가 없어 칸이 기본값(44px)으로 굳었다 — 같은 자료가 열 때마다 다른 줄 · 쪽으로
 *   나뉘어, 넘긴 쪽의 첫 토큰을 저장해도 다시 열면 그 토큰이 쪽 가운데에 왔다(e2e viewer-paged-reader 390 실측 2026-10-24 KST — main · PR 빌드 모두 간헐 재현, 실패한 판은 전부 이 순서).
 * · fonts.ready는 아직 받기 시작하지 않은 조각을 기다리지 않는다 — 잴 글자(PINYIN_MEASURE_SYLLABLES)의 조각을 fonts.load로 직접 받은 뒤 다시 잰다.
 */
export function watchPinyinCell({ win, doc, root, pinyinRem, fontRem, onCell }) {
  let live = true;
  const fontOf = () => {
    const rootSize = parseFloat(win.getComputedStyle(doc.documentElement).fontSize) || 16;
    const host = root?.() || doc.body;
    const family = (host ? win.getComputedStyle(host).getPropertyValue('--font-noto-sans').trim() : '') || 'sans-serif';
    return { rootSize, font: `${pinyinRem * rootSize}px ${family}` };
  };
  const measure = () => {
    if (!live) return;
    const ctx = doc.createElement('canvas').getContext?.('2d');
    if (!ctx) return;
    const { rootSize, font } = fontOf();
    ctx.font = font;
    onCell(pinyinCellWidth(text => ctx.measureText(text).width, fontRem * rootSize));
  };
  measure();
  doc.fonts?.load?.(fontOf().font, PINYIN_MEASURE_SYLLABLES.join(' ')).then(measure, () => {});
  doc.fonts?.ready?.then(measure);
  win.addEventListener('resize', measure);
  return () => { live = false; win.removeEventListener('resize', measure); };
}
