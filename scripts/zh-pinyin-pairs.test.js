import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectZhPinyinPairs } from './zh-pinyin-pairs.mjs';

/**
 * 계약: lint-curriculum (h) 병음 게이트의 사각 0 — 콘텐츠 모듈 트리의 모든 {zh, pinyin} 쌍이 소스 정규식에도
 * 잡힌다. 게이트는 텍스트를 읽고 앱은 모듈을 읽으므로, 둘의 집합이 갈리는 만큼 게이트가 못 보는 문장이
 * 생긴다(라운드 6 실측: JSON식 "zh": 표기 7본 406쌍). 새 파일이 다른 표기로 들어오면 여기서 먼저 빨개진다.
 */
const HAN = /[一-鿿]/;
function walk(node, out, seen) {
  if (!node || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) { node.forEach((c) => walk(c, out, seen)); return; }
  if (typeof node.zh === 'string' && typeof node.pinyin === 'string' && HAN.test(node.zh)) out.push(`${node.zh}|${node.pinyin}`);
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v, out, seen);
}

describe('zh·pinyin 쌍 수확 — 게이트 사각 0', () => {
  it('키 따옴표 유무·이스케이프를 모두 받는다', () => {
    const src = `{ zh: "他说：\\"好\\"。", pinyin: "tā shuō: \\"hǎo\\"." }\n{ "zh": "你好", "pinyin": "nǐ hǎo", "ko": "안녕" }\n{ zh: "无", ko: "x", pinyin: "wú" }`;
    expect(collectZhPinyinPairs(src)).toEqual([
      { zh: '他说："好"。', pinyin: 'tā shuō: "hǎo".' },
      { zh: '你好', pinyin: 'nǐ hǎo' },
    ]);
  });

  it('모듈 트리의 모든 쌍이 소스 정규식에도 잡힌다', async () => {
    const mod = await import('../src/content/chinese/index.js');
    const tree = []; const seen = new Set();
    for (const ch of mod.ALL_CHAPTERS) walk(ch, tree, seen);
    for (const m of mod.ZH_LEVEL_META) { walk(mod.getBunkei(m.key), tree, seen); walk(mod.getVocab(m.key), tree, seen); }
    const fromSource = new Set();
    for (const sub of ['grammar', 'bunkei', 'vocab']) {
      for (const f of readdirSync(`src/content/chinese/${sub}`)) {
        if (!f.endsWith('.js')) continue;
        for (const p of collectZhPinyinPairs(readFileSync(`src/content/chinese/${sub}/${f}`, 'utf8'))) fromSource.add(`${p.zh}|${p.pinyin}`);
      }
    }
    const missed = tree.filter((k) => !fromSource.has(k));
    expect(tree.length).toBeGreaterThan(15000);   // 공허 통과 방지
    expect(missed.slice(0, 10)).toEqual([]);
    expect(missed).toHaveLength(0);
  }, 60000);
});
