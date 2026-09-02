import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { tokenizeJaLine } from '../tokenizeJa';

/**
 * 회귀 계약: 일본어 요미 — 콘텐츠 정답지 전수 대조 (분석기 리뷰 라운드 3, #1077 5501779373 §2).
 *
 * ja 예문마다 사람이 적은 `yomi`가 있다. 한자 문장 전부를 kuromoji+수리층 출력과 대조해 완전 일치율과
 * 범인 토큰 상한을 못 박는다 — 라이브러리·사전·규칙이 바뀌면 CI가 먼저 빨개진다.
 *
 * ── 잣대
 * 가나 전용 문장은 뺀다(요미 = 본문이라 대조가 무의미 — 그쪽은 분할 문제, 라운드 4). 숫자·로마자 문장은
 * 정답지 관례가 갈려(３時 さんじ / 3時) 뺀다. 정답지의 한글 발음 병기 「(와타시와…)」와 구두점은 걷어낸다.
 * 양쪽 다 맞는 이독(家 いえ/うち·昨夜 さくや/ゆうべ)은 불일치로 남는다 — 그래서 100%가 아니라 문턱이다.
 */
const HAN = /[一-鿿々]/;
const DIG = /[0-9０-９A-Za-zＡ-Ｚａ-ｚ]/;
const KANA_ONLY = /^[^一-鿿々]*$/;
const PUN = /[\s　。、！？!?…「」『』（）()〜～・,.\-—"“”]/g;
const HANGUL = /\([^)]*[가-힣][^)]*\)|[가-힣]+/g;
const k2h = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const norm = (s) => k2h(s.normalize('NFKC')).replace(HANGUL, '').replace(PUN, '');
const isKana = (s) => /^[ぁ-ゖァ-ヶーゝゞ]+$/.test(s);

function walk(node, out, seen) {
  if (!node || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) { node.forEach((c) => walk(c, out, seen)); return; }
  if (typeof node.ja === 'string' && typeof node.yomi === 'string' && HAN.test(node.ja)) out.push({ ja: node.ja, yomi: node.yomi });
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v, out, seen);
}

export async function collectJaCorpus() {
  const mod = await import('../../../content/japanese/index.js');
  const seen = new Set(); const rows = [];
  for (const ch of mod.ALL_CHAPTERS || []) walk(ch, rows, seen);
  for (const m of mod.JA_LEVEL_META || []) { walk(mod.getBunkei(m.key), rows, seen); walk(mod.getVocab(m.key), rows, seen); }
  walk(mod.getReadingTrack('n5-tokyo'), rows, seen);
  const uniq = new Map();
  for (const r of rows) {
    if (DIG.test(r.ja) || KANA_ONLY.test(r.ja)) continue;
    if (!(/[。、！？!?…]/.test(r.ja) || /\s/.test(r.ja.trim()) || [...r.ja].length >= 6)) continue;
    if (!uniq.has(r.ja)) uniq.set(r.ja, r);
  }
  return [...uniq.values()];
}

/** 토큰의 요미 조각 — 독음 있으면 독음, 가나 표면은 그대로, 독음 없는 한자는 표면(OOV 신호). */
const seg = (t) => norm(t.furigana ? t.furigana : (isKana(t.text) || !HAN.test(t.text)) ? t.text : t.text);

export async function auditJaYomi(rows) {
  const stat = { sentences: 0, match: 0, mismatch: 0 };
  const culprit = new Map(); const samples = new Map();
  for (const r of rows) {
    const toks = (await tokenizeJaLine(r.ja)).filter((t) => t.pos !== '기호');
    const segs = toks.map(seg);
    const got = segs.join(''); const want = norm(r.yomi);
    stat.sentences++;
    if (got === want) { stat.match++; continue; }
    stat.mismatch++;
    // 범인 토큰: 공통 접두를 뗀 뒤 첫 차이를 덮는 토큰
    let i = 0; while (i < Math.min(got.length, want.length) && got[i] === want[i]) i++;
    let acc = 0;
    for (let k = 0; k < toks.length; k++) {
      if (i < acc + segs[k].length || k === toks.length - 1) {
        culprit.set(toks[k].text, (culprit.get(toks[k].text) || 0) + 1);
        if (!samples.has(toks[k].text)) samples.set(toks[k].text, []);
        if (samples.get(toks[k].text).length < 2) samples.get(toks[k].text).push(`${r.ja} | 정답 ${want} | 분석 ${got}`);
        break;
      }
      acc += segs[k].length;
    }
  }
  return { stat, culprit, samples };
}

describe('일본어 요미 — 정답지 전수 대조 회귀', () => {
  it('문장 완전 일치율이 실측 문턱 아래로 내려가지 않고, 라운드 3 범인이 되살아나지 않는다', async () => {
    const rows = await collectJaCorpus();
    const { stat, culprit, samples } = await auditJaYomi(rows);
    const rate = stat.match / stat.sentences;
    if (process.env.JA_CORPUS_REPORT) {
      writeFileSync(process.env.JA_CORPUS_REPORT, JSON.stringify({ ...stat, rate }, null, 1) + '\n'
        + [...culprit].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([w, n]) => `${w} ${n}`).join(' · ') + '\n'
        + [...culprit].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => `## ${w}\n  ${(samples.get(w) || []).join('\n  ')}`).join('\n') + '\n');
    }
    expect(rows.length).toBeGreaterThan(5000);
    // 실측(2026-09-02): 라운드 3 전 0.934 → 후 0.97+ (9,207문장). 문턱은 그 아래 0.965.
    expect(rate).toBeGreaterThanOrEqual(0.965);
    // 라운드 3 범인 상한 — 규칙 하나가 죽으면 수십 단위로 튄다(日本 70·二 47·一 36·何 23·間 21). 者·一日은
    // 토큰 일치로 넣었다가 되레 튀었던 자리(40·16)라 회귀 감시.
    for (const [w, cap] of Object.entries({ 日本: 2, 二: 3, 一: 5, 何: 6, 間: 3, 者: 6, 一日: 3, 今: 3, 後: 3 })) {
      expect(culprit.get(w) ?? 0, `${w} 오독`).toBeLessThanOrEqual(cap);
    }
  }, 300000);
});
