// 콘텐츠 병음 경성 게이트 — 오너 결정 2026-09-02 「추천대로」(분석기 라운드 7 보고의 콘텐츠 후보 이행).
//
// 라운드 7의 정답지 전수 대조에서 「사전·라이브러리가 경성으로 내고 정답지가 원조로 적는」 자리가 남았다(≈40줄).
// 분석기 쪽이 맞다 — pinyin-pro와 CEDICT가 함께 경성이거나(任务 rèn·wu) 구조 규칙(경험상 过·가능보어 가운데 不·得)이다.
// 그래서 성조 변조 통일(zh-sandhi.mjs)과 같은 방식으로 콘텐츠를 맞춘다: 규칙 정본은 여기, lint-curriculum.mjs가
// 부르고, 위반은 오류. 표는 오너가 승인한 항목으로 닫혀 있다 — 넓히려면 실측(정답지 대조 수치)과 함께.
//
// ① 필독 경성 어휘 — 둘째 음절 경성. 정답지가 원조로 적던 것만(任务 ×9·队伍·答应·聪明·尾巴·衣服·眼睛·码头·耽误·下巴).
// ② 가능보어 가운데 不·得 — 경성(看得见 kàn de jiàn·放不下 fàng bu xià·看不见).
// ③ 경험상 过 — 앞 글자가 닫힌 동사 목록이고 뒤가 방향보어·복합어 머리(过来·过去·过年·过程…)가 아니면 guo.
//    穿过(통과)·走过·爬过·错过·度过·经过·通过는 목록 밖 — 원조 guò가 맞는 자리라 애초에 안 본다.

import { syllabify } from './zh-sandhi.mjs';

const HAN = /[一-鿿]/;
const BARE = {ā:'a',á:'a',ǎ:'a',à:'a',ē:'e',é:'e',ě:'e',è:'e',ī:'i',í:'i',ǐ:'i',ì:'i',ō:'o',ó:'o',ǒ:'o',ò:'o',ū:'u',ú:'u',ǔ:'u',ù:'u',ǖ:'ü',ǘ:'ü',ǚ:'ü',ǜ:'ü'};
const bare = (s) => [...s].map((c) => BARE[c] ?? c).join('').toLowerCase();
const cap = (cur, t) => (cur[0] === cur[0].toUpperCase() && cur[0] !== cur[0].toLowerCase()) ? t[0].toUpperCase() + t.slice(1) : t;

export const NEUTRAL_WORDS = {
  任务: 'rèn wu', 队伍: 'duì wu', 答应: 'dā ying', 聪明: 'cōng ming', 尾巴: 'wěi ba',
  衣服: 'yī fu', 眼睛: 'yǎn jing', 码头: 'mǎ tou', 耽误: 'dān wu', 下巴: 'xià ba',
};
export const COMPLEMENT_WORDS = { 看得见: 'kàn de jiàn', 放不下: 'fàng bu xià', 看不见: 'kàn bu jiàn' };
export const GUO_VERBS = new Set([...'去看吃来听见学用试住玩读做想说写坐喝找问睡买到谈教练查']);
const GUO_NEXT_KEEP = new Set([...'来去年节程分期敏度时后头失错世关']);

const PUNCT_L = /^[^A-Za-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]*/i;
const PUNCT_R = /[^A-Za-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]*$/i;

/** zh 글자 ↔ 병음 음절 정렬(zh-sandhi.mjs와 같은 규약). 정렬이 안 되면 null. */
export function alignPinyin(zh, py) {
  if (/[A-Za-z]/.test(zh)) return null;
  const chars = [...zh].filter((c) => HAN.test(c));
  const syls = [];
  for (const part of py.split(/\s+/)) {
    if (!part) continue;
    const lead = part.match(PUNCT_L)[0];
    const tail = part.slice(lead.length).match(PUNCT_R)[0];
    const core = part.slice(lead.length, part.length - tail.length);
    const sy = syllabify(core);
    if (sy.join('') !== core) return null;
    syls.push(...sy);
  }
  if (syls.length !== chars.length) return null;
  return { chars, syls };
}

/** i번째 글자의 목표 표기. null이면 손대지 않는다. 음절 base가 다르면(다른 독음) 절대 손대지 않는다. */
export function neutralTarget(chars, syls, i) {
  const cur = syls[i];
  const want = (t) => (bare(cur) === bare(t) && cur !== cap(cur, t) ? cap(cur, t) : null);
  // ① 필독 경성 어휘 — 둘째 글자 자리
  if (i > 0) {
    const w2 = chars[i - 1] + chars[i];
    if (NEUTRAL_WORDS[w2]) return want(NEUTRAL_WORDS[w2].split(' ')[1]);
  }
  // ② 가능보어 — 가운데 글자 자리
  if (i > 0 && i + 1 < chars.length) {
    const w3 = chars[i - 1] + chars[i] + chars[i + 1];
    if (COMPLEMENT_WORDS[w3]) return want(COMPLEMENT_WORDS[w3].split(' ')[1]);
  }
  // ③ 경험상 过
  if (chars[i] === '过' && i > 0 && GUO_VERBS.has(chars[i - 1]) && !(chars[i + 1] && GUO_NEXT_KEEP.has(chars[i + 1]))) {
    return want('guo');
  }
  return null;
}

export function neutralViolations(zh, py) {
  const a = alignPinyin(zh, py);
  if (!a) return [];
  const out = [];
  for (let i = 0; i < a.chars.length; i++) {
    const t = neutralTarget(a.chars, a.syls, i);
    if (t != null) out.push({ i, char: a.chars[i], from: a.syls[i], to: t });
  }
  return out;
}
