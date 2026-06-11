#!/usr/bin/env node
/**
 * 요미가나 정렬 검사 — ja에 한자가 있는데 루비 정렬이 실패하는 예문을 찾는다.
 * 사용: node scripts/check-furigana.mjs src/content/japanese/bunkei/n5.js
 * (refShared.jsx의 alignFurigana와 동일 로직)
 */
const isKanjiLike = ch => /[一-鿿々〆ヶ0-9０-９]/.test(ch);
const kataToHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const PUNCT = '。、・！？!?,. 　「」『』();（）:〜';

function alignFurigana(ja, yomiRaw) {
  if (!ja || !yomiRaw) return null;
  if (/[가-힣]/.test(yomiRaw)) return 'KO_MIXED'; // 한글 병기(OT) — 의도된 폴백, 실패 아님
  if (![...ja].some(isKanjiLike)) return 'NO_KANJI';
  const yomi = kataToHira(yomiRaw.replace(/[\s　]+/g, ''));
  const segs = [];
  for (const ch of ja) {
    const t = isKanjiLike(ch) ? 'k' : 'p';
    if (segs.length && segs[segs.length - 1].t === t) segs[segs.length - 1].s += ch;
    else segs.push({ t, s: ch });
  }
  let yi = 0;
  const out = [];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (seg.t === 'p') {
      const norm = kataToHira(seg.s.replace(/[\s　]+/g, ''));
      for (const c of norm) {
        if (yi < yomi.length && yomi[yi] === c) yi++;
        else if (PUNCT.includes(c)) continue;
        else return null;
      }
      out.push({ text: seg.s });
    } else {
      let endIdx = yomi.length;
      const next = segs[i + 1];
      if (next) {
        const anchorNorm = kataToHira(next.s.replace(/[\s　]+/g, ''));
        const anchor = [...anchorNorm].find(c => !PUNCT.includes(c));
        if (anchor) {
          const found = yomi.indexOf(anchor, yi + 1);
          if (found === -1) return null;
          endIdx = found;
        }
      }
      const rt = yomi.slice(yi, endIdx);
      if (!rt) return null;
      out.push({ text: seg.s, rt });
      yi = endIdx;
    }
  }
  if (yi < yomi.length) return null;
  return out;
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
