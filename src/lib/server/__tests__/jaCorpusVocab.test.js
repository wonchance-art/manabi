import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { tokenizeJaLine } from '../tokenizeJa';

/**
 * 회귀 계약: 일본어 어휘 표제어 — 자기 예문에서의 생존(분석기 라운드 10, 2026-09-02).
 *
 * 어휘 표제어마다 사람이 적은 pos와 예문이 있다. 예문을 토큰화해 표제어가 한 토큰(표면 또는 기본형)으로 살아남는
 * 비율은 분절의 성질이다 — kuromoji의 복합명사 과분할(映画|館)을 재병합하면 오르고, 규칙이 죽으면 떨어진다.
 * 미생존의 큰 몫은 표제어 표기 차이(어휘는 가나 いぬ, 예문은 犬)와 〜표기(〜分·〜時)라 비율은 1에 가까워지지 않는다.
 * 품사는 kuromoji 큰 품사 ↔ 콘텐츠 라벨 매핑으로 대조한다(な형용사는 名詞/形容動詞語幹이라 명사·형용동사 둘 다 인정).
 */
const MAP = { '명사': ['명사'], '동사(1)': ['동사'], '동사(2)': ['동사'], '동사(3)': ['동사'], '부사': ['부사'], 'い형용사': ['형용사'], 'な형용사': ['형용동사', '명사'], '접속사': ['접속사'], '감탄사': ['감탄사'], '연체사': ['연체사'], '조사': ['조사'], '조동사': ['조동사'] };

describe('일본어 어휘 표제어 — 예문 생존·품사 회귀', () => {
  it('표제어 단일 토큰 생존율과 품사 일치율이 실측 문턱 아래로 내려가지 않는다', async () => {
    const mod = await import('../../../content/japanese/index.js');
    const rows = [];
    for (const m of mod.JA_LEVEL_META || []) {
      const v = mod.getVocab(m.key);
      for (const th of v?.themes || []) for (const w of th.words || []) if (w.ja && w.pos && w.ex?.ja) rows.push({ ja: String(w.ja), pos: w.pos, ex: w.ex.ja });
    }
    let survived = 0; let mapped = 0; let agree = 0; const miss = new Map();
    for (const r of rows) {
      const heads = r.ja.split(/[;；]/).map((s) => s.trim().replace(/^[〜～]/, '').replace(/[〜～]$/, '')).filter(Boolean);
      const toks = await tokenizeJaLine(r.ex);
      const t = toks.find((x) => heads.includes(x.text)) ?? toks.find((x) => heads.includes(x.base_form));
      if (!t) continue;
      survived++;
      const want = MAP[r.pos];
      if (!want) continue;
      mapped++;
      if (want.includes(t.pos)) agree++;
      else { const k = `${r.pos}→${t.pos}`; miss.set(k, (miss.get(k) || 0) + 1); }
    }
    const survival = survived / rows.length;
    const posRate = agree / mapped;
    if (process.env.JA_CORPUS_REPORT) writeFileSync(process.env.JA_CORPUS_REPORT + '.vocab', JSON.stringify({ rows: rows.length, survived, survival, mapped, agree, posRate, miss: [...miss].sort((a, b) => b[1] - a[1]).slice(0, 15) }, null, 1));
    expect(rows.length).toBeGreaterThan(6000);
    // 실측(2026-09-02): 라운드 10 전 0.9277(6,771/7,299) → 후 0.9412(6,870). 문턱은 그 아래 0.935 — 재병합이 죽으면 0.928로 떨어진다.
    expect(survival).toBeGreaterThanOrEqual(0.935);
    // 품사 일치(매핑 가능 단일 토큰): 실측 0.9858(6,549/6,643) — 불일치는 연체사/명사·부사가능 명사 같은 분류 차이.
    expect(posRate).toBeGreaterThanOrEqual(0.97);
    // 라운드 10이 닫은 부류 — 재병합 규칙이 죽으면 여기서 잡힌다
    const py = async (line, w) => (await tokenizeJaLine(line)).find((x) => x.text === w);
    expect((await py('駅前に映画館ができた。', '映画館'))?.furigana).toBe('えいがかん');
    expect((await py('今日は姉の誕生日です。', '誕生日'))?.furigana).toBe('たんじょうび');
  }, 600000);
});
