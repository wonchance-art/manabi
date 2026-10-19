// 단어 읽기를 글자마다 나누기(JLPT 단어 페이지 글자 칸 첫 줄 「経 날 경 けい」 — 오너 확정 2026-10-19 KST).
// 글자별 음독 · 훈독(jaKanjiReadings.json — KANJIDIC2)으로 단어 읽기를 왼쪽부터 맞춘다. 연탁(か→が) · 촉음(つ→っ) · 々(앞 글자 반복)을 허용한다.
// 전체가 맞지 않는 한자 구간(今日 きょう · 大人 おとな 같은 숙자훈)은 그 구간 글자의 읽기를 비운다 — 틀린 읽기를 붙이지 않는다.
// 빌드(서버 조립)에서만 부른다 — 표는 화면으로 보내지 않고 결과(글자별 읽기)만 싣는다.

const HAN = /\p{Script=Han}/u;
const hira = (s) => String(s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

const VOICED = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど',
  は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
const HALF = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };
const ZJ = { ぢ: 'じ', づ: 'ず' };
const SOKUON = new Set(['つ', 'く', 'ち', 'き']);
// 훈독 오쿠리가나 연용형(話す → 話し · はなし) — 명사로 굳은 단어의 마지막 글자.
const RENYOU = { う: 'い', く: 'き', ぐ: 'ぎ', す: 'し', つ: 'ち', ぬ: 'に', ぶ: 'び', む: 'み', る: 'り' };

/** 글자 하나의 읽기 후보(긴 것 먼저) — 표 읽기 + 연탁 · 반탁 · 촉음 · 연용형 꼴. */
export function kanjiReadingCandidates(raw) {
  const out = new Set();
  for (const r of String(raw || '').split(',').filter(Boolean)) {
    const forms = [r];
    const last = r.slice(-1);
    if (RENYOU[last] && r.length > 1) forms.push(r.slice(0, -1) + RENYOU[last]);
    for (const f of forms) {
      const first = f[0];
      const heads = [f];
      if (VOICED[first]) heads.push(VOICED[first] + f.slice(1));
      if (HALF[first]) heads.push(HALF[first] + f.slice(1));
      if (ZJ[heads[1]?.[0]]) heads.push(ZJ[heads[1][0]] + f.slice(1));
      for (const h of heads) {
        out.add(h);
        if (h.length > 1 && SOKUON.has(h.slice(-1))) out.add(`${h.slice(0, -1)}っ`);
      }
    }
  }
  return [...out].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

/**
 * 글자별 읽기 — 표제어 글자 수와 같은 길이의 배열(한자 자리 = 읽기 또는 '', 가나 자리 = '').
 * 한자가 없거나 읽기가 없으면 null. table = { 글자: '읽기,읽기' }(jaKanjiReadings.json의 r).
 */
export function splitKanjiReadings(word, reading, table) {
  const chars = [...String(word || '')];
  if (!chars.some((c) => HAN.test(c)) || !reading || !table) return null;
  // 읽기 표기 흔들림 — 「けっこん (する)」 · 「まいげつ; まいつき」 · 「うんどうする」(표제어에 する 없음).
  let yomi = hira(String(reading).split(/[;；／/]/)[0].replace(/[（(][^)）]*[)）]/g, '').replace(/[\s　]+/g, ''));
  if (yomi.endsWith('する') && !chars.join('').endsWith('する')) yomi = yomi.slice(0, -2);
  const N = yomi.length;
  const cands = chars.map((c, i) => {
    if (c === '々' && i > 0) return kanjiReadingCandidates(table[chars[i - 1]]);
    return HAN.test(c) ? kanjiReadingCandidates(table[c]) : null;
  });
  const memo = new Map();
  // 왼쪽부터 — 한자는 후보 중 하나, 가나는 그대로(가타카나는 히라가나로). 처음 맞는 해를 쓴다(긴 후보 먼저).
  const solve = (i, at) => {
    if (i === chars.length) return at === N ? [] : null;
    const key = i * 1024 + at;
    if (memo.has(key)) return memo.get(key);
    let res = null;
    if (cands[i]) {
      for (const r of cands[i]) {
        if (!yomi.startsWith(r, at)) continue;
        const rest = solve(i + 1, at + r.length);
        if (rest) { res = [r, ...rest]; break; }
      }
    } else {
      const k = hira(chars[i]);
      if (yomi.startsWith(k, at)) {
        const rest = solve(i + 1, at + k.length);
        if (rest) res = ['', ...rest];
      } else if (chars[i] === 'ー' || /[・\s]/.test(chars[i])) {
        const rest = solve(i + 1, at);
        if (rest) res = ['', ...rest];
      }
    }
    memo.set(key, res);
    return res;
  };
  const whole = solve(0, 0);
  if (whole) return whole.some(Boolean) ? whole : null;
  // 전체가 맞지 않으면 한자 구간마다 — 앞뒤 가나 사이의 구간 읽기만 맞춰 본다(구간 하나가 숙자훈이어도 나머지는 살린다).
  return partialSplit(chars, yomi, cands);
}

function partialSplit(chars, yomi, cands) {
  const out = chars.map(() => '');
  // 가나 구간을 닻으로 한자 구간의 읽기 범위를 정한다(alignFurigana와 같은 생각 — 앞에서부터 가나가 처음 맞는 자리).
  const runs = [];
  for (let i = 0; i < chars.length;) {
    const han = !!cands[i];
    let j = i;
    while (j < chars.length && !!cands[j] === han) j++;
    runs.push({ han, from: i, to: j, text: chars.slice(i, j).map(hira).join('') });
    i = j;
  }
  let at = 0;
  for (let r = 0; r < runs.length; r++) {
    const run = runs[r];
    if (!run.han) {
      if (!yomi.startsWith(run.text, at)) return out.some(Boolean) ? out : null;
      at += run.text.length;
      continue;
    }
    const next = runs[r + 1];
    const end = next ? yomi.indexOf(next.text, at + 1) : yomi.length;
    if (end < 0) return out.some(Boolean) ? out : null;
    const part = yomi.slice(at, end);
    const sub = splitRun(cands.slice(run.from, run.to), part);
    if (sub) sub.forEach((x, k) => { out[run.from + k] = x; });
    at = end;
  }
  return out.some(Boolean) ? out : null;
}

function splitRun(cands, part) {
  const solve = (i, at) => {
    if (i === cands.length) return at === part.length ? [] : null;
    for (const r of cands[i]) {
      if (!part.startsWith(r, at)) continue;
      const rest = solve(i + 1, at + r.length);
      if (rest) return [r, ...rest];
    }
    return null;
  };
  return solve(0, 0);
}
