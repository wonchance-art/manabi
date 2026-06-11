#!/usr/bin/env node
/**
 * 요미가나 정렬 검사 — ja에 한자가 있는데 루비 정렬이 실패하는 예문을 찾는다.
 * 사용: node scripts/check-furigana.mjs src/content/japanese/bunkei/n5.js
 * (refShared.jsx의 alignFurigana와 동일 로직)
 */
const isKanjiLike = ch => /[一-鿿々〆ヶ0-9０-９]/.test(ch);
const kataToHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const PUNCT = '。、・！？!?,. 　「」『』();（）:〜';

// 한자 독음(rt) 후보 제약 — 독음은 가나로만 구성되고, 음절 경계상 올 수 없는 글자로 시작하지 않는다.
const isKanaCh = c => (c >= 'ぁ' && c <= 'ゖ') || c === 'ー';
const RT_BAD_START = 'んっーゃゅょぁぃぅぇぉゎ';
const UO_VOWEL = 'うくすつぬふむゆるぐずづぶぷぅゅょおこそとのほもよろをごぞどぼぽぉ'; // う단·お단 — 뒤따르는 「う」는 장음
const SMALL_KANA = 'ぁぃぅぇぉゃゅょゎっー';
const moraLen = rt => rt.reduce((n, c) => n + (SMALL_KANA.includes(c) ? 0 : 1), 0); // 한자당 독음 길이 추정용

function alignFurigana(ja, yomiRaw) {
  if (!ja || !yomiRaw) return null;
  if (/[가-힣]/.test(yomiRaw)) return 'KO_MIXED'; // 한글 병기(OT) — 의도된 폴백, 실패 아님
  if (![...ja].some(isKanjiLike)) return 'NO_KANJI';

  const yomi = [...kataToHira(yomiRaw.replace(/[\s　]+/g, ''))];
  const segs = [];
  for (const ch of ja) {
    const t = isKanjiLike(ch) ? 'k' : 'p';
    if (segs.length && segs[segs.length - 1].t === t) segs[segs.length - 1].s += ch;
    else segs.push({ t, s: ch });
  }

  // 백트래킹 정렬: 한자 구간마다 가능한 독음 길이를 모두 시도하고,
  // 비용 Σ(독음길이−한자길이)² 가 최소인 전역 정렬을 채택한다(동점이면 앞 구간이 긴 쪽).
  const N = yomi.length;
  const memo = new Map();
  // afterRt: 직전에 소비한 yomi 글자가 한자 독음(rt)이었는지 — 한자↔한자 경계에서만 장음 규칙 적용
  function solve(si, yi, afterRt) {
    if (si === segs.length) {
      let j = yi;
      while (j < N && PUNCT.includes(yomi[j])) j++;    // 꼬리 구두점 허용
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
        while (j < N && yomi[j] !== c && PUNCT.includes(yomi[j])) j++; // yomi 쪽 구두점 건너뜀
        if (j < N && yomi[j] === c) j++;
        else if (PUNCT.includes(c)) continue;          // yomi 쪽에 구두점이 없는 경우 허용
        else { ok = false; break; }
      }
      if (ok) {
        const rest = solve(si + 1, j, j === yi ? afterRt : false);
        if (rest) best = { cost: rest.cost, parts: [{ text: seg.s }, ...rest.parts] };
      }
    } else {
      // 다음 가나 구간의 첫 글자 — 독음이 뒤따르는 조사·오쿠리가나를 삼키는 동점 해소용
      let nextFirst = null;
      if (segs[si + 1]) {
        const nn = kataToHira(segs[si + 1].s.replace(/[\s　]+/g, ''));
        nextFirst = [...nn].find(c => !PUNCT.includes(c)) || null;
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
  return r ? r.parts : null;                           // 정렬 불가 — 정렬 신뢰 불가
}

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/check-furigana.mjs <content-file.js>'); process.exit(1); }

const mod = await import(new URL('../' + file, import.meta.url));
const data = mod.default;
let total = 0, fail = [];

function checkEx(ex, where) {
  if (!ex?.ja) return;
  total++;
  const r = alignFurigana(ex.ja, ex.yomi);
  if (r === null) fail.push({ where, ja: ex.ja, yomi: ex.yomi || '(없음)' });
}

if (Array.isArray(data)) {
  // grammar 챕터 배열
  data.forEach(c => c.sections.forEach((s, si) =>
    (s.examples || []).forEach(e => checkEx(e, `${c.slug} §${si + 1}`))));
} else {
  // bunkei / vocab
  data.themes.forEach(t => (t.items || t.words).forEach(i => {
    checkEx(i.ex, `${t.name} / ${i.pattern || i.ja}`);
    checkEx(i.ex2, `${t.name} / ${i.pattern || i.ja} (ex2)`);
  }));
}

console.log(`검사: ${total}개 예문 — 정렬 실패 ${fail.length}건`);
fail.forEach(f => console.log(`  ✗ [${f.where}]\n    ja:   ${f.ja}\n    yomi: ${f.yomi}`));
process.exit(fail.length ? 1 : 0);
