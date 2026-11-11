import { describe, expect, it } from 'vitest';
import ZH_ERHUA from '../data/zhErhua.json';
import { tokenizeZhLine } from '../tokenizeZh';
import { applyZhErhua, isZhErhuaWord } from '../zhErhua';
import { summarizeZhPinyinChecks, verifyZhSyllables } from '../zhPinyinVerify';
import { collectZhCorpus } from './zhCorpusPinyin.test.js';

/**
 * 회귀 계약: 중국어 얼화 병음 (ZH-ERHUA 안 A — 오너 「권장대로. ㄱㄱ」 2026-11-11 KST).
 * 저장 꼴 = 글자당 한 음절 그대로, 儿 자리만 「r」(哪儿 「nǎ r」 · 一点儿 「yì diǎn r」). 붙여 쓰기(nǎr)는 화면 쪽 규칙.
 * 대상 = CC-CEDICT가 儿 자리를 r5로만 적는 낱말(data/zhErhua.json). 실음절 ér · 두 독음 낱말은 손대지 않는다.
 *   ① 목록 경계 ② 토크나이저 회귀 표 ③ 검증 패스가 얼화 토큰을 suspect로 보지 않는다 ④ 교재 정답 대조(얼화 꼴 정렬).
 */
const read = (line, word) => tokenizeZhLine(line).find((t) => t.text === word)?.furigana;

describe('① 목록 경계', () => {
  it('운영 대상 낱말은 목록 안, 실음절 ér · 두 독음 낱말은 목록 밖', () => {
    for (const w of ['哪儿', '这儿', '那儿', '一点儿', '画儿', '大伙儿', '心眼儿', '有点儿', '早点儿', '一会儿', '好玩儿', '没事儿']) expect(isZhErhuaWord(w), w).toBe(true);
    for (const w of ['女儿', '儿子', '儿童', '婴儿', '孤儿', '少儿', '胎儿', '幼儿', '健儿', '男儿', '侄儿', '花儿', '小儿', '托儿', '干儿', '猴儿', '儿']) expect(isZhErhuaWord(w), w).toBe(false);
  });
  it('목록 형식 — 정렬 · 중복 없음 · 儿로 끝나는 한자 2자 이상', () => {
    const w = ZH_ERHUA.words;
    expect(w.length).toBeGreaterThan(600);
    expect([...w].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(w);
    expect(new Set(w).size).toBe(w.length);
    expect(w.filter((x) => !/^[一-鿿]+儿$/.test(x) || [...x].length < 2)).toEqual([]);
  });
  it('applyZhErhua — 儿 자리만 r, 음절 수가 어긋나면 그대로', () => {
    expect(applyZhErhua('哪儿', ['nǎ', 'ér'])).toEqual(['nǎ', 'r']);
    expect(applyZhErhua('一点儿', ['yì', 'diǎn', 'ér'])).toEqual(['yì', 'diǎn', 'r']);
    expect(applyZhErhua('有点儿', ['yǒu', 'diǎn', 'er'])).toEqual(['yǒu', 'diǎn', 'r']);
    expect(applyZhErhua('女儿', ['nǚ', 'ér'])).toEqual(['nǚ', 'ér']);
    expect(applyZhErhua('哪儿', ['nǎér'])).toEqual(['nǎér']);
    expect(applyZhErhua('哪儿', null)).toBe(null);
  });
});

describe('② 토크나이저 회귀 표', () => {
  it.each([
    ['你去哪儿？', '哪儿', 'nǎ r'],
    ['我在这儿等你。', '这儿', 'zhè r'],
    ['那儿有很多人。', '那儿', 'nà r'],
    ['请说慢一点儿。', '一点儿', 'yì diǎn r'], // 一 변조 yì는 그대로
    ['一会儿见。', '一会儿', 'yí huì r'],      // 一 변조 yí는 그대로
    ['我有点儿累。', '有点儿', 'yǒu diǎn r'],  // 줄 병음 경성 er도 r로
    ['你早点儿睡吧。', '早点儿', 'zǎo diǎn r'],
    ['她画了一张画儿。', '画儿', 'huà r'],
    ['大伙儿都来了。', '大伙儿', 'dà huǒ r'],
    ['他心眼儿好。', '心眼儿', 'xīn yǎn r'],
    ['没事儿。', '没事儿', 'méi shì r'],
    ['我们去玩儿吧。', '玩儿', 'wán r'],
    ['我女儿五岁了。', '女儿', 'nǚ ér'],      // 실음절 ér — 그대로
    ['儿子在上学。', '儿子', 'ér zi'],
    ['儿童节快乐。', '儿童节', 'ér tóng jié'],
    ['婴儿在睡觉。', '婴儿', 'yīng ér'],
    ['他是孤儿。', '孤儿', 'gū ér'],
    ['这儿的花儿很好看。', '花儿', 'huā ér'],  // 두 독음 낱말 — 지금 값 그대로
  ])('%s %s → %s', (line, word, want) => {
    expect(read(line, word)).toBe(want);
  });
  it('음절 수 = 글자 수(얼화 토큰 포함)', () => {
    for (const line of ['你去哪儿？', '请说慢一点儿。', '我有点儿累。', '大伙儿都来了。', '我女儿五岁了。']) {
      for (const t of tokenizeZhLine(line).filter((x) => x.furigana)) expect(t.furigana.split(' ').length, t.text).toBe([...t.text].length);
    }
  });
});

describe('③ 검증 패스 — 얼화 토큰은 suspect가 아니다', () => {
  it('얼화 꼴은 ok, 옛 꼴(ér)은 낱말 단독 얼화 꼴로 fixed', () => {
    expect(verifyZhSyllables('哪儿', ['nǎ', 'r']).verdict).toBe('ok');
    expect(verifyZhSyllables('大伙儿', ['dà', 'huǒ', 'r']).verdict).toBe('ok');
    expect(verifyZhSyllables('哪儿', ['nǎ', 'ér'])).toMatchObject({ verdict: 'fixed', syllables: ['nǎ', 'r'] });
    expect(verifyZhSyllables('女儿', ['nǚ', 'ér']).verdict).toBe('ok');
  });
  it('얼화 문장 분석 — 검증 관측에 suspect · fixed 0', () => {
    const lines = ['你去哪儿？', '我在这儿等你。', '那儿有很多人。', '她画了一张画儿。', '大伙儿都来了。', '他心眼儿好。'].map(tokenizeZhLine);
    const s = summarizeZhPinyinChecks(lines);
    expect(s.suspect ?? 0).toBe(0);
    expect(s.fixed ?? 0).toBe(0);
  });
});

describe('④ 교재 정답 대조 — 얼화 꼴 정렬', () => {
  it('儿로 끝나는 다글자 토큰이 든 문장이 정답과 정렬되고, 토큰 병음이 정답(r 붙임 · r 생략 표기)과 맞는다', async () => {
    const V = 'aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
    const syl = (w) => { const out = []; let i = 0; const n = w.length; while (i < n) { let j = i; while (j < n && !V.includes(w[j])) j++; let k = j; while (k < n && V.includes(w[k])) k++; let c = k; if (c < n && w[c] === 'n') { if (c + 1 < n && w[c + 1] === 'g' && (c + 2 >= n || !V.includes(w[c + 2]))) c += 2; else if (c + 1 >= n || !V.includes(w[c + 1])) c += 1; } else if (c < n && w[c] === 'r' && (c + 1 >= n || !V.includes(w[c + 1]))) c += 1; if (k === j) break; out.push(w.slice(i, c)); i = c; } return out; };
    const gold = (py) => py.normalize('NFC').toLowerCase().replace(/v/g, 'ü').replace(/[’'\-·,，。！？?!.:;：；"“”()（）…]/g, ' ').trim().split(/\s+/).filter(Boolean).flatMap(syl);
    const st = { sentences: 0, aligned: 0, tokens: 0, exact: 0, goldNoR: 0, other: 0 };
    for (const r of await collectZhCorpus()) {
      const toks = tokenizeZhLine(r.zh).filter((t) => t.pos !== '기호' && /[一-鿿]/.test(t.text) && t.furigana);
      if (!toks.some((t) => t.text.endsWith('儿') && [...t.text].length > 1)) continue;
      st.sentences++;
      const g = gold(r.pinyin); let gi = 0; const per = [];
      for (const t of toks) {
        const ys = t.furigana.split(' ');
        const want = ys.at(-1) === 'r' && ys.length > 1 ? [...ys.slice(0, -2), `${ys.at(-2)}r`] : ys; // 정답지는 얼화를 앞 음절에 붙여 쓴다(nǎr)
        per.push([t, want, g.slice(gi, gi + want.length)]); gi += want.length;
      }
      if (gi !== g.length) continue;
      st.aligned++;
      for (const [t, want, seg] of per) {
        if (!t.text.endsWith('儿') || [...t.text].length < 2) continue;
        st.tokens++;
        if (want.join(' ') === seg.join(' ')) st.exact++;
        else if (want.join(' ').replace(/r$/, '') === seg.join(' ')) st.goldNoR++; // 정답지가 r을 생략(一点儿 yì diǎn) — 표기 관례
        else st.other++;
      }
    }
    // 실측(2026-11-11 KST): 160문장 중 정렬 159(얼화 전 9) · 토큰 162 = 정확 86 · 정답 r 생략 73 · 그 밖 3(一块儿 yí/yī · 一点儿 yì/yī · 待会儿 dài/dāi).
    expect(st.sentences).toBeGreaterThan(140);
    expect(st.aligned / st.sentences).toBeGreaterThan(0.97);
    expect(st.other).toBeLessThanOrEqual(5);
  }, 120000);
});
