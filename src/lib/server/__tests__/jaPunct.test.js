import { describe, expect, it } from 'vitest';
import { tokenizeJaLine } from '../tokenizeJa';

/**
 * 계약(JA-PUNCT-001 · 2026-11-08 KST): 문장부호 · 기호만으로 된 토큰은 반각이든 전각이든 품사 「기호」, 후리가나 없음.
 * kuromoji는 반각 ( ) / ~ 와 대시 — 를 미등록어 名詞로 내서, 운영 공개 N5 문법 시드 8편(60~67)에서 60토큰이 뜻 없는 「명사」로
 * 눌렸다. 숫자 · 글자 · 장음(ー) · 々가 섞인 토큰은 그대로 둔다(바꾸는 쪽과 두는 쪽을 한 쌍으로).
 */
const posOf = async (line) => (await tokenizeJaLine(line)).map((t) => [t.text, t.pos]);

describe('JA-PUNCT-001 — 기호만으로 된 토큰은 기호', () => {
  it('반각 ( ) / 와 대시 — 는 기호(운영 시드 60~67의 모양 그대로)', async () => {
    const out = await posOf('何(なに)/誰(だれ) — 例文');
    const marks = out.filter(([text]) => /^[()/—)]+$/.test(text) || text === ')/');
    expect(marks.length).toBeGreaterThanOrEqual(5);
    for (const [, pos] of marks) expect(pos).toBe('기호');
  });

  it('전각 기호는 원래대로 기호', async () => {
    for (const [text, pos] of await posOf('（全角）／「引用」…')) {
      if (/^[（）／「」…]+$/.test(text)) expect(pos).toBe('기호');
    }
  });

  it('기호에는 후리가나가 없다 · 토큰 이음 = 원문', async () => {
    const line = '~人(にん) — 三人(さんにん)/五個';
    const toks = await tokenizeJaLine(line);
    for (const t of toks.filter((x) => x.pos === '기호')) expect(t.furigana).toBeNull();
    expect(toks.map((t) => t.text).join('')).toBe(line); // 공백도 토큰으로 남는다
  });

  it('두는 쪽 — 숫자 · 글자 · 장음 · 々가 든 토큰은 기호로 바꾸지 않는다', async () => {
    const out = await posOf('人々はコーヒーを3杯飲んだ。');
    const pos = Object.fromEntries(out);
    expect(pos['人々']).not.toBe('기호');
    expect(pos['コーヒー']).toBe('명사');
    expect(out.find(([t]) => /3/.test(t))?.[1]).not.toBe('기호');
    expect(pos['。']).toBe('기호');
  });
});
