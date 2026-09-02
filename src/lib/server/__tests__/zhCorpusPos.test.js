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
    // 실측(2026-09-02): 라운드 2 전 179건/42종 → 후 2건(高高的/nrfg·物) → 라운드 8 후 4건(+胡说·恩人 — 두-실단어
    // 되가름 조각을 jieba가 홀로 다시 갈라 x 폴백). 문턱 8 — 매핑이 하나 죽으면 수십으로 튄다.
    expect(nullCount).toBeLessThanOrEqual(8);
  }, 120000);

  /**
   * 어휘 정답지 대조(라운드 9): 어휘 표제어를 자기 예문에서 토큰화해 콘텐츠 pos와 비교한다. 겸류 후보(pos_all)에
   * 콘텐츠 pos가 있으면 일치로 친다(문맥 판별기가 짚는 자리). 불일치의 절반은 분류 체계 차이(콘텐츠 명사 ⊃ 시간사·
   * 방위사·처소사, 개사=전치사)라 비율은 1에 가까워지지 않는다 — 문턱은 회귀 감지용이다.
   */
  it('어휘 표제어 품사 — 자기 예문에서의 일치율이 실측 문턱 아래로 내려가지 않는다', async () => {
    const mod = await import('../../../content/chinese/index.js');
    const rows = [];
    for (const m of mod.ZH_LEVEL_META || []) {
      const v = mod.getVocab(m.key);
      for (const th of v?.themes || []) for (const w of th.words || []) if (w.zh && w.pos && w.ex?.zh) rows.push({ zh: w.zh, pos: w.pos, ex: w.ex.zh });
    }
    let single = 0; let agree = 0; const miss = new Map();
    for (const r of rows) {
      const t = tokenizeZhLine(r.ex).find((x) => x.text === r.zh);
      if (!t) continue;
      single++;
      if (t.pos === r.pos || (t.pos_all && t.pos_all.split('·').includes(r.pos))) agree++;
      else { const k = `${r.pos}→${t.pos ?? '미상'}`; miss.set(k, (miss.get(k) || 0) + 1); }
    }
    const rate = agree / single;
    if (process.env.ZH_CORPUS_REPORT) writeFileSync(process.env.ZH_CORPUS_REPORT + '.pos', JSON.stringify({ single, agree, rate, miss: [...miss].sort((a, b) => b[1] - a[1]).slice(0, 20) }, null, 1));
    expect(rows.length).toBeGreaterThan(5000);
    expect(single / rows.length).toBeGreaterThan(0.8);   // 표제어가 단일 토큰으로 살아남는 비율 — 분절 규칙이 표제어를 부수면 여기서 잡힌다(실측 0.864)
    // 실측(2026-09-02): 라운드 9 전 0.8356 → 후 0.85__ (단일 토큰 6,034). 문턱은 그 아래.
    expect(rate).toBeGreaterThanOrEqual(0.84);
    // 라운드 9가 닫은 부류 — 이합사 n→동사(走路), 사전 오태그 수제(一起/m·红绿灯/nr·高兴/b)
    const py = (line, w) => tokenizeZhLine(line).find((x) => x.text === w);
    expect(py('我走路去学校。', '走路')?.pos).toBe('동사');
    expect(py('我走路去学校。', '走路')?.pos_all).toBe('동사·명사');
    expect(py('我们一起去吧。', '一起')?.pos).toBe('부사');
    expect(py('到红绿灯右拐。', '红绿灯')?.pos).toBe('명사');
    expect(py('我很高兴。', '高兴')?.pos).toBe('형용사');
  }, 120000);
});
