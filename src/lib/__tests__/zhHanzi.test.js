// 「한자」 탭 데이터 계약(HANZI-TAB-AL-001 · 인계 #1337 6146776723 §3 ⑴–⑼ · 수용 기준 6).
// 표(src/lib/data/zhHanzi/<level>.json)는 생성기가 만들고, 여기서는 ① 생성기 결과와 디스크가 같은지(결정성)
// ② 검사 ⑴–⑻이 통과하는지 ③ 각 검사를 일부러 깨뜨리면 실패하는지 ④ 크기 · import · 출처(⑼)를 본다.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { buildHanziTable, loadHanziInputs } from '../../../scripts/build-zh-hanzi.mjs';
import { HANZI_LEVELS, assignHanziSets, hanziClash, hanziSyllable, loadHanziTable, readingOfSyllable, wordsByReading } from '../zhHanzi.js';
import { loadPatternIndex } from '../patternIndex.js';
import { checkHanziTable, zhengCandidates } from './helpers/zhHanziChecks.js';

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const json = (f) => JSON.parse(read(f));

const inputs = await loadHanziInputs();
const kernels = new Set((await loadPatternIndex('Chinese', { allKernels: true })).keys()); // 화면과 같은 색인(문형 보기)
const ctxOf = (level) => {
  const content = json(`src/content/chinese/hanzi/${level}.json`);
  return {
    content,
    ctx: {
      levelChars: inputs.chars[String(Number(level.slice(1)))],
      universe: inputs.universe,
      trad: inputs.trad,
      panel: inputs.panel,
      lookalike: new Set((content.lookalike || []).map((p) => p.join(''))),
      kernels,
    },
  };
};
const clone = (x) => JSON.parse(JSON.stringify(x));

describe.each(HANZI_LEVELS)('%s 표', (level) => {
  const file = `src/lib/data/zhHanzi/${level}.json`;
  const table = json(file);
  const { content, ctx } = ctxOf(level);

  it('생성기 결과와 같다 — 같은 입력 → 같은 표(node scripts/build-zh-hanzi.mjs --check)', () => {
    const built = buildHanziTable(level, content, inputs);
    expect(built.errors).toEqual([]);
    expect(`${JSON.stringify(built.table)}\n`).toBe(read(file));
  });

  it('검사 ⑴–⑻ 통과', () => {
    expect(checkHanziTable(table, ctx)).toEqual([]);
  });

  it('⑼ 크기 gzip 45KB 이하 · 화면은 동적 import만', async () => {
    const gz = zlib.gzipSync(fs.readFileSync(path.join(ROOT, file))).length;
    expect(gz).toBeLessThanOrEqual(45 * 1024);
    expect((await loadHanziTable(level)).chars).toEqual(table.chars);
  });
});

describe('일부러 깨뜨리면 실패한다(수용 기준 6)', () => {
  const table = json('src/lib/data/zhHanzi/H1.json');
  const { ctx } = ctxOf('H1');
  const firstWordGroup = (t) => Object.entries(t.chars).find(([, e]) => e.rd[0].s.some((s) => s.w?.length >= 2));
  const cases = {
    '⑴ 글자 빠짐': (t) => { delete t.chars[Object.keys(t.chars)[5]]; },
    '⑴ std': (t) => { Object.values(t.chars)[0].std = 'hsk2021'; },
    '⑵ 사전 밖 단어': (t) => { const [, e] = firstWordGroup(t); e.rd[0].s.find((s) => s.w).w[0] = '没有这个词'; },
    '⑶ 소리 어긋남': (t) => {
      const [, e] = Object.entries(t.chars).find(([, x]) => x.rd.length >= 2 && x.rd[1].s.some((s) => s.w));
      e.rd[1].s.find((s) => s.w).w.push(e.rd[0].s.find((s) => s.w).w[0]);
    },
    '⑷ n 어긋남': (t) => { Object.values(t.chars)[3].rd[0].n += 1; },
    '⑷ 소리 순서': (t) => { const e = Object.values(t.chars).find((x) => x.rd.length >= 2 && x.rd[0].n > x.rd[1].n); e.rd.reverse(); },
    '⑸ 갈래당 단어 상한': (t) => { const [, e] = firstWordGroup(t); const s = e.rd[0].s.find((x) => x.w); s.w = [...s.w, ...s.w, ...s.w].slice(0, 4); },
    '⑸ 주의 단어가 갈래에도': (t) => { const e = Object.values(t.chars).find((x) => x.watch?.length); e.rd[0].s.find((s) => s.w).w[0] = e.watch[0].w; },
    '⑸ 뜻 10자 초과': (t) => { Object.values(t.chars)[7].rd[0].s[0].g = '아주 길고 길게 늘어진 한국어 뜻풀이'; },
    '⑹ 정체 후보 밖': (t) => { t.chars['只'].rd[1].zheng = '鳥'; },
    '⑺ 문형 색인 밖 fn': (t) => { const e = Object.values(t.chars).find((x) => x.rd.some((r) => r.s.some((s) => s.fn))); e.rd.find((r) => r.s.some((s) => s.fn)).s.find((s) => s.fn).fn = '없는핵심어'; },
    '⑺ 문법 갈래에 단어': (t) => { const e = Object.values(t.chars).find((x) => x.rd.some((r) => r.s.some((s) => s.fn))); e.rd.find((r) => r.s.some((s) => s.fn)).s.find((s) => s.fn).w = ['的']; },
    '⑻ 같은 조각 한 묶음': (t) => {
      const pieces = (c) => (inputs.panel.roles?.[c] ? [...inputs.panel.roles[c]].slice(0, 2) : []);
      const all = Object.keys(t.chars).filter((c) => t.chars[c].set > 0);
      for (const a of all) {
        const b = all.find((x) => x !== a && t.chars[x].set !== t.chars[a].set && pieces(a).some((p) => pieces(x).includes(p)));
        if (b) { t.chars[b].set = t.chars[a].set; return; }
      }
      throw new Error('같은 조각 짝을 찾지 못함');
    },
  };
  it.each(Object.keys(cases))('%s', (name) => {
    const broken = clone(table);
    cases[name](broken);
    const errors = checkHanziTable(broken, ctx);
    expect(errors.length, name).toBeGreaterThan(0);
    expect(errors.some((e) => e.startsWith(name.slice(0, 1))), `${name}: ${errors.slice(0, 3).join(' / ')}`).toBe(true);
  });
});

describe('규칙', () => {
  it('一 · 不 변조는 본래 성조로, 경성은 같은 바탕 소리의 가벼운 읽기', () => {
    expect([hanziSyllable('一', 'yí'), hanziSyllable('一', 'yì'), hanziSyllable('不', 'bú')]).toEqual(['yī', 'yī', 'bù']);
    expect(readingOfSyllable('爸', 'ba', ['bà'])).toBe('bà');
    expect(readingOfSyllable('得', 'de', ['dé', 'de'])).toBe('de'); // 경성 자체가 소리로 올라 있으면 그것
    expect(readingOfSyllable('行', 'hang', ['xíng'])).toBeNull();
  });

  it('소리별 단어 — 사전에 보이는 대로(行 xíng · háng)', () => {
    const { byReading } = wordsByReading('行', inputs.universe);
    expect(byReading.get('xíng')).toContain('旅行');
    expect(byReading.get('háng')).toContain('银行');
  });

  it('묶음 — 부딪히는 글자는 다른 묶음, 짧은 꼬리는 앞 묶음으로', () => {
    const clash = (a, b) => hanziClash(a, b, { pieces: (c) => ({ 妈: ['女', '马'], 吗: ['口', '马'], 好: ['女', '子'] }[c] || []), lookalike: new Set() });
    const sets = assignHanziSets(['妈', '吗', '好', '人', '大'], clash, 3);
    for (const s of sets) for (const a of s) for (const b of s) if (a !== b) expect(clash(a, b), `${a}${b}`).toBe(false);
    expect(sets.flat().sort()).toEqual(['人', '吗', '大', '好', '妈'].sort());
  });

  it('정체 후보는 구절 표에서도 — 只 → 隻(一只 → 一隻)', () => {
    expect(zhengCandidates('只', inputs.trad).has('隻')).toBe(true);
  });

  it('⑼ 표는 동적 import로만 — 다른 파일이 표를 정적으로 들이지 않는다 · README 출처 줄', () => {
    const files = [];
    const walk = (d) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) { if (n !== '__tests__' && n !== 'data') walk(p); } else if (/\.(jsx?|mjs)$/.test(n)) files.push(p); } };
    walk(path.join(ROOT, 'src'));
    const hits = files.filter((f) => /zhHanzi\/H\d\.json/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
    expect(hits).toEqual(['src/lib/zhHanzi.js']);
    expect(read('src/lib/zhHanzi.js')).not.toMatch(/^import .*zhHanzi\/H\d\.json/m);
    expect(read('src/lib/data/README.md')).toMatch(/zhHanzi\/<level>\.json/);
  });
});
