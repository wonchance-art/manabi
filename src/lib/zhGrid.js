// 중국어 본문 격자 조판(ZH-GRID-001 — 오너 승인 목업 2026-10-12).
// 중국어 출판물처럼 한자·전각 문장부호가 모두 같은 폭의 한 칸을 차지해 줄이 바뀌어도 세로로 맞는다.
// 칸 폭은 CSS(--zh-cell: 병음을 보이면 max(1em, --pinyin-cell), 끄면 1em)가 정하고, 여기서는
// ⑴ 글자를 칸·반각 묶음으로 나누고 ⑵ 반각 묶음이 차지할 칸 수를 세고 ⑶ 줄머리 금칙 표시를 만든다.

// 전각 = 한 칸. CJK 한자·부호(3000–303F)·전각 형태(FF00–FF60·FFE0–FFE6)·한글·가나·CJK 호환,
// 그리고 중국어 조판에서 전각으로 쓰는 따옴표(‘’“”)·말줄임(…)·줄표(—·―)·가운뎃점(·).
const FULL_WIDTH = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦‘-‟…—―·\u{20000}-\u{3FFFD}]/u;
export const isZhFullWidth = (ch) => FULL_WIDTH.test(ch);

/** 글자열 → 조각 목록: 전각 글자 하나 = {cell}, 이어진 반각 글자(숫자·라틴·공백) = {run}.
 *  공백뿐인 묶음은 뺀다 — 중국어는 띄어 쓰지 않고, 남기면 칸 없이 자간만 두 번 들어가 격자가 밀린다. */
export function zhPieces(text) {
  const out = [];
  for (const ch of String(text ?? '')) {
    if (isZhFullWidth(ch)) out.push({ cell: ch });
    else if (out.length && out.at(-1).run != null) out.at(-1).run += ch;
    else out.push({ run: ch });
  }
  return out.filter(piece => piece.run == null || piece.run.trim());
}

/** 반각 묶음의 칸 수 — 실제 글자 폭을 k칸(k×칸 + (k−1)×자간)에 올림으로 맞춰 뒤 글자가 격자에 남는다. */
export function zhRunCells(width, cell, gap = 0) {
  if (!(width > 0.5) || !(cell > 0)) return 0;
  return Math.max(1, Math.ceil((width + gap - 0.5) / (cell + gap)));
}

// 줄머리 금칙(禁则) — 닫는 부호는 줄 첫 자리에 올 수 없다.
// 일본어(JA-KINSOKU — 목업 viewer-lang-4 §4, W3C JLREQ §3.1.7 행두 금칙)도 같은 표시 · 같은 CSS 변수를 쓴다. 일본어 집합은
// 중국어 집합에 장음(ー)·중점(・)·반복 부호(ゝゞヽヾ々〻)·작은 가나·물결표(〜～)·반각 가나 부호(｡､｣･ｰ)를 더한다.
const CLOSING_FULL = /^[。，、；：？！．）》」』〉】〕〗〙〛”’…‥·％]+$/u;
const CLOSING_JA = /^[。，、；：？！．）》」』〉】〕〗〙〛”’…‥·％・ー〜～゠ゝゞヽヾ々〻ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶㇰ-ㇿ‼⁇⁈⁉｡､｣･ｰ]+$/u;
const CLOSING_HALF = /^[,.;:?!)\]}%]{1,2}$/;
/** 금칙을 적용하는 본문 언어 — 토큰마다 inline-block(flex 항목)이라 브라우저 line-break가 토큰 사이에 닿지 않는 언어. */
export const KINSOKU_LANGUAGES = Object.freeze(['Chinese', 'Japanese']);
export const hasKinsoku = (language) => KINSOKU_LANGUAGES.includes(language);
/** 닫는 부호 토큰이면 그 칸 수, 아니면 0. 반각 부호 1–2자는 한 칸보다 좁아 1칸이다. 일본어는 language='Japanese'. */
export function zhClosingCells(text, language = 'Chinese') {
  const t = String(text ?? '');
  if ((language === 'Japanese' ? CLOSING_JA : CLOSING_FULL).test(t)) return [...t].length;
  return CLOSING_HALF.test(t) ? 1 : 0;
}

/**
 * 줄머리 금칙 표시: 닫는 부호 묶음 바로 앞 토큰에 hold(묶음 칸 수), 묶음 첫 토큰에 pull(같은 값).
 * CSS가 hold만큼 앞 토큰의 오른쪽 여백을 늘리고 pull만큼 부호의 왼쪽 여백을 줄인다 — 두 값이 상쇄돼
 * 배치(격자)는 그대로고, 앞 토큰이 들어갈 자리가 없으면 부호와 함께 다음 줄로 넘어간다.
 * 개행 토큰(pos '개행' 또는 '\n')에서 끊는다. 반환: Map(tokenId → {hold?, pull?}).
 * language: 'Chinese'(기본) · 'Japanese' — 닫는 부호 집합만 다르다(zhClosingCells).
 */
export function zhKinsokuMarks(ids, tokenOf, language = 'Chinese') {
  const marks = new Map();
  let prev = null, head = null, cells = 0;
  const flush = () => {
    if (prev && head && cells) {
      marks.set(prev, { ...marks.get(prev), hold: cells });
      marks.set(head, { ...marks.get(head), pull: cells });
    }
    head = null; cells = 0;
  };
  for (const id of ids) {
    const token = tokenOf(id);
    if (!token) continue;
    if (token.pos === '개행' || String(token.text ?? '').includes('\n')) { flush(); prev = null; continue; }
    const closing = zhClosingCells(token.text, language);
    if (closing && prev) { head ??= id; cells += closing; continue; }
    flush(); prev = id;
  }
  flush();
  return marks;
}

/** 금칙 표시 → 토큰 style 조각(없으면 null). */
export const zhKinsokuStyle = (mark) => mark
  ? { ...(mark.hold ? { '--zh-hold': mark.hold } : null), ...(mark.pull ? { '--zh-pull': mark.pull } : null) }
  : null;

const lengthPx = (value, rootPx, emPx) => {
  const v = String(value ?? '').trim(), n = parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  return v.endsWith('rem') ? n * rootPx : v.endsWith('em') ? n * emPx : n;
};

/**
 * 반각 묶음(.zh-run)마다 실제 글자 폭을 재 --zh-cells를 쓴다. 칸 폭·자간은 그 요소의 계산값에서 얻는다
 * (제목의 큰 글자도 자기 em으로 잰다). 같은 조건(칸·자간·글자)으로 이미 잰 요소는 건너뛴다.
 * 읽기를 모두 끝낸 뒤 쓴다 — 요소마다 레이아웃을 다시 계산하지 않게.
 */
export function layoutZhRuns(root, force = false) {
  if (!root || typeof document === 'undefined') return;
  const runs = root.querySelectorAll('.zh-run');
  if (!runs.length) return;
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const writes = [];
  for (const el of runs) {
    const cs = getComputedStyle(el), em = parseFloat(cs.fontSize) || rootPx;
    const reserved = el.closest('[data-pron-spacing]')?.getAttribute('data-pron-spacing') === 'reserved';
    const cell = reserved ? Math.max(em, lengthPx(cs.getPropertyValue('--pinyin-cell'), rootPx, em)) : em;
    const gap = lengthPx(cs.getPropertyValue('--char-gap'), rootPx, em);
    const sig = `${cell}|${gap}|${el.textContent}`;
    if (!force && el.dataset.zhSig === sig) continue;
    const range = document.createRange();
    range.selectNodeContents(el);
    writes.push([el, sig, zhRunCells(range.getBoundingClientRect().width, cell, gap)]);
  }
  for (const [el, sig, cells] of writes) { el.style.setProperty('--zh-cells', String(cells)); el.dataset.zhSig = sig; }
}
