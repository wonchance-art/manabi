// ① 카드 확대 단어(오너 승인 2026-08-19) — 폭맞춤 크기의 분모.
// CJK 본문 글자는 병음 격자 계약으로 정확히 1em이라, 카드 글꼴 크기는
// `100cqi ÷ fitDivisor` 수식으로 폭을 꽉 채운다(측정 JS 없음 — index.css .word-fit).
// 라틴 자료는 글자 폭이 1em이 아니라 폭맞춤 대상이 아니다(isFitLang).

/** 폭맞춤을 적용하는 자료 언어 — 전각 1em 격자가 성립하는 CJK만. */
export function isFitLang(language) {
  return language === 'Chinese' || language === 'Japanese';
}

/**
 * 크기 분모 — 기본은 글자 수(폭 = 글자수 × 1em).
 * 일본어는 요미가나(0.5em/자)가 본문보다 넓을 수 있어(志 1자 : こころざし 5자),
 * 요미 폭(글자수 ÷ 2)이 더 크면 그쪽을 분모로 — 요미가 패널을 넘어 가로
 * 스크롤을 만드는 것을 크기 쪽에서 막는다. 병음은 0.26em 단일 크기 계약으로
 * 셀(1em)을 절대 넘지 않으므로 보정이 필요 없다.
 */
export function fitDivisor(text, furigana, language) {
  const n = [...String(text || '')].length;
  if (n === 0) return 1;
  if (language === 'Japanese' && furigana) {
    const yomiHalf = [...String(furigana)].length / 2;
    return Math.max(n, yomiHalf);
  }
  return n;
}

// ── 긴 표제어(뷰어 점검 E2, 오너 승인 2026-10-23 KST) ─────────────────────────────
// 6자 이상(中华人民共和国)은 글자 칸이 카드 폭을 넘어 끝 한 글자(国)만 다음 줄로 떨어졌다.
// 넘칠 때만 글자를 2px씩 최소 22px까지 줄여 한 줄에 맞추고, 그래도 넘치면(훈음 칸이 넓을 때) 원래 크기로
// 반씩 나눈다(中华人民 / 共和国 — 뷰어가 가운데 자리에 둔 .word-fit__break를 켠다). 넘치지 않으면 손대지 않는다.
export const LONG_HEAD_CHARS = 6;
export const LONG_HEAD_MIN_PX = 22;
/** 반으로 나눌 자리(앞쪽 글자 수) — 앞줄이 한 글자 더 길다(4 / 3). 짧은 표제어는 -1. */
export function longHeadSplitAt(n) {
  return n >= LONG_HEAD_CHARS ? Math.ceil(n / 2) : -1;
}
const fitSigs = new WeakMap();
/**
 * .word-fit[data-long] 하나를 맞춘다. 같은 폭 · 같은 내용이면 다시 재지 않는다(force는 크기 변화 감시에서).
 * 줄 넘김 판정 = 첫 칸과 끝 칸이 다른 줄(끝 칸 위가 첫 칸 아래 이상).
 */
export function fitLongHeadword(el, { force = false } = {}) {
  if (!el?.isConnected || !el.hasAttribute('data-long')) return;
  const surface = el.querySelector(':scope > .surface');
  const wrap = el.parentElement;
  if (!surface || !wrap) return;
  const sig = `${wrap.clientWidth}|${surface.textContent}`;
  if (!force && fitSigs.get(el) === sig) return;
  fitSigs.set(el, sig);
  el.style.removeProperty('font-size');
  el.removeAttribute('data-split');
  const items = [...surface.children].filter((c) => !c.classList.contains('word-fit__break') && c.getClientRects().length);
  if (items.length < 2) return;
  const wrapped = () => items[items.length - 1].getBoundingClientRect().top >= items[0].getBoundingClientRect().bottom - 1;
  if (!wrapped()) return;
  const base = Math.floor(parseFloat(getComputedStyle(el).fontSize) || 32);
  for (let px = base - 2; px >= LONG_HEAD_MIN_PX; px -= 2) {
    el.style.fontSize = `${px}px`;
    if (!wrapped()) return;
  }
  el.style.removeProperty('font-size');
  el.setAttribute('data-split', '');
}
