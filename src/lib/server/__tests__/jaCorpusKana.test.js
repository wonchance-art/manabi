import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { tokenizeJaLine } from '../tokenizeJa';
import JA_YOMI_INDEX from '../../data/jaYomiIndex.json';

/**
 * 회귀 계약: 일본어 가나 전용 문장 — 조각 지문과 정본 적중 (분석기 리뷰 라운드 4).
 * 가나 전용은 요미 대조가 무의미하다(요미 = 본문). 대신 kuromoji 붕괴의 지문을 센다:
 *   · 문중 1자 간투사(え/あ)·1자 동사 파생(み/みる·し/する 아닌 것)·1자 명사 조각
 *   · 내용어의 정본 적중(표제어 또는 읽기 색인)
 */
const HAN = /[一-鿿々]/;
const KANA_ONLY = /^[^一-鿿々]*$/;
const DIG = /[0-9０-９A-Za-zＡ-Ｚａ-ｚ]/;
const CONTENT = new Set(['명사', '동사', '형용사', '부사', '형용동사']);
const k2h = (s) => String(s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

function walk(node, out, seen) {
  if (!node || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) { node.forEach((c) => walk(c, out, seen)); return; }
  if (typeof node.ja === 'string' && typeof node.yomi === 'string') out.push(node.ja);
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v, out, seen);
}
export async function collectJaKanaCorpus() {
  const mod = await import('../../../content/japanese/index.js');
  const seen = new Set(); const rows = [];
  for (const ch of mod.ALL_CHAPTERS || []) walk(ch, rows, seen);
  for (const m of mod.JA_LEVEL_META || []) { walk(mod.getBunkei(m.key), rows, seen); walk(mod.getVocab(m.key), rows, seen); }
  walk(mod.getReadingTrack('n5-tokyo'), rows, seen);
  return [...new Set(rows.filter((s) => KANA_ONLY.test(s) && !DIG.test(s) && /[ぁ-ゖ]/.test(s) && (/[。、！？!?…]/.test(s) || /\s/.test(s.trim()) || [...s].length >= 6)))];
}

describe('가나 전용 문장 — 조각 지문·정본 적중 회귀', () => {
  it('조각 지문이 상한 아래고 내용어 정본 적중이 문턱 위다', async () => {
    const rows = await collectJaKanaCorpus();
    let content = 0, hit = 0, frag = 0; const fragS = new Map();
    for (const s of rows) {
      const toks = (await tokenizeJaLine(s)).filter((t) => t.pos !== '기호');
      toks.forEach((t, i) => {
        if (CONTENT.has(t.pos)) { content++; if (JA_YOMI_INDEX[k2h(t.base_form || '')] || JA_YOMI_INDEX[k2h(t.text || '')]) hit++; }
        const one = [...t.text].length === 1;
        if ((one && t.pos === '간투사' && i > 0) || (one && t.pos === '동사' && t.base_form !== t.text && !['し', 'き', 'み', 'い', 'ね', 'で', 'え'].includes(t.text))) { frag++; fragS.set(t.text, (fragS.get(t.text) || 0) + 1); }
      });
    }
    const rate = hit / content;
    if (process.env.JA_KANA_REPORT) writeFileSync(process.env.JA_KANA_REPORT, JSON.stringify({ sentences: rows.length, content, hit, rate, frag, fragTop: [...fragS].sort((a, b) => b[1] - a[1]).slice(0, 15) }, null, 1));
    expect(rows.length).toBeGreaterThan(500);
    // 실측(2026-09-02, 621문장): 라운드 4 전 적중 0.822·조각 40 → 후 0.892·조각 6. 문턱은 그 아래·위.
    expect(rate).toBeGreaterThanOrEqual(0.87);
    expect(frag).toBeLessThanOrEqual(12);
  }, 300000);
});
