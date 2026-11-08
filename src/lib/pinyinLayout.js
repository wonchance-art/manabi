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
 * 병음 칸 폭을 재지 않고 낸다(ZH-SSR-001, 2026-11-08 KST). 측정 음절표에서 가장 넓은 음절(「chuāng」)의 폭은 글꼴(Noto Sans — 라틴 ·
 * 라틴 확장 조각, src/app/layout.jsx --font-noto-sans)의 고정값이라 1em당 PINYIN_EM_WIDTH다. 그래서 칸 = pinyinCellWidth와 같은 식을
 * 글꼴 크기만으로 셀 수 있다 — 서버 그림과 하이드레이션 첫 렌더가 같은 값을 내고(병음 칸을 붙은 뒤에 재서 본문이 다시 흐르던 것이
 * 중국어를 서버 본문에서 뺀 까닭이었다), 글꼴이 오기 전에도 칸이 정해진다.
 * 대조: 운영 /viewer/368 실측 — 설정 전 범위(글자 0.8–3.0rem × 병음 0.75–1.0rem, 138조합)에서 measurePinyinCell과 138/138 같다.
 * 글꼴 사본(vendor/google-fonts)이 바뀌면 e2e pinyin-cell-formula가 실제 글꼴로 다시 대조해 깨진다 — 그때 이 값을 새로 잰다.
 */
export const PINYIN_EM_WIDTH = 3.509994;
export const PINYIN_ROOT_PX = 16;
export function pinyinCellFormula(fontRem, pinyinRem, rootPx = PINYIN_ROOT_PX) {
  return Math.ceil(Math.max(fontRem * rootPx + 2, PINYIN_EM_WIDTH * pinyinRem * rootPx + 4));
}

/** 문서 뿌리 글자 크기(px) — 브라우저 기본 글자 크기를 바꾼 사람만 16이 아니다. 서버는 16으로 본다(PINYIN_ROOT_PX). */
export function rootFontPx(win, doc) {
  return parseFloat(win.getComputedStyle(doc.documentElement).fontSize) || PINYIN_ROOT_PX;
}

/** 병음 글꼴(잴 음절의 조각까지)이 이 문서에서 쓸 수 있는 상태인가 — 아직 받는 중이면 잰 값은 대체 글꼴 폭이다. */
export function pinyinFontReady({ win, doc, root, pinyinRem }) {
  const check = doc.fonts?.check;
  if (typeof check !== 'function') return true;
  try { return check.call(doc.fonts, pinyinFontOf({ win, doc, root, pinyinRem }).font, PINYIN_MEASURE_SYLLABLES.join(' ')); } catch { return true; }
}

/**
 * 식이 정본이고, 잰 값은 안전망이다(ZH-SSR-001). 병음 글꼴이 다 온 뒤에 잰 값이 식과 1px 넘게 다를 때만(글꼴을 못 받았거나 다른 글꼴로
 * 바뀐 기기) 잰 값을 쓴다. 글꼴이 오기 전 잰 값(대체 글꼴)으로 칸을 바꾸지 않는다 — 예전에는 그 값으로 한 번, 글꼴이 오면 또 한 번 본문이 흘렀다.
 */
export function settlePinyinCell(measured, formula, fontReady) {
  if (!fontReady || measured == null || !Number.isFinite(measured)) return formula;
  return Math.abs(measured - formula) > 1 ? measured : formula;
}

/**
 * 뷰어의 병음 칸 폭(--pinyin-cell)을 재고, 잴 글자의 글꼴 조각이 받아지면 다시 잰다(PINYIN-CELL-RACE-001). 해제 함수를 돌려준다.
 * · 글꼴 변수(--font-noto-sans)는 body에 있다(src/app/layout.jsx) — 본문(root())이 아직 없으면 body에서 읽고 그대로 잰다.
 *   예전에는 본문이 없으면 건너뛰었다. 비공개 자료가 계정보다 먼저 오면 「비공개 자료예요」가 잠깐 그려지고 본문은 늦게 붙는데,
 *   그때는 fonts.ready가 이미 끝나 다시 잴 계기가 없어 칸이 기본값(44px)으로 굳었다 — 같은 자료가 열 때마다 다른 줄 · 쪽으로
 *   나뉘어, 넘긴 쪽의 첫 토큰을 저장해도 다시 열면 그 토큰이 쪽 가운데에 왔다(e2e viewer-paged-reader 390 실측 2026-10-24 KST — main · PR 빌드 모두 간헐 재현, 실패한 판은 전부 이 순서).
 * · fonts.ready는 아직 받기 시작하지 않은 조각을 기다리지 않는다 — 잴 글자(PINYIN_MEASURE_SYLLABLES)의 조각을 fonts.load로 직접 받은 뒤 다시 잰다.
 */
function pinyinFontOf({ win, doc, root, pinyinRem }) {
  const rootSize = parseFloat(win.getComputedStyle(doc.documentElement).fontSize) || 16;
  const host = root?.() || doc.body;
  const family = (host ? win.getComputedStyle(host).getPropertyValue('--font-noto-sans').trim() : '') || 'sans-serif';
  return { rootSize, font: `${pinyinRem * rootSize}px ${family}` };
}

/** 지금 받아진 글꼴로 한 번 잰 병음 칸 폭(px) — 캔버스가 없으면 null. watchPinyinCell과 뷰어의 첫 그림 전 재기(VIEWER-RENDER-001)가 같이 쓴다. */
export function measurePinyinCell({ win, doc, root, pinyinRem, fontRem }) {
  const ctx = doc.createElement('canvas').getContext?.('2d');
  if (!ctx) return null;
  const { rootSize, font } = pinyinFontOf({ win, doc, root, pinyinRem });
  ctx.font = font;
  return pinyinCellWidth(text => ctx.measureText(text).width, fontRem * rootSize);
}

export function watchPinyinCell({ win, doc, root, pinyinRem, fontRem, onCell }) {
  let live = true;
  const measure = () => {
    if (!live) return;
    const cell = measurePinyinCell({ win, doc, root, pinyinRem, fontRem });
    if (cell != null) onCell(cell);
  };
  measure();
  doc.fonts?.load?.(pinyinFontOf({ win, doc, root, pinyinRem }).font, PINYIN_MEASURE_SYLLABLES.join(' ')).then(measure, () => {});
  doc.fonts?.ready?.then(measure);
  win.addEventListener('resize', measure);
  return () => { live = false; win.removeEventListener('resize', measure); };
}
