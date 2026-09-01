import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { tokenizeZhLine } from '../tokenizeZh';

/**
 * 회귀 계약: 중국어 병음 — 콘텐츠 정답지 전수 대조 (분석기 리뷰 라운드 1, #1077 5501779373).
 *
 * 분석기 검토는 여태 손으로 고른 문장으로 했다. 그런데 정답지가 이미 있었다 — zh 예문마다 사람이
 * 적은 `pinyin`. 콘텐츠 트리 전체(챕터·문형사전·어휘 예문)를 걸어 문장을 모으고 분석기 출력과
 * 대조하면, 분석기나 라이브러리(jieba·pinyin-pro)가 바뀔 때 CI가 먼저 빨개진다. 실측치가 낡지
 * 않는 유일한 방법이다(규약: 원칙이 코드로 표현되면 계약으로 심는다).
 *
 * ── 관례 중립화
 * 정답지와 분석기가 **표기 관례**에서 갈리는 것은 오독이 아니다: 一·不 변조(정답지 yī/bù, 뷰어
 * yì/bú — #1004 결정, 오너 결정 대기), 个의 경성 표기(정답지 자체가 gè/ge 혼용). 이 셋은 성조를
 * 지우고 비교한다. 정답지의 음절 띄어쓰기(어휘 H1~H6 25%)는 병음 비교와 무관하다(공백 무시).
 *
 * ── 왜 비율을 못 박나
 * 개별 문장을 못 박으면 콘텐츠가 바뀔 때마다 깨진다. 비율은 분석기의 성질이다. 문턱은 실측치
 * 바로 아래에 둔다 — 회귀는 잡고 콘텐츠 증감의 잡음은 흘린다.
 */
const HAN = /[一-鿿]/;
const LAT = /[A-Za-z0-9０-９]/;
const V = 'aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
const TONE = { ā: 'a', á: 'a', ǎ: 'a', à: 'a', ē: 'e', é: 'e', ě: 'e', è: 'e', ī: 'i', í: 'i', ǐ: 'i', ì: 'i', ō: 'o', ó: 'o', ǒ: 'o', ò: 'o', ū: 'u', ú: 'u', ǔ: 'u', ù: 'u', ǖ: 'ü', ǘ: 'ü', ǚ: 'ü', ǜ: 'ü' };
const stripTone = (s) => [...s].map((c) => TONE[c] ?? c).join('');

function syllabify(word) {
  const out = []; let i = 0; const n = word.length;
  while (i < n) {
    let j = i; while (j < n && !V.includes(word[j])) j++;
    let k = j; while (k < n && V.includes(word[k])) k++;
    let c = k;
    if (c < n && word[c] === 'n') {
      if (c + 1 < n && word[c + 1] === 'g' && (c + 2 >= n || !V.includes(word[c + 2]))) c += 2;
      else if (c + 1 >= n || !V.includes(word[c + 1])) c += 1;
    } else if (c < n && word[c] === 'r' && (c + 1 >= n || !V.includes(word[c + 1]))) c += 1;
    if (k === j) break;
    out.push(word.slice(i, c)); i = c;
  }
  return out;
}
const cleanGold = (s) => s.normalize('NFC').toLowerCase().replace(/v/g, 'ü').replace(/u:/g, 'ü')
  .replace(/[’'\-·,，。！？?!.:;：；"“”()（）…]/g, ' ').trim().split(/\s+/).filter(Boolean);
/** 관례 중립화 — 一·不 변조, 个 경성은 성조를 지운다. */
const neutral = (syl) => {
  const base = stripTone(syl);
  return base === 'yi' || base === 'bu' || base === 'ge' ? base : syl.normalize('NFC');
};

function walk(node, out, seen) {
  if (!node || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) { node.forEach((c) => walk(c, out, seen)); return; }
  if (typeof node.zh === 'string' && typeof node.pinyin === 'string' && HAN.test(node.zh)) out.push({ zh: node.zh, pinyin: node.pinyin });
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v, out, seen);
}

export async function collectZhCorpus() {
  const mod = await import('../../../content/chinese/index.js');
  const seen = new Set(); const rows = [];
  for (const ch of mod.ALL_CHAPTERS || []) walk(ch, rows, seen);
  for (const m of mod.ZH_LEVEL_META || []) { walk(mod.getBunkei(m.key), rows, seen); walk(mod.getVocab(m.key), rows, seen); }
  const uniq = new Map();
  for (const r of rows) if (!LAT.test(r.zh) && (/[。！？，]/.test(r.zh) || [...r.zh].length >= 6) && !uniq.has(r.zh)) uniq.set(r.zh, r);
  return [...uniq.values()];
}

export function auditZhPinyin(rows) {
  const stat = { sentences: 0, unalignable: 0, match: 0, mismatch: 0 };
  const byChar = new Map();   // 한자 → { total, wrong }
  for (const r of rows) {
    const gold = cleanGold(r.pinyin).flatMap(syllabify).map(neutral);
    const toks = tokenizeZhLine(r.zh).filter((t) => t.pos !== '기호' && HAN.test(t.text) && t.furigana);
    const got = toks.flatMap((t) => t.furigana.split(' ')).map(neutral);
    const chars = toks.flatMap((t) => [...t.text]);
    stat.sentences++;
    if (gold.length !== got.length) { stat.unalignable++; continue; }
    let ok = true;
    for (let i = 0; i < gold.length; i++) {
      const c = byChar.get(chars[i]) ?? { total: 0, wrong: 0 };
      c.total++;
      if (gold[i] !== got[i]) { c.wrong++; ok = false; }
      byChar.set(chars[i], c);
    }
    stat[ok ? 'match' : 'mismatch']++;
  }
  return { stat, byChar };
}

describe('중국어 병음 — 정답지 전수 대조 회귀', () => {
  it('문장 완전 일치율이 실측 문턱 아래로 내려가지 않는다', async () => {
    const rows = await collectZhCorpus();
    const { stat, byChar } = auditZhPinyin(rows);
    const aligned = stat.match + stat.mismatch;
    const rate = stat.match / aligned;
    if (process.env.ZH_CORPUS_REPORT) {
      const worst = [...byChar].filter(([, c]) => c.wrong >= 3).sort((a, b) => b[1].wrong - a[1].wrong).slice(0, 40)
        .map(([ch, c]) => `${ch} ${c.wrong}/${c.total}`).join(' · ');
      writeFileSync(process.env.ZH_CORPUS_REPORT, JSON.stringify({ ...stat, aligned, rate }, null, 1) + '\n' + worst + '\n');
    }
    expect(rows.length).toBeGreaterThan(5000);              // 코퍼스가 통째로 사라지면 비율이 무의미하다
    expect(stat.unalignable / stat.sentences).toBeLessThan(0.03);
    // 실측(2026-09-02): 라운드 1 전 0.888 → 후 0.918 (8,388문장 정렬). 문턱은 그 아래 0.91.
    expect(rate).toBeGreaterThanOrEqual(0.91);
    // 구조조사·다음자 — 라운드 1이 닫은 부류. 글자별 오독 상한 = 실측 잔여(得 20·地 16·了 ≤2·过 17·
    // 种 0·只 0)에 콘텐츠 증감 여유를 더한 값. 규칙 하나가 죽으면 그 글자가 수십~백 단위로 튄다.
    for (const [ch, cap] of Object.entries({ 得: 25, 地: 20, 了: 5, 过: 22, 种: 2, 只: 2 })) {
      expect(byChar.get(ch)?.wrong ?? 0, `${ch} 오독`).toBeLessThanOrEqual(cap);
    }
  }, 120000);
});
