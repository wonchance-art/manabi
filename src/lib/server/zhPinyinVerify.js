// 서버 전용 — 중국어 병음 검증 패스 (ZH-PINYIN-CHECK — 오너 지시 2026-11-11 「중국어 분석 후 병음 맞는지 다시 확인하는 절차」).
//
// ── 왜 필요한가
// tokenizeZhLine은 pinyin-pro에 **줄 전체**를 넣어 문맥 병음을 받는다(#1004 — 낱말 단독 호출은 변조 누락 · 오독이 더 많다:
// 교재 정답 병음 24,860문장 대조에서 「모든 다글자 토큰을 단독 호출로」 바꾸면 어긋남 1,513 → 3,017). 그런데 줄 문맥이 드물게
// **멀쩡한 낱말을 틀리게** 만든다 — 中医 zhòng · 相同 xiàng · 学校 jiào · 参与 shēn yǔ, 그리고 운영 id 372의 「被认为」 rèn wèi
// (200자 넘는 줄을 잘라 분석한 0–160 조각에서만). 이 패스는 그 「줄 문맥 오독」만 사전 둘의 합의로 되돌린다.
//
// ── 무엇을 하나 (토큰 하나, 다른 층이 손대지 않은 줄 병음에만)
//   ok       줄 병음이 CC-CEDICT 독음 후보 안에 있다(경성 차이는 낱말 단독 병음과 같을 때만 허용).
//   fixed    줄 병음이 후보 밖이고 **낱말 단독 pinyin-pro가 후보 안** — 두 원천이 합의한 단독 병음으로 바꾼다(고신뢰).
//   suspect  둘 다 후보 밖 — 바꾸지 않고 관측만 한다(분석 응답 stats.zhPinyin · 서버 로그).
//   skip     검증 밖(1자 · 一/不 포함 · 표에 없음 · 음절 수 ≠ 글자 수).
// 표 = src/lib/server/data/zhPinyinCheck.json(HSK 3.0 다글자 낱말의 CC-CEDICT 독음 — 서버 전용, 클라이언트 번들 밖이 계약).

import { pinyin } from 'pinyin-pro';
import ZH_PINYIN_CHECK from './data/zhPinyinCheck.json';
import { applyZhErhua } from './zhErhua';

const WORDS = ZH_PINYIN_CHECK.words;
const BARE = { ā: 'a', á: 'a', ǎ: 'a', à: 'a', ē: 'e', é: 'e', ě: 'e', è: 'e', ī: 'i', í: 'i', ǐ: 'i', ì: 'i', ō: 'o', ó: 'o', ǒ: 'o', ò: 'o', ū: 'u', ú: 'u', ǔ: 'u', ù: 'u', ǖ: 'ü', ǘ: 'ü', ǚ: 'ü', ǜ: 'ü' };
const bare = (s) => [...s].map((c) => BARE[c] ?? c).join('');
const toned = (s) => [...s].some((c) => BARE[c]);

/** 검증표에 그 낱말의 독음 후보가 있나(테스트 · 관측용). */
export function zhPinyinCandidates(word) {
  return WORDS[word] ?? null;
}

/**
 * 음절 배열이 후보 하나와 맞나. 정확 일치, 또는 후보가 경성인 자리에서 음절이 `citation`(낱말 단독 병음)과 같을 때만 허용
 * — 力量: 후보 lì liang · 단독 lì liàng → 「lì liàng」은 허용, 줄 문맥 오독 「lì liáng」은 거부.
 */
function accepts(syllables, readings, citation) {
  return readings.some((r) => {
    const rs = r.split(' ');
    if (rs.length !== syllables.length) return false;
    // 경성 차이 둘: 후보가 경성인 자리는 낱말 단독 병음과 같을 때만 허용(力量 lì liáng 오독 거부), 줄 병음이 경성인 자리는 허용 —
    // 줄 문맥이 일부러 낸 경성(公路上|车의 上 shang — 분절 오류 낱말)을 원조로 되돌리지 않는다(정답 대조 깨짐 1 실측).
    return rs.every((y, k) => y === syllables[k] || (bare(y) === bare(syllables[k]) && ((!toned(y) && citation?.[k] === syllables[k]) || !toned(syllables[k]))));
  });
}

/**
 * @param {string} word 토큰 표면
 * @param {string[]} syllables 줄 병음에서 이 토큰에 배분된 음절(글자당 1개)
 * @returns {{ verdict: 'ok'|'fixed'|'suspect'|'skip', syllables: string[], from?: string, candidates?: string[] }}
 */
export function verifyZhSyllables(word, syllables) {
  const chars = [...word];
  const readings = WORDS[word];
  if (chars.length < 2 || /[一不]/.test(word) || !readings || !syllables || syllables.length !== chars.length) return { verdict: 'skip', syllables };
  // 낱말 단독 병음도 얼화 꼴로 — CC-CEDICT 후보가 「nǎ r」이므로 단독 「nǎ ér」로는 합의가 안 된다(zhErhua 안 A).
  const citation = applyZhErhua(word, pinyin(word, { toneType: 'symbol', type: 'array' }));
  if (accepts(syllables, readings, citation)) return { verdict: 'ok', syllables };
  if (citation.length === chars.length && accepts(citation, readings, citation)) {
    return { verdict: 'fixed', syllables: citation, from: syllables.join(' ') };
  }
  return { verdict: 'suspect', syllables, candidates: readings };
}

/**
 * 한 요청(여러 줄)의 토큰에서 「같은 낱말이 다른 병음」 — 다글자 · 一/不 없는 토큰만. 관측 전용(바꾸지 않는다).
 * @param {Array<Array<{text:string, furigana?:string, pos?:string}>>} tokenizedLines
 * @returns {Array<{word:string, readings:string[]}>}
 */
export function inconsistentZhReadings(tokenizedLines) {
  const seen = new Map();
  for (const tokens of tokenizedLines) {
    for (const t of tokens || []) {
      if (!t?.furigana || t.pos === '기호' || [...(t.text || '')].length < 2 || /[一不]/.test(t.text)) continue;
      if (!seen.has(t.text)) seen.set(t.text, new Set());
      seen.get(t.text).add(t.furigana);
    }
  }
  return [...seen].filter(([, s]) => s.size > 1).map(([word, s]) => ({ word, readings: [...s].sort() }));
}

const STAT_CAP = 20;
/**
 * 요청 하나의 검증 관측 요약 — 분석 응답 stats.zhPinyin(zhSense · zhCuratedFills와 같은 자리)과 서버 로그가 쓴다.
 * 토큰의 열거되지 않는 표식(pinyinCheck, tokenizeZhLine이 단다)을 센다 — 저장 · 응답 토큰 모양은 그대로다.
 * @param {Array<Array<object>>} tokenizedLines
 */
export function summarizeZhPinyinChecks(tokenizedLines) {
  let fixed = 0; let suspect = 0; const suspects = []; const fixes = [];
  for (const tokens of tokenizedLines) {
    for (const t of tokens || []) {
      const c = t?.pinyinCheck;
      if (!c) continue;
      if (c.verdict === 'fixed') { fixed++; if (fixes.length < STAT_CAP) fixes.push({ word: t.text, from: c.from, to: c.to }); }
      if (c.verdict === 'suspect') { suspect++; if (suspects.length < STAT_CAP) suspects.push({ word: t.text, reading: c.to }); }
    }
  }
  return { fixed, suspect, fixes, suspects, inconsistent: inconsistentZhReadings(tokenizedLines).slice(0, STAT_CAP) };
}
