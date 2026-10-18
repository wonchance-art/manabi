import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

// 계약: HSK 2026 1~6급 단어 빠짐 0 (ZH-LEVEL-2026-001 ④ — 오너 승인 2026-10-13 KST).
// 원천 《中文水平考试 HSK 考试大纲》(中外语言交流合作中心, 2025-11 발표 · 2026-07 시행) 词汇大纲
// = docs/design/hsk2026/words.json. 우리 사전(src/content/chinese/vocab)에 없던 1~6급 584개를
// 「HSK{n} 2026 보강」 주제로 채웠다(h{n}_hsk2026.js, 2급 1개는 모듈 3단어 하한 때문에 h2_hsk30.js 끝 주제)
// — 병음은 대강 원문 그대로, 품사는 원문 품사의 첫 갈래.
// 레벨 화면(AJ) 중국어 목록이 「2026 급수 · 우리 사전에 있는 단어만」이라, 빠지면 목록에서 조용히 사라진다.

const ROOT = process.cwd();
const VOCAB_DIR = path.join(ROOT, 'src/content/chinese/vocab');
const SOURCE = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/design/hsk2026/words.json'), 'utf8'));
const FILL_COUNTS = { 1: 5, 2: 1, 3: 6, 4: 42, 5: 114, 6: 416 };
const POS = { 名: '명사', 动: '동사', 形: '형용사', 副: '부사', 代: '대명사', 数: '수사', 量: '양사', 数量: '수량사', 介: '전치사', 连: '접속사', 助: '조사', 叹: '감탄사', 后缀: '접미사', 前缀: '접두사' };

const files = fs.readdirSync(VOCAB_DIR).filter((f) => f.endsWith('.js')).sort();
const themesByFile = Object.fromEntries(await Promise.all(files.map(async (f) => {
  const mod = await import(pathToFileURL(path.join(VOCAB_DIR, f)).href);
  return [f, (mod.default || mod).themes];
})));
const modules = Object.fromEntries(Object.entries(themesByFile).map(([f, themes]) => [f, themes.flatMap((t) => t.words)]));
const FILL_THEME = /^HSK([1-6]) 2026 보강$/;
/** 급수 → 채운 단어(「HSK{n} 2026 보강」 주제) */
const fillByLevel = {};
for (const [f, themes] of Object.entries(themesByFile)) {
  for (const t of themes) {
    const m = FILL_THEME.exec(t.name);
    if (!m) continue;
    expect(f, `${t.name}는 h${m[1]}_* 파일에`).toMatch(new RegExp(`^h${m[1]}_`));
    (fillByLevel[m[1]] ??= []).push(...t.words);
  }
}

/** 2026 표제어(동형어 번호 뗌) → 가장 낮은 급수의 항목 */
const source2026 = new Map();
for (const e of SOURCE) {
  if (e.level === '7-9') continue;
  const hw = e.headword ?? e.word;
  const prev = source2026.get(hw);
  if (!prev || Number(prev.level) > Number(e.level)) source2026.set(hw, e);
}

describe('HSK 2026 1~6급 — 우리 사전 빠짐 0', () => {
  it('1~6급 표제어가 전부 우리 사전 어딘가에 있다', () => {
    const dict = new Set(Object.values(modules).flat().map((w) => w.zh));
    const missing = [...source2026.keys()].filter((w) => !dict.has(w));
    expect(missing).toEqual([]);
  });

  it('채운 주제 — 급수별 개수 고정(1급 5 · 2급 1 · 3급 6 · 4급 42 · 5급 114 · 6급 416)', () => {
    for (const [lv, n] of Object.entries(FILL_COUNTS)) {
      expect(fillByLevel[lv]?.length, `HSK${lv} 2026 보강`).toBe(n);
    }
  });

  it('채운 항목은 그 급수의 2026 단어이고, 병음은 원문 그대로 · 품사는 원문 첫 갈래 · 뜻 · 예문이 있다', () => {
    const bad = [];
    for (const lv of Object.keys(FILL_COUNTS)) {
      for (const w of fillByLevel[lv]) {
        const src = source2026.get(w.zh);
        const firstPos = src?.pos.split('、')[0].replace(/[（）()]/g, '');
        const pos = firstPos ? POS[firstPos] : '표현';
        if (!src || src.level !== lv) bad.push(`${w.zh}: ${lv}급 2026 단어가 아님`);
        else if (w.pinyin !== src.pinyin) bad.push(`${w.zh}: 병음 ${w.pinyin} ≠ 원문 ${src.pinyin}`);
        else if (w.pos !== pos) bad.push(`${w.zh}: 품사 ${w.pos} ≠ ${pos}`);
        if (!w.ko?.trim() || !w.ex?.zh?.includes(w.zh) || !w.ex?.pinyin?.trim() || !w.ex?.ko?.trim()) bad.push(`${w.zh}: 뜻 · 예문 누락`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('채운 단어는 다른 사전 파일과 겹치지 않는다(이미 있던 표제어를 새로 쓰지 않는다)', () => {
    const fill = Object.values(fillByLevel).flat().map((w) => w.zh);
    const count = new Map();
    for (const w of Object.values(modules).flat()) count.set(w.zh, (count.get(w.zh) ?? 0) + 1);
    expect(fill.filter((zh) => count.get(zh) !== 1)).toEqual([]);
  });

  it('사전 파일은 전부 두 색인(레퍼런스 레지스트리 · 단어 색인)에 등록돼 있다 — 빠진 파일은 화면에 안 나온다', () => {
    const registry = fs.readFileSync(path.join(ROOT, 'src/content/chinese/index.js'), 'utf8');
    const index = fs.readFileSync(path.join(ROOT, 'src/lib/refVocabIndex.js'), 'utf8');
    for (const f of files) {
      const name = f.replace(/\.js$/, '');
      expect(registry, f).toContain(`'./vocab/${name}'`);
      expect(index, f).toContain(`'../content/chinese/vocab/${name}'`);
    }
  });
});

// 7–9급 통합 밴드(LEVEL-HSK79-001 — 오너 2026-10-16 KST 「HSK 7~9도 추가 · 통째로 · 이전에 확보한 pdf로」).
// 1~6급에 없는 7–9급 표제어 중 우리 사전에 없던 4,246개를 「HSK7–9 2026 보강」(h7_hsk2026_a~e.js)으로 채웠다.
// 콘텐츠 레벨 세트가 아니라 ZH_HSK79_VOCAB으로만 내보낸다(레지스트리 · 교재 보관함 · 목표 레벨 커버리지 밖).
const FILL79_THEME = 'HSK7–9 2026 보강';
const FILL79_COUNT = 4246;
const POS79 = { ...POS, 拟声: '의성어' };
const fill79 = Object.entries(themesByFile).flatMap(([f, themes]) => themes.filter((t) => t.name === FILL79_THEME).map((t) => [f, t.words]));
/** 7–9급 표제어(1~6급에 있는 것은 뺀다) → 대강 첫 항목 */
const source79 = new Map();
for (const e of SOURCE) {
  const hw = e.headword ?? e.word;
  if (e.level !== '7-9' || source2026.has(hw) || source79.has(hw)) continue;
  source79.set(hw, e);
}

describe('HSK 2026 7–9급 — 우리 사전 빠짐 0', () => {
  it('7–9급 표제어가 전부 우리 사전 어딘가에 있다', () => {
    const dict = new Set(Object.values(modules).flat().map((w) => w.zh));
    expect([...source79.keys()].filter((w) => !dict.has(w))).toEqual([]);
  });

  it(`채운 주제는 h7_hsk2026_* 파일에만, 모두 ${FILL79_COUNT}개`, () => {
    for (const [f] of fill79) expect(f).toMatch(/^h7_hsk2026_[a-e]\.js$/);
    expect(fill79.flatMap(([, words]) => words).length).toBe(FILL79_COUNT);
  });

  it('채운 항목은 7–9급 2026 단어이고, 병음은 원문 그대로 · 품사는 원문 첫 갈래 · 뜻 · 예문(표제어 포함)이 있다', () => {
    const bad = [];
    for (const w of fill79.flatMap(([, words]) => words)) {
      const src = source79.get(w.zh);
      const firstPos = src?.pos.split('、')[0].replace(/[（）()]/g, '');
      const pos = firstPos ? POS79[firstPos] : '표현';
      if (!src) bad.push(`${w.zh}: 1~6급에 없는 7–9급 2026 단어가 아님`);
      else if (w.pinyin !== src.pinyin) bad.push(`${w.zh}: 병음 ${w.pinyin} ≠ 원문 ${src.pinyin}`);
      else if (w.pos !== pos) bad.push(`${w.zh}: 품사 ${w.pos} ≠ ${pos}`);
      if (!w.ko?.trim() || !w.ex?.zh?.includes(w.zh) || !w.ex?.pinyin?.trim() || !w.ex?.ko?.trim()) bad.push(`${w.zh}: 뜻 · 예문 누락`);
    }
    expect(bad).toEqual([]);
  });

  it('채운 단어는 다른 사전 파일과 겹치지 않는다', () => {
    const count = new Map();
    for (const w of Object.values(modules).flat()) count.set(w.zh, (count.get(w.zh) ?? 0) + 1);
    expect(fill79.flatMap(([, words]) => words).map((w) => w.zh).filter((zh) => count.get(zh) !== 1)).toEqual([]);
  });

  it('콘텐츠 레벨 세트(레지스트리)가 아니라 ZH_HSK79_VOCAB으로만 나간다 — H6 교재 · 목표 커버리지에 섞이지 않는다', async () => {
    const zh = await import('../../content/chinese/index.js');
    expect(zh.ZH_HSK79_VOCAB.flatMap((m) => m.themes.flatMap((t) => t.words)).length).toBe(FILL79_COUNT);
    const registryWords = new Set(zh.ZH_LEVEL_META.flatMap((m) => (zh.getVocab(m.key)?.themes || []).flatMap((t) => t.words.map((w) => w.zh))));
    expect(fill79.flatMap(([, words]) => words).filter((w) => registryWords.has(w.zh))).toEqual([]);
    const index = fs.readFileSync(path.join(ROOT, 'src/lib/refVocabIndex.js'), 'utf8');
    for (const x of 'abcde') expect(index).toContain(`import('../content/chinese/vocab/h7_hsk2026_${x}').then((m) => ({ level: 'H7', mod: m }))`);
  });
});
