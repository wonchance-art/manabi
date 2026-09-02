import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { tag as jiebaTag } from 'jieba-wasm';
import '../zhSuppress';
import { fixZhTagged, isZhRealWord, splitZhCompound } from '../zhTokenFix';
import { collectZhCorpus } from './zhCorpusPinyin.test.js';

/**
 * 회귀 계약: 중국어 분절 — 두-실단어 되가름(⑦, 분석기 라운드 8)의 정답지 대조.
 *
 * 정답지 예문 병음은 단어 단위로 띄어 쓴다(rfc-zh-pinyin-orthography §1). 그래서 분석기가 토큰을 가른 자리에
 * 정답지도 공백을 뒀는지가 **분절의 정답지**가 된다 — 병음 값이 아니라 공백 위치를 본다. 규칙 ⑦이 가른 자리의
 * 정답지 공백 동의율과, 남은 비실단어 융합 토큰 수를 못 박는다. 규칙이 느슨해지면 동의율이, 죽으면 잔여가 튄다.
 */
const HAN = /^[一-鿿]+$/;
const V = 'aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
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

export function auditZhSegment(rows) {
  const stat = { tokens: 0, fusedNonReal: 0, split: 0, agree: 0, disagree: 0, fallbackX: 0 };
  const disagreed = new Map();
  for (const r of rows) {
    const goldWords = cleanGold(r.pinyin).map(syllabify);
    const starts = new Set(); let acc = 0;
    for (const w of goldWords) { starts.add(acc); acc += w.length; }
    // 규칙 ⑦ 전(raw jieba) 토큰에서 분할 후보를 찾고, 후처리 출력에서 잔여 융합을 센다.
    const raw = jiebaTag(r.zh, true).filter((e) => HAN.test(e.word));
    const aligned = raw.reduce((s, e) => s + [...e.word].length, 0) === acc;
    let si = 0;
    for (const e of raw) {
      const n = [...e.word].length; const s0 = si; si += n;
      const parts = splitZhCompound(e.word, e.tag);
      if (!parts) continue;
      stat.split++;
      if (!aligned) continue;
      const k = [...parts[0]].length;
      if (starts.has(s0 + k)) stat.agree++;
      else { stat.disagree++; disagreed.set(e.word, (disagreed.get(e.word) ?? 0) + 1); }
    }
    // x 폴백 게이지 — 후처리가 **만든** x 실단어 조각만(⑦ 조각을 jieba가 홀로 다시 가른 胡说·恩人). raw에서 이미 x였던
    // 실단어(허용목록 扫码류, 라운드 9b 방벽이 지키는 不太·微信)는 우리가 만든 게 아니라 제외한다.
    const rawAll = jiebaTag(r.zh, true);
    const rawX = new Set(rawAll.filter((e) => e.tag === 'x').map((e) => e.word));
    for (const e of fixZhTagged(rawAll)) {
      if (!HAN.test(e.word)) continue;
      stat.tokens++;
      if ([...e.word].length >= 3 && !isZhRealWord(e.word)) stat.fusedNonReal++;
      if (e.tag === 'x' && [...e.word].length >= 2 && isZhRealWord(e.word) && !rawX.has(e.word)) stat.fallbackX++;
    }
  }
  return { stat, disagreed };
}

describe('중국어 분절 — 실단어 방벽 불변식', () => {
  it('jieba가 한 토큰으로 낸 HSK 실단어(≥2자)를 후처리가 가르는 경우가 없다 (라운드 9b — 微信/x·真诚/a 10건 → 0)', async () => {
    const rows = await collectZhCorpus();
    const broken = new Map();
    for (const r of rows) {
      const raw = jiebaTag(r.zh, true);
      const fixedWords = new Set(fixZhTagged(raw).map((e) => e.word));
      for (const e of raw) {
        if ([...e.word].length < 2 || !HAN.test(e.word) || !isZhRealWord(e.word) || fixedWords.has(e.word)) continue;
        broken.set(`${e.word}/${e.tag}`, (broken.get(`${e.word}/${e.tag}`) || 0) + 1);
      }
    }
    expect([...broken]).toEqual([]);
  }, 120000);
});

describe('중국어 분절 — 두-실단어 되가름의 정답지 공백 대조', () => {
  it('가른 자리의 정답지 공백 동의율이 문턱 위이고, 남은 비실단어 융합 토큰이 실측 상한 아래다', async () => {
    const rows = await collectZhCorpus();
    const { stat, disagreed } = auditZhSegment(rows);
    const agreeRate = stat.agree / (stat.agree + stat.disagree);
    if (process.env.ZH_CORPUS_REPORT) {
      writeFileSync(process.env.ZH_CORPUS_REPORT, JSON.stringify({ ...stat, agreeRate }, null, 1) + '\n'
        + [...disagreed].sort((a, b) => b[1] - a[1]).map(([w, c]) => `${w} ${c}`).join(' · ') + '\n');
    }
    expect(rows.length).toBeGreaterThan(5000);
    // 실측(2026-09-02): 가름 668 · 동의 663 · 불일치 3(摆放着·弥漫着·惦记着 — 정답지가 着를 붙여 씀) → 동의율 0.9955.
    // 문턱은 그 아래 0.97 — 규칙 (b)에서 명사 접미를 받거나 유일성을 느슨하게 하면 0.95 아래로 떨어진다(실측 21 불일치).
    expect(stat.split).toBeGreaterThan(400);            // 규칙이 죽으면 0
    expect(agreeRate).toBeGreaterThanOrEqual(0.97);
    // 남은 비실단어 ≥3자 융합 토큰 — 규칙 전 1,577 → 후 931(모호 분해·명사 접미·성어·고유명사). 상한 = 잔여 + 여유.
    expect(stat.fusedNonReal).toBeLessThanOrEqual(1050);
    // 후처리가 만든 x 실단어 조각 ≥2자 — ⑦ 조각을 jieba가 홀로 다시 가르면 여기 잡힌다. 실측 0(胡说·恩人은 raw x라 방벽 몫), 상한 5.
    expect(stat.fallbackX).toBeLessThanOrEqual(5);
  }, 120000);
});
