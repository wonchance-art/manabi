// JLPT 단어 페이지 글자 창의 음 · 훈 표(오너 2026-10-25 KST 「상용한자 교재에서 나오는 모양」 · 시안 ⑧ · 문서 「JLPT 한자 창」).
// 상용한자표 순서대로 음(가타카나) · 훈(히라가나, 오쿠리가나는 괄호 안 흐리게)을 한 줄씩 두고, 그 읽기로 읽히는 JLPT 단어를
// 읽기마다 cap개(내 단어 → 색인 N5→N1, 지금 단어는 뺀다) 붙인다. JLPT 단어가 없는 읽기도 표 순서 그대로 빈 줄로 둔다(오너 「1안」).
// 지금 단어에서 쓰인 읽기에 current. 한 자 내린 읽기(rare)는 흐리게, 그 갈래(음 · 훈)의 끝으로.
// 상용 밖 글자(醤)는 KANJIDIC2의 음 · 훈(jaKanjiOnKun.json)으로 같은 모양을 그리되 쓰이는 줄만 둔다(표시 없음 — 오너 「상용 외 문구 없애」).
// 단어 속 글자 읽기는 색인의 kr(「い,,もの」 — 빌드 때 나눈 값)을 쓴다. 촉음(がっ ↔ がく) · 연탁(ばな ↔ はな)도 같은 읽기로 본다.
import { shortMeaning } from './viewerHanjaPanel.js';

const HAN = /\p{Script=Han}/u;
const chars = (s) => [...String(s || '')];
const hira = (s) => String(s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

let readingPromise = null;
/** 음훈 표 두 벌 — 창을 처음 열 때 한 번 받는다(상용 55KB · 상용 밖 5KB). */
export function loadJaReadingTables() {
  readingPromise ||= Promise.all([import('./data/jaJoyo.json'), import('./data/jaKanjiOnKun.json')])
    .then(([j, o]) => ({ joyo: (j.default || j).r, onkun: (o.default || o).r }))
    .catch((error) => { readingPromise = null; throw error; });
  return readingPromise;
}

/** 「セイ,い.きる,*いばら」 → [{ type, stem, okuri, rare }] (음은 stem = 가타카나 그대로). */
export function parseKanjiReadings(value) {
  if (!value) return [];
  return String(value).split(',').filter(Boolean).map((raw) => {
    const rare = raw.startsWith('*');
    const r = rare ? raw.slice(1) : raw;
    if (/^[ァ-ヶ]/.test(r)) return { type: 'on', stem: r, okuri: '', rare };
    const [stem, okuri = ''] = r.split('.');
    return { type: 'kun', stem, okuri, rare };
  });
}

/** 글자별 읽기 kr(「がく,せい」) → 글자 수와 맞으면 배열, 아니면 null. */
export function kanaPerChar(word, kr) {
  const cs = chars(word);
  const ks = kr == null ? null : String(kr).split(',');
  return ks && ks.length === cs.length ? ks : null;
}

const VOICED = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
const HALF = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };
/** 단어 속 가나(k)가 이 읽기(r)인가 — 같거나, 촉음 꼴(がっ · がく), 첫 소리 연탁(ばな · はな), 그 둘이 겹친 꼴. */
export function sameReading(k, r) {
  if (!k || !r) return false;
  const voiced = (x) => [x, VOICED[x[0]] ? VOICED[x[0]] + x.slice(1) : null, HALF[x[0]] ? HALF[x[0]] + x.slice(1) : null, x[0] === 'ち' ? `じ${x.slice(1)}` : null].filter(Boolean);
  for (const form of voiced(r)) {
    if (k === form) return true;
    if (k.endsWith('っ') && k.length === form.length && k.slice(0, -1) === form.slice(0, -1) && 'くつちき'.includes(form.at(-1))) return true;
  }
  return false;
}

/** 단어 속 그 글자 뒤 히라가나 줄(生きる → きる · 生け花 → け). */
const tailAfter = (cs, i) => {
  let s = '';
  for (let j = i + 1; j < cs.length && /[ぁ-ゖ]/.test(cs[j]); j++) s += cs[j];
  return s;
};

/**
 * 단어 속 한 글자(가나 k, 뒤 히라가나 after)가 어느 읽기 줄인가 — 줄 번호, 없으면 -1.
 * 훈은 줄기가 같으면 오쿠리가나로 가른다: 뒤가 오쿠리가나로 시작(生きる)하면 3, 활용 꼴(生き物 · 生まれ)이면 2,
 * 오쿠리가나 없는 훈(なま · き)이면 1, 줄기만 맞으면 0.5. 음은 1.
 */
export function readingRowOf(readings, k, after = '') {
  let best = -1, score = 0;
  readings.forEach((r, i) => {
    const key = r.type === 'on' ? hira(r.stem) : r.stem;
    if (!sameReading(k, key)) return;
    let s;
    if (r.type === 'on') s = 1;
    else if (!r.okuri) s = 1;
    else if (after.startsWith(r.okuri)) s = 3;
    else if (r.okuri.length > 1 && after && after.startsWith(r.okuri.slice(0, -1))) s = 2;
    else s = 0.5;
    if (s > score) { best = i; score = s; }
  });
  return best;
}

/** 후리가나 덩어리 — 이어진 한자는 한 덩어리에 읽기를 합쳐 단다(一生懸命 → いっしょうけんめい). 가나는 덩어리 밖. */
export function furiganaRuns(word, ks) {
  const cs = chars(word);
  const runs = [];
  cs.forEach((c, i) => {
    const k = ks?.[i] || '';
    const kanji = HAN.test(c) && k;
    const last = runs.at(-1);
    if (kanji && last?.r != null) { last.t += c; last.r += k; }
    else if (kanji) runs.push({ t: c, r: k });
    else if (last && last.r == null) last.t += c;
    else runs.push({ t: c, r: null });
  });
  return runs;
}

const charIndexCache = new WeakMap();
/** 색인(단어 → { level(5–1), reading, meaning, kr }) → 글자별 단어(쉬운 급수 = N5 먼저, 같은 급수는 색인 순서). */
function wordsByChar(refIndex) {
  let byChar = charIndexCache.get(refIndex);
  if (byChar) return byChar;
  byChar = new Map();
  let order = 0;
  for (const [word, entry] of refIndex) {
    const at = order++;
    for (const c of new Set(chars(word))) {
      if (!HAN.test(c)) continue;
      if (!byChar.has(c)) byChar.set(c, []);
      byChar.get(c).push({ word, entry, at });
    }
  }
  for (const list of byChar.values()) list.sort((a, b) => (Number(b.entry.level) || 0) - (Number(a.entry.level) || 0) || a.at - b.at);
  charIndexCache.set(refIndex, byChar);
  return byChar;
}

/**
 * 글자 창의 읽기 표.
 * @param {object} p
 * @param {string} p.ch - 누른 글자(신자체)
 * @param {string} [p.word] - 지금 단어(빠지고, 그 단어의 읽기 줄에 current)
 * @param {number} [p.index] - 지금 단어에서 그 글자의 자리
 * @param {string} [p.kr] - 지금 단어의 글자별 읽기
 * @param {Iterable<object>} [p.savedRows] - 내 단어 행(word_text · language)
 * @param {Map} [p.refIndex] - 단어 → { level, reading, meaning, kr }
 * @param {{ joyo: object, onkun: object }} p.tables
 * @returns {null | { reading: string|null, rows: Array<{ type, stem, okuri, rare, current, words: Array<{ word, at, runs, meaning }> }> }}
 */
export function jaKanjiReadingRows({ ch, word = '', index = null, kr = null, savedRows = [], refIndex = null, tables, cap = 2 } = {}) {
  const joyo = tables?.joyo?.[ch] != null;
  const value = joyo ? tables.joyo[ch] : tables?.onkun?.[ch];
  const readings = parseKanjiReadings(value);
  if (!readings.length) return null;
  const rows = readings.map((r) => ({ ...r, current: false, words: [] }));
  const cs = chars(word);
  const ks = kanaPerChar(word, kr);
  const reading = Number.isInteger(index) && cs[index] === ch && ks?.[index] ? ks[index] : null;
  if (reading) {
    const at = readingRowOf(readings, reading, tailAfter(cs, index));
    if (at >= 0) rows[at].current = true;
  }
  const seen = new Set([word]);
  const consider = (w, entry) => {
    if (!w || seen.has(w) || !entry) return;
    seen.add(w);
    const wcs = chars(w);
    const wks = kanaPerChar(w, entry.kr);
    if (!wks) return;
    const i = wcs.findIndex((c, j) => c === ch && wks[j]);
    if (i < 0) return;
    const row = rows[readingRowOf(readings, wks[i], tailAfter(wcs, i))];
    if (!row || row.words.length >= cap) return;
    row.words.push({ word: w, at: i, runs: furiganaRuns(w, wks), meaning: shortMeaning(String(entry.meaning || '').split(/\s[—–]\s|[.。]\s/)[0]) || '' });
  };
  for (const r of savedRows || []) {
    if (r?.language && r.language !== 'Japanese') continue;
    const w = String(r?.word_text || '');
    if (chars(w).includes(ch)) consider(w, refIndex?.get?.(w));
  }
  if (refIndex) for (const { word: w, entry } of wordsByChar(refIndex).get(ch) || []) consider(w, entry);
  // 한 자 내린 읽기는 그 갈래(음 · 훈)의 끝으로 — 표 순서는 갈래 안에서 그대로.
  const group = (list, type) => [...list.filter((r) => r.type === type && !r.rare), ...list.filter((r) => r.type === type && r.rare)];
  // 상용 밖 글자는 KANJIDIC2의 옛 · 드문 읽기(眩 훈 11개 · 几 きにょう)까지 담겨 있어, 지금 단어 · JLPT 단어가 있는 줄만 남긴다.
  const used = joyo ? rows : rows.filter((r) => r.current || r.words.length);
  const shown = used.length ? used : rows;
  return { reading, rows: [...group(shown, 'on'), ...group(shown, 'kun')] };
}
