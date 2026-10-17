#!/usr/bin/env node
// 중국어 「한자」 탭 표 생성기(HANZI-TAB-AL-001 · 인계 #1337 6146776723 §3) — 결정적(같은 입력 → 같은 표).
//
// 입력
//   docs/design/hsk2026/chars.json        HSK 2026 认读字(급수 글자표)
//   src/lib/data/zhHsk2026Level.json       HSK 2026 단어 → 급수(조어력 = 그 글자를 담은 대강 단어 수)
//   src/content/chinese/vocab/*.js        우리 사전 — 단어 · 뜻 · 병음의 유일한 원천
//   src/content/chinese/hanzi/<level>.json 뜻 갈래 · 주의 · 문법 글자 · 닮은꼴(콘텐츠, AI 초안 → 다른 모델 대조)
//   src/lib/data/hanjaPanel.json · hanjaTrad.json  글자 조각 · 정체 후보
// 출력
//   src/lib/data/zhHanzi/<level>.json
//
// 사용: node scripts/build-zh-hanzi.mjs [--check]   (--check = 다시 만들어 디스크와 같은지만 본다)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const Z = await import(pathToFileURL(path.join(root, 'src/lib/zhHanzi.js')).href);

/**
 * 우리 사전 — 화면이 쓰는 것과 같은 항목(refVocabIndex.loadRefVocabIndex의 파일 목록 · 순서 · 「낮은 급수가 이김」 규칙).
 * 목록은 그 파일에서 읽어 둘이 갈라지지 않게 한다.
 * @returns {Promise<Map<string, object>>} 표제어 → 사전 항목
 */
export async function readZhDictionary() {
  const src = fs.readFileSync(path.join(root, 'src/lib/refVocabIndex.js'), 'utf8');
  const files = [...src.matchAll(/import\('\.\.\/content\/chinese\/vocab\/([\w-]+)'\)\.then\(\(m\) => \(\{ level: '(\w+)'/g)].map((m) => ({ file: m[1], level: m[2] }));
  if (files.length < 30) throw new Error(`refVocabIndex 파일 목록을 읽지 못했다(${files.length})`);
  const sets = [];
  // HSK 7–9 보강(level H7, LEVEL-HSK79-001)은 넣지 않는다 — 「한자」 탭(HSK 1 · 2 글자)의 단어 · 조어력은 그 전 사전 그대로.
  for (const { file, level } of files) if (level !== 'H7') sets.push({ level, mod: await import(pathToFileURL(path.join(root, `src/content/chinese/vocab/${file}.js`)).href) });
  const RANK = { H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6 };
  const map = new Map();
  for (const { level, mod } of sets) {
    for (const theme of mod.default?.themes || []) {
      for (const w of theme.words || []) {
        if (!w?.zh) continue;
        const prev = map.get(w.zh);
        if (!prev || (RANK[level] || 9) < (RANK[prev.level] || 9)) map.set(w.zh, { level, word: w });
      }
    }
  }
  return new Map([...map].map(([k, v]) => [k, v.word]));
}

export async function loadHanziInputs() {
  const chars = read('docs/design/hsk2026/chars.json').levels;
  const h26 = read('src/lib/data/zhHsk2026Level.json');
  const h21 = read('src/lib/data/zhHskLevel.json');
  const panel = read('src/lib/data/hanjaPanel.json');
  const trad = read('src/lib/data/hanjaTrad.json');
  const entries = [...(await readZhDictionary()).values()];
  const universe = Z.hanziWordUniverse(entries, new Set([...Object.keys(h26), ...Object.keys(h21)]));
  return { chars, h26Words: Object.keys(h26), panel, trad, universe };
}

export function buildHanziTable(level, content, inputs) {
  const { chars, h26Words, panel, trad, universe } = inputs;
  const lvNum = Number(level.slice(1));
  const list = [...chars[String(lvNum)]];
  const errors = [];
  const out = {};
  const rank = {};
  for (const ch of list) {
    const c = content.chars?.[ch];
    if (!c) { errors.push(`${ch}: 콘텐츠 없음`); continue; }
    const rdPys = (c.rd || []).map((r) => r.py);
    const otherPys = (c.other || []).map((o) => o.py);
    const { byReading, unmatched } = Z.wordsByReading(ch, universe, [...rdPys, ...otherPys]);
    if (unmatched.length) errors.push(`${ch}: 소리가 콘텐츠에 없는 사전 단어 ${unmatched.join(' ')}`);
    const rd = (c.rd || []).map((r) => {
      const n = byReading.get(r.py)?.length || 0;
      if (!n) errors.push(`${ch} ${r.py}: 사전 단어 0 — 「다른 소리」로`);
      const words = (r.s || []).flatMap((s) => s.w || []);
      const hear = r.hear || words.find((w) => [...w].length >= 2) || (r.s || []).flatMap((s) => s.phr || [])[0] || null;
      return { py: r.py, n, ...(r.zheng ? { zheng: r.zheng } : {}), ...(hear ? { hear } : {}), s: r.s };
    });
    rd.sort((a, b) => b.n - a.n); // 안정 정렬 — 같은 수면 콘텐츠 순서
    const other = (c.other || []).map((o) => ({ py: o.py, g: o.g, ...(byReading.get(o.py)?.length ? { n: byReading.get(o.py).length } : {}) }));
    rank[ch] = Z.hanziRank(ch, h26Words);
    out[ch] = {
      lv: lvNum, set: 0, rank: rank[ch], std: Z.HANZI_STD, rd,
      ...(other.length ? { other } : {}),
      ...(c.watch?.length ? { watch: c.watch } : {}),
      ...(c.grammar ? { gram: true } : {}),
    };
  }
  for (const ch of Object.keys(content.chars || {})) if (!list.includes(ch)) errors.push(`${ch}: 이 급수 글자가 아님`);
  if (errors.length) return { errors };

  const lookalike = new Set((content.lookalike || []).map((p) => p.join('')));
  const pieces = (ch) => Z.hanziPieces(ch, panel, trad.chars);
  const clash = (a, b) => Z.hanziClash(a, b, { pieces, lookalike });
  const order = Z.byRank(rank);
  const gram = list.filter((ch) => out[ch].gram).sort(order);
  const rest = list.filter((ch) => !out[ch].gram).sort(order);
  const sets = [...(gram.length ? [gram] : []), ...Z.assignHanziSets(rest, clash)];
  const base = gram.length ? 0 : 1;
  const table = { _meta: { level, std: Z.HANZI_STD, grammarSet: gram.length > 0, source: '《中文水平考试 HSK 考试大纲》汉字大纲 认读字(2025-11 발표 · 2026-07 시행) · 단어 · 뜻 · 병음 = 우리 사전' }, chars: {} };
  sets.forEach((set, i) => {
    for (const ch of set) table.chars[ch] = { ...out[ch], set: base + i };
  });
  return { table, errors: [] };
}

async function main() {
  const check = process.argv.includes('--check');
  const inputs = await loadHanziInputs();
  let bad = false;
  for (const level of Z.HANZI_LEVELS) {
    const content = read(`src/content/chinese/hanzi/${level}.json`);
    const { table, errors } = buildHanziTable(level, content, inputs);
    if (errors.length) {
      bad = true;
      console.error(`${level}: ${errors.length} errors\n  ${errors.slice(0, 40).join('\n  ')}`);
      continue;
    }
    const file = path.join(root, `src/lib/data/zhHanzi/${level}.json`);
    const json = `${JSON.stringify(table)}\n`;
    if (check) {
      if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== json) { bad = true; console.error(`${level}: 표가 생성기 결과와 다르다 — node scripts/build-zh-hanzi.mjs`); }
      continue;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, json);
    const sets = new Set(Object.values(table.chars).map((c) => c.set)).size;
    console.log(`${level}: ${Object.keys(table.chars).length}자 · 묶음 ${sets} · ${json.length}B`);
  }
  if (bad) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
