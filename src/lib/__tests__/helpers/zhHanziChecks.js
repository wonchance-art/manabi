// 「한자」 탭 표 데이터 검사 ⑴–⑻(HANZI-TAB-AL-001 · 인계 §3) — 계약 테스트와 「일부러 깨뜨리기」 테스트가 같은 함수를 쓴다.
import {
  HANZI_CAPS, HANZI_GLOSS_MAX, HANZI_SET_SIZE, HANZI_STD, hanziClash, hanziPieces, readingOfSyllable, syllablesAt,
} from '../../zhHanzi.js';

/** 붙어 한 단어 · 문법 갈래는 10자 상한 밖(인계 §2 — 「동사에 붙어 한 단어」). */
const LONG_GLOSS = /붙어 한 단어|^문법 · /;

/** 정체 후보 — 글자 표(첫 후보) + 구절 표에서 그 글자 자리에 오는 꼴 + 글자 자신(OpenCC 파생 hanjaTrad). */
export function zhengCandidates(ch, trad) {
  const out = new Set([ch]);
  if (trad.chars?.[ch]) out.add(trad.chars[ch]);
  for (const map of [trad.phrases, trad.twPhrases]) {
    for (const [k, v] of Object.entries(map || {})) {
      const ks = [...k];
      const vs = [...v];
      if (ks.length !== vs.length) continue;
      ks.forEach((c, i) => { if (c === ch) out.add(vs[i]); });
    }
  }
  return out;
}

/**
 * @param {object} table - src/lib/data/zhHanzi/<level>.json
 * @param {object} ctx - {levelChars: string, universe: Map, trad, panel, lookalike: Set<string>, kernels: Set<string>}
 * @returns {string[]} 어긋남(없으면 [])
 */
export function checkHanziTable(table, { levelChars, universe, trad, panel, lookalike, kernels }) {
  const errors = [];
  const chars = Object.keys(table.chars || {});
  // ⑴ 글자표의 글자가 빠짐없이 한 번씩, std 고정
  const want = [...levelChars];
  const missing = want.filter((c) => !table.chars[c]);
  const extra = chars.filter((c) => !want.includes(c));
  if (missing.length) errors.push(`⑴ 빠진 글자 ${missing.join('')}`);
  if (extra.length) errors.push(`⑴ 급수 밖 글자 ${extra.join('')}`);
  if (table._meta?.std !== HANZI_STD) errors.push('⑴ _meta.std');
  for (const ch of chars) {
    const e = table.chars[ch];
    if (e.std !== HANZI_STD) errors.push(`⑴ ${ch} std`);
    const readings = [...e.rd.map((r) => r.py), ...(e.other || []).map((o) => o.py)];
    const seen = new Set();
    // ⑵ 단어는 우리 사전 표제어(단어 범위)이고 그 글자를 포함 ⑶ 그 자리 음절 = 소리
    const checkWord = (w, py, where) => {
      if (!universe.has(w)) errors.push(`⑵ ${ch} ${where} ${w}: 사전 단어 아님`);
      else if (!w.includes(ch)) errors.push(`⑵ ${ch} ${where} ${w}: 글자 없음`);
      else if (py) {
        const syls = syllablesAt(universe.get(w), ch);
        if (!syls || !syls.some((s) => readingOfSyllable(ch, s, readings) === py)) errors.push(`⑶ ${ch} ${py} ${w}: 소리 어긋남`);
      }
    };
    if (e.rd.length > HANZI_CAPS.readings) errors.push(`⑸ ${ch} 소리 ${e.rd.length}`);
    for (const r of e.rd) {
      // ⑷ n = 그 소리로 읽히는 사전 단어 수
      let n = 0;
      for (const [zh, entry] of universe) {
        if (!zh.includes(ch)) continue;
        const syls = syllablesAt(entry, ch);
        if (syls?.some((s) => readingOfSyllable(ch, s, readings) === r.py)) n++;
      }
      if (n !== r.n) errors.push(`⑷ ${ch} ${r.py} n=${r.n} ≠ ${n}`);
      if (r.s.length > HANZI_CAPS.groups) errors.push(`⑸ ${ch} ${r.py} 갈래 ${r.s.length}`);
      // ⑹ 정체 후보
      if (r.zheng && !zhengCandidates(ch, trad).has(r.zheng)) errors.push(`⑹ ${ch} ${r.py} 正 ${r.zheng}`);
      for (const s of r.s) {
        if (!s.g) errors.push(`⑸ ${ch} 빈 갈래`);
        if (!LONG_GLOSS.test(s.g) && [...s.g].length > HANZI_GLOSS_MAX) errors.push(`⑸ ${ch} 갈래 ${s.g}: ${HANZI_GLOSS_MAX}자 초과`);
        if (s.fn !== undefined) {
          // ⑺ 문법 갈래 — 문형 색인 핵심어, 단어 대신 짧은 구만
          if (!kernels.has(s.fn)) errors.push(`⑺ ${ch} fn ${s.fn}: 문형 색인에 없음`);
          if (s.w) errors.push(`⑺ ${ch} 문법 갈래에 단어`);
          if (!s.phr?.length || s.phr.length > HANZI_CAPS.phrases) errors.push(`⑺ ${ch} 짧은 구 ${s.phr?.length || 0}`);
          for (const p of s.phr || []) if (!p.includes(ch)) errors.push(`⑺ ${ch} 구 ${p}: 글자 없음`);
          continue;
        }
        if (s.phr) errors.push(`⑺ ${ch} 단어 갈래에 짧은 구`);
        if (!s.w?.length || s.w.length > HANZI_CAPS.words) errors.push(`⑸ ${ch} 갈래 ${s.g} 단어 ${s.w?.length || 0}`);
        for (const w of s.w || []) {
          if (seen.has(w)) errors.push(`⑸ ${ch} ${w}: 두 갈래`);
          seen.add(w);
          checkWord(w, r.py, '갈래');
        }
      }
    }
    for (let i = 1; i < e.rd.length; i++) if (e.rd[i].n > e.rd[i - 1].n) errors.push(`⑷ ${ch} 소리 순서`);
    if ((e.watch || []).length > HANZI_CAPS.watch) errors.push(`⑸ ${ch} 주의 ${e.watch.length}`);
    for (const x of e.watch || []) {
      if (seen.has(x.w)) errors.push(`⑸ ${ch} 주의 ${x.w}: 갈래에도 있음`);
      checkWord(x.w, null, '주의');
    }
  }
  // ⑻ 한 묶음 안에 같은 조각 · 닮은꼴 짝 없음, 묶음 크기 ≤ 12
  const bySet = new Map();
  for (const ch of chars) {
    const set = table.chars[ch].set;
    if (!bySet.has(set)) bySet.set(set, []);
    bySet.get(set).push(ch);
  }
  const pieces = (c) => hanziPieces(c, panel, trad.chars);
  for (const [set, list] of bySet) {
    if (list.length > HANZI_SET_SIZE) errors.push(`⑻ 묶음 ${set} ${list.length}자`);
    if (set === 0) continue; // 문법 글자 묶음은 기능으로 모은다
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (hanziClash(list[i], list[j], { pieces, lookalike })) errors.push(`⑻ 묶음 ${set} ${list[i]}${list[j]}`);
      }
    }
  }
  return errors;
}
