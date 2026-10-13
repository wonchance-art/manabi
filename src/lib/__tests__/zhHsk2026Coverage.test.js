import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 계약: HSK 2026 1–6급 단어는 우리 사전(중국어 어휘)에 전부 있다 — ZH-LEVEL-2026-001 ④(2026-10-13).
 *
 * 정본 = docs/design/hsk2026/words.json(《HSK 考试大纲》 2025-11 发布 · 2026-07 实施 词汇大纲).
 * 정규화(README 규칙): 동형어 번호를 떼고(本1 → 本) 같은 표기는 가장 낮은 급, 괄호 급수(1（4）)는 앞 급수(level).
 * 설계 세션 실측 = 1급 5 · 2급 1 · 3급 6 · 4급 42 · 5급 114 · 6급 416(합 584)이 없던 것을 채웠다.
 * 2급 1개(没意思)는 한 단어짜리 모듈이 어휘 모듈 3단어 하한(contentSchemaContract)에 걸려 h2.js에 둔다.
 * 7–9급은 이 인계 밖이다.
 */
const ROOT = process.cwd();
const VOCAB_DIR = path.join(ROOT, 'src/content/chinese/vocab');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const WORDS = JSON.parse(read('docs/design/hsk2026/words.json'));
const headOf = (e) => e.headword || e.word.replace(/\d+$/, '');
/** 표기 → { level(가장 낮은 급), pinyins(원문 병음·별음 전부) } — 1–6급만 */
function hsk2026Levels() {
  const map = new Map();
  for (const e of WORDS) {
    const w = headOf(e);
    const lv = /^[1-6]$/.test(e.level) ? Number(e.level) : 99;
    const cur = map.get(w) || { level: 99, pinyins: new Set() };
    cur.level = Math.min(cur.level, lv);
    // 격음 부호는 리포 관례 ASCII '(원문 PDF 추출본의 곡선 ’와 같은 부호로 본다 — bù'ān 선례)
    cur.pinyins.add(e.pinyin.replace(/’/g, "'"));
    for (const alt of e.pinyin_alts || []) cur.pinyins.add(alt.replace(/’/g, "'"));
    map.set(w, cur);
  }
  return new Map([...map].filter(([, v]) => v.level <= 6));
}

async function loadVocabFiles() {
  const files = fs.readdirSync(VOCAB_DIR).filter((f) => f.endsWith('.js')).sort();
  const out = [];
  for (const f of files) {
    const mod = await import(`../../content/chinese/vocab/${f.replace(/\.js$/, '')}.js`);
    const words = (mod.default?.themes || []).flatMap((t) => t.words || []);
    out.push({ file: f, words });
  }
  return out;
}

describe('HSK 2026 1–6급 — 우리 사전 커버리지', () => {
  it('words.json 1–6급 정규화 = 5,334표기(1급 300 · 2급 197 · 3급 491 · 4급 990 · 5급 1,579 · 6급 1,777)', () => {
    const count = {};
    for (const { level } of hsk2026Levels().values()) count[level] = (count[level] || 0) + 1;
    // 원문 단어 수(300·200·500·1,000·1,600·1,800)보다 적은 것은 동형어 번호·같은 표기를 하나로 묶었기 때문이다.
    expect(count).toEqual({ 1: 300, 2: 197, 3: 491, 4: 990, 5: 1579, 6: 1777 });
  });

  it('1–6급 2026 단어 중 우리 사전에 없는 것 0', async () => {
    const heads = new Set((await loadVocabFiles()).flatMap((f) => f.words.map((w) => w?.zh)).filter(Boolean));
    const missing = [...hsk2026Levels()].filter(([w]) => !heads.has(w)).map(([w, v]) => `${w}(${v.level}급)`);
    expect(missing).toEqual([]);
  });

  it('보강 파일(h{n}_hsk2026.js) — 파일 급수 = 2026 급수, 병음 = 2026 원문, 예문·뜻·품사 있음, 합 583(+ h2.js 没意思)', async () => {
    const lv = hsk2026Levels();
    const files = (await loadVocabFiles()).filter((f) => /_hsk2026\.js$/.test(f.file));
    expect(files.map((f) => f.file)).toEqual(['h1_hsk2026.js', 'h3_hsk2026.js', 'h4_hsk2026.js', 'h5_hsk2026.js', 'h6_hsk2026.js']);
    const counts = {};
    const bad = [];
    for (const { file, words } of files) {
      const n = Number(/^h(\d)/.exec(file)[1]);
      counts[n] = words.length;
      for (const w of words) {
        const want = lv.get(w.zh);
        if (!want) { bad.push(`${file} ${w.zh}: 2026 1–6급 밖`); continue; }
        if (want.level !== n) bad.push(`${file} ${w.zh}: 2026 ${want.level}급`);
        if (!want.pinyins.has(w.pinyin)) bad.push(`${file} ${w.zh}: 병음 ${w.pinyin} ∉ ${[...want.pinyins].join('/')}`);
        if (!w.ko || !w.pos || !w.ex?.zh || !w.ex?.pinyin || !w.ex?.ko) bad.push(`${file} ${w.zh}: 필드 누락`);
        if (w.ex?.zh && !w.ex.zh.includes(w.zh)) bad.push(`${file} ${w.zh}: 예문에 표제어 없음`);
      }
    }
    expect(bad).toEqual([]);
    expect(counts).toEqual({ 1: 5, 3: 6, 4: 42, 5: 114, 6: 416 });
    const h2 = (await loadVocabFiles()).find((f) => f.file === 'h2.js').words.find((w) => w.zh === '没意思');
    expect(h2?.pinyin).toBe('méi yìsi');
    expect(lv.get('没意思').level).toBe(2);
  });

  it('보강 파일이 레지스트리(index.js 급별 병합)와 급수 인덱스(refVocabIndex)에 같은 급으로 등록돼 있다', () => {
    const index = read('src/content/chinese/index.js');
    const ref = read('src/lib/refVocabIndex.js');
    for (const n of [1, 3, 4, 5, 6]) {
      expect(index).toContain(`import vocabH${n}hsk2026 from './vocab/h${n}_hsk2026';`);
      expect(sliceBetween(index, `H${n}: mergeVocab(`, ')')).toContain(`vocabH${n}hsk2026`);
      expect(ref).toContain(`import('../content/chinese/vocab/h${n}_hsk2026').then((m) => ({ level: 'H${n}', mod: m }))`);
    }
  });

  it('한국어 동형이의어(같은 한자, 다른 뜻·쓰임)는 첫 뜻에 두지 않고 한자 주의를 단다 — 转机·入住·出力·分期·改编·青春期·原本·质疑', async () => {
    const all = (await loadVocabFiles()).filter((f) => /_hsk2026\.js$/.test(f.file)).flatMap((f) => f.words);
    const CASES = { 转机: '전기', 入住: '입주', 出力: '출력', 分期: '분기', 改编: '개편', 青春期: '청춘기', 原本: '원본', 质疑: '질의' };
    for (const [zh, eum] of Object.entries(CASES)) {
      const w = all.find((x) => x.zh === zh);
      expect(w, zh).toBeTruthy();
      expect(w.ko.split(/[;,]/)[0], `${zh} 첫 뜻`).not.toContain(eum);
      expect(w.hanja, `${zh} 한자 주의`).toMatch(new RegExp(`^${eum}\\(.+\\) — `));
    }
    // 표본 대조(2026-10-13)로 가짜동족이 아니라고 본 것 — 谈论(담론의 기본 뜻 = 이야기함)은 주의 없음,
    // 预定은 본뜻 「미리 정하다」가 첫 뜻(예약은 보통 预订).
    expect(all.find((x) => x.zh === '谈论').hanja).toBeUndefined();
    expect(all.find((x) => x.zh === '预定').ko.split(/[;,]/)[0]).toBe('미리 정하다');
  });
});
