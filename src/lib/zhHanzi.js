// 중국어 레벨 화면 「한자」 탭(HANZI-TAB-AL-001) — 생성기(scripts/build-zh-hanzi.mjs)와 계약 테스트가 함께 쓰는 순수 규칙.
// 인계 #1337 6146776723 §3. 표(src/lib/data/zhHanzi/<level>.json)는 표제어를 가리키기만 하고, 단어 · 뜻 · 병음의
// 원천은 우리 사전 하나다. 화면은 loadHanziTable(동적 import)만 쓴다.
import { normalizePinyin, splitPinyinSyllables } from './viewerHanjaPanel.js';

export const HANZI_STD = 'hsk2026';
export const HANZI_LEVELS = ['H1', 'H2'];
export const HANZI_SET_SIZE = 12;
/** 답 카드 상한(인계 §2) — 소리 3 · 소리당 갈래 3 · 갈래당 단어 3 · 주의 2 · 문법 갈래 짧은 구 2. */
export const HANZI_CAPS = Object.freeze({ readings: 3, groups: 3, words: 3, watch: 2, phrases: 2 });
export const HANZI_GLOSS_MAX = 10;

const HAN_ONLY = /^\p{Script=Han}+$/u;
const SANDHI = new Set(['一', '不']);

/**
 * 「우리 사전 단어」의 범위 — 한자만으로 된 표제어 중 3글자 이하, 또는 HSK 단어표(2021 · 2026)에 있는 말.
 * 여행 구절(信号不好 · 国际转机 같은 4글자 이상 상황 구절)은 단어 칩 · 단어 수에서 뺀다.
 * @param {Iterable<{zh: string, pinyin: string}>} entries - 사전 항목(첫 표제어 우선)
 * @param {Set<string>} hskWords
 * @returns {Map<string, object>} 표제어 → 항목
 */
export function hanziWordUniverse(entries, hskWords) {
  const out = new Map();
  for (const e of entries) {
    const zh = e?.zh;
    if (!zh || out.has(zh) || !HAN_ONLY.test(zh)) continue;
    if ([...zh].length <= 3 || hskWords.has(zh)) out.set(zh, e);
  }
  return out;
}

/** 소리 비교 꼴 — 一 · 不 변조는 본래 성조로(yí · yì → yī, bú → bù). */
export function hanziSyllable(ch, syl) {
  const s = normalizePinyin(syl);
  if (!s) return '';
  if (SANDHI.has(ch)) {
    const bare = normalizePinyin(s, { toneless: true });
    if (ch === '一' && bare === 'yi' && s !== 'yi') return 'yī';
    if (ch === '不' && bare === 'bu' && s !== 'bu') return 'bù';
  }
  return s;
}

const isNeutral = (s) => s === normalizePinyin(s, { toneless: true });

/**
 * 한 음절이 어느 소리로 읽히는가 — 성조까지 같으면 그 소리. 경성은 같은 글자 소리의 가벼운 읽기로 본다
 * (bu → bù, 같은 바탕 소리가 여럿이면 앞 소리). 경성 자체가 소리로 올라 있으면(得 de) 그것이 먼저다.
 * @returns {string|null}
 */
export function readingOfSyllable(ch, syl, readings) {
  const s = hanziSyllable(ch, syl);
  if (!s) return null;
  if (readings.includes(s)) return s;
  if (isNeutral(s)) {
    const bare = normalizePinyin(s, { toneless: true });
    return readings.find((r) => normalizePinyin(r, { toneless: true }) === bare) || null;
  }
  return null;
}

/** 표제어 속 ch 자리마다의 음절(나눌 수 없으면 null). */
export function syllablesAt(entry, ch) {
  const cs = [...entry.zh];
  const syl = splitPinyinSyllables(entry.pinyin, cs.length, { erhua: cs.at(-1) === '儿' });
  if (!syl) return null;
  return cs.flatMap((c, i) => (c === ch ? [syl[i]] : []));
}

/**
 * 글자 ch를 담은 사전 단어를 소리별로 나눈다. readings가 없으면 사전에 보이는 소리(변조 정규화) 그대로.
 * @returns {{byReading: Map<string, string[]>, unmatched: string[]}} 단어는 사전 순서 그대로
 */
export function wordsByReading(ch, universe, readings = null) {
  const byReading = new Map((readings || []).map((r) => [r, []]));
  const unmatched = [];
  for (const [zh, entry] of universe) {
    if (!zh.includes(ch)) continue;
    const syls = syllablesAt(entry, ch);
    if (!syls) continue;
    const got = new Set();
    for (const syl of syls) {
      const r = readings ? readingOfSyllable(ch, syl, readings) : hanziSyllable(ch, syl);
      if (r) got.add(r);
      else unmatched.push(zh);
    }
    for (const r of got) {
      if (!byReading.has(r)) byReading.set(r, []);
      byReading.get(r).push(zh);
    }
  }
  return { byReading, unmatched: [...new Set(unmatched)] };
}

/** 조어력 — 그 글자를 담은 HSK 2026 단어 수(대강 전체, 같은 표기는 한 번). */
export function hanziRank(ch, hskWords) {
  let n = 0;
  for (const w of hskWords) if (w.includes(ch)) n++;
  return n;
}

/**
 * 글자 조각 — 형성자 역할(뜻 · 소리 조각)이 있으면 그것, 없으면 1단 성분. 조회는 정체 꼴(없으면 글자 그대로).
 * @param {string} ch
 * @param {{roles?: object, comps?: object}} panel - hanjaPanel.json
 * @param {Record<string, string>} tradChars - hanjaTrad.json chars
 */
export function hanziPieces(ch, panel, tradChars = {}) {
  for (const c of [tradChars[ch], ch]) {
    if (!c) continue;
    const role = panel?.roles?.[c];
    if (role) return [...role].slice(0, 2);
    const comps = panel?.comps?.[c];
    if (comps) return [...comps];
  }
  return [];
}

/** 두 글자가 한 묶음에 있으면 안 되는가 — 같은 조각을 나눔(뜻 · 소리) 또는 닮은꼴 짝. */
export function hanziClash(a, b, { pieces, lookalike }) {
  if (lookalike?.has(`${a}${b}`) || lookalike?.has(`${b}${a}`)) return true;
  const pa = pieces(a);
  const pb = pieces(b);
  if (pa.includes(b) || pb.includes(a)) return true;
  return pa.some((p) => pb.includes(p));
}

/**
 * 12자 묶음 — 순서(조어력 순)대로 넣되, 지금 묶음의 글자와 부딪히면 다음 묶음으로 미룬다(결정적).
 * 미룬 글자는 다음 묶음의 맨 앞 후보가 된다.
 * @param {string[]} ordered
 * @returns {string[][]}
 */
export function assignHanziSets(ordered, clash, size = HANZI_SET_SIZE) {
  const sets = [];
  let pending = [...ordered];
  while (pending.length) {
    const set = [];
    const rest = [];
    for (const ch of pending) {
      if (set.length < size && !set.some((o) => clash(o, ch))) set.push(ch);
      else rest.push(ch);
    }
    if (!set.length) throw new Error('assignHanziSets: no progress');
    sets.push(set);
    pending = rest;
  }
  return packTail(sets, clash, size);
}

/**
 * 꼬리 다듬기 — 부딪힘에 밀려 마지막 묶음이 몇 자만 남으면(1자 묶음 등) 그 글자를 앞 묶음의 빈자리로,
 * 빈자리가 없으면 한 글자와 맞바꿔(맞바뀐 글자는 다른 빈자리로) 옮긴다. 다 옮기면 마지막 묶음을 없앤다.
 */
function packTail(sets, clash, size) {
  const fits = (set, ch, skip = null) => set.length - (skip ? 1 : 0) < size && !set.some((o) => o !== skip && clash(o, ch));
  while (sets.length > 1) {
    const tail = sets.at(-1);
    const room = sets.slice(0, -1).reduce((n, s) => n + (size - s.length), 0);
    if (room < tail.length) break;
    const body = sets.slice(0, -1).map((s) => [...s]);
    let ok = true;
    for (const x of tail) {
      const direct = body.findLast((s) => fits(s, x));
      if (direct) { direct.push(x); continue; }
      let moved = false;
      for (let si = body.length - 1; si >= 0 && !moved; si--) {
        for (const y of body[si]) {
          if (body[si].some((o) => o !== y && clash(o, x))) continue;
          const other = body.findLast((t, ti) => ti !== si && fits(t, y));
          if (!other) continue;
          body[si] = [...body[si].filter((o) => o !== y), x];
          other.push(y);
          moved = true;
          break;
        }
      }
      if (!moved) { ok = false; break; }
    }
    if (!ok) break;
    sets.splice(0, sets.length, ...body);
  }
  return sets;
}

/** 표 한 장의 정렬 — 조어력 많은 순, 같으면 코드포인트. */
export function byRank(rank) {
  return (a, b) => (rank[b] - rank[a]) || (a.codePointAt(0) - b.codePointAt(0));
}

/** 글자 하나의 모든 단어(갈래 · 주의) — 계약 ⑵ · ⑸가 쓴다. */
export function hanziEntryWords(entry) {
  const ws = [];
  for (const rd of entry.rd || []) for (const s of rd.s || []) for (const w of s.w || []) ws.push(w);
  for (const w of entry.watch || []) ws.push(w.w);
  return ws;
}

/** 급수 표 동적 import — 화면은 이것만 쓴다(정적 import 0). */
const tableLoaders = {
  H1: () => import('./data/zhHanzi/H1.json'),
  H2: () => import('./data/zhHanzi/H2.json'),
};
export function loadHanziTable(level) {
  const load = tableLoaders[String(level || '').toUpperCase()];
  return load ? load().then((m) => m.default || m) : Promise.resolve(null);
}
