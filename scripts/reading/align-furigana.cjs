/**
 * align-furigana — check-furigana.mjs의 alignFurigana 정렬 로직을 재사용 가능한 모듈로 고정한다.
 * refShared.jsx / check-furigana.mjs와 동일한 백트래킹 정렬(비용 Σ(독음길이−한자길이)² 최소).
 *
 * 왜 복제인가: check-furigana.mjs는 소유 밖 파일이라 수정하지 않는다. 대신 그 로직을
 * 한 벌 더 고정해 build-yomi-map(맵 생성)·check-reading(맵 검증)이 "같은 정렬"로
 * 한자 표면형↔요미 구간을 분해하게 한다. 정렬이 흔들리면 두 스크립트의 표면형이
 * 어긋나 맵이 무의미해지므로, 원본과 바이트 동일한 정렬을 쓰는 것이 핵심이다.
 *
 * 사용:
 *   const { alignFurigana, extractReadings } = require('./align-furigana.cjs');
 *   extractReadings('かぞくの 旅行です', 'かぞくの りょこうです')
 *     → { ok:true, status:'ALIGNED', readings:[{surface:'旅行', reading:'りょこう'}] }
 */
const isKanjiLike = (ch) => /[一-鿿々〆ヶ0-9０-９]/.test(ch);
const kataToHira = (s) => String(s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const PUNCT = '。、・！？!?,. 　「」『』();（）:〜';

const isKanaCh = (c) => (c >= 'ぁ' && c <= 'ゖ') || c === 'ー';
const RT_BAD_START = 'んっーゃゅょぁぃぅぇぉゎ';
const UO_VOWEL = 'うくすつぬふむゆるぐずづぶぷぅゅょおこそとのほもよろをごぞどぼぽぉ';
const SMALL_KANA = 'ぁぃぅぇぉゃゅょゎっー';
const moraLen = (rt) => rt.reduce((n, c) => n + (SMALL_KANA.includes(c) ? 0 : 1), 0);

function alignFurigana(ja, yomiRaw) {
  if (!ja || !yomiRaw) return null;
  if (/[가-힣]/.test(yomiRaw)) return 'KO_MIXED';
  if (![...ja].some(isKanjiLike)) return 'NO_KANJI';

  const yomi = [...kataToHira(yomiRaw.replace(/[\s　]+/g, ''))];
  const segs = [];
  for (const ch of ja) {
    const t = isKanjiLike(ch) ? 'k' : 'p';
    if (segs.length && segs[segs.length - 1].t === t) segs[segs.length - 1].s += ch;
    else segs.push({ t, s: ch });
  }

  const N = yomi.length;
  const memo = new Map();
  function solve(si, yi, afterRt) {
    if (si === segs.length) {
      let j = yi;
      while (j < N && PUNCT.includes(yomi[j])) j++;
      return j === N ? { cost: 0, parts: [] } : null;
    }
    const key = (si * 4096 + yi) * 2 + (afterRt ? 1 : 0);
    if (memo.has(key)) return memo.get(key);
    const seg = segs[si];
    let best = null;
    if (seg.t === 'p') {
      const norm = kataToHira(seg.s.replace(/[\s　]+/g, ''));
      let j = yi, ok = true;
      for (const c of norm) {
        while (j < N && yomi[j] !== c && PUNCT.includes(yomi[j])) j++;
        if (j < N && yomi[j] === c) j++;
        else if (PUNCT.includes(c)) continue;
        else { ok = false; break; }
      }
      if (ok) {
        const rest = solve(si + 1, j, j === yi ? afterRt : false);
        if (rest) best = { cost: rest.cost, parts: [{ text: seg.s }, ...rest.parts] };
      }
    } else {
      let nextFirst = null;
      if (segs[si + 1]) {
        const nn = kataToHira(segs[si + 1].s.replace(/[\s　]+/g, ''));
        nextFirst = [...nn].find((c) => !PUNCT.includes(c)) || null;
      }
      for (let end = N; end > yi; end--) {
        const rt = yomi.slice(yi, end);
        if (!rt.every(isKanaCh)) continue;
        if (RT_BAD_START.includes(rt[0])) continue;
        if (rt[0] === 'う' && afterRt && yi > 0 && UO_VOWEL.includes(yomi[yi - 1])) continue;
        const rest = solve(si + 1, end, true);
        if (!rest) continue;
        const d = moraLen(rt) - seg.s.length;
        const cost = rest.cost + 8 * d * d + (nextFirst && rt.includes(nextFirst) ? 1 : 0);
        if (!best || cost < best.cost)
          best = { cost, parts: [{ text: seg.s, rt: rt.join('') }, ...rest.parts] };
      }
    }
    memo.set(key, best);
    return best;
  }
  const r = solve(0, 0, false);
  return r ? r.parts : null;
}

/**
 * 한 문장을 정렬해 한자 표면형→요미 대응만 추출한다.
 * @returns {{ok:boolean, status:string, readings:{surface:string,reading:string}[]}}
 *   status: ALIGNED(정렬 성공) · NO_KANJI(한자 없음) · KO_MIXED(한글 병기) · FAIL(정렬 불가)
 */
function extractReadings(ja, yomi) {
  const r = alignFurigana(ja, yomi);
  if (r === 'NO_KANJI') return { ok: true, status: 'NO_KANJI', readings: [] };
  if (r === 'KO_MIXED') return { ok: true, status: 'KO_MIXED', readings: [] };
  if (r === null) return { ok: false, status: 'FAIL', readings: [] };
  return {
    ok: true,
    status: 'ALIGNED',
    readings: r.filter((p) => p.rt).map((p) => ({ surface: p.text, reading: p.rt })),
  };
}

/**
 * 문장 단위 요미 락(YLOCK)용 정규화 — build-yomi-lock와 check-reading의 YLOCK 게이트가 공유한다.
 * 규칙(P1-1·P1-2·P2-5): 카타카나→히라가나 + 공백(반각·전각)·구두점 제거. 장음부(ー)와 한자·한글은 보존한다.
 *   - 한자 보존: ja는 표면형(한자 포함) 그대로가 문장의 정체성 키가 된다.
 *   - 한글 보존: KO_MIXED(요미에 한글 섞임)를 게이트가 검출할 수 있도록 남긴다.
 *   - 두 스크립트가 반드시 같은 정규화를 써야 락 키가 어긋나지 않는다 → 여기 한 곳에 고정.
 */
function normLock(s) {
  return kataToHira(String(s || ''))
    .replace(/[\s　]/g, '')
    .replace(/[。．、，！？!?｡､「」『』（）()〔〕【】・…‥〜~]/g, '');
}

module.exports = { alignFurigana, extractReadings, kataToHira, normLock };
