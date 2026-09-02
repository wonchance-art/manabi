import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { tokenizeZhLine } from '../tokenizeZh';
import { ZH_SUPPRESS } from '../zhSuppress';
import { collectZhCorpus } from './zhCorpusPinyin.test.js';

/**
 * 회귀 계약: 중국어 품사 — 콘텐츠 전수 (분석기 리뷰 라운드 2).
 * 품사 미상(null) 한자 토큰은 뷰어에 「미상」으로 뜨고 판별기 프롬프트를 낭비한다. 라운드 2 전 179건/42종.
 * 억제 목록의 병합 항목은 코퍼스 어디서도 토큰으로 살아남지 않아야 한다.
 */
describe('중국어 품사 — 콘텐츠 전수 회귀', () => {
  it('품사 미상 한자 토큰이 실측 상한 아래고, 억제 항목은 토큰으로 없다', async () => {
    const rows = await collectZhCorpus();
    const HAN = /[一-鿿]/;
    const nullPos = new Map(); const survived = new Map();
    for (const r of rows) {
      for (const t of tokenizeZhLine(r.zh)) {
        if (!HAN.test(t.text) || t.pos === '기호') continue;
        if (t.pos == null) nullPos.set(t.text, (nullPos.get(t.text) || 0) + 1);
        if (ZH_SUPPRESS.includes(t.text)) survived.set(t.text, (survived.get(t.text) || 0) + 1);
      }
    }
    const nullCount = [...nullPos.values()].reduce((a, b) => a + b, 0);
    if (process.env.ZH_CORPUS_REPORT) writeFileSync(process.env.ZH_CORPUS_REPORT, JSON.stringify({ nullCount, nullTypes: [...nullPos].sort((a, b) => b[1] - a[1]).slice(0, 30), survived: [...survived] }, null, 1));
    expect(rows.length).toBeGreaterThan(5000);
    expect([...survived], '억제 항목이 토큰으로 살아남았다').toEqual([]);
    // 실측(2026-09-02): 라운드 2 전 179건/42종 → 후 2건(高高的/nrfg·物). 문턱 5 — 매핑이 하나 죽으면 수십으로 튄다.
    expect(nullCount).toBeLessThanOrEqual(5);
  }, 120000);
});
