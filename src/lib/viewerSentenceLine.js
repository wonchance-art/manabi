// 단어창 문장 줄(VIEWER-V2-ROUNDS-001 §2.1 · AE-R1 설계서 §4) — 순수 함수, 의존 0.
// 지금 카드의 「문장」은 raw_text 줄 전체이고(ctxSentenceOf) 강조는 같은 단어를 모두 칠한다
// (splitSentenceAroundWord). 정본은 「누른 토큰이 든 한 문장」 + 「누른 자리만」이다.
// 위치는 문자열 검색이 아니라 줄 안 토큰 순서로 구한다 — 같은 단어가 여러 번 나와도 누른
// 자리 하나만 잡히고, 공백·누락 토큰에도 견딘다(rawLine.indexOf(text, cursor)로 따라간다).
// PR ①에서는 화면에 연결하지 않는다(PR ②가 쓴다).

// 문장 경계 — CJK는 。！？；… 와 뒤따르는 닫는 따옴표·괄호까지.
const CJK_END = /[。！？；…]+[」』”’）)\]】〕》〉"']*/gu;
// 라틴 자료는 . ! ? ; 뒤가 공백·줄 끝일 때 경계를 더한다(설계서 §10.2 제안값).
const LATIN_END = /[.!?;]+["'”’)\]]*(?=\s|$)/gu;
// 흔한 약어 뒤 마침표는 경계로 보지 않는다 — 오탐을 줄이는 최소 목록(완전하지 않다, 감수).
const LATIN_ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'e.g', 'i.e', 'cf', 'no', 'vol', 'fig',
  'approx', 'dept', 'est', 'inc', 'ltd', 'co', 'mt', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug',
  'sep', 'sept', 'oct', 'nov', 'dec', 'mme', 'mlle', 'm', 'av', 'env',
]);
const CJK_LANGUAGES = new Set(['Chinese', 'Japanese']);

/** 3줄 예산(설계서 §10.2) — 전각 글자 60자. 반각 글자는 0.375자로 세어 라틴 160자와 같다. */
export const SENTENCE_LINE_BUDGET = 60;
/** 2줄 예산 — 자형 표가 있는 카드가 시트 첫 화면을 넘을 때 문장 줄을 먼저 줄인다(AE-R3 PR② 첫 화면 우선). */
export const SENTENCE_LINE_BUDGET_TIGHT = 40;
const NARROW_WEIGHT = 60 / 160;
const ELLIPSIS = '…';

const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꥠ-꥿가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{20000}-\u{3fffd}]/u;

/** 글자 하나의 예산 폭 — 전각 1, 그 밖 0.375. */
export function sentenceCharWeight(ch) {
  return WIDE.test(ch) ? 1 : NARROW_WEIGHT;
}

function weightOf(chars) {
  let w = 0;
  for (const ch of chars) w += sentenceCharWeight(ch);
  return w;
}

function isLatinAbbreviation(line, endIndex) {
  // endIndex = 마침표 위치. 그 앞 단어(점 포함 약어 e.g·i.e도)를 본다.
  const head = line.slice(0, endIndex);
  const m = /([\p{L}.]+)$/u.exec(head);
  if (!m) return false;
  const word = m[1].replace(/^\.+/, '').toLowerCase();
  if (LATIN_ABBREVIATIONS.has(word)) return true;
  // 이니셜(J. K. Rowling) — 대문자 한 글자
  return /^\p{Lu}$/u.test(m[1]);
}

/**
 * 줄을 문장 구간으로 나눈다 — [{start, end}] (UTF-16 색인, end 제외). 경계가 없으면 줄 전체 한 구간.
 * 문장 앞 공백은 구간에서 뺀다.
 */
export function splitSentenceRanges(line, { language } = {}) {
  const s = String(line ?? '');
  const ends = [];
  for (const m of s.matchAll(CJK_END)) ends.push(m.index + m[0].length);
  if (!CJK_LANGUAGES.has(language)) {
    for (const m of s.matchAll(LATIN_END)) {
      // 마침표 하나로 끝나는 경계만 약어 검사(?·!·…·.. 는 그대로 경계)
      if (/^\.["'”’)\]]*$/u.test(m[0]) && isLatinAbbreviation(s, m.index)) continue;
      ends.push(m.index + m[0].length);
    }
  }
  const sorted = [...new Set(ends)].sort((a, b) => a - b);
  const ranges = [];
  let start = 0;
  for (const end of [...sorted, s.length]) {
    if (end <= start) continue;
    let from = start;
    while (from < end && /\s/u.test(s[from])) from += 1;
    if (from < end) ranges.push({ start: from, end });
    start = end;
  }
  return ranges.length ? ranges : [{ start: 0, end: s.length }];
}

/**
 * 줄 안 토큰 순서로 각 토큰의 글자 위치를 구한다 — [{start, end} | null].
 * 찾지 못한 토큰(공백 정규화·누락)은 null이고 커서를 움직이지 않는다.
 */
export function locateLineTokens(line, tokens) {
  const s = String(line ?? '');
  let cursor = 0;
  return (tokens || []).map((token) => {
    const text = typeof token === 'string' ? token : token?.text;
    if (!text || text === '\n') return null;
    const at = s.indexOf(text, cursor);
    if (at < 0) return null;
    cursor = at + text.length;
    return { start: at, end: at + text.length };
  });
}

function sliceResult(s, range, termStart, termEnd) {
  const text = s.slice(range.start, range.end);
  return {
    text,
    before: s.slice(range.start, termStart),
    term: s.slice(termStart, termEnd),
    after: s.slice(termEnd, range.end),
    sentenceStart: range.start,
    sentenceEnd: range.end,
    start: termStart - range.start,
    end: termEnd - range.start,
  };
}

/**
 * 누른 토큰이 든 한 문장과 그 안의 누른 자리.
 * @param {{line:string, tokens:Array<{text:string}|string>, index:number, language?:string, term?:string}} input
 *   line = raw_text 한 줄, tokens = 그 줄 토큰(json.sequence 순서), index = 누른 토큰의 tokens 안 순번.
 *   index가 없거나 위치를 못 찾으면 term(없으면 tokens[index].text)의 첫 일치로 내려간다.
 * @returns {{text, before, term, after, start, end, sentenceStart, sentenceEnd, located:boolean}|null}
 *   located = 토큰 순서로 위치를 찾았는가(false면 첫 일치 폴백). term이 줄에 없으면 term:''로 문장 없이 줄 전체.
 */
export function sentenceAroundToken({ line, tokens = [], index = -1, language, term } = {}) {
  const s = String(line ?? '');
  if (!s) return null;
  const ranges = splitSentenceRanges(s, { language });
  const target = Number.isInteger(index) && index >= 0 ? locateLineTokens(s, tokens)[index] : null;
  let termStart = -1, termEnd = -1, located = false;
  if (target) {
    termStart = target.start; termEnd = target.end; located = true;
  } else {
    const word = term ?? (typeof tokens[index] === 'string' ? tokens[index] : tokens[index]?.text) ?? '';
    const at = word ? s.indexOf(word) : -1;
    if (at >= 0) { termStart = at; termEnd = at + word.length; }
  }
  if (termStart < 0) {
    const range = { start: 0, end: s.length };
    return { ...sliceResult(s, range, s.length, s.length), before: s, term: '', after: '', start: -1, end: -1, located: false };
  }
  const range = ranges.find((r) => termStart >= r.start && termStart < r.end)
    || ranges.find((r) => termStart < r.end) || ranges[ranges.length - 1];
  // 경계 바로 앞에서 끝나는 문장이 토큰 끝을 자르지 않게(토큰이 경계를 넘는 드문 경우) 넓힌다.
  const widened = { start: Math.min(range.start, termStart), end: Math.max(range.end, termEnd) };
  return { ...sliceResult(s, widened, termStart, termEnd), located };
}

/** 무id 리스트 단어 — 카드를 열 당시 문맥에서 첫 일치만 칠한다. */
export function sentenceAroundTerm({ line, term, language } = {}) {
  return sentenceAroundToken({ line, tokens: [], index: -1, term, language });
}

/**
 * 3줄 예산 줄임 — 단어는 자르지 않고, 남는 예산을 앞뒤에 나눠 양 끝을 …로 줄인다.
 * 라틴 글자는 단어 중간에서 자르지 않는다(공백까지 물린다). 실제 줄 수 안전망은 CSS line-clamp.
 * @param {{before:string, term:string, after:string}} parts sentenceAroundToken 결과
 * @returns {{before:string, term:string, after:string, clippedStart:boolean, clippedEnd:boolean}}
 */
export function clipSentenceToBudget(parts, { budget = SENTENCE_LINE_BUDGET } = {}) {
  const before = [...String(parts?.before ?? '')];
  const term = String(parts?.term ?? '');
  const after = [...String(parts?.after ?? '')];
  const total = weightOf(before) + weightOf(term) + weightOf(after);
  if (total <= budget) return { before: before.join(''), term, after: after.join(''), clippedStart: false, clippedEnd: false };
  const ell = sentenceCharWeight(ELLIPSIS);
  const room = Math.max(0, budget - weightOf(term) - 2 * ell);
  // 앞뒤 공평 배분 — 한쪽이 짧으면 남는 몫을 다른 쪽에 준다.
  const beforeW = weightOf(before), afterW = weightOf(after);
  let leftRoom = room / 2, rightRoom = room / 2;
  if (beforeW < leftRoom) { rightRoom += leftRoom - beforeW; leftRoom = beforeW; }
  if (afterW < rightRoom) { leftRoom += rightRoom - afterW; rightRoom = afterW; }
  // 앞쪽: 단어에 붙은 끝에서부터 거꾸로 담는다.
  let keptBefore = [], w = 0;
  for (let i = before.length - 1; i >= 0; i -= 1) {
    const cw = sentenceCharWeight(before[i]);
    if (w + cw > leftRoom + 1e-9) break;
    keptBefore.unshift(before[i]); w += cw;
  }
  let keptAfter = []; w = 0;
  for (let i = 0; i < after.length; i += 1) {
    const cw = sentenceCharWeight(after[i]);
    if (w + cw > rightRoom + 1e-9) break;
    keptAfter.push(after[i]); w += cw;
  }
  const clippedStart = keptBefore.length < before.length;
  const clippedEnd = keptAfter.length < after.length;
  // 라틴 단어 중간 절단 방지 — 잘린 쪽 끝 조각이 단어 중간이면 다음 공백까지 버린다.
  const isWordChar = (ch) => !!ch && /[\p{L}\p{N}'’-]/u.test(ch) && !WIDE.test(ch);
  if (clippedStart && isWordChar(keptBefore[0]) && isWordChar(before[before.length - keptBefore.length - 1])) {
    const cut = keptBefore.findIndex((ch) => /\s/u.test(ch));
    keptBefore = cut < 0 ? [] : keptBefore.slice(cut);
  }
  if (clippedEnd && isWordChar(keptAfter[keptAfter.length - 1]) && isWordChar(after[keptAfter.length])) {
    let cut = -1;
    for (let i = keptAfter.length - 1; i >= 0; i -= 1) if (/\s/u.test(keptAfter[i])) { cut = i; break; }
    keptAfter = cut < 0 ? [] : keptAfter.slice(0, cut + 1);
  }
  const head = keptBefore.join('').replace(/^\s+/u, '');
  const tail = keptAfter.join('').replace(/\s+$/u, '');
  return {
    before: clippedStart ? ELLIPSIS + head : head,
    term,
    after: clippedEnd ? tail + ELLIPSIS : tail,
    clippedStart,
    clippedEnd,
  };
}
